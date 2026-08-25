import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import JSZip from "jszip";
import { LoadMosaicFile } from "../src/MosaicFile.ts";
import { buildMosaicFile, packMosaicSource, type MosaicSourceDocument } from "../src/MosaicPack.ts";
import { packMosaicSourceFile, defaultOutputPath } from "../src/MosaicPackFs.ts";
import { DATA_DIR, examplePath, readExample, readSchema, resolveExampleSchema, resolve } from "./fixtures.ts";

const WALL = "acme::geometry::wall";
const PAINT = "acme::material::paint";

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mosaic-pack-"));
}

test("packing inlines schema references as schema documents", async () => {
    const packed = await LoadMosaicFile(await packMosaicSource(readExample("house-v1"), resolveExampleSchema));

    for (const table of packed.index.componentTables) {
        assert.equal(typeof table.schema, "object", `${table.filename} kept an unresolved schema`);
    }

    const wall = packed.index.componentTables.find(t => t.filename === `${WALL}.ndjson`)!;
    assert.deepEqual(wall.schema, JSON.parse(readSchema("wall")));
});

test("packing puts an ndjson file per component table alongside the index", async () => {
    const bytes = await packMosaicSource(readExample("house-v1"), resolveExampleSchema);
    const entries = Object.keys((await new JSZip().loadAsync(bytes)).files).sort();

    assert.deepEqual(entries, ["acme::geometry::wall.ndjson", "acme::material::paint.ndjson", "index.json"]);
});

test("each component row becomes one line of its ndjson file", async () => {
    const bytes = await packMosaicSource(readExample("house-v1"), resolveExampleSchema);
    const zip = await new JSZip().loadAsync(bytes);
    const lines = (await zip.file(`${WALL}.ndjson`)!.async("string")).split("\n");

    assert.equal(lines.length, 2);
    assert.deepEqual(lines.map(line => JSON.parse(line).name), ["North wall", "South wall"]);
});

test("a packed example round trips to the rows it declared", async () => {
    const packed = await LoadMosaicFile(await packMosaicSource(readExample("house-v1"), resolveExampleSchema));
    const north = packed.index.sections[0].nodes[0];

    assert.deepEqual(resolve(packed, WALL, north.components![0].componentIndex), {
        name: "North wall", height: 2.4, loadBearing: true,
    });
    assert.deepEqual(resolve(packed, PAINT, north.components![1].componentIndex), {
        color: "white", finish: "matte",
    });
});

test("rows already written as serialized lines are kept as they are", () => {
    const document: MosaicSourceDocument = {
        components: { [WALL]: ['{"name":"Raw wall","height":2}'] },
        index: { header: { MosaicVersion: "post-alpha" }, imports: [], componentTables: [], sections: [] },
    };

    assert.equal(buildMosaicFile(document).readRawComponent(WALL, 0), '{"name":"Raw wall","height":2}');
});

test("a malformed component row is rejected with its location", () => {
    const document: MosaicSourceDocument = {
        components: { [WALL]: ['{"name": broken}'] },
        index: { header: { MosaicVersion: "post-alpha" }, imports: [], componentTables: [], sections: [] },
    };

    assert.throws(
        () => buildMosaicFile(document),
        (err: Error) => err.message === `Component ${WALL}[0] is not valid JSON`,
    );
});

test("an unresolvable schema reference is rejected when no resolver is given", () => {
    assert.throws(() => buildMosaicFile(readExample("house-v1")), /no schema resolver was provided/);
});

test("a malformed index is rejected before anything is written", () => {
    const document = { components: {}, index: { header: {} } } as unknown as MosaicSourceDocument;

    assert.throws(() => buildMosaicFile(document));
});

test("packing a file on disk writes a .tsr beside it", async () => {
    const out = tempDir();
    const result = await packMosaicSourceFile(examplePath("house-v1"), path.join(out, "house-v1.tsr"));

    assert.equal(path.extname(result.outputPath), ".tsr");
    assert.equal(result.componentCount, 3);
    assert.deepEqual(result.tables.sort(), [`${WALL}.ndjson`, `${PAINT}.ndjson`].sort());
    assert.equal(fs.statSync(result.outputPath).size, result.byteLength);

    const reloaded = await LoadMosaicFile(fs.readFileSync(result.outputPath));
    assert.equal(reloaded.index.sections[0].header.id, "house-v1");
    assert.equal(typeof reloaded.index.componentTables[0].schema, "object");
});

test("the default output path replaces every extension with .tsr", () => {
    assert.equal(path.basename(defaultOutputPath("data/house-v1.mosaic.json")), "house-v1.tsr");
    assert.equal(path.basename(defaultOutputPath("house-v1.json")), "house-v1.tsr");
});

test("packing without an output path writes next to the source document", async () => {
    const out = tempDir();
    const copied = path.join(out, "copy.mosaic.json");
    fs.copyFileSync(examplePath("house-v1"), copied);
    fs.cpSync(path.join(DATA_DIR, "schemas"), path.join(out, "schemas"), { recursive: true });

    const result = await packMosaicSourceFile(copied);

    assert.equal(result.outputPath, path.join(out, "copy.tsr"));
    assert.ok(fs.existsSync(result.outputPath));
});

test("a missing input file is reported by name", async () => {
    await assert.rejects(() => packMosaicSourceFile("no-such-file.json"), /no-such-file\.json does not exist/);
});

test("a missing schema is reported with the reference and the resolved path", async () => {
    const out = tempDir();
    const orphan = path.join(out, "orphan.mosaic.json");
    fs.copyFileSync(examplePath("house-v1"), orphan);

    await assert.rejects(() => packMosaicSourceFile(orphan), /Schema "schemas\/wall\.schema\.json".*does not exist/s);
});
