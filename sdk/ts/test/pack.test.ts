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
import { indexOf } from "../src/ComponentReference.ts";

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

    assert.deepEqual(resolve(packed, WALL, indexOf(north.components![0]!)), {
        name: "North wall", height: 2.4, loadBearing: true,
    });
    assert.deepEqual(resolve(packed, PAINT, indexOf(north.components![1]!)), {
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

// ---------------------------------------------------------------------------
// Imports are references, not content: packing carries them through untouched
// and never pulls the data they name into the archive.
// ---------------------------------------------------------------------------

test("imports survive packing exactly as written", async () => {
    const source = readExample("linked-house");
    const bytes = await packMosaicSource(source, resolveExampleSchema);
    const zip = await new JSZip().loadAsync(bytes);
    const packedIndex = JSON.parse(await zip.file("index.json")!.async("string"));

    assert.deepEqual(packedIndex.imports, source.index.imports);
    assert.equal(packedIndex.imports[0].uri, "house-v1.tsr");
    assert.equal(packedIndex.imports[1].uri, "https://example.com/datasets/site-survey.tsr");
});

test("an import keeps its integrity hash, and one without stays without", async () => {
    const bytes = await packMosaicSource(readExample("linked-house"), resolveExampleSchema);
    const zip = await new JSZip().loadAsync(bytes);
    const packedIndex = JSON.parse(await zip.file("index.json")!.async("string"));

    // In the archive itself an unpinned import carries no integrity key at all.
    assert.match(packedIndex.imports[0].integrity, /^sha384-/);
    assert.equal(Object.hasOwn(packedIndex.imports[1], "integrity"), false);

    // Reading it back, the optional field is simply undefined.
    const [pinned, unpinned] = (await LoadMosaicFile(bytes)).index.imports;
    assert.equal(pinned.integrity, packedIndex.imports[0].integrity);
    assert.equal(unpinned.integrity, undefined);
});

test("packing does not pull imported files into the archive", async () => {
    const bytes = await packMosaicSource(readExample("linked-house"), resolveExampleSchema);
    const entries = Object.keys((await new JSZip().loadAsync(bytes)).files).sort();

    // Only this dataset's own index and component table -- nothing from house-v1.tsr.
    assert.deepEqual(entries, ["acme::geometry::wall.ndjson", "index.json"]);
});

test("imports are references, so packing does not require them to exist", async () => {
    const out = tempDir();
    const document = readExample("linked-house");
    document.index.imports = [{ uri: "nowhere/missing.tsr" }];
    fs.writeFileSync(path.join(out, "dangling.mosaic.json"), JSON.stringify(document));
    fs.cpSync(path.join(DATA_DIR, "schemas"), path.join(out, "schemas"), { recursive: true });

    const result = await packMosaicSourceFile(path.join(out, "dangling.mosaic.json"));
    const reloaded = await LoadMosaicFile(fs.readFileSync(result.outputPath));

    assert.deepEqual(reloaded.index.imports.map(i => i.uri), ["nowhere/missing.tsr"]);
});

test("imports pass through the CLI's own pack path onto disk", async () => {
    const out = tempDir();
    fs.cpSync(DATA_DIR, out, { recursive: true });

    const result = await packMosaicSourceFile(path.join(out, "linked-house.mosaic.json"));
    const reloaded = await LoadMosaicFile(fs.readFileSync(result.outputPath));

    // Compare on the fields the format defines; absent optionals read back as undefined.
    assert.deepEqual(
        reloaded.index.imports.map(i => ({ uri: i.uri, integrity: i.integrity })),
        readExample("linked-house").index.imports.map(i => ({ uri: i.uri, integrity: i.integrity })),
    );
    assert.deepEqual(reloaded.index.sections[0].nodes[0].components!.map(c => c.id), ["geometry"]);
});
