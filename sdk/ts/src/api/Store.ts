import fs from "node:fs";
import path from "node:path";
import { MosaicDatabase } from "../duckdb/Export.ts";
import { LoadMosaicFile, WriteMosaicFile, type MosaicFile } from "../MosaicFile.ts";
import { federate } from "../MosaicFileOperations.ts";
import type {
    BlobResponse, CreateModelCommand, CreateModelVersionCommand, CreateModelVersionResponse,
    ModelDetails, ModelStatus, ModelVersion, MosaicProvenanceData,
} from "./MosaicApiTypes.ts";
import { CreateModelVersionResponseState, MosaicFileDownloadType } from "./MosaicApiTypes.ts";

/**
 * The tables the API keeps beside the ones an archive is loaded into. Models and their
 * versions are the API's own bookkeeping; the archives themselves stay as blobs, and are
 * only read when a download has to be built out of them.
 */
const API_SCHEMA = [
    `CREATE TABLE IF NOT EXISTS api_model (
        model_id   VARCHAR PRIMARY KEY,
        name       VARCHAR,
        created_at TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS api_model_version (
        model_id            VARCHAR,
        version_id          VARCHAR,
        previous_version_id VARCHAR,
        blob_id             VARCHAR,
        ordinal             BIGINT,
        author              VARCHAR,
        timestamp           VARCHAR,
        application         VARCHAR,
        message             VARCHAR,
        created_at          TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS api_blob (
        blob_id     VARCHAR PRIMARY KEY,
        model_id    VARCHAR,
        byte_length BIGINT,
        created_at  TIMESTAMP
    )`,
];

export class NotFound extends Error {
    constructor(what: string) {
        super(what);
        this.name = "NotFound";
    }
}

export class BadRequest extends Error {
    constructor(what: string) {
        super(what);
        this.name = "BadRequest";
    }
}

/**
 * The API's data, kept in a Mosaic DuckDB database.
 *
 * Blob bytes live in a directory beside the database rather than in a column: they are
 * whole archives, they are written once and read whole, and keeping them as files is what
 * lets a download be handed over without copying it through SQL.
 */
export class ApiStore {
    private constructor(
        private readonly database: MosaicDatabase,
        readonly databasePath: string,
        readonly blobDirectory: string,
    ) {}

    static async open(databasePath: string): Promise<ApiStore> {
        const database = await MosaicDatabase.open(databasePath);
        for (const statement of API_SCHEMA) await database.run(statement);

        const blobs = databasePath === ":memory:"
            ? fs.mkdtempSync(path.join(process.cwd(), ".mosaic-blobs-"))
            : `${path.resolve(databasePath)}.blobs`;
        fs.mkdirSync(blobs, { recursive: true });

        return new ApiStore(database, databasePath, blobs);
    }

    async close(): Promise<void> {
        await this.database.close();
    }

    /** For queries the API does not cover; the database is the same one archives go into. */
    async all(sql: string): Promise<Array<Record<string, unknown>>> {
        return await this.database.all(sql);
    }

    // --- blobs --------------------------------------------------------------

    blobPath(blobId: string): string {
        return path.join(this.blobDirectory, `${blobId}.tsr`);
    }

    hasBlob(blobId: string): boolean {
        return fs.existsSync(this.blobPath(blobId));
    }

    readBlob(blobId: string): Buffer {
        if (!this.hasBlob(blobId)) throw new NotFound(`No blob ${blobId}`);
        return fs.readFileSync(this.blobPath(blobId));
    }

    /** Records a blob the API handed out an upload url for. */
    async reserveBlob(blobId: string, modelId: string): Promise<void> {
        await this.insert(
            `INSERT INTO api_blob
             SELECT json_extract_string(j, '$.row.blob_id'), json_extract_string(j, '$.row.model_id'),
                    0, now()
             FROM (SELECT ?::JSON AS j)`,
            { row: { blob_id: blobId, model_id: modelId } },
        );
    }

    async writeBlob(blobId: string, bytes: Buffer): Promise<void> {
        fs.writeFileSync(this.blobPath(blobId), bytes);

        const known = await this.database.all(
            `SELECT blob_id FROM api_blob WHERE blob_id = ${literal(blobId)}`);
        if (known.length === 0) {
            await this.insert(
                `INSERT INTO api_blob
                 SELECT json_extract_string(j, '$.row.blob_id'), NULL,
                        json_extract(j, '$.row.byte_length')::BIGINT, now()
                 FROM (SELECT ?::JSON AS j)`,
                { row: { blob_id: blobId, byte_length: bytes.byteLength } },
            );
        } else {
            await this.database.run(
                `UPDATE api_blob SET byte_length = ${bytes.byteLength} WHERE blob_id = ${literal(blobId)}`);
        }
    }

    // --- models -------------------------------------------------------------

    async listModels(): Promise<ModelStatus[]> {
        const rows = await this.database.all(
            `SELECT m.model_id, m.name,
                    (SELECT v.version_id FROM api_model_version v
                      WHERE v.model_id = m.model_id ORDER BY v.ordinal DESC LIMIT 1) AS latest
             FROM api_model m
             ORDER BY m.created_at, m.model_id`);

        return rows.map(row => ({
            id: String(row.model_id),
            name: String(row.name ?? ""),
            latestVersion: row.latest === null || row.latest === undefined ? "" : String(row.latest),
        }));
    }

    async createModel(command: CreateModelCommand): Promise<void> {
        if (!command?.id || !command?.name) throw new BadRequest(`A model needs an id and a name`);

        const existing = await this.database.all(
            `SELECT model_id FROM api_model WHERE model_id = ${literal(command.id)}`);
        if (existing.length > 0) throw new BadRequest(`A model with id ${command.id} already exists`);

        await this.insert(
            `INSERT INTO api_model
             SELECT json_extract_string(j, '$.row.model_id'), json_extract_string(j, '$.row.name'), now()
             FROM (SELECT ?::JSON AS j)`,
            { row: { model_id: command.id, name: command.name } },
        );
    }

    async getModel(modelId: string): Promise<ModelDetails> {
        const [model] = await this.database.all(
            `SELECT model_id, name FROM api_model WHERE model_id = ${literal(modelId)}`);
        if (!model) throw new NotFound(`No model ${modelId}`);

        return {
            id: String(model.model_id),
            name: String(model.name ?? ""),
            history: await this.versionsOf(modelId),
        };
    }

    async deleteModel(modelId: string): Promise<void> {
        const [model] = await this.database.all(
            `SELECT model_id FROM api_model WHERE model_id = ${literal(modelId)}`);
        if (!model) throw new NotFound(`No model ${modelId}`);

        // The blobs stay: they are content, and another model version may name the same one.
        await this.database.run(`DELETE FROM api_model_version WHERE model_id = ${literal(modelId)}`);
        await this.database.run(`DELETE FROM api_model WHERE model_id = ${literal(modelId)}`);
    }

    // --- versions -----------------------------------------------------------

    async versionsOf(modelId: string): Promise<ModelVersion[]> {
        const rows = await this.database.all(
            `SELECT model_id, version_id, previous_version_id, author, timestamp, application, message
             FROM api_model_version WHERE model_id = ${literal(modelId)} ORDER BY ordinal`);

        return rows.map(row => ({
            modelId: String(row.model_id),
            versionId: String(row.version_id),
            previousVersionId: row.previous_version_id === null ? "" : String(row.previous_version_id),
            provenance: {
                author: String(row.author ?? ""),
                timestamp: String(row.timestamp ?? ""),
                application: String(row.application ?? ""),
                message: String(row.message ?? ""),
            },
        }));
    }

    async getVersion(modelId: string, versionId: string): Promise<ModelVersion> {
        const versions = await this.versionsOf(modelId);
        const version = versions.find(candidate => candidate.versionId === versionId);
        if (!version) throw new NotFound(`Model ${modelId} has no version ${versionId}`);
        return version;
    }

    /** The id of the version a new one has to follow, or "" when there is none yet. */
    async latestVersionId(modelId: string): Promise<string> {
        const [row] = await this.database.all(
            `SELECT version_id FROM api_model_version WHERE model_id = ${literal(modelId)}
             ORDER BY ordinal DESC LIMIT 1`);
        return row ? String(row.version_id) : "";
    }

    /**
     * Adds a version, if it follows the one the model is actually on and its blob holds a
     * readable archive. Both checks answer with a state rather than an error, because
     * being out of date is an ordinary thing for a client to be.
     */
    async createVersion(modelId: string, command: CreateModelVersionCommand): Promise<CreateModelVersionResponse> {
        const [model] = await this.database.all(
            `SELECT model_id FROM api_model WHERE model_id = ${literal(modelId)}`);
        if (!model) throw new NotFound(`No model ${modelId}`);

        if (!command?.id || !command?.blobId) {
            return { state: CreateModelVersionResponseState.ValidationError, validationErrors: ["id and blobId are required"] };
        }

        const latest = await this.latestVersionId(modelId);
        const claimed = command.previousModelVersionId ?? "";
        if (claimed !== latest) {
            return {
                state: CreateModelVersionResponseState.OutOfDate,
                validationErrors: [`The model is on version ${latest || "(none)"}, not ${claimed || "(none)"}`],
            };
        }

        const validationErrors: string[] = [];
        let file: MosaicFile | undefined;

        if (!this.hasBlob(command.blobId)) {
            validationErrors.push(`Blob ${command.blobId} has not been uploaded`);
        } else {
            try {
                file = await LoadMosaicFile(this.readBlob(command.blobId));
            } catch (error) {
                validationErrors.push(`Blob ${command.blobId} is not a readable Mosaic archive: ${messageOf(error)}`);
            }
        }

        if (validationErrors.length > 0) {
            return { state: CreateModelVersionResponseState.ValidationError, validationErrors };
        }

        // The provenance of the newest section is the provenance of the version.
        const header = file!.index.sections.at(-1)?.header;
        const provenance: MosaicProvenanceData = {
            author: header?.author ?? "",
            timestamp: header?.timestamp ?? "",
            application: header?.application ?? "",
            message: header?.message ?? "",
        };

        await this.insert(
            `INSERT INTO api_model_version
             SELECT json_extract_string(j, '$.row.model_id'), json_extract_string(j, '$.row.version_id'),
                    json_extract_string(j, '$.row.previous_version_id'), json_extract_string(j, '$.row.blob_id'),
                    json_extract(j, '$.row.ordinal')::BIGINT,
                    json_extract_string(j, '$.row.author'), json_extract_string(j, '$.row.timestamp'),
                    json_extract_string(j, '$.row.application'), json_extract_string(j, '$.row.message'), now()
             FROM (SELECT ?::JSON AS j)`,
            {
                row: {
                    model_id: modelId, version_id: command.id,
                    previous_version_id: claimed, blob_id: command.blobId,
                    ordinal: (await this.versionsOf(modelId)).length,
                    ...provenance,
                },
            },
        );

        // The archive also goes into the database proper, so it can be queried and composed
        // alongside every other archive without being unpacked again.
        await this.database.insertFile(file!, `${modelId}/${command.id}`, this.blobPath(command.blobId));

        return { state: CreateModelVersionResponseState.Ok, validationErrors: [] };
    }

    /**
     * Builds the archive a download asks for, and returns the blob it ended up in.
     *
     * Anything beyond the single version is federated out of the versions leading up to
     * it: intact keeps every section, condensed collapses them to what is still leading.
     */
    async materialiseDownload(modelId: string, versionId: string, type: MosaicFileDownloadType): Promise<string> {
        const version = await this.getVersion(modelId, versionId);
        const rows = await this.database.all(
            `SELECT version_id, blob_id FROM api_model_version WHERE model_id = ${literal(modelId)} ORDER BY ordinal`);

        const upTo: string[] = [];
        for (const row of rows) {
            upTo.push(String(row.blob_id));
            if (String(row.version_id) === versionId) break;
        }

        if (type === MosaicFileDownloadType.JustThisVersion) {
            const [row] = rows.filter(candidate => String(candidate.version_id) === versionId);
            return String(row!.blob_id);
        }

        const keepHistory = type === MosaicFileDownloadType.WholeModelHistoryIntact;
        let composed: MosaicFile | undefined;
        for (const blobId of upTo) {
            const file = await LoadMosaicFile(this.readBlob(blobId));
            composed = composed ? federate(composed, file, keepHistory) : file;
        }

        void version;
        const derived = `${modelId}-${versionId}-${type}`.replace(/[^A-Za-z0-9-]/g, "_");
        await this.writeBlob(derived, Buffer.from(await WriteMosaicFile(composed!)));
        return derived;
    }

    // --- helpers ------------------------------------------------------------

    private async insert(sql: string, payload: unknown): Promise<void> {
        await this.database.runWithJsonPayload(sql, payload);
    }
}

/** Builds the response for a blob the client is about to upload. */
export function blobResponse(blobId: string, baseUrl: string): BlobResponse {
    return { blobId, putURL: `${baseUrl}/Mosaic-api/upload/${blobId}` };
}

function literal(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
