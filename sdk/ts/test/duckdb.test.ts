import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MosaicDatabase, exportArchivesToDatabase, readMosaicFile, listFiles, composeDatabaseToGlb } from "../src/duckdb/index.ts";
import { composeArchive } from "../src/composition/ComposeFs.ts";
import { mosaicToGltf } from "../src/composition/MosaicToGltf.ts";
import { collapseNodesByPath } from "../src/MosaicFileOperations.ts";
import { parseGlb } from "../src/gltf/GltfDocument.ts";
import { columnTypeFor, planColumns } from "../src/duckdb/SqlTypes.ts";
import { packMosaicSource } from "../src/MosaicPack.ts";
import { CORE_TYPE } from "../src/core/schemas.ts";
import { GLTF_TYPE } from "../src/gltf/schemas.ts";
import { readExample, resolveExampleSchema } from "./fixtures.ts";

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mosaic-duckdb-"));
}

/** Packs an example into a scratch directory and hands back its path. */
async function archive(name: string, into: string): Promise<string> {
    const target = path.join(into, `${name}.tsr`);
    fs.writeFileSync(target, await packMosaicSource(readExample(name), resolveExampleSchema));
    return target;
}

/** A database holding one example, cleaned up by the caller. */
async function withExample(name: string): Promise<{ db: MosaicDatabase; dir: string }> {
    const dir = tempDir();
    const db = await MosaicDatabase.open(path.join(dir, "mosaic.duckdb"));
    await db.insertArchive(await archive(name, dir));
    return { db, dir };
}

// ---------------------------------------------------------------------------
// Mapping schemas to columns
// ---------------------------------------------------------------------------

test("scalar properties become scalar columns", () => {
    assert.equal(columnTypeFor({ type: "string" }), "VARCHAR");
    assert.equal(columnTypeFor({ type: "integer" }), "BIGINT");
    assert.equal(columnTypeFor({ type: "number" }), "DOUBLE");
    assert.equal(columnTypeFor({ type: "boolean" }), "BOOLEAN");
});

test("a list of scalars becomes a list column, and anything else stays JSON", () => {
    assert.equal(columnTypeFor({ type: "array", items: { type: "number" } }), "DOUBLE[]");
    assert.equal(columnTypeFor({ type: "array", items: { type: "string" } }), "VARCHAR[]");
    assert.equal(columnTypeFor({ type: "array", items: { type: "object" } }), "JSON");
    assert.equal(columnTypeFor({ type: "object" }), "JSON");
    assert.equal(columnTypeFor({}), "JSON");
});

test("an enum says what type its values are", () => {
    assert.equal(columnTypeFor({ enum: ["SCALAR", "VEC3"] }), "VARCHAR");
    assert.equal(columnTypeFor({ enum: [5120, 5126] }), "BIGINT");
});

test("a property that clashes with a fixed column is renamed, and said so", () => {
    const warnings: string[] = [];
    const columns = planColumns({ properties: { value: { type: "string" }, name: { type: "string" } } }, w => warnings.push(w));

    assert.deepEqual(columns.map(c => c.name), ["value_", "name"]);
    assert.deepEqual(columns.map(c => c.property), ["value", "name"]);
    assert.ok(warnings.some(w => w.includes("collides with a fixed column")));
});

// ---------------------------------------------------------------------------
// Building a database
// ---------------------------------------------------------------------------

test("opening a database creates the file and its fixed tables", async () => {
    const dir = tempDir();
    const file = path.join(dir, "new.duckdb");

    const db = await MosaicDatabase.open(file);
    try {
        assert.ok(fs.existsSync(file), "the database file should have been created");

        const tables = await db.all(`SELECT table_name FROM information_schema.tables WHERE table_schema='main' ORDER BY 1`);
        assert.deepEqual(tables.map(t => t.table_name), [
            "mosaic_component_ref", "mosaic_component_table", "mosaic_file",
            "mosaic_import", "mosaic_node", "mosaic_section",
        ]);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("opening an existing database adds to it rather than replacing it", async () => {
    const dir = tempDir();
    const file = path.join(dir, "grow.duckdb");
    const boxes = await archive("gltf-box", dir);

    const first = await MosaicDatabase.open(file);
    await first.insertArchive(boxes);
    await first.close();

    // A second open of the same path finds what the first one wrote.
    const second = await MosaicDatabase.open(file);
    try {
        assert.equal((await second.all(`SELECT count(*) AS n FROM mosaic_file`))[0]!.n, 1);
        await second.insertArchive(boxes);
        assert.equal((await second.all(`SELECT count(*) AS n FROM mosaic_file`))[0]!.n, 2);
    } finally {
        await second.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("each component type gets a table named after it", async () => {
    const { db, dir } = await withExample("gltf-box");
    try {
        const tables = (await db.all(
            `SELECT table_name FROM information_schema.tables WHERE table_schema='main' AND table_name LIKE '%::%' ORDER BY 1`,
        )).map(t => t.table_name);

        assert.deepEqual(tables, [
            CORE_TYPE.transform, GLTF_TYPE.accessor, GLTF_TYPE.buffer,
            GLTF_TYPE.bufferView, GLTF_TYPE.material, GLTF_TYPE.meshPrimitive,
        ].sort());
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("a component table takes its columns from the schema in the archive", async () => {
    const { db, dir } = await withExample("gltf-box");
    try {
        const columns = await db.all(
            `SELECT column_name, data_type FROM information_schema.columns
             WHERE table_name = '${GLTF_TYPE.accessor}' ORDER BY ordinal_position`,
        );
        const byName = Object.fromEntries(columns.map(c => [c.column_name, c.data_type]));

        // The fixed columns, then what the accessor schema declares.
        assert.equal(byName.file_id, "VARCHAR");
        assert.equal(byName.idx, "BIGINT");
        assert.equal(byName.value, "JSON");
        assert.equal(byName.componentType, "BIGINT");
        assert.equal(byName.count, "BIGINT");
        assert.equal(byName.type, "VARCHAR");
        assert.equal(byName.normalized, "BOOLEAN");
        assert.equal(byName.min, "DOUBLE[]");
        assert.equal(byName.max, "DOUBLE[]");
        // bufferView is a node id in this format, not a number.
        assert.equal(byName.bufferView, "VARCHAR");
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("component rows land in their table, typed and in order", async () => {
    const { db, dir } = await withExample("gltf-box");
    try {
        const accessors = await db.all(
            `SELECT idx, name, type, componentType, count, min FROM ${JSON.stringify(GLTF_TYPE.accessor)} ORDER BY idx`,
        );

        assert.equal(accessors.length, 2);
        assert.deepEqual(accessors[0], {
            idx: 0, name: "POSITION", type: "VEC3", componentType: 5126, count: 8, min: [-0.5, -0.5, -0.5],
        });
        assert.equal(accessors[1]!.type, "SCALAR");
        assert.equal(accessors[1]!.min, null, "an absent property is null");
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("the whole component is kept as JSON beside the columns", async () => {
    const { db, dir } = await withExample("gltf-box");
    try {
        const [row] = await db.all(
            `SELECT json_extract_string(value, '$.name') AS name,
                    json_extract(value, '$.pbrMetallicRoughness.roughnessFactor')::DOUBLE AS roughness
             FROM ${JSON.stringify(GLTF_TYPE.material)}`,
        );

        // Nested objects have no column of their own, but are still queryable.
        assert.equal(row!.name, "Painted brick");
        assert.equal(row!.roughness, 0.9);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("the index tables describe the sections, nodes and references", async () => {
    const { db, dir } = await withExample("gltf-box");
    try {
        const [file] = await db.all(`SELECT file_id, mosaic_version FROM mosaic_file`);
        assert.equal(file!.file_id, "gltf-box");
        assert.equal(file!.mosaic_version, "post-alpha");

        const [section] = await db.all(`SELECT section_id, author FROM mosaic_section`);
        assert.equal(section!.section_id, "box-geometry");
        assert.equal(section!.author, "ada@example.com");

        const [counts] = await db.all(
            `SELECT (SELECT count(*) FROM mosaic_node) AS nodes,
                    (SELECT count(*) FROM mosaic_component_ref) AS refs`,
        );
        assert.equal(counts!.nodes, 8);
        assert.equal(counts!.refs, 10);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("the defaults of an optional reference are resolved on the way in", async () => {
    const { db, dir } = await withExample("typed-boxes");
    try {
        // core::inherit references carry neither an index nor an operation.
        const rows = await db.all(
            `SELECT DISTINCT idx, operation FROM mosaic_component_ref WHERE type = '${CORE_TYPE.inherit}'`,
        );

        assert.deepEqual(rows, [{ idx: -1, operation: "VALUE" }]);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("imports are recorded", async () => {
    const { db, dir } = await withExample("linked-house");
    try {
        const imports = await db.all(`SELECT ordinal, uri, integrity FROM mosaic_import ORDER BY ordinal`);

        assert.equal(imports.length, 2);
        assert.equal(imports[0]!.uri, "house-v1.tsr");
        assert.match(String(imports[0]!.integrity), /^sha384-/);
        assert.equal(imports[1]!.integrity, null);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// ---------------------------------------------------------------------------
// Inserting more than one archive
// ---------------------------------------------------------------------------

test("a second archive appends its sections beside the first", async () => {
    const dir = tempDir();
    const db = await MosaicDatabase.open(path.join(dir, "many.duckdb"));
    try {
        await db.insertArchive(await archive("house-v1", dir));
        await db.insertArchive(await archive("house-v2", dir));

        const sections = await db.all(`SELECT file_id, section_id FROM mosaic_section ORDER BY file_id, ordinal`);
        assert.deepEqual(sections, [
            { file_id: "house-v1", section_id: "house-v1" },
            { file_id: "house-v2", section_id: "house-v1" },
            { file_id: "house-v2", section_id: "house-v2" },
        ]);

        // Nothing was overwritten: the walls of both archives are all present.
        const walls = await db.all(`SELECT file_id, count(*) AS n FROM "acme::geometry::wall" GROUP BY 1 ORDER BY 1`);
        assert.deepEqual(walls, [{ file_id: "house-v1", n: 2 }, { file_id: "house-v2", n: 4 }]);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("the same archive twice is kept twice, under distinct names", async () => {
    const dir = tempDir();
    const db = await MosaicDatabase.open(path.join(dir, "twice.duckdb"));
    try {
        const boxes = await archive("gltf-box", dir);
        const first = await db.insertArchive(boxes);
        const second = await db.insertArchive(boxes);

        assert.equal(first.fileId, "gltf-box");
        assert.equal(second.fileId, "gltf-box#2");
        assert.equal((await db.all(`SELECT count(*) AS n FROM ${JSON.stringify(GLTF_TYPE.accessor)}`))[0]!.n, 4);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("a row still points at its own archive's component table", async () => {
    const dir = tempDir();
    const db = await MosaicDatabase.open(path.join(dir, "join.duckdb"));
    try {
        await db.insertArchive(await archive("house-v1", dir));
        await db.insertArchive(await archive("house-v2", dir));

        // Joining on (file_id, idx) keeps each archive's references to its own rows.
        const resolved = await db.all(
            `SELECT r.file_id, w.name
             FROM mosaic_component_ref r
             JOIN "acme::geometry::wall" w ON w.file_id = r.file_id AND w.idx = r.idx
             WHERE r.type = 'acme::geometry::wall' AND r.section_ordinal = 0
             ORDER BY r.file_id, r.ordinal`,
        );

        assert.deepEqual(resolved, [
            { file_id: "house-v1", name: "North wall" },
            { file_id: "house-v1", name: "South wall" },
            { file_id: "house-v2", name: "North wall" },
            { file_id: "house-v2", name: "South wall" },
        ]);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("exportArchivesToDatabase builds a database from several archives at once", async () => {
    const dir = tempDir();
    const paths = [await archive("house-v1", dir), await archive("gltf-box", dir)];

    const { database, inserted } = await exportArchivesToDatabase(paths, path.join(dir, "all.duckdb"));
    try {
        assert.deepEqual(inserted.map(i => i.fileId), ["house-v1", "gltf-box"]);
        assert.equal(inserted[1]!.nodes, 8);
        assert.ok(inserted[1]!.tablesCreated.includes(GLTF_TYPE.accessor));

        const types = await database.componentTypes();
        assert.ok(types.some(t => t.type === "acme::geometry::wall" && t.rows === 2));
        assert.ok(types.some(t => t.type === GLTF_TYPE.accessor && t.rows === 2));
    } finally {
        await database.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("a type whose schema grew gets the new columns added", async () => {
    const dir = tempDir();
    const db = await MosaicDatabase.open(path.join(dir, "widen.duckdb"));
    try {
        const narrow = readExample("house-v1");
        const wall = narrow.index.componentTables[0]!;
        // The example stores the schema as a path; resolve it so it can be narrowed.
        const schema = resolveExampleSchema(wall.schema as string) as any;

        // First archive: a wall schema that does not mention loadBearing.
        delete schema.properties.loadBearing;
        wall.schema = schema;
        fs.writeFileSync(path.join(dir, "narrow.tsr"), await packMosaicSource(narrow, resolveExampleSchema));
        await db.insertArchive(path.join(dir, "narrow.tsr"), { fileId: "narrow" });

        let columns = await db.all(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'acme::geometry::wall'`);
        assert.ok(!columns.some(c => c.column_name === "loadBearing"));

        // Second archive: the same type, with the property back.
        await db.insertArchive(await archive("house-v1", dir), { fileId: "wide" });

        columns = await db.all(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'acme::geometry::wall'`);
        assert.ok(columns.some(c => c.column_name === "loadBearing"), "the new column should have been added");

        const rows = await db.all(
            `SELECT file_id, loadBearing FROM "acme::geometry::wall" WHERE name = 'North wall' ORDER BY file_id`);
        assert.deepEqual(rows, [{ file_id: "narrow", loadBearing: null }, { file_id: "wide", loadBearing: true }]);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("a missing archive is reported by name", async () => {
    const dir = tempDir();
    const db = await MosaicDatabase.open(path.join(dir, "x.duckdb"));
    try {
        await assert.rejects(() => db.insertArchive(path.join(dir, "nope.tsr")), /nope\.tsr does not exist/);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// ---------------------------------------------------------------------------
// Reading a database back, and composing it
// ---------------------------------------------------------------------------

test("a database reads back as the file that went into it", async () => {
    const dir = tempDir();
    const db = await MosaicDatabase.open(path.join(dir, "read.duckdb"));
    try {
        const source = await archive("gltf-box", dir);
        await db.insertArchive(source);

        const fromDatabase = await readMosaicFile(db);
        const composedFromDatabase = mosaicToGltf(fromDatabase);
        const composedFromArchive = await composeArchive(source);

        // Same document, down to the byte, whichever way round it came.
        assert.deepEqual(composedFromDatabase.document, composedFromArchive.document);
        assert.deepEqual([...composedFromDatabase.binary], [...composedFromArchive.binary]);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("reading several archives shifts each one's references onto the merged tables", async () => {
    const dir = tempDir();
    const db = await MosaicDatabase.open(path.join(dir, "merge.duckdb"));
    try {
        await db.insertArchive(await archive("house-v1", dir));
        await db.insertArchive(await archive("house-v2", dir));

        const file = await readMosaicFile(db);

        // Both archives' rows are in one table, so the second one's start after the first.
        assert.equal(file.serializedComponents.get("acme::geometry::wall")!.length, 6);

        // Every reference still resolves, and to the row it named in its own archive.
        for (const section of file.index.sections) {
            for (const node of section.nodes) {
                for (const reference of node.components ?? []) {
                    assert.doesNotThrow(
                        () => file.readRawComponent(reference.type, reference.index!),
                        `${section.header.id}/${node.id}/${reference.id}`,
                    );
                }
            }
        }

        // house-v2 was inserted second, so its sections layer on top: the north wall ends
        // up at the height that archive gave it.
        const collapsed = collapseNodesByPath(file);
        const north = collapsed.get("11111111-1111-4111-8111-111111111111")!;
        const geometry = north.components!.find(c => c.id === "geometry")!;
        assert.equal(JSON.parse(file.readRawComponent(geometry.type, geometry.index!)).height, 2.7);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("composing a database writes a glb", async () => {
    const dir = tempDir();
    const database = path.join(dir, "scene.duckdb");
    const db = await MosaicDatabase.open(database);
    await db.insertArchive(await archive("gltf-box", dir));
    await db.close();

    try {
        const result = await composeDatabaseToGlb(database);

        assert.equal(result.outputPath, path.join(dir, "scene.glb"));
        assert.deepEqual(result.sources, ["gltf-box"]);
        assert.equal(result.meshCount, 1);
        assert.equal(result.binaryLength, 168);
        assert.deepEqual(result.warnings, []);

        // It really is a GLB, and it holds what the archive did.
        const { document, binaryChunk } = parseGlb(new Uint8Array(fs.readFileSync(result.outputPath)));
        assert.equal(document.meshes?.length, 1);
        assert.equal(binaryChunk?.byteLength, 168);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("composing several archives merges nodes that share an id rather than duplicating them", async () => {
    const dir = tempDir();
    const database = path.join(dir, "many.duckdb");
    const db = await MosaicDatabase.open(database);
    await db.insertArchive(await archive("gltf-box", dir));
    await db.insertArchive(await archive("typed-boxes", dir));
    await db.close();

    try {
        const result = await composeDatabaseToGlb(database, path.join(dir, "out.glb"));
        assert.deepEqual(result.sources, ["gltf-box", "typed-boxes"]);

        // typed-boxes was built from gltf-box and reuses its buffer and accessor node ids,
        // so those are one node carrying the later archive's row -- the same layering a
        // second section gives, which is exactly what appending archives is meant to do.
        assert.equal(result.binaryLength, 168, "one buffer node, not two");
        assert.equal(result.meshCount, 1);

        // What is unique to each archive is all there: the walls of one, the types of the
        // other, and the boxes that inherit from them.
        const { document } = parseGlb(new Uint8Array(fs.readFileSync(result.outputPath)));
        const named = document.nodes!
            .map(n => (n as any).extensions?.MOSAIC_components?.components?.find((c: any) => c.type === "core::name")?.name)
            .filter(Boolean);
        assert.ok(named.includes("Box type"), "from typed-boxes");
        assert.ok(named.includes("Near box"), "and the things that are-a box type");
        assert.equal(document.nodes!.filter(n => n.mesh !== undefined).length, 8, "two walls plus six boxes");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("only the named archives are composed", async () => {
    const dir = tempDir();
    const database = path.join(dir, "pick.duckdb");
    const db = await MosaicDatabase.open(database);
    await db.insertArchive(await archive("gltf-box", dir));
    await db.insertArchive(await archive("typed-boxes", dir));
    await db.close();

    try {
        const result = await composeDatabaseToGlb(database, path.join(dir, "one.glb"), { files: ["gltf-box"] });

        assert.deepEqual(result.sources, ["gltf-box"]);
        assert.equal(result.binaryLength, 168, "only one archive's geometry");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("asking for an archive the database does not have says so", async () => {
    const dir = tempDir();
    const database = path.join(dir, "missing.duckdb");
    const db = await MosaicDatabase.open(database);
    await db.insertArchive(await archive("gltf-box", dir));
    await db.close();

    try {
        await assert.rejects(
            () => composeDatabaseToGlb(database, path.join(dir, "x.glb"), { files: ["nope"] }),
            /no archive called nope/,
        );
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("listFiles reports the archives in the order they were inserted", async () => {
    const dir = tempDir();
    const db = await MosaicDatabase.open(path.join(dir, "order.duckdb"));
    try {
        await db.insertArchive(await archive("typed-boxes", dir));
        await db.insertArchive(await archive("gltf-box", dir));
        await db.insertArchive(await archive("house-v1", dir));

        const files = await listFiles(db);
        assert.deepEqual(files.map(f => f.fileId), ["typed-boxes", "gltf-box", "house-v1"]);
        assert.deepEqual(files.map(f => f.ordinal), [0, 1, 2]);
        assert.equal(files[2]!.sections, 1);
    } finally {
        await db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("composing an empty database says so rather than writing nothing", async () => {
    const dir = tempDir();
    const database = path.join(dir, "empty.duckdb");
    const db = await MosaicDatabase.open(database);
    await db.close();

    try {
        await assert.rejects(() => composeDatabaseToGlb(database), /holds no archives/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
