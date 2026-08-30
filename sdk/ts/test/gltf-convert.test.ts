import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import JSZip from "jszip";
import { LoadMosaicFile, type MosaicFile } from "../src/MosaicFile.ts";
import { buildMosaicFile, packMosaicSource } from "../src/MosaicPack.ts";
import { parseGltf, parseGlb, isGlb } from "../src/gltf/GltfDocument.ts";
import { gltfToMosaic } from "../src/gltf/GltfToMosaic.ts";
import { GLTF_TYPE } from "../src/gltf/schemas.ts";
import {
    convertGltfFile,
    convertGltfToSourceFile,
    convertGltfToArchiveFile,
    sourceOutputPath,
    archiveOutputPath,
} from "../src/gltf/GltfConvertFs.ts";
import { composeTrs, multiply, IDENTITY } from "../src/gltf/matrix.ts";
import { DATA_DIR, follow, componentsOf, decodeBuffer, type Row } from "./fixtures.ts";

const GLTF_DIR = path.join(DATA_DIR, "gltf");
const input = (name: string) => path.join(GLTF_DIR, name);

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mosaic-gltf-"));
}

/** Deterministic ids, so a conversion can be compared against another one. */
function counter(): () => string {
    let n = 0;
    return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

async function convert(name: string): Promise<MosaicFile> {
    const { document } = convertGltfFile(input(name), { newId: counter() });
    return await LoadMosaicFile(await packMosaicSource(document));
}

/**
 * Everything about a converted file except its provenance, which legitimately differs
 * between runs and between input files (source name, conversion timestamp).
 */
function structure(file: MosaicFile) {
    return {
        componentTables: file.index.componentTables,
        nodes: file.index.sections[0]!.nodes,
        components: [...file.serializedComponents],
    };
}

/** The mesh-bearing nodes of a converted file, in document order. */
function meshNodes(file: MosaicFile): Array<Record<string, Row>> {
    return file.index.sections[0]!.nodes
        .filter(node => (node.components ?? []).some(ref => ref.name.startsWith("mesh")))
        .map(node => componentsOf(file, node.id));
}

// ---------------------------------------------------------------------------
// GLB container
// ---------------------------------------------------------------------------

test("a GLB is recognised by its magic and a glTF JSON document is not", () => {
    assert.equal(isGlb(new Uint8Array(fs.readFileSync(input("box.glb")))), true);
    assert.equal(isGlb(new Uint8Array(fs.readFileSync(input("box-embedded.gltf")))), false);
});

test("parsing a GLB yields both its JSON document and its binary chunk", () => {
    const { document, binaryChunk } = parseGlb(new Uint8Array(fs.readFileSync(input("box.glb"))));

    assert.equal(document.asset?.version, "2.0");
    assert.equal(document.meshes?.length, 1);
    assert.ok(binaryChunk);
    // 168 bytes of geometry, padded to a 4-byte boundary.
    assert.equal(binaryChunk.byteLength, 168);
});

test("parseGltf accepts either container and rejects anything else", () => {
    assert.ok(parseGltf(new Uint8Array(fs.readFileSync(input("box.glb")))).binaryChunk);
    assert.equal(parseGltf(new Uint8Array(fs.readFileSync(input("box-embedded.gltf")))).binaryChunk, undefined);

    assert.throws(() => parseGltf(new TextEncoder().encode("not a model")), /neither a GLB container nor a JSON/);
});

test("a GLB with the wrong version is rejected", () => {
    const bytes = new Uint8Array(fs.readFileSync(input("box.glb")));
    new DataView(bytes.buffer, bytes.byteOffset).setUint32(4, 1, true);

    assert.throws(() => parseGlb(bytes), /Unsupported GLB version 1/);
});

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

test("converting produces a node per referenced element plus one per mesh node", async () => {
    const file = await convert("box.glb");
    const nodes = file.index.sections[0]!.nodes;

    // 1 buffer + 2 bufferViews + 2 accessors + 1 material, then 2 wall nodes.
    assert.equal(nodes.length, 8);
    assert.equal(meshNodes(file).length, 2);
    assert.deepEqual(Object.keys(file.serializedComponents).length, 0); // Map, not object
    assert.deepEqual(
        [...file.serializedComponents].map(([typeID, rows]) => [typeID, rows.length]),
        [
            [GLTF_TYPE.buffer, 1], [GLTF_TYPE.bufferView, 2], [GLTF_TYPE.accessor, 2],
            [GLTF_TYPE.meshPrimitive, 1], [GLTF_TYPE.material, 1], [GLTF_TYPE.nodeTransform, 2],
        ],
    );
});

test("every glTF index becomes a node id that resolves to the right component", async () => {
    const file = await convert("box.glb");
    const primitive = meshNodes(file)[0]!.mesh!;

    const position = follow(file, primitive.attributes.POSITION);
    const indices = follow(file, primitive.indices);

    assert.equal(position.name, "POSITION");
    assert.equal(position.type, "VEC3");
    assert.equal(indices.name, "indices");
    assert.equal(follow(file, primitive.material).name, "Painted brick");

    // ...and on through the bufferViews to the buffer.
    assert.equal(follow(file, position.bufferView).name, "positions");
    assert.equal(follow(file, follow(file, indices.bufferView).buffer).byteLength, 168);

    for (const reference of [primitive.attributes.POSITION, primitive.indices, primitive.material, position.bufferView]) {
        assert.match(reference as string, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
});

test("the converted buffer holds the geometry the accessors describe", async () => {
    const file = await convert("box.glb");
    const primitive = meshNodes(file)[0]!.mesh!;

    const position = follow(file, primitive.attributes.POSITION);
    const view = follow(file, position.bufferView);
    const bytes = decodeBuffer(follow(file, view.buffer).uri);

    assert.equal(bytes.byteLength, 168);
    assert.equal(position.count * 3 * 4, view.byteLength);

    const start = view.byteOffset + position.byteOffset;
    const xs = Array.from({ length: position.count }, (_, i) => bytes.readFloatLE(start + i * 12));
    assert.equal(Math.min(...xs), position.min[0]);
    assert.equal(Math.max(...xs), position.max[0]);
});

test("the same model converts identically from GLB, an embedded uri and an external .bin", async () => {
    const [fromGlb, fromEmbedded, fromExternal] = await Promise.all(
        ["box.glb", "box-embedded.gltf", "box-external.gltf"].map(convert),
    );

    // The provenance differs by design -- each records the file it came from.
    assert.deepEqual(structure(fromEmbedded!), structure(fromGlb!));
    assert.deepEqual(structure(fromExternal!), structure(fromGlb!));
    assert.notEqual(fromEmbedded!.index.sections[0]!.header.id, fromGlb!.index.sections[0]!.header.id);
});

test("a node under a parent gets its transform composed into world space", async () => {
    const flat = await convert("box-embedded.gltf");
    const nested = await convert("box-nested.gltf");

    // Flat file: the root nodes keep the TRS the glTF wrote.
    assert.deepEqual(meshNodes(flat)[0]!.transform!.translation, [0, 0, 0]);
    assert.deepEqual(meshNodes(flat)[0]!.transform!.scale, [4, 2.4, 0.2]);

    // Nested file: the same walls sit under a group translated by x=10, so they are
    // emitted as world matrices with that translation folded in.
    const [front, side] = meshNodes(nested);
    assert.equal(front!.transform!.translation, undefined);
    assert.deepEqual(front!.transform!.matrix.slice(12, 15), [10, 0, 0]);
    assert.deepEqual(side!.transform!.matrix.slice(12, 15), [10, 0, 3.5]);
});

test("group nodes that carry no mesh are reported as folded away", () => {
    const { warnings } = convertGltfFile(input("box-nested.gltf"), { newId: counter() });

    assert.ok(warnings.some(w => /1 node\(s\) carried no mesh/.test(w)), warnings.join("; "));
});

test("glTF fields the component subset cannot carry are reported, not dropped silently", () => {
    const { warnings } = convertGltfFile(input("box.glb"), { newId: counter() });

    assert.ok(warnings.some(w => w.includes("emissiveFactor") && w.includes("alphaMode")), warnings.join("; "));
    assert.ok(warnings.some(w => w.includes("baseColorTexture")), warnings.join("; "));
});

test("a sparse accessor is refused rather than converted into something wrong", () => {
    const gltf = JSON.parse(fs.readFileSync(input("box-embedded.gltf"), "utf-8"));
    gltf.accessors[0].sparse = { count: 1, indices: {}, values: {} };

    assert.throws(
        () => gltfToMosaic(gltf, { resolveBuffer: () => new Uint8Array(168), newId: counter() }),
        /Accessor 0 uses sparse storage/,
    );
});

test("a dangling glTF index is reported with what it pointed at", () => {
    const gltf = JSON.parse(fs.readFileSync(input("box-embedded.gltf"), "utf-8"));
    gltf.meshes[0].primitives[0].material = 7;

    assert.throws(
        () => gltfToMosaic(gltf, { resolveBuffer: () => new Uint8Array(168), newId: counter() }),
        /references material 7, which does not exist/,
    );
});

test("a mesh with several primitives numbers the components it puts on one node", () => {
    const gltf = JSON.parse(fs.readFileSync(input("box-embedded.gltf"), "utf-8"));
    gltf.meshes[0].primitives.push({ ...gltf.meshes[0].primitives[0] });

    const { document } = gltfToMosaic(gltf, { resolveBuffer: () => new Uint8Array(168), newId: counter() });
    const file = buildMosaicFile(document);
    const wall = file.index.sections[0]!.nodes.at(-2)!;

    assert.deepEqual(wall.components!.map(c => c.name), ["mesh.0", "mesh.1", "transform"]);
});

// ---------------------------------------------------------------------------
// Writing to disk
// ---------------------------------------------------------------------------

test("converting to a source document writes a .mosaic.json that packs", async () => {
    const out = tempDir();
    const result = convertGltfToSourceFile(input("box.glb"), path.join(out, "box.mosaic.json"));

    assert.equal(result.nodeCount, 8);
    assert.equal(result.componentCounts[GLTF_TYPE.accessor], 2);
    assert.equal(fs.statSync(result.outputPath).size, result.byteLength);

    // The schemas are inlined, so the document packs without a schema resolver.
    const document = JSON.parse(fs.readFileSync(result.outputPath, "utf-8"));
    const table = document.index.componentTables[0];
    assert.equal(typeof table.schema, "object");
    assert.equal(table.schema["x-mosaic-id"], GLTF_TYPE.buffer);

    const packed = await LoadMosaicFile(await packMosaicSource(document));
    assert.equal(packed.index.sections[0]!.nodes.length, 8);
});

test("converting straight to an archive gives the same result as converting then packing", async () => {
    const out = tempDir();

    const direct = await convertGltfToArchiveFile(input("box.glb"), path.join(out, "direct.tsr"), { newId: counter() });
    const viaSource = convertGltfToSourceFile(input("box.glb"), path.join(out, "box.mosaic.json"), { newId: counter() });
    const packedSeparately = await packMosaicSource(JSON.parse(fs.readFileSync(viaSource.outputPath, "utf-8")));

    const fromDirect = await LoadMosaicFile(fs.readFileSync(direct.outputPath));
    const fromSource = await LoadMosaicFile(packedSeparately);

    assert.deepEqual(structure(fromDirect), structure(fromSource));

    const entries = Object.keys((await new JSZip().loadAsync(fs.readFileSync(direct.outputPath))).files);
    assert.ok(entries.includes("index.json"));
    assert.ok(entries.includes(`${GLTF_TYPE.buffer}.ndjson`));
});

test("output paths default to the input's name with the right extension", () => {
    assert.equal(path.basename(sourceOutputPath("scene/box.glb")), "box.mosaic.json");
    assert.equal(path.basename(archiveOutputPath("scene/box.gltf")), "box.tsr");
});

test("converting without an output path writes beside the input", async () => {
    const out = tempDir();
    fs.copyFileSync(input("box.glb"), path.join(out, "copy.glb"));

    const result = convertGltfToSourceFile(path.join(out, "copy.glb"));
    assert.equal(result.outputPath, path.join(out, "copy.mosaic.json"));

    const archive = await convertGltfToArchiveFile(path.join(out, "copy.glb"));
    assert.equal(archive.outputPath, path.join(out, "copy.tsr"));
});

test("a missing input, and a buffer pointing at a missing file, are reported by name", () => {
    assert.throws(() => convertGltfToSourceFile("no-such-model.glb"), /no-such-model\.glb does not exist/);

    const out = tempDir();
    fs.copyFileSync(input("box-external.gltf"), path.join(out, "orphan.gltf"));
    assert.throws(() => convertGltfToSourceFile(path.join(out, "orphan.gltf")), /points at "box-external\.bin", which does not exist/);
});

// ---------------------------------------------------------------------------
// Transform maths
// ---------------------------------------------------------------------------

test("composeTrs builds the matrix glTF's T * R * S means", () => {
    assert.deepEqual(composeTrs(), IDENTITY);
    assert.deepEqual(composeTrs([1, 2, 3]).slice(12, 15), [1, 2, 3]);
    assert.deepEqual(composeTrs([0, 0, 0], [0, 0, 0, 1], [2, 3, 4]).filter((_, i) => i % 5 === 0), [2, 3, 4, 1]);

    // A quarter turn about y sends +x to -z.
    const quarterTurn = composeTrs([0, 0, 0], [0, Math.SQRT1_2, 0, Math.SQRT1_2]);
    assert.ok(Math.abs(quarterTurn[0]!) < 1e-6);
    assert.ok(Math.abs(quarterTurn[2]! + 1) < 1e-6);
});

test("multiply composes transforms parent-first", () => {
    const parent = composeTrs([10, 0, 0]);
    const child = composeTrs([0, 0, 5]);

    assert.deepEqual(multiply(parent, child).slice(12, 15), [10, 0, 5]);
    assert.deepEqual(multiply(IDENTITY, child), child);
});
