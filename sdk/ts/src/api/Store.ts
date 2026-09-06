import { MosaicDatabase } from "../duckdb/Export.ts";
import { LoadMosaicFile, WriteMosaicFile, type MosaicFile } from "../MosaicFile.ts";
import { federate } from "../MosaicFileOperations.ts";
import { readMosaicFile } from "../duckdb/Import.ts";
import { selectNodesFromDatabase } from "../duckdb/SelectFromDatabase.ts";
import type { SelectionResult } from "../Selection.ts";
import { selectNodes, type SelectionRequest } from "../Selection.ts";
import { mosaicToGltf } from "../composition/MosaicToGltf.ts";
import { writeGlb } from "../composition/GlbWriter.ts";
import type {
    BlobResponse, CreateTesseraCommand, CreateTesseraVersionCommand, CreateTesseraVersionResponse,
    TesseraDetails, TesseraStatus, TesseraVersion, MosaicProvenanceData,
} from "./MosaicApiTypes.ts";
import { CreateTesseraVersionResponseState, MosaicFileDownloadType, NodeFetchFormat } from "./MosaicApiTypes.ts";

/**
 * The tables the API keeps beside the ones an archive is loaded into.
 *
 * Everything the API holds is in the database and nothing is on disk. Tesserae and their
 * versions are its own bookkeeping; `api_blob` holds the bytes that move in and out, which
 * are the only bytes kept as bytes. The content of a version is not among them: an
 * uploaded archive is unpacked into the component tables, and every answer is built back
 * out of those.
 *
 * The component tables themselves are not declared here. Which component types a database
 * holds is not known until an archive arrives carrying them, so each one is created when
 * it is first seen, from the schema the archive supplies -- see
 * `MosaicDatabase.ensureComponentTable`.
 */
const API_SCHEMA = [
    `CREATE TABLE IF NOT EXISTS api_tessera (
        tessera_id VARCHAR PRIMARY KEY,
        name       VARCHAR,
        created_at TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS api_tessera_version (
        tessera_id          VARCHAR,
        version_id          VARCHAR,
        previous_version_id VARCHAR,
        blob_id             VARCHAR,
        file_id             VARCHAR,
        ordinal             BIGINT,
        author              VARCHAR,
        timestamp           VARCHAR,
        application         VARCHAR,
        message             VARCHAR,
        created_at          TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS api_blob (
        blob_id     VARCHAR PRIMARY KEY,
        tessera_id  VARCHAR,
        bytes       BLOB,
        byte_length BIGINT,
        created_at  TIMESTAMP
    )`,
];

/** What a node fetch answers with: the bytes, and enough to say what is in them. */
export interface BuiltNodes {
    bytes: Uint8Array;
    contentType: string;
    nodeCount: number;
    /** Meshes in the answer, for a glb. Absent for a tsr, which is not drawn. */
    meshCount?: number;
    missing: string[];
}

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

export interface VersionRef {
    tesseraId: string;
    versionId: string;
}

/** One archive in a scope, and the version it came from. */
export interface ScopeEntry extends VersionRef {
    /** The archive this version became, as it is named in the database. */
    fileId: string;
    /** The tessera's name, which is also what an import names it by. */
    name: string;
    /** True when nothing asked for it: it is here because something imports it. */
    imported: boolean;
}

/** The archives a question is answered from, once imports have been followed. */
export interface ResolvedScope {
    /** In layering order: an import comes before whatever imports it. */
    entries: ScopeEntry[];
    /** Imports that could not be followed, said rather than silently dropped. */
    warnings: string[];
}

/**
 * The tessera name an import uri points at: `../lib/helmet.tsr?v=2` -> `helmet`.
 *
 * An import names an archive, and this server holds archives as tesserae, so the file
 * name is the link between the two. It is a convention of this server rather than
 * anything the format says -- a uri that names nothing published here stays unresolved,
 * and is reported.
 */
export function importedTesseraName(uri: string): string {
    const withoutQuery = uri.split(/[?#]/)[0] ?? "";
    const last = withoutQuery.split(/[\\/]/).filter(part => part.length > 0).at(-1) ?? "";
    return decodeURIComponent(last).replace(/\.tsr$/i, "").toLowerCase();
}

/**
 * The API's data, kept in a Mosaic DuckDB database.
 *
 * Blob bytes are a column like everything else. They are what an upload arrives as and
 * what a download is handed, and nothing else reads them: a version's content is in the
 * component tables by the time any question is asked of it.
 */
export class ApiStore {
    private constructor(
        private readonly database: MosaicDatabase,
        readonly databasePath: string,
    ) {}

    static async open(databasePath: string): Promise<ApiStore> {
        const database = await MosaicDatabase.open(databasePath);
        for (const statement of API_SCHEMA) await database.run(statement);

        return new ApiStore(database, databasePath);
    }

    async close(): Promise<void> {
        await this.database.close();
    }

    /** For queries the API does not cover; the database is the same one archives go into. */
    async all(sql: string): Promise<Array<Record<string, unknown>>> {
        return await this.database.all(sql);
    }

    // --- blobs --------------------------------------------------------------

    /** True when bytes have been uploaded under that id. */
    async hasBlob(blobId: string): Promise<boolean> {
        const [row] = await this.database.all(
            `SELECT byte_length FROM api_blob WHERE blob_id = ${literal(blobId)} AND bytes IS NOT NULL`);
        return row !== undefined;
    }

    /**
     * The bytes stored under a blob id.
     *
     * They come back through base64 rather than as a BLOB value: it is the one
     * representation that is unambiguous on the way out, whatever the driver wraps a
     * BLOB in.
     */
    async readBlob(blobId: string): Promise<Buffer> {
        const [row] = await this.database.all(
            `SELECT to_base64(bytes) AS encoded FROM api_blob
             WHERE blob_id = ${literal(blobId)} AND bytes IS NOT NULL`);
        if (!row) throw new NotFound(`No blob ${blobId}`);

        return Buffer.from(String(row.encoded), "base64");
    }

    /**
     * Drops the bytes of every blob, keeping the rows that name them.
     *
     * This is what a sweep of old uploads would do. Nothing the API answers should notice:
     * a version's content lives in the component tables, not in the archive it arrived in.
     */
    async forgetBlobs(): Promise<void> {
        await this.database.run(`UPDATE api_blob SET bytes = NULL, byte_length = 0`);
    }

    /** Records a blob the API handed out an upload url for, with nothing in it yet. */
    async reserveBlob(blobId: string, tesseraId: string): Promise<void> {
        await this.insert(
            `INSERT INTO api_blob
             SELECT json_extract_string(j, '$.row.blob_id'), json_extract_string(j, '$.row.tessera_id'),
                    NULL, 0, now()
             FROM (SELECT ?::JSON AS j)`,
            { row: { blob_id: blobId, tessera_id: tesseraId } },
        );
    }

    /** Stores bytes under a blob id, in the database. */
    async writeBlob(blobId: string, bytes: Buffer): Promise<void> {
        const known = await this.database.all(
            `SELECT blob_id FROM api_blob WHERE blob_id = ${literal(blobId)}`);

        // Binary rides in as base64 and is decoded by DuckDB, so the one bound parameter
        // every insert here uses stays a string.
        if (known.length === 0) {
            await this.insert(
                `INSERT INTO api_blob
                 SELECT json_extract_string(j, '$.row.blob_id'), NULL,
                        from_base64(json_extract_string(j, '$.row.bytes')),
                        json_extract(j, '$.row.byte_length')::BIGINT, now()
                 FROM (SELECT ?::JSON AS j)`,
                { row: { blob_id: blobId, bytes: bytes.toString("base64"), byte_length: bytes.byteLength } },
            );
            return;
        }

        const statement = `UPDATE api_blob
                           SET bytes = from_base64(json_extract_string(?::JSON, '$.bytes')),
                               byte_length = ${bytes.byteLength}
                           WHERE blob_id = ${literal(blobId)}`;
        await this.database.runWithJsonPayload(statement, { bytes: bytes.toString("base64") });
    }

    // --- tesserae -----------------------------------------------------------

    async listTesserae(): Promise<TesseraStatus[]> {
        const rows = await this.database.all(
            `SELECT m.tessera_id, m.name,
                    (SELECT v.version_id FROM api_tessera_version v
                      WHERE v.tessera_id = m.tessera_id ORDER BY v.ordinal DESC LIMIT 1) AS latest
             FROM api_tessera m
             ORDER BY m.created_at, m.tessera_id`);

        return rows.map(row => ({
            id: String(row.tessera_id),
            name: String(row.name ?? ""),
            latestVersion: row.latest === null || row.latest === undefined ? "" : String(row.latest),
        }));
    }

    async createTessera(command: CreateTesseraCommand): Promise<void> {
        if (!command?.id || !command?.name) throw new BadRequest(`A tessera needs an id and a name`);

        const existing = await this.database.all(
            `SELECT tessera_id FROM api_tessera WHERE tessera_id = ${literal(command.id)}`);
        if (existing.length > 0) throw new BadRequest(`A tessera with id ${command.id} already exists`);

        await this.insert(
            `INSERT INTO api_tessera
             SELECT json_extract_string(j, '$.row.tessera_id'), json_extract_string(j, '$.row.name'), now()
             FROM (SELECT ?::JSON AS j)`,
            { row: { tessera_id: command.id, name: command.name } },
        );
    }

    async getTessera(tesseraId: string): Promise<TesseraDetails> {
        const [tessera] = await this.database.all(
            `SELECT tessera_id, name FROM api_tessera WHERE tessera_id = ${literal(tesseraId)}`);
        if (!tessera) throw new NotFound(`No tessera ${tesseraId}`);

        return {
            id: String(tessera.tessera_id),
            name: String(tessera.name ?? ""),
            history: await this.versionsOf(tesseraId),
        };
    }

    async deleteTessera(tesseraId: string): Promise<void> {
        const [tessera] = await this.database.all(
            `SELECT tessera_id FROM api_tessera WHERE tessera_id = ${literal(tesseraId)}`);
        if (!tessera) throw new NotFound(`No tessera ${tesseraId}`);

        // The blobs stay: they are content, and another version may name the same one.
        await this.database.run(`DELETE FROM api_tessera_version WHERE tessera_id = ${literal(tesseraId)}`);
        await this.database.run(`DELETE FROM api_tessera WHERE tessera_id = ${literal(tesseraId)}`);
    }

    // --- versions -----------------------------------------------------------

    async versionsOf(tesseraId: string): Promise<TesseraVersion[]> {
        const rows = await this.database.all(
            `SELECT tessera_id, version_id, previous_version_id, author, timestamp, application, message
             FROM api_tessera_version WHERE tessera_id = ${literal(tesseraId)} ORDER BY ordinal`);

        return rows.map(row => ({
            tesseraId: String(row.tessera_id),
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

    async getVersion(tesseraId: string, versionId: string): Promise<TesseraVersion> {
        const versions = await this.versionsOf(tesseraId);
        const version = versions.find(candidate => candidate.versionId === versionId);
        if (!version) throw new NotFound(`Tessera ${tesseraId} has no version ${versionId}`);
        return version;
    }

    /** The id of the version a new one has to follow, or "" when there is none yet. */
    async latestVersionId(tesseraId: string): Promise<string> {
        const [row] = await this.database.all(
            `SELECT version_id FROM api_tessera_version WHERE tessera_id = ${literal(tesseraId)}
             ORDER BY ordinal DESC LIMIT 1`);
        return row ? String(row.version_id) : "";
    }

    /**
     * Adds a version, if it follows the one the tessera is actually on and its blob holds a
     * readable archive. Both checks answer with a state rather than an error, because
     * being out of date is an ordinary thing for a client to be.
     */
    async createVersion(tesseraId: string, command: CreateTesseraVersionCommand): Promise<CreateTesseraVersionResponse> {
        const [tessera] = await this.database.all(
            `SELECT tessera_id FROM api_tessera WHERE tessera_id = ${literal(tesseraId)}`);
        if (!tessera) throw new NotFound(`No tessera ${tesseraId}`);

        if (!command?.id || !command?.blobId) {
            return { state: CreateTesseraVersionResponseState.ValidationError, validationErrors: ["id and blobId are required"] };
        }

        const latest = await this.latestVersionId(tesseraId);
        const claimed = command.previousTesseraVersionId ?? "";
        if (claimed !== latest) {
            return {
                state: CreateTesseraVersionResponseState.OutOfDate,
                validationErrors: [`The tessera is on version ${latest || "(none)"}, not ${claimed || "(none)"}`],
            };
        }

        const validationErrors: string[] = [];
        let file: MosaicFile | undefined;

        if (!(await this.hasBlob(command.blobId))) {
            validationErrors.push(`Blob ${command.blobId} has not been uploaded`);
        } else {
            try {
                // The one place an uploaded archive is read: unpacking it into the
                // component tables is how its content gets into the database at all.
                file = await LoadMosaicFile(await this.readBlob(command.blobId));
            } catch (error) {
                validationErrors.push(`Blob ${command.blobId} is not a readable Mosaic archive: ${messageOf(error)}`);
            }
        }

        if (validationErrors.length > 0) {
            return { state: CreateTesseraVersionResponseState.ValidationError, validationErrors };
        }

        // The provenance of the newest section is the provenance of the version.
        const header = file!.index.sections.at(-1)?.header;
        const provenance: MosaicProvenanceData = {
            author: header?.author ?? "",
            timestamp: header?.timestamp ?? "",
            application: header?.application ?? "",
            message: header?.message ?? "",
        };

        // The archive goes into the database before the version row, so the row can record
        // what it is called there. Every later read goes through that name, never the blob.
        const stored = await this.database.insertFile(file!, `${tesseraId}/${command.id}`, `blob:${command.blobId}`);

        await this.insert(
            `INSERT INTO api_tessera_version
             SELECT json_extract_string(j, '$.row.tessera_id'), json_extract_string(j, '$.row.version_id'),
                    json_extract_string(j, '$.row.previous_version_id'), json_extract_string(j, '$.row.blob_id'),
                    json_extract_string(j, '$.row.file_id'), json_extract(j, '$.row.ordinal')::BIGINT,
                    json_extract_string(j, '$.row.author'), json_extract_string(j, '$.row.timestamp'),
                    json_extract_string(j, '$.row.application'), json_extract_string(j, '$.row.message'), now()
             FROM (SELECT ?::JSON AS j)`,
            {
                row: {
                    tessera_id: tesseraId, version_id: command.id,
                    previous_version_id: claimed, blob_id: command.blobId,
                    file_id: stored.fileId,
                    ordinal: (await this.versionsOf(tesseraId)).length,
                    ...provenance,
                },
            },
        );

        return { state: CreateTesseraVersionResponseState.Ok, validationErrors: [] };
    }

    /**
     * The names, in the database, of the archives making up a tessera's history up to and
     * including one version.
     */
    private async archivesUpTo(tesseraId: string, versionId: string): Promise<string[]> {
        const rows = await this.database.all(
            `SELECT version_id, file_id FROM api_tessera_version
             WHERE tessera_id = ${literal(tesseraId)} ORDER BY ordinal`);

        const names: string[] = [];
        for (const row of rows) {
            if (row.file_id) names.push(String(row.file_id));
            if (String(row.version_id) === versionId) return names;
        }

        throw new NotFound(`Tessera ${tesseraId} has no version ${versionId}`);
    }

    /**
     * Reads a version back out of the database.
     *
     * This is the only way anything here reads content. The blob a version was published
     * from is not consulted: blobs exist to carry bytes in and out, they are not storage,
     * and by the time a question is asked the blob may be long gone. What the archive
     * held is in the database, which is what answers.
     */
    private async versionFile(tesseraId: string, versionId: string): Promise<MosaicFile> {
        await this.getVersion(tesseraId, versionId);
        const [name] = await this.archivesUpTo(tesseraId, versionId).then(names => names.slice(-1));
        if (!name) throw new NotFound(`Version ${versionId} of tessera ${tesseraId} is not in the database`);

        return await readMosaicFile(this.database, { files: [name] });
    }

    /**
     * Builds the archive a download asks for, and returns the blob it was written to.
     *
     * Built out of the database every time, never out of the blob the version arrived in.
     * The bytes are therefore equal in content to what was published rather than equal
     * byte for byte: an archive is repacked from what it held, not handed back.
     */
    async materialiseDownload(tesseraId: string, versionId: string, type: MosaicFileDownloadType): Promise<string> {
        const history = await this.archivesUpTo(tesseraId, versionId);

        let composed: MosaicFile;
        if (type === MosaicFileDownloadType.JustThisVersion) {
            composed = await this.versionFile(tesseraId, versionId);
        } else if (type === MosaicFileDownloadType.WholeTesseraHistoryIntact) {
            // Reading the whole history at once lays every section down in order, which is
            // what keeping the history intact means.
            composed = await readMosaicFile(this.database, { files: history });
        } else {
            // Condensed: fold the versions together, dropping what is no longer leading.
            let folded: MosaicFile | undefined;
            for (const name of history) {
                const file = await readMosaicFile(this.database, { files: [name] });
                folded = folded ? federate(folded, file, false) : file;
            }
            composed = folded!;
        }

        const derived = `${tesseraId}-${versionId}-${type}`.replace(/[^A-Za-z0-9-]/g, "_");
        await this.writeBlob(derived, Buffer.from(await WriteMosaicFile(composed)));
        return derived;
    }

    /**
     * Builds a file out of some of a version's nodes, on demand.
     *
     * The subset is taken in the database: the nodes asked for, the references they carry
     * and the rows behind those are each queried by name, so the cost follows what was
     * asked for rather than the size of the version. Nothing is stored and no blob is
     * read. A glb is what a viewer opens; a tsr is the same subset as a Mosaic archive,
     * which can be published again or composed later.
     */
    async fetchNodes(
        tesseraId: string,
        versionId: string,
        format: NodeFetchFormat,
        request: SelectionRequest,
    ): Promise<BuiltNodes> {
        return await this.buildNodes([{ tesseraId, versionId }], format, request);
    }

    /** The same, over several versions read together. */
    async buildNodes(refs: VersionRef[], format: NodeFetchFormat, request: SelectionRequest): Promise<BuiltNodes> {
        const selection = await this.selectionAcross(refs, request);

        if (format === NodeFetchFormat.Tsr) {
            return {
                bytes: await WriteMosaicFile(selection.file),
                contentType: "application/octet-stream",
                nodeCount: selection.nodeIds.length,
                missing: selection.missing,
            };
        }

        const composed = mosaicToGltf(selection.file);
        return {
            bytes: writeGlb(composed.document, composed.binary),
            contentType: "model/gltf-binary",
            nodeCount: selection.nodeIds.length,
            // A selection can be entirely links -- a part whose geometry belongs to the
            // type it is-a has none of its own until inheritance is resolved -- and a
            // viewer handed a file with no meshes has nothing to say about why.
            meshCount: composed.document.meshes?.length ?? 0,
            missing: selection.missing,
        };
    }

    // --- imports ------------------------------------------------------------

    /** The uris an archive imports, in the order it lists them. */
    private async importsOf(fileId: string): Promise<string[]> {
        const rows = await this.database.all(
            `SELECT uri FROM mosaic_import WHERE file_id = ${literal(fileId)} ORDER BY ordinal`);
        return rows.map(row => String(row.uri ?? "")).filter(uri => uri.length > 0);
    }

    /**
     * The archives that answer for a set of versions: the versions themselves and,
     * underneath them, everything they import.
     *
     * An import is a reference to another archive, so a version that imports one is only
     * half a story on its own -- the nodes it points into live over there. Following the
     * imports here is what lets a selection cross that line. Each import is matched to a
     * tessera by name; a version of that tessera the caller has already named is the one
     * used, and otherwise its latest.
     *
     * Imports come out before the archive that imports them, so the importing archive
     * layers over what it imports. A tessera appears once however many times it is
     * reached, and a cycle stops rather than repeating.
     */
    async resolveScope(asked: VersionRef[]): Promise<ResolvedScope> {
        const tesserae = await this.listTesserae();
        const byName = new Map(tesserae.map(tessera => [tessera.name.toLowerCase(), tessera]));
        const byId = new Map(tesserae.map(tessera => [tessera.id, tessera]));

        // A version the caller named wins over the latest, wherever that tessera turns up.
        const pinned = new Map(asked.map(ref => [ref.tesseraId, ref.versionId]));

        const entries: ScopeEntry[] = [];
        const placed = new Set<string>();
        const visiting = new Set<string>();
        const warnings: string[] = [];

        const visit = async (ref: VersionRef): Promise<void> => {
            if (placed.has(ref.tesseraId) || visiting.has(ref.tesseraId)) return;
            visiting.add(ref.tesseraId);

            const fileId = await this.archiveOf(ref.tesseraId, ref.versionId);

            for (const uri of await this.importsOf(fileId)) {
                const target = byName.get(importedTesseraName(uri));
                if (!target) {
                    warnings.push(`import "${uri}" is not published here as a tessera, so it was left out`);
                    continue;
                }

                const versionId = pinned.get(target.id) ?? target.latestVersion;
                if (!versionId) {
                    warnings.push(`import "${uri}" names the tessera "${target.name}", which has no versions yet`);
                    continue;
                }

                await visit({ tesseraId: target.id, versionId });
            }

            visiting.delete(ref.tesseraId);
            placed.add(ref.tesseraId);
            entries.push({
                ...ref,
                fileId,
                name: byId.get(ref.tesseraId)?.name ?? "",
                imported: !pinned.has(ref.tesseraId),
            });
        };

        for (const ref of asked) await visit(ref);

        return { entries, warnings };
    }

    /** The archive a version became, as it is named in the database. */
    private async archiveOf(tesseraId: string, versionId: string): Promise<string> {
        await this.getVersion(tesseraId, versionId);
        const [name] = (await this.archivesUpTo(tesseraId, versionId)).slice(-1);
        if (!name) throw new NotFound(`Version ${versionId} of tessera ${tesseraId} is not in the database`);
        return name;
    }

    /** Takes a subset of a version, in the database, imports included. */
    async selection(tesseraId: string, versionId: string, request: SelectionRequest): Promise<SelectionResult> {
        return await this.selectionAcross([{ tesseraId, versionId }], request);
    }

    /**
     * Takes a subset of several versions at once, as one selection.
     *
     * Which is the only way to see what an import means: the archives are read together,
     * so a child reference written in one and landing in another is an ordinary link
     * rather than a dangling id.
     */
    async selectionAcross(
        refs: VersionRef[],
        request: SelectionRequest,
        resolved?: ResolvedScope,
    ): Promise<SelectionResult> {
        const scope = resolved ?? await this.resolveScope(refs);
        return await selectNodesFromDatabase(this.database, scope.entries.map(entry => entry.fileId), request);
    }

    /**
     * The nodes of a version that nothing else holds as a child -- where a tree of it
     * starts. Everything else hangs beneath one of them.
     */
    async rootNodeIds(tesseraId: string, versionId: string): Promise<string[]> {
        const [roots] = await this.rootsAcross([{ tesseraId, versionId }]);
        return roots?.nodes ?? [];
    }

    /**
     * Where the trees start, for each version asked for.
     *
     * Being a root is judged across the whole scope rather than within one archive: a
     * node that is a root of the archive it is written in stops being one as soon as
     * something that imports that archive holds it as a child. That is what makes two
     * tesserae shown together one tree instead of two.
     *
     * Only the versions asked for get roots. An archive pulled in because something
     * imports it is there to be pointed into, and shows up where it is pointed at.
     */
    async rootsAcross(
        refs: VersionRef[],
        resolved?: ResolvedScope,
    ): Promise<Array<ScopeEntry & { nodes: string[] }>> {
        const { entries } = resolved ?? await this.resolveScope(refs);
        if (entries.length === 0) return [];

        const everything = `file_id IN (${entries.map(entry => literal(entry.fileId)).join(", ")})`;
        const answer: Array<ScopeEntry & { nodes: string[] }> = [];

        for (const entry of entries) {
            if (entry.imported) continue;

            const rows = await this.database.all(
                `SELECT n.node_id, min(n.node_ordinal) AS first_seen
                 FROM mosaic_node n
                 WHERE n.file_id = ${literal(entry.fileId)}
                   AND n.node_id NOT IN (
                       SELECT ref_id FROM mosaic_component_ref
                       WHERE ${everything} AND type = 'core::child' AND operation <> 'DELETE')
                 GROUP BY n.node_id
                 ORDER BY first_seen`);

            answer.push({ ...entry, nodes: rows.map(row => String(row.node_id)) });
        }

        return answer;
    }

    /**
     * Which archive each of these nodes is written in, as far as a scope is concerned.
     *
     * A node written in more than one of them -- the same node carried by two versions --
     * is answered with the topmost, since that is the one whose writing stands.
     */
    async originsOf(fileIds: string[], nodeIds: string[]): Promise<Map<string, string>> {
        if (fileIds.length === 0 || nodeIds.length === 0) return new Map();

        const rows = await this.database.all(
            `SELECT DISTINCT node_id, file_id,
                    list_position([${fileIds.map(literal).join(", ")}], file_id) AS layer
             FROM mosaic_node
             WHERE file_id IN (${fileIds.map(literal).join(", ")})
               AND node_id IN (${nodeIds.map(literal).join(", ")})
             ORDER BY layer`);

        // Ordered bottom to top, so the last write of a node id is the topmost archive.
        const origins = new Map<string, string>();
        for (const row of rows) origins.set(String(row.node_id), String(row.file_id));

        return origins;
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
