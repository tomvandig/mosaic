import { MosaicFile } from "../MosaicFile.ts";
import { Type, type ComponentElement, type NodeElement } from "../MosaicIndexFile.ts";
import { CORE_TYPE } from "../core/schemas.ts";
import { composeInPlace, type SelectionRequest, type SelectionResult } from "../Selection.ts";
import type { MosaicDatabase } from "./Export.ts";
import { componentFromRow, quoteIdentifier } from "./SqlTypes.ts";

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
    /** The archive the reference is written in, which is where its row is. */
    fileId: string;
    nodeId: string;
    refId: string;
    type: string;
    index: number;
}

/**
 * Takes a subset of one or more archives straight out of the database.
 *
 * The same thing `selectNodes` does to a file in memory, except that nothing is
 * reconstructed to be thrown away: the nodes, their references and their component rows
 * are each asked for by name, so answering for three nodes costs three nodes rather than
 * the whole version. The collapsing a file would have done -- the last write to a
 * reference wins, and a DELETE removes it -- is done in SQL instead.
 *
 * Given several archives it reads across all of them at once, which is what makes a
 * reference that leaves one archive and lands in another -- an import -- resolve.
 */
export async function selectNodesFromDatabase(
    database: MosaicDatabase,
    files: string | string[],
    request: SelectionRequest,
): Promise<SelectionResult> {
    // The archives arrive in layering order: an import sits underneath whatever imports
    // it, so where two of them write the same reference the later one wins -- the rule
    // sections already follow inside one archive.
    const fileIds = typeof files === "string" ? [files] : files;
    if (fileIds.length === 0) {
        return { file: emptyFile(), nodeIds: [], missing: [...request.nodes], pulledIn: [] };
    }

    const scope = `file_id IN (${list(fileIds)})`;
    /** Which layer a row is on. Later in the list is nearer the top. */
    const layer = `list_position([${list(fileIds)}], file_id)`;
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

    /** Everything reachable from a set of nodes along references of one type. */
    const walk = async (from: string[], type: string): Promise<string[]> => {
        if (from.length === 0) return [];
        const seeds = from.map(id => `(${literal(id)})`).join(", ");

        const rows = await database.all(
            `WITH RECURSIVE ranked AS (
                 SELECT node_id, ref_id, operation,
                        row_number() OVER (PARTITION BY node_id, ref_id
                                           ORDER BY ${layer} DESC, section_ordinal DESC, ordinal DESC) AS rn
                 FROM mosaic_component_ref
                 WHERE ${scope} AND type = ${literal(type)} AND operation <> 'PASS_THROUGH'
             ),
             links AS (SELECT node_id, ref_id FROM ranked WHERE rn = 1 AND operation <> 'DELETE'),
             tree(node_id) AS (
                 SELECT node_id FROM (VALUES ${seeds}) AS seeds(node_id)
                 UNION
                 SELECT links.ref_id FROM links JOIN tree ON links.node_id = tree.node_id
             )
             SELECT node_id FROM tree`);

        return rows.map(row => String(row.node_id));
    };

    for (const id of asked) take(id);
    if (request.includeChildren) {
        for (const id of await walk(asked, CORE_TYPE.child)) take(id);
    }

    // An is-a link names its target in the reference id rather than in a value, so the
    // pass that follows references would never reach it. Those ancestors are taken for
    // what they carry, not to be part of the answer, so they are noted and dropped once
    // their components have been copied down.
    const ancestors = new Set<string>();
    if (request.compose) {
        for (const id of await walk([...chosen], CORE_TYPE.inherit)) {
            if (seen.has(id)) continue;
            take(id);
            ancestors.add(id);
        }
    }

    // Everything reached so far was asked for -- the seeds and, when children were
    // wanted, their descendants -- so the component filter applies to all of it, and can
    // be asked for as part of the question. Only nodes dragged in later, because something
    // kept refers to them, keep everything, and those are read without it below.
    //
    // A child link is kept whatever was asked for when the children were wanted: they are
    // what the answer was walked along, and dropping them would hand back a tree with no
    // branches.
    const keep = wanted
        ? new Set([...wanted, ...(request.includeChildren ? [CORE_TYPE.child] : [])])
        : undefined;

    /**
     * The references a set of nodes carries, after collapsing: a PASS_THROUGH changes
     * nothing, the last write to a reference wins, and a DELETE takes it away.
     *
     * `types`, when given, keeps only those, and keeps them here rather than in the answer.
     * Which is the whole difference at the size these files reach: the architectural model
     * carries 590,184 references and a tree wants three types of them, 202,201, so
     * filtering afterwards means ranking 387,983 rows and copying them out of the database
     * in order to throw them away.
     */
    const referencesOf = async (ids: string[], types?: ReadonlySet<string>): Promise<Reference[]> => {
        if (ids.length === 0) return [];

        const only = types && types.size > 0 ? `AND type IN (${list(types)})` : "";

        const rows = await database.all(
            `WITH ranked AS (
                 SELECT file_id, node_id, ref_id, type, idx, operation,
                        row_number() OVER (PARTITION BY node_id, ref_id
                                           ORDER BY ${layer} DESC, section_ordinal DESC, ordinal DESC) AS rn,
                        min(${layer}) OVER (PARTITION BY node_id, ref_id) AS first_layer,
                        min(section_ordinal) OVER (PARTITION BY node_id, ref_id) AS first_section,
                        min(ordinal) OVER (PARTITION BY node_id, ref_id) AS first_ordinal
                 FROM mosaic_component_ref
                 WHERE ${scope} AND node_id IN (${list(ids)}) AND operation <> 'PASS_THROUGH' ${only}
             )
             SELECT file_id, node_id, ref_id, type, idx FROM ranked
             WHERE rn = 1 AND operation <> 'DELETE'
             ORDER BY node_id, first_layer, first_section, first_ordinal`);

        return rows.map(row => ({
            fileId: String(row.file_id),
            nodeId: String(row.node_id),
            refId: String(row.ref_id),
            type: String(row.type),
            index: Number(row.idx),
        }));
    };

    // --- the references, and the rows behind them ---------------------------
    const references = await referencesOf(chosen, keep);

    // A row is addressed by archive as well as by type and index: every archive counts
    // its rows of a type from its own zero, so an index alone names two different rows.
    const values = new Map<string, Record<string, unknown>>();
    const valueKey = (reference: Reference) => `${reference.fileId} ${reference.type} ${reference.index}`;

    /**
     * Reads the rows a set of references points at.
     *
     * Each component type lives in its own table, so this is a union across the types the
     * references actually name -- one query per round rather than one per type, since at
     * these sizes the cost is in the round trips and not in the scanning.
     */
    const loadValues = async (needed: Reference[]): Promise<void> => {
        const groups = new Map<string, { fileId: string; type: string; indices: Set<number> }>();
        for (const reference of needed) {
            if (reference.index < 0) continue;
            if (values.has(valueKey(reference))) continue;

            const key = `${reference.fileId} ${reference.type}`;
            const group = groups.get(key)
                ?? { fileId: reference.fileId, type: reference.type, indices: new Set<number>() };
            group.indices.add(reference.index);
            groups.set(key, group);
        }

        // A component is its columns, and two types have different ones, so each table is
        // asked for on its own rather than all of them in one union.
        for (const { fileId, type, indices } of groups.values()) {
            const columns = await database.componentColumns(type);

            const rows = await database.all(
                `SELECT * FROM ${quoteIdentifier(type)}
                 WHERE file_id = ${literal(fileId)} AND idx IN (${[...indices].join(", ")})`);

            for (const row of rows) {
                values.set(`${fileId} ${type} ${Number(row.idx)}`, componentFromRow(columns, row));
            }
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
            const value = values.get(valueKey(reference));
            if (value === undefined) continue;
            referencedIds(value, candidates);
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
        `SELECT mosaic_version FROM mosaic_file WHERE ${scope} ORDER BY ${layer} DESC LIMIT 1`);
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

            return {
                type: reference.type,
                id: reference.refId,
                index: file.addSerializedComponent(
                    reference.type, JSON.stringify(values.get(valueKey(reference)) ?? {})),
            };
        });

        return { id, components };
    });

    // A type several archives declare is described once, by whichever of them is nearest
    // the top: they are the same type, so the topmost declaration stands for all of them.
    const tables = await database.all(
        `SELECT type, filename, format, schema FROM mosaic_component_table
         WHERE ${scope} AND type IN (${list(usedTypes)}) ORDER BY ${layer}`);
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
         WHERE ${scope} ORDER BY ${layer} DESC, ordinal DESC LIMIT 1`);

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

    if (request.compose) {
        composeInPlace(file, ancestors);
        return {
            file,
            nodeIds: chosen.filter(id => !ancestors.has(id)),
            missing,
            pulledIn: pulledIn.filter(id => !ancestors.has(id)),
        };
    }

    return { file, nodeIds: chosen, missing, pulledIn };
}

function emptyFile(): MosaicFile {
    const file = new MosaicFile();
    file.index.sections = [];
    return file;
}
