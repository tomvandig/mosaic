import fs from "node:fs";
import path from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { LoadMosaicFile, type MosaicFile } from "../MosaicFile.ts";
import { indexOf, operationOf } from "../ComponentReference.ts";
import { FIXED_COLUMNS, planColumns, extractionFor, quoteIdentifier, type ColumnPlan } from "./SqlTypes.ts";

/**
 * The tables that hold the index of every archive put into the database. These are fixed:
 * whatever components an archive turns out to carry, its sections, nodes and references
 * are always described the same way.
 */
const FIXED_SCHEMA = [
    `CREATE TABLE IF NOT EXISTS mosaic_file (
        file_id        VARCHAR PRIMARY KEY,
        source         VARCHAR,
        mosaic_version VARCHAR,
        inserted_at    TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS mosaic_import (
        file_id   VARCHAR,
        ordinal   BIGINT,
        uri       VARCHAR,
        integrity VARCHAR
    )`,
    `CREATE TABLE IF NOT EXISTS mosaic_component_table (
        file_id  VARCHAR,
        type     VARCHAR,
        filename VARCHAR,
        format   VARCHAR,
        schema   JSON
    )`,
    `CREATE TABLE IF NOT EXISTS mosaic_section (
        file_id      VARCHAR,
        ordinal      BIGINT,
        section_id   VARCHAR,
        message      VARCHAR,
        data_version VARCHAR,
        author       VARCHAR,
        timestamp    VARCHAR,
        application  VARCHAR
    )`,
    `CREATE TABLE IF NOT EXISTS mosaic_node (
        file_id         VARCHAR,
        section_ordinal BIGINT,
        node_ordinal    BIGINT,
        node_id         VARCHAR
    )`,
    `CREATE TABLE IF NOT EXISTS mosaic_component_ref (
        file_id         VARCHAR,
        section_ordinal BIGINT,
        node_id         VARCHAR,
        ordinal         BIGINT,
        type            VARCHAR,
        ref_id          VARCHAR,
        idx             BIGINT,
        operation       VARCHAR
    )`,
];

export interface InsertOptions {
    /** How this archive is named in the database. Defaults to the file name. */
    fileId?: string;
}

export interface InsertResult {
    fileId: string;
    source: string;
    sections: number;
    nodes: number;
    references: number;
    /** Rows written per component type. */
    components: Record<string, number>;
    /** Component tables created by this insert, as opposed to appended to. */
    tablesCreated: string[];
    warnings: string[];
}

type Row = Record<string, unknown>;

/** A database of Mosaic archives. Rows are only ever appended. */
export class MosaicDatabase {
    private constructor(
        private readonly instance: DuckDBInstance,
        private readonly connection: DuckDBConnection,
        readonly path: string,
    ) {}

    /**
     * Opens a database, creating both the file and the fixed tables if they are not there,
     * so the same call makes a new database or adds to an existing one.
     */
    static async open(databasePath: string): Promise<MosaicDatabase> {
        if (databasePath !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });

        const instance = await DuckDBInstance.create(databasePath);
        const connection = await instance.connect();

        for (const statement of FIXED_SCHEMA) await connection.run(statement);

        return new MosaicDatabase(instance, connection, databasePath);
    }

    /** Runs a query and returns its rows, with DuckDB's BIGINTs as ordinary numbers. */
    async all(sql: string): Promise<Row[]> {
        const reader = await this.connection.runAndReadAll(sql);
        return reader.getRowObjects().map(row =>
            Object.fromEntries(Object.entries(row).map(([key, value]) => [key, plain(value)])));
    }

    async close(): Promise<void> {
        this.connection.closeSync();
        this.instance.closeSync();
    }

    /** The component types the database holds, and how many rows of each. */
    async componentTypes(): Promise<Array<{ type: string; rows: number }>> {
        const types = await this.all(`SELECT DISTINCT type FROM mosaic_component_table ORDER BY type`);
        const out: Array<{ type: string; rows: number }> = [];

        for (const { type } of types as Array<{ type: string }>) {
            const [count] = await this.all(`SELECT count(*) AS n FROM ${quoteIdentifier(type)}`);
            out.push({ type, rows: Number(count?.n ?? 0) });
        }

        return out;
    }

    /** Reads an archive and appends it. Nothing already in the database is touched. */
    async insertArchive(archivePath: string, options: InsertOptions = {}): Promise<InsertResult> {
        if (!fs.existsSync(archivePath)) throw new Error(`File ${archivePath} does not exist`);

        const source = path.resolve(archivePath);
        const file = await LoadMosaicFile(fs.readFileSync(source));

        return await this.insertFile(file, options.fileId ?? path.basename(source).split(".")[0]!, source);
    }

    /** Appends an already-loaded file. */
    async insertFile(file: MosaicFile, fileId: string, source = ""): Promise<InsertResult> {
        const warnings: string[] = [];
        const id = await this.uniqueFileId(fileId);

        await this.connection.run("BEGIN TRANSACTION");
        try {
            const result = await this.write(file, id, source, warnings);
            await this.connection.run("COMMIT");
            return result;
        } catch (error) {
            await this.connection.run("ROLLBACK");
            throw error;
        }
    }

    // -----------------------------------------------------------------------

    /** Archives are appended, so a name already taken gets a suffix rather than a clash. */
    private async uniqueFileId(wanted: string): Promise<string> {
        const taken = new Set((await this.all(`SELECT file_id FROM mosaic_file`)).map(row => String(row.file_id)));
        if (!taken.has(wanted)) return wanted;

        for (let n = 2; ; n++) {
            const candidate = `${wanted}#${n}`;
            if (!taken.has(candidate)) return candidate;
        }
    }

    /** Runs a statement with one JSON document bound to it. */
    private async runWithJson(sql: string, payload: unknown): Promise<void> {
        const statement = await this.connection.prepare(sql);
        statement.bindVarchar(1, JSON.stringify(payload));
        await statement.run();
    }

    private async write(file: MosaicFile, fileId: string, source: string, warnings: string[]): Promise<InsertResult> {
        await this.runWithJson(
            `INSERT INTO mosaic_file
             SELECT json_extract_string(j, '$.row.file_id'), json_extract_string(j, '$.row.source'),
                    json_extract_string(j, '$.row.version'), now()
             FROM (SELECT ?::JSON AS j)`,
            { row: { file_id: fileId, source, version: file.index.header.MosaicVersion } },
        );

        for (const [ordinal, entry] of file.index.imports.entries()) {
            await this.runWithJson(
                `INSERT INTO mosaic_import
                 SELECT json_extract_string(j, '$.row.file_id'), json_extract(j, '$.row.ordinal')::BIGINT,
                        json_extract_string(j, '$.row.uri'), json_extract_string(j, '$.row.integrity')
                 FROM (SELECT ?::JSON AS j)`,
                { row: { file_id: fileId, ordinal, uri: entry.uri, integrity: entry.integrity ?? null } },
            );
        }

        // --- component tables, built from the schemas the archive carries --------
        const tablesCreated: string[] = [];
        const inserters = new Map<string, string>();

        for (const table of file.index.componentTables) {
            const type = table.filename.replace(/\.ndjson$/i, "");
            const created = await this.ensureComponentTable(type, table.schema, warnings);
            if (created) tablesCreated.push(type);
            inserters.set(type, this.insertStatementFor(type, table.schema, warnings));

            await this.runWithJson(
                `INSERT INTO mosaic_component_table
                 SELECT json_extract_string(j, '$.row.file_id'), json_extract_string(j, '$.row.type'),
                        json_extract_string(j, '$.row.filename'), json_extract_string(j, '$.row.format'),
                        json_extract(j, '$.row.schema')
                 FROM (SELECT ?::JSON AS j)`,
                { row: { file_id: fileId, type, filename: table.filename, format: table.type, schema: table.schema ?? null } },
            );
        }

        // --- the component rows themselves ---------------------------------------
        const components: Record<string, number> = {};

        for (const [type, rows] of file.serializedComponents) {
            if (!inserters.has(type)) {
                // Rows for a type the index never declared: keep them, with no columns
                // beyond the fixed ones, rather than dropping data on the floor.
                warnings.push(`component type "${type}" has rows but no table entry, so it was stored without columns`);
                if (await this.ensureComponentTable(type, undefined, warnings)) tablesCreated.push(type);
                inserters.set(type, this.insertStatementFor(type, undefined, warnings));
            }

            const sql = inserters.get(type)!;
            let written = 0;

            for (const [index, line] of rows.entries()) {
                if (line.trim().length === 0) continue;
                await this.runWithJson(sql, { file_id: fileId, idx: index, row: JSON.parse(line) });
                written++;
            }

            components[type] = written;
        }

        // --- sections, nodes and references --------------------------------------
        let nodeCount = 0;
        let referenceCount = 0;

        for (const [sectionOrdinal, section] of file.index.sections.entries()) {
            await this.runWithJson(
                `INSERT INTO mosaic_section
                 SELECT json_extract_string(j, '$.row.file_id'), json_extract(j, '$.row.ordinal')::BIGINT,
                        json_extract_string(j, '$.row.section_id'), json_extract_string(j, '$.row.message'),
                        json_extract_string(j, '$.row.data_version'), json_extract_string(j, '$.row.author'),
                        json_extract_string(j, '$.row.timestamp'), json_extract_string(j, '$.row.application')
                 FROM (SELECT ?::JSON AS j)`,
                {
                    row: {
                        file_id: fileId, ordinal: sectionOrdinal, section_id: section.header.id,
                        message: section.header.message, data_version: section.header.dataVersion,
                        author: section.header.author, timestamp: section.header.timestamp,
                        application: section.header.application,
                    },
                },
            );

            for (const [nodeOrdinal, node] of section.nodes.entries()) {
                await this.runWithJson(
                    `INSERT INTO mosaic_node
                     SELECT json_extract_string(j, '$.row.file_id'), json_extract(j, '$.row.section_ordinal')::BIGINT,
                            json_extract(j, '$.row.node_ordinal')::BIGINT, json_extract_string(j, '$.row.node_id')
                     FROM (SELECT ?::JSON AS j)`,
                    { row: { file_id: fileId, section_ordinal: sectionOrdinal, node_ordinal: nodeOrdinal, node_id: node.id } },
                );
                nodeCount++;

                for (const [ordinal, reference] of (node.components ?? []).entries()) {
                    await this.runWithJson(
                        `INSERT INTO mosaic_component_ref
                         SELECT json_extract_string(j, '$.row.file_id'), json_extract(j, '$.row.section_ordinal')::BIGINT,
                                json_extract_string(j, '$.row.node_id'), json_extract(j, '$.row.ordinal')::BIGINT,
                                json_extract_string(j, '$.row.type'), json_extract_string(j, '$.row.ref_id'),
                                json_extract(j, '$.row.idx')::BIGINT, json_extract_string(j, '$.row.operation')
                         FROM (SELECT ?::JSON AS j)`,
                        {
                            row: {
                                file_id: fileId, section_ordinal: sectionOrdinal, node_id: node.id, ordinal,
                                type: reference.type, ref_id: reference.id,
                                // The defaults are resolved here, so a query never has to
                                // remember that an absent index means -1.
                                idx: indexOf(reference), operation: operationOf(reference),
                            },
                        },
                    );
                    referenceCount++;
                }
            }
        }

        return {
            fileId, source,
            sections: file.index.sections.length,
            nodes: nodeCount,
            references: referenceCount,
            components, tablesCreated, warnings,
        };
    }

    /** Creates a component type's table, or widens it if a later archive knows more. */
    private async ensureComponentTable(type: string, schema: unknown, warnings: string[]): Promise<boolean> {
        const table = quoteIdentifier(type);
        const columns = planColumns(schema as Record<string, any>, message => warnings.push(`${type}: ${message}`));

        const existing = await this.all(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = 'main' AND table_name = '${type.replace(/'/g, "''")}'`,
        );

        if (existing.length === 0) {
            const declarations = [
                `${quoteIdentifier(FIXED_COLUMNS.fileId)} VARCHAR`,
                `${quoteIdentifier(FIXED_COLUMNS.index)} BIGINT`,
                ...columns.map(column => `${quoteIdentifier(column.name)} ${column.sqlType}`),
                `${quoteIdentifier(FIXED_COLUMNS.value)} JSON`,
            ];
            await this.connection.run(`CREATE TABLE ${table} (${declarations.join(", ")})`);
            return true;
        }

        // The same type can arrive from another archive whose schema has grown.
        const present = new Set(existing.map(row => String(row.column_name)));
        for (const column of columns) {
            if (present.has(column.name)) continue;
            await this.connection.run(`ALTER TABLE ${table} ADD COLUMN ${quoteIdentifier(column.name)} ${column.sqlType}`);
            warnings.push(`${type}: added column "${column.name}", which an earlier archive did not declare`);
        }

        return false;
    }

    /** The INSERT for one component type, reading each column out of the bound row. */
    private insertStatementFor(type: string, schema: unknown, warnings: string[]): string {
        const columns = planColumns(schema as Record<string, any>, message => warnings.push(`${type}: ${message}`));

        const names = [
            quoteIdentifier(FIXED_COLUMNS.fileId),
            quoteIdentifier(FIXED_COLUMNS.index),
            ...columns.map(column => quoteIdentifier(column.name)),
            quoteIdentifier(FIXED_COLUMNS.value),
        ];

        const values = [
            `json_extract_string(j, '$.file_id')`,
            `json_extract(j, '$.idx')::BIGINT`,
            ...columns.map((column: ColumnPlan) => extractionFor(column, "j")),
            `json_extract(j, '$.row')`,
        ];

        return `INSERT INTO ${quoteIdentifier(type)} (${names.join(", ")})
                SELECT ${values.join(", ")} FROM (SELECT ?::JSON AS j)`;
    }
}

/** DuckDB hands back BIGINTs as BigInt and lists as objects; queries read better without. */
function plain(value: unknown): unknown {
    if (typeof value === "bigint") return Number(value);
    if (value && typeof value === "object" && "items" in (value as Record<string, unknown>)) {
        return (value as { items: unknown[] }).items.map(plain);
    }
    return value;
}

/** Builds a database from one or more archives, creating it if it is not there. */
export async function exportArchivesToDatabase(
    archivePaths: string[],
    databasePath: string,
): Promise<{ database: MosaicDatabase; inserted: InsertResult[] }> {
    const database = await MosaicDatabase.open(databasePath);
    const inserted: InsertResult[] = [];

    for (const archivePath of archivePaths) inserted.push(await database.insertArchive(archivePath));

    return { database, inserted };
}
