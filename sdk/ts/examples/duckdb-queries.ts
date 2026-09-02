/**
 * Builds a DuckDB database from the example archives and runs a few queries over it.
 *
 *   npm run example:duckdb                  # into a temporary database
 *   npm run example:duckdb -- out/mosaic.duckdb
 *
 * The archives have to exist first:
 *
 *   mosaic pack test-data/<name>.mosaic.json
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { MosaicDatabase } from "../src/duckdb/index.ts";

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "test-data");
const ARCHIVES = ["house-v2", "gltf-box", "typed-boxes", "instanced-boxes"];

/** Prints rows as a small aligned table, so the output reads like a query result. */
function show(title: string, sql: string, rows: Array<Record<string, unknown>>): void {
    console.log(`\n── ${title} ${"─".repeat(Math.max(0, 68 - title.length))}`);
    console.log(sql.trim().split("\n").map(line => `   ${line.trim()}`).join("\n"));
    console.log();

    if (rows.length === 0) {
        console.log("   (no rows)");
        return;
    }

    const columns = Object.keys(rows[0]!);
    const width = Object.fromEntries(columns.map(c => [
        c,
        Math.max(c.length, ...rows.map(r => String(r[c] ?? "").length)),
    ]));

    const line = (cells: string[]) => "   " + cells.map((cell, i) => cell.padEnd(width[columns[i]!]!)).join("  ");
    console.log(line(columns));
    console.log("   " + columns.map(c => "-".repeat(width[c]!)).join("  "));
    for (const row of rows.slice(0, 12)) console.log(line(columns.map(c => String(row[c] ?? ""))));
    if (rows.length > 12) console.log(`   … ${rows.length - 12} more`);
}

const QUERIES: Array<{ title: string; sql: string }> = [
    {
        title: "What is in the database",
        sql: `
            SELECT f.file_id,
                   f.mosaic_version,
                   count(DISTINCT s.ordinal) AS sections,
                   count(DISTINCT n.node_id) AS nodes
            FROM mosaic_file f
            LEFT JOIN mosaic_section s USING (file_id)
            LEFT JOIN mosaic_node n USING (file_id)
            GROUP BY 1, 2
            ORDER BY 1`,
    },
    {
        title: "Which component types each archive carries",
        sql: `
            SELECT file_id, type, count(*) AS refs
            FROM mosaic_component_ref
            GROUP BY 1, 2
            ORDER BY 1, refs DESC, 2`,
    },
    {
        title: "Every named node -- a value-less component keeps its data in the reference id",
        sql: `
            SELECT file_id, ref_id AS name, node_id
            FROM mosaic_component_ref
            WHERE type = 'core::name'
            ORDER BY file_id, name`,
    },
    {
        title: "Everything that is-a something, and what it is",
        sql: `
            SELECT me.ref_id AS is_a_node,
                   type_name.ref_id AS is_a,
                   my_name.ref_id AS node
            FROM mosaic_component_ref me
            LEFT JOIN mosaic_component_ref type_name
                   ON type_name.file_id = me.file_id
                  AND type_name.node_id = me.ref_id
                  AND type_name.type = 'core::name'
            LEFT JOIN mosaic_component_ref my_name
                   ON my_name.file_id = me.file_id
                  AND my_name.node_id = me.node_id
                  AND my_name.type = 'core::name'
            WHERE me.type = 'core::inherit'
            ORDER BY is_a, node`,
    },
    {
        title: "The scene tree, one row per parent-child link",
        sql: `
            SELECT parent.ref_id AS parent,
                   child.ref_id AS child
            FROM mosaic_component_ref link
            LEFT JOIN mosaic_component_ref parent
                   ON parent.file_id = link.file_id AND parent.node_id = link.node_id AND parent.type = 'core::name'
            LEFT JOIN mosaic_component_ref child
                   ON child.file_id = link.file_id AND child.node_id = link.ref_id AND child.type = 'core::name'
            WHERE link.type = 'core::child'
            ORDER BY parent, child`,
    },
    {
        title: "Where each transform puts its node",
        sql: `
            SELECT name.ref_id AS node,
                   t.translation,
                   t.scale
            FROM mosaic_component_ref r
            JOIN "core::transform" t ON t.file_id = r.file_id AND t.idx = r.idx
            LEFT JOIN mosaic_component_ref name
                   ON name.file_id = r.file_id AND name.node_id = r.node_id AND name.type = 'core::name'
            WHERE r.type = 'core::transform'
            ORDER BY node`,
    },
    {
        title: "Following a mesh to the vertex data it draws",
        sql: `
            SELECT p.file_id,
                   json_extract_string(p.value, '$.attributes.POSITION') AS position_node,
                   a.name  AS accessor,
                   a.count AS vertices,
                   a.type,
                   a.min,
                   a.max
            FROM "khronos::gltf::meshPrimitive" p
            JOIN mosaic_component_ref accessor_ref
              ON accessor_ref.file_id = p.file_id
             AND accessor_ref.node_id = json_extract_string(p.value, '$.attributes.POSITION')
             AND accessor_ref.type = 'khronos::gltf::accessor'
            JOIN "khronos::gltf::accessor" a
              ON a.file_id = accessor_ref.file_id AND a.idx = accessor_ref.idx
            ORDER BY p.file_id`,
    },
    {
        title: "How much geometry each archive holds",
        sql: `
            SELECT file_id,
                   sum(CASE WHEN name = 'POSITION' THEN count ELSE 0 END) AS vertices,
                   sum(CASE WHEN type = 'SCALAR'   THEN count ELSE 0 END) AS indices
            FROM "khronos::gltf::accessor"
            GROUP BY 1
            ORDER BY 1`,
    },
    {
        title: "Materials, reaching into a nested object that has no column",
        sql: `
            SELECT file_id,
                   name,
                   json_extract(value, '$.pbrMetallicRoughness.baseColorFactor') AS base_colour,
                   json_extract(value, '$.pbrMetallicRoughness.roughnessFactor')::DOUBLE AS roughness
            FROM "khronos::gltf::material"
            ORDER BY file_id, name`,
    },
    {
        title: "Which sections touched a node, in the order they were layered",
        sql: `
            SELECT r.file_id, s.section_id, r.node_id, r.type, r.operation
            FROM mosaic_component_ref r
            JOIN mosaic_section s ON s.file_id = r.file_id AND s.ordinal = r.section_ordinal
            WHERE r.node_id = '11111111-1111-4111-8111-111111111111'
            ORDER BY r.file_id, r.section_ordinal, r.ordinal`,
    },
];

const target = process.argv[2] ?? path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mosaic-db-")), "mosaic.duckdb");
const database = await MosaicDatabase.open(target);

try {
    for (const name of ARCHIVES) {
        const archive = path.join(DATA, `${name}.tsr`);
        if (!fs.existsSync(archive)) {
            console.log(`skipping ${name}: ${archive} is not there -- run "mosaic pack test-data/${name}.mosaic.json"`);
            continue;
        }

        const result = await database.insertArchive(archive);
        const rows = Object.values(result.components).reduce((total, n) => total + n, 0);
        console.log(`inserted ${result.fileId.padEnd(16)} ${String(result.nodes).padStart(3)} nodes, ${String(rows).padStart(3)} component rows`);
    }

    console.log(`\ndatabase: ${target}`);

    for (const { title, sql } of QUERIES) {
        show(title, sql, await database.all(sql));
    }
} finally {
    await database.close();
}
