import { MosaicFile } from "../MosaicFile.ts";
import { Type, type ComponentElement, type NodeElement } from "../MosaicIndexFile.ts";
import { CORE_TYPE } from "../core/schemas.ts";
import type { SelectionRequest, SelectionResult } from "../Selection.ts";
import type { MosaicDatabase } from "./Export.ts";
import { quoteIdentifier } from "./SqlTypes.ts";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function literal(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function list(values: Iterable<string>): string {
    const items = [...values].map(literal);
    return items.length > 0 ? items.join(", ") : "NULL";
}

/** Every node id mentioned anywhere inside a component's value. */
function referencedIds(value: unknown, into: Set<string>): void {
    if (typeof value === "string") {
        if (UUID.test(value)) into.add(value);
        return;
    }
    if (Array.isArray(value)) return value.forEach(entry => referencedIds(entry, into));
    if (value && typeof value === "object") {
        for (const entry of Object.values(value)) referencedIds(entry, into);
    }
}

interface Reference {
    nodeId: string;
    refId: string;
    type: string;
    index: number;
}

/**
 * Takes a subset of one archive straight out of the database.
 *
 * The same thing `selectNodes` does to a file in memory, except that nothing is
 * reconstructed to be thrown away: the nodes, their references and their component rows
 * are each asked for by name, so answering for three nodes costs three nodes rather than
 * the whole version. The collapsing a file would have done -- the last write to a
 * reference wins, and a DELETE removes it -- is done in SQL instead.
 */
export async function selectNodesFromDatabase(
    database: MosaicDatabase,
    fileId: string,
    request: SelectionRequest,
): Promise<SelectionResult> {
    const scope = `file_id = ${literal(fileId)}`;
    const wanted = request.componentTypes && request.componentTypes.length > 0
        ? new Set(request.componentTypes)
        : undefined;

    // --- which of the asked-for nodes exist ---------------------------------
    const present = new Set((await database.all(
        `SELECT DISTINCT node_id FROM mosaic_node WHERE ${scope} AND node_id IN (${list(request.nodes)})`,
    )).map(row => String(row.node_id)));

    const missing = request.nodes.filter(id => !present.has(id));
    const asked = request.nodes.filter(id => present.has(id));

    if (asked.length === 0) {
        return { file: emptyFile(), nodeIds: [], missing, pulledIn: [] };
    }

    // --- and everything beneath them, if that was asked for ------------------
    // Only child references are walked, so the recursion touches nothing else.
    const chosen: string[] = [];
    const seen = new Set<string>();
    const take = (id: string) => {
        if (seen.has(id)) return;
        seen.add(id);
        chosen.push(id);
    };

    if (request.includeChildren) {
        const seeds = asked.map(id => `(${literal(id)})`).join(", ");
        const descendants = await database.all(
            `WITH RECURSIVE ranked AS (
                 SELECT node_id, ref_id, operation,
                        row_number() OVER (PARTITION BY node_id, ref_id
                                           ORDER BY section_ordinal DESC, ordinal DESC) AS rn
                 FROM mosaic_component_ref
                 WHERE ${scope} AND type = ${literal(CORE_TYPE.child)} AND operation <> 'PASS_THROUGH'
             ),
             links AS (SELECT node_id, ref_id FROM ranked WHERE rn = 1 AND operation <> 'DELETE'),
             tree(node_id) AS (
                 SELECT node_id FROM (VALUES ${seeds}) AS seeds(node_id)
                 UNION
                 SELECT links.ref_id FROM links JOIN tree ON links.node_id = tree.node_id
             )
             SELECT node_id FROM tree`);

        for (const id of asked) take(id);
        for (const row of descendants) take(String(row.node_id));
    } else {
        for (const id of asked) take(id);
    }

    // Everything reached so far was asked for -- the seeds and, when children were
    // wanted, their descendants -- so the component filter applies to all of it. Only
    // nodes dragged in later, because something kept refers to them, keep everything.
    const askedFor = new Set(chosen);

    /**
     * The references a set of nodes carries, after collapsing: a PASS_THROUGH changes
     * nothing, the last write to a reference wins, and a DELETE takes it away.
     */
    const referencesOf = async (ids: string[]): Promise<Reference[]> => {
        if (ids.length === 0) return [];

        const rows = await database.all(
            `WITH ranked AS (
                 SELECT node_id, ref_id, type, idx, operation,
                        row_number() OVER (PARTITION BY node_id, ref_id
                                           ORDER BY section_ordinal DESC, ordinal DESC) AS rn,
                        min(section_ordinal) OVER (PARTITION BY node_id, ref_id) AS first_section,
                        min(ordinal) OVER (PARTITION BY node_id, ref_id) AS first_ordinal
                 FROM mosaic_component_ref
                 WHERE ${scope} AND node_id IN (${list(ids)}) AND operation <> 'PASS_THROUGH'
             )
             SELECT node_id, ref_id, type, idx FROM ranked
             WHERE rn = 1 AND operation <> 'DELETE'
             ORDER BY node_id, first_section, first_ordinal`);

        return rows.map(row => ({
            nodeId: String(row.node_id),
            refId: String(row.ref_id),
            type: String(row.type),
            index: Number(row.idx),
        }));
    };

    /** Whether this selection keeps a reference at all. */
    const keeps = (reference: Reference): boolean => {
        if (!wanted || !askedFor.has(reference.nodeId)) return true;
        if (request.includeChildren && reference.type === CORE_TYPE.child) return true;
        return wanted.has(reference.type);
    };

    // --- the references, and the rows behind them ---------------------------
    const references = (await referencesOf(chosen)).filter(keeps);
    const values = new Map<string, unknown>();

    /**
     * Reads the rows a set of references points at.
     *
     * Each component type lives in its own table, so this is a union across the types the
     * references actually name -- one query per round rather than one per type, since at
     * these sizes the cost is in the round trips and not in the scanning.
     */
    const loadValues = async (needed: Reference[]): Promise<void> => {
        const byType = new Map<string, Set<number>>();
        for (const reference of needed) {
            if (reference.index < 0) continue;
            const key = `${reference.type} ${reference.index}`;
            if (values.has(key)) continue;
            const indices = byType.get(reference.type) ?? new Set<number>();
            indices.add(reference.index);
            byType.set(reference.type, indices);
        }

        if (byType.size === 0) return;

        const parts = [...byType].map(([type, indices]) =>
            `SELECT ${literal(type)} AS type, idx, value FROM ${quoteIdentifier(type)}
             WHERE ${scope} AND idx IN (${[...indices].join(", ")})`);

        for (const row of await database.all(parts.join(" UNION ALL "))) {
            values.set(`${String(row.type)} ${Number(row.idx)}`, row.value);
        }
    };

    await loadValues(references);

    // --- whatever those rows point at ---------------------------------------
    // A subset has to stand on its own, so a node named inside a kept component comes
    // along with everything it carries. Each round only looks at what the last one added.
    const pulledIn: string[] = [];
    let frontier = references;

    while (frontier.length > 0) {
        const candidates = new Set<string>();

        for (const reference of frontier) {
            const value = values.get(`${reference.type} ${reference.index}`);
            if (value === undefined) continue;
            referencedIds(typeof value === "string" ? JSON.parse(value) : value, candidates);
        }

        const fresh = [...candidates].filter(id => !seen.has(id));
        if (fresh.length === 0) break;

        const exists = new Set((await database.all(
            `SELECT DISTINCT node_id FROM mosaic_node WHERE ${scope} AND node_id IN (${list(fresh)})`,
        )).map(row => String(row.node_id)));

        const added = fresh.filter(id => exists.has(id));
        if (added.length === 0) break;

        for (const id of added) {
            take(id);
            pulledIn.push(id);
        }

        // A node pulled in for its data keeps everything it has.
        frontier = await referencesOf(added);
        await loadValues(frontier);
        references.push(...frontier);
    }

    // --- build the file ------------------------------------------------------
    const file = emptyFile();
    const [header] = await database.all(
        `SELECT mosaic_version FROM mosaic_file WHERE ${scope}`);
    file.index.header.MosaicVersion = String(header?.mosaic_version ?? "post-alpha");

    const byNode = new Map<string, Reference[]>();
    for (const reference of references) {
        const list = byNode.get(reference.nodeId) ?? [];
        list.push(reference);
        byNode.set(reference.nodeId, list);
    }

    const usedTypes = new Set<string>();
    const nodes: NodeElement[] = chosen.map(id => {
        const components: ComponentElement[] = (byNode.get(id) ?? []).map(reference => {
            usedTypes.add(reference.type);

            if (reference.index < 0) {
                return { type: reference.type, id: reference.refId, index: reference.index };
            }

            const value = values.get(`${reference.type} ${reference.index}`);
            const row = typeof value === "string" ? value : JSON.stringify(value ?? {});
            return {
                type: reference.type,
                id: reference.refId,
                index: file.addSerializedComponent(reference.type, row),
            };
        });

        return { id, components };
    });

    const tables = await database.all(
        `SELECT type, filename, format, schema FROM mosaic_component_table
         WHERE ${scope} AND type IN (${list(usedTypes)})`);
    const schemas = new Map(tables.map(row => [String(row.type), row]));

    for (const type of [...usedTypes].sort()) {
        const table = schemas.get(type);
        file.index.componentTables.push({
            filename: table ? String(table.filename) : `${type}.ndjson`,
            type: table && String(table.format) === Type.Parquet ? Type.Parquet : Type.Ndjson,
            schema: table?.schema !== undefined && table.schema !== null
                ? (typeof table.schema === "string" ? JSON.parse(String(table.schema)) : table.schema)
                : {},
        });
    }

    const [provenance] = await database.all(
        `SELECT section_id, data_version, author FROM mosaic_section
         WHERE ${scope} ORDER BY ordinal DESC LIMIT 1`);

    file.index.sections.push({
        header: {
            id: String(provenance?.section_id ?? "selection"),
            message: `A selection of ${nodes.length} node(s)`,
            dataVersion: String(provenance?.data_version ?? "1.0.0"),
            author: String(provenance?.author ?? ""),
            timestamp: new Date().toISOString(),
            application: "mosaic",
        },
        nodes,
    });

    return { file, nodeIds: chosen, missing, pulledIn };
}

function emptyFile(): MosaicFile {
    const file = new MosaicFile();
    file.index.sections = [];
    return file;
}
