import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { LoadMosaicFile } from "../src/MosaicFile.ts";
import { packMosaicSource } from "../src/MosaicPack.ts";
import { packMosaicSourceFile } from "../src/MosaicPackFs.ts";
import { parseGlb } from "../src/gltf/GltfDocument.ts";
import { convertGltfFile } from "../src/gltf/GltfConvertFs.ts";
import { GLTF_TYPE } from "../src/gltf/schemas.ts";
import { CORE_TYPE } from "../src/core/schemas.ts";
import { mosaicToGltf, MOSAIC_COMPONENTS_EXTENSION, MOSAIC_ELEMENT_EXTENSION } from "../src/composition/MosaicToGltf.ts";
import { writeGlb } from "../src/composition/GlbWriter.ts";
import { composeArchive, composeArchiveToGlb, loadWithImports, glbOutputPath } from "../src/composition/ComposeFs.ts";
import { DATA_DIR, examplePath, readExample, resolveExampleSchema } from "./fixtures.ts";

const BOX_GLB = path.join(DATA_DIR, "gltf", "box.glb");

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mosaic-compose-"));
}

/** Packs an example, and everything it needs, into a scratch directory. */
async function stage(...examples: string[]): Promise<string> {
    const out = tempDir();
    fs.cpSync(path.join(DATA_DIR, "schemas"), path.join(out, "schemas"), { recursive: true });
    // The glTF component schemas live in the SDK, and the examples reach them by relative path.
    fs.cpSync(path.join(DATA_DIR, "..", "src", "gltf", "schemas"), path.join(out, "..", "src", "gltf", "schemas"), { recursive: true });

    for (const name of examples) {
        const copied = path.join(out, `${name}.mosaic.json`);
        fs.copyFileSync(examplePath(name), copied);
        await packMosaicSourceFile(copied, path.join(out, `${name}.tsr`));
    }

    return out;
}

/** The box model, converted and packed into an archive. */
async function stageBox(): Promise<string> {
    const out = tempDir();
    const { document } = convertGltfFile(BOX_GLB);
    fs.writeFileSync(path.join(out, "box.tsr"), await packMosaicSource(document));
    return out;
}

function positionsOf(glb: Uint8Array): { vertices: number[][]; indices: number[] } {
    const { document, binaryChunk } = parseGlb(glb);
    assert.ok(binaryChunk, "GLB has no binary chunk");

    const node = document.nodes!.find(n => n.mesh !== undefined)!;
    const primitive = document.meshes![node.mesh!]!.primitives[0]!;
    const bytes = Buffer.from(binaryChunk.buffer, binaryChunk.byteOffset, binaryChunk.byteLength);

    const read = (accessorIndex: number) => {
        const accessor = document.accessors![accessorIndex]!;
        const view = document.bufferViews![accessor.bufferView!]!;
        return { accessor, start: (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) };
    };

    const position = read(primitive.attributes.POSITION!);
    const vertices = Array.from({ length: position.accessor.count }, (_, i) => [
        bytes.readFloatLE(position.start + i * 12),
        bytes.readFloatLE(position.start + i * 12 + 4),
        bytes.readFloatLE(position.start + i * 12 + 8),
    ]);

    const index = read(primitive.indices!);
    const indices = Array.from({ length: index.accessor.count }, (_, i) => bytes.readUInt16LE(index.start + i * 2));

    return { vertices, indices };
}

// ---------------------------------------------------------------------------
// GLB container
// ---------------------------------------------------------------------------

test("the GLB writer produces a container its own parser reads back", () => {
    const document = { asset: { version: "2.0" }, nodes: [{ name: "a" }] };
    const binary = new Uint8Array([1, 2, 3, 4, 5]);

    const parsed = parseGlb(writeGlb(document, binary));

    assert.deepEqual(parsed.document.nodes, [{ name: "a" }]);
    // The chunk is padded to a 4-byte boundary, so 5 bytes become 8.
    assert.equal(parsed.binaryChunk?.byteLength, 8);
    assert.deepEqual([...parsed.binaryChunk!.subarray(0, 5)], [1, 2, 3, 4, 5]);
});

test("every chunk in a written GLB starts on a 4-byte boundary", () => {
    // An odd-length JSON payload and an odd-length binary, so padding has to happen.
    const glb = writeGlb({ asset: { version: "2.0" }, scenes: [{ name: "x" }] }, new Uint8Array(7));
    const view = new DataView(glb.buffer, glb.byteOffset);

    assert.equal(glb.byteLength % 4, 0);
    assert.equal(view.getUint32(8, true), glb.byteLength, "header length should match the file");

    const jsonLength = view.getUint32(12, true);
    assert.equal(jsonLength % 4, 0);
    assert.equal(view.getUint32(20 + jsonLength, true) % 4, 0);
});

test("a GLB with no geometry is written without a binary chunk", async () => {
    const out = await stage("house-v1");
    const composed = await composeArchive(path.join(out, "house-v1.tsr"));

    assert.equal(composed.binary.byteLength, 0);
    assert.equal(composed.document.buffers, undefined);
    assert.equal(parseGlb(writeGlb(composed.document, composed.binary)).binaryChunk, undefined);
});

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

test("composing an archive gives a node for every Mosaic node", async () => {
    const out = await stageBox();
    const composed = await composeArchive(path.join(out, "box.tsr"));

    // 1 buffer + 2 bufferViews + 2 accessors + 1 material + 2 walls.
    assert.equal(composed.document.nodes?.length, 8);

    const file = await LoadMosaicFile(fs.readFileSync(path.join(out, "box.tsr")));
    const ids = file.index.sections[0]!.nodes.map(n => n.id).sort();
    assert.deepEqual(composed.document.nodes!.map(n => n.name).sort(), ids, "each glTF node should keep its Mosaic id");
});

test("glTF-namespace components are written natively", async () => {
    const out = await stageBox();
    const { document } = await composeArchive(path.join(out, "box.tsr"));

    assert.equal(document.buffers?.length, 1);
    assert.equal(document.bufferViews?.length, 2);
    assert.equal(document.accessors?.length, 2);
    assert.equal(document.materials?.length, 1);
    assert.equal(document.materials![0]!.name, "Painted brick");

    // Two walls referencing one primitive row share a single mesh.
    assert.equal(document.meshes?.length, 1);
    const meshNodes = document.nodes!.filter(n => n.mesh !== undefined);
    assert.equal(meshNodes.length, 2);
    assert.deepEqual(meshNodes.map(n => n.mesh), [0, 0]);
    assert.deepEqual(meshNodes[0]!.scale, [4, 2.4, 0.2]);
});

test("components outside the glTF namespace travel as an extension", async () => {
    const out = await stage("house-v1");
    const { document } = await composeArchive(path.join(out, "house-v1.tsr"));

    assert.deepEqual(document.extensionsUsed, [MOSAIC_COMPONENTS_EXTENSION]);
    assert.equal(document.extensionsRequired, undefined, "a viewer must not be required to understand it");

    const north = document.nodes!.find(n => n.name === "11111111-1111-4111-8111-111111111111")! as any;
    const carried = north.extensions[MOSAIC_COMPONENTS_EXTENSION].components;

    assert.deepEqual(carried.map((c: any) => c.name), ["geometry", "paint"]);
    assert.equal(carried[0].typeID, "acme::geometry::wall");
    assert.deepEqual(carried[0].value, { name: "North wall", height: 2.4, loadBearing: true });
});

test("a node hoisted into a glTF array records where it went", async () => {
    const out = await stageBox();
    const { document } = await composeArchive(path.join(out, "box.tsr"));

    const hoisted = document.nodes!.filter(n => (n as any).extensions?.[MOSAIC_ELEMENT_EXTENSION]);
    assert.equal(hoisted.length, 6, "1 buffer + 2 bufferViews + 2 accessors + 1 material");

    const accessorNodes = hoisted.filter(n => (n as any).extensions[MOSAIC_ELEMENT_EXTENSION].typeID === GLTF_TYPE.accessor);
    assert.deepEqual(accessorNodes.map(n => (n as any).extensions[MOSAIC_ELEMENT_EXTENSION].index).sort(), [0, 1]);
});

test("buffers become one binary chunk with the bufferViews shifted to match", async () => {
    const out = await stageBox();
    const composed = await composeArchive(path.join(out, "box.tsr"));

    assert.equal(composed.binary.byteLength, 168);
    assert.equal(composed.document.buffers![0]!.byteLength, 168);
    assert.equal(composed.document.buffers![0]!.uri, undefined, "a GLB buffer must have no uri");

    for (const view of composed.document.bufferViews!) {
        assert.equal(view.buffer, 0);
        assert.ok((view.byteOffset ?? 0) + view.byteLength <= composed.binary.byteLength, `${view.name} runs past the chunk`);
    }
    assert.deepEqual(composed.document.bufferViews!.map(v => v.byteOffset), [0, 96]);
});

test("two buffers are laid end to end, each starting 4-byte aligned", async () => {
    // A second buffer of an awkward length, so the next one has to be padded forward.
    const document = readExample("gltf-box");
    const buffers = document.components[GLTF_TYPE.buffer] as any[];
    buffers.push({ name: "extra", byteLength: 5, uri: "data:application/octet-stream;base64,AQIDBAU=" });

    const views = document.components[GLTF_TYPE.bufferView] as any[];
    const bufferNodeId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    document.index.sections[0]!.nodes.push({
        id: bufferNodeId,
        components: [{ name: "buffer", typeID: GLTF_TYPE.buffer, componentIndex: 1, operation: "VALUE" as any }],
    });
    views.push({ name: "extra", buffer: bufferNodeId, byteOffset: 0, byteLength: 5 });
    document.index.sections[0]!.nodes.push({
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        components: [{ name: "bufferView", typeID: GLTF_TYPE.bufferView, componentIndex: 2, operation: "VALUE" as any }],
    });

    const file = await LoadMosaicFile(await packMosaicSource(document, resolveExampleSchema));
    const composed = mosaicToGltf(file);

    // 168 is already a multiple of 4, so the second buffer starts exactly there.
    assert.equal(composed.document.bufferViews!.at(-1)!.byteOffset, 168);
    assert.equal(composed.binary.byteLength, 176, "168 + 5, padded to a 4-byte boundary");
    assert.deepEqual([...composed.binary.subarray(168, 173)], [1, 2, 3, 4, 5]);
});

test("a reference to a node carrying no such component is reported", async () => {
    const document = readExample("gltf-box");
    (document.components[GLTF_TYPE.accessor] as any[])[0]!.bufferView = "00000000-0000-4000-8000-000000000000";

    const file = await LoadMosaicFile(await packMosaicSource(document, resolveExampleSchema));
    assert.throws(() => mosaicToGltf(file), /carries no bufferView component/);
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

test("composing follows imports and merges them underneath the importing file", async () => {
    const out = await stageBox();
    fs.writeFileSync(path.join(out, "annotations.mosaic.json"), JSON.stringify({
        components: { "acme::geometry::wall": [{ name: "Annotated wall", height: 2.4 }] },
        index: {
            header: { MosaicVersion: "post-alpha" },
            imports: [{ uri: "box.tsr" }],
            componentTables: [],
            sections: [{
                header: { id: "a", message: "", dataVersion: "1.0.0", author: "", timestamp: "", application: "" },
                nodes: [{
                    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                    components: [{ name: "geometry", typeID: "acme::geometry::wall", componentIndex: 0, operation: "VALUE" }],
                }],
            }],
        },
    }));
    await packMosaicSourceFile(path.join(out, "annotations.mosaic.json"), path.join(out, "annotations.tsr"));

    const composed = await composeArchive(path.join(out, "annotations.tsr"));

    assert.deepEqual(composed.sources.map(s => path.basename(s)), ["box.tsr", "annotations.tsr"]);
    // The 8 nodes of the import, plus the annotated one.
    assert.equal(composed.document.nodes?.length, 9);
    assert.equal(composed.document.meshes?.length, 1, "geometry came through the import");
    assert.deepEqual(composed.document.extensionsUsed?.sort(), [MOSAIC_COMPONENTS_EXTENSION, MOSAIC_ELEMENT_EXTENSION]);
});

test("an import that is not on disk is skipped and reported", async () => {
    const out = await stage("linked-house", "house-v1");
    const { warnings, sources } = await composeArchive(path.join(out, "linked-house.tsr"));

    assert.deepEqual(sources.map(s => path.basename(s)), ["house-v1.tsr", "linked-house.tsr"]);
    assert.ok(warnings.some(w => w.includes("https://example.com")), warnings.join("; "));
});

test("an import missing from disk is reported with what referenced it", async () => {
    const out = await stage("linked-house");

    await assert.rejects(
        () => composeArchive(path.join(out, "linked-house.tsr")),
        /Import "house-v1\.tsr", referenced by linked-house\.tsr, does not exist/,
    );
});

test("loadWithImports rejects a cycle rather than looping", async () => {
    const out = tempDir();
    const selfImporting = {
        components: {},
        index: {
            header: { MosaicVersion: "post-alpha" },
            imports: [{ uri: "loop.tsr" }],
            componentTables: [],
            sections: [],
        },
    };
    fs.writeFileSync(path.join(out, "loop.tsr"), await packMosaicSource(selfImporting as any));

    await assert.rejects(() => loadWithImports(path.join(out, "loop.tsr")), /Import cycle/);
});

// ---------------------------------------------------------------------------
// Round trip and output
// ---------------------------------------------------------------------------

test("geometry survives glTF -> Mosaic -> GLB unchanged", async () => {
    const out = await stageBox();
    const result = await composeArchiveToGlb(path.join(out, "box.tsr"), path.join(out, "box.glb"));

    const original = positionsOf(new Uint8Array(fs.readFileSync(BOX_GLB)));
    const composed = positionsOf(new Uint8Array(fs.readFileSync(result.outputPath)));

    assert.deepEqual(composed.vertices, original.vertices);
    assert.deepEqual(composed.indices, original.indices);
});

test("the composed GLB carries what a renderer needs", async () => {
    const out = await stageBox();
    const { document } = await composeArchive(path.join(out, "box.tsr"));

    assert.equal(document.asset?.version, "2.0");
    assert.equal(document.scene, 0);
    assert.deepEqual(document.scenes![0]!.nodes, document.nodes!.map((_, i) => i));

    for (const accessor of document.accessors!) {
        assert.ok(accessor.bufferView !== undefined, `accessor ${accessor.name} has no bufferView`);
        assert.ok(accessor.count >= 1);
        // An accessor's offset into the chunk must suit its component size.
        const view = document.bufferViews![accessor.bufferView]!;
        const size = accessor.componentType === 5126 ? 4 : accessor.componentType === 5123 ? 2 : 1;
        assert.equal(((view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)) % size, 0, `accessor ${accessor.name} is misaligned`);
    }

    const position = document.accessors!.find(a => a.type === "VEC3")!;
    assert.ok(position.min && position.max, "POSITION needs min/max to be valid glTF");
});

test("composing writes a .glb and defaults its name from the input", async () => {
    const out = await stageBox();

    assert.equal(path.basename(glbOutputPath("scene/house.tsr")), "house.glb");

    const result = await composeArchiveToGlb(path.join(out, "box.tsr"));
    assert.equal(result.outputPath, path.join(out, "box.glb"));
    assert.equal(fs.statSync(result.outputPath).size, result.byteLength);
    assert.equal(result.nodeCount, 8);
    assert.equal(result.meshCount, 1);
    assert.equal(result.binaryLength, 168);
});

test("textures compose back into images, samplers and textures", async () => {
    const out = tempDir();
    const { document } = convertGltfFile(path.join(DATA_DIR, "gltf", "box-textured.gltf"));
    fs.writeFileSync(path.join(out, "textured.tsr"), await packMosaicSource(document));

    const composed = await composeArchive(path.join(out, "textured.tsr"));

    assert.equal(composed.document.images?.length, 1);
    assert.equal(composed.document.samplers?.length, 1);
    assert.equal(composed.document.textures?.length, 1);

    // Indices, not node ids, on the way back out.
    const material = composed.document.materials![0]!;
    assert.equal(material.pbrMetallicRoughness?.baseColorTexture?.index, 0);
    assert.equal(composed.document.textures![0]!.source, 0);
    assert.equal(composed.document.textures![0]!.sampler, 0);
    assert.equal(composed.document.samplers![0]!.magFilter, 9729);
});

test("an image held as a data URI is moved into the binary chunk", async () => {
    const out = tempDir();
    const { document } = convertGltfFile(path.join(DATA_DIR, "gltf", "box-textured.gltf"));
    fs.writeFileSync(path.join(out, "textured.tsr"), await packMosaicSource(document));

    const composed = await composeArchive(path.join(out, "textured.tsr"));
    const image = composed.document.images![0]!;

    assert.equal(image.uri, undefined, "a GLB should carry its image as bytes, not base64 text");
    assert.equal(image.mimeType, "image/png");
    assert.ok(image.bufferView !== undefined);

    // The bytes really are in the chunk, and they are a PNG.
    const view = composed.document.bufferViews![image.bufferView]!;
    const at = view.byteOffset ?? 0;
    assert.deepEqual([...composed.binary.subarray(at, at + 4)], [0x89, 0x50, 0x4e, 0x47]);
    assert.ok(at + view.byteLength <= composed.binary.byteLength);
    // Geometry came first, so the image sits past it, on a 4-byte boundary.
    assert.ok(at >= 232);
    assert.equal(at % 4, 0);
});

// ---------------------------------------------------------------------------
// core::child: the link lives in the name of the reference
// ---------------------------------------------------------------------------

const GROUP = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";
const WALL_FRONT = "55555555-5555-4555-8555-555555555555";
const WALL_SIDE = "66666666-6666-4666-8666-666666666666";

/** Composes the hierarchy example, after any edits, without touching the repository. */
async function composeHierarchy(edit?: (document: any) => void) {
    const document = readExample("gltf-box-hierarchy");
    edit?.(document);

    const out = tempDir();
    const archive = path.join(out, "hierarchy.tsr");
    fs.writeFileSync(archive, await packMosaicSource(document, resolveExampleSchema));

    return await composeArchive(archive);
}

/** A section that adds one component reference to a node. */
function section(id: string, nodeId: string, component: any) {
    return {
        header: { id, message: "", dataVersion: "1.0.0", author: "", timestamp: "", application: "" },
        nodes: [{ id: nodeId, components: [component] }],
    };
}

test("a core::child link becomes a glTF child, named by the reference not the value", async () => {
    const { document } = await composeHierarchy();

    const byName = new Map(document.nodes!.map((n, i) => [n.name!, i]));
    const group = document.nodes![byName.get(GROUP)!]!;

    assert.deepEqual(group.children, [byName.get(WALL_FRONT), byName.get(WALL_SIDE)]);
    // The component itself carries nothing; the id is in the name of the reference.
    assert.deepEqual(readExample("gltf-box-hierarchy").components[CORE_TYPE.child], [{}]);
});

test("a node that is someone's child is not also a root of the scene", async () => {
    const { document } = await composeHierarchy();

    const byName = new Map(document.nodes!.map((n, i) => [n.name!, i]));
    const roots = document.scenes![0]!.nodes!;

    assert.ok(roots.includes(byName.get(GROUP)!), "the group should be a root");
    assert.ok(!roots.includes(byName.get(WALL_FRONT)!), "a child must not also be a root");
    assert.ok(!roots.includes(byName.get(WALL_SIDE)!), "a child must not also be a root");
    // Every node is still reachable: roots plus the children of the roots.
    assert.equal(roots.length + 2, document.nodes!.length);
});

test("a DELETE on the child name removes just that link", async () => {
    const { document } = await composeHierarchy(doc => {
        doc.index.sections.push(section("unparent", GROUP, {
            name: WALL_SIDE, typeID: CORE_TYPE.child, componentIndex: 0, operation: "DELETE",
        }));
    });

    const byName = new Map(document.nodes!.map((n, i) => [n.name!, i]));
    const group = document.nodes![byName.get(GROUP)!]!;

    assert.deepEqual(group.children, [byName.get(WALL_FRONT)], "only the front wall should still be a child");
    assert.ok(document.scenes![0]!.nodes!.includes(byName.get(WALL_SIDE)!), "the freed node becomes a root again");
});

test("core::child is consumed as hierarchy, not carried as extension data", async () => {
    const { document } = await composeHierarchy();

    const group = document.nodes!.find(n => n.name === GROUP)! as any;
    const carried = group.extensions?.[MOSAIC_COMPONENTS_EXTENSION]?.components ?? [];

    assert.equal(carried.length, 0, "the child links should not be repeated in the extension");
});

test("a child link naming a node that is not present is reported and skipped", async () => {
    const { document, warnings } = await composeHierarchy(doc => {
        doc.index.sections[0].nodes.at(-1).components.push({
            name: "00000000-0000-4000-8000-000000000000", typeID: CORE_TYPE.child, componentIndex: 0, operation: "VALUE",
        });
    });

    assert.ok(warnings.some(w => w.includes("no such node is present")), warnings.join("; "));
    assert.equal(document.nodes!.find(n => n.name === GROUP)!.children?.length, 2);
});

test("a node naming itself as a child is reported and skipped", async () => {
    const { document, warnings } = await composeHierarchy(doc => {
        doc.index.sections.push(section("self", GROUP, {
            name: GROUP, typeID: CORE_TYPE.child, componentIndex: 0, operation: "VALUE",
        }));
    });

    assert.ok(warnings.some(w => w.includes("names itself as a child")), warnings.join("; "));
    assert.equal(document.nodes!.find(n => n.name === GROUP)!.children?.length, 2);
});

test("a node named by two parents is placed under each of them", async () => {
    // glTF gives a node one parent, so placing one thing twice means two nodes. They
    // share a mesh, so the geometry is stored once however often it is placed.
    const { document, warnings } = await composeHierarchy(doc => {
        doc.index.sections.push(section("second-parent", WALL_FRONT, {
            name: WALL_SIDE, typeID: CORE_TYPE.child, componentIndex: 0, operation: "VALUE",
        }));
    });

    assert.deepEqual(warnings, []);

    const copies = document.nodes!.filter(n => n.name === WALL_SIDE);
    assert.equal(copies.length, 2, "the side wall is placed twice, so it is written twice");
    assert.equal(new Set(copies.map(n => n.mesh)).size, 1, "both copies should share one mesh");
    assert.equal(document.meshes?.length, 1, "so the geometry is stored once");

    // One copy hangs off the group, the other off the front wall.
    const parents = document.nodes!.filter(n => (n.children ?? []).some(i => document.nodes![i]!.name === WALL_SIDE));
    assert.deepEqual(parents.map(n => n.name).sort(), [GROUP, WALL_FRONT].sort());
});

test("the same node placed three times keeps one copy of its geometry", async () => {
    const { document } = await composeHierarchy(doc => {
        const nodes = doc.index.sections[0].nodes;
        for (const id of ["d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1", "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2"]) {
            nodes.push({
                id,
                components: [{ name: WALL_FRONT, typeID: CORE_TYPE.child, componentIndex: 0, operation: "VALUE" }],
            });
        }
    });

    // Once under the group, and once under each of the two new parents.
    assert.equal(document.nodes!.filter(n => n.name === WALL_FRONT).length, 3);
    assert.equal(document.meshes?.length, 1);
    assert.equal(document.accessors?.length, 2, "the placements share one set of accessors");
});

test("a node placed twice carries its own subtree each time", async () => {
    // The group is placed twice, so its children are written twice too.
    const { document } = await composeHierarchy(doc => {
        doc.index.sections[0].nodes.push({
            id: "d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3",
            components: [{ name: GROUP, typeID: CORE_TYPE.child, componentIndex: 0, operation: "VALUE" }],
        });
    });

    assert.equal(document.nodes!.filter(n => n.name === GROUP).length, 1, "the group has one parent");
    assert.equal(document.nodes!.filter(n => n.name === WALL_FRONT).length, 1);

    const outer = document.nodes!.find(n => n.name === "d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3")!;
    const group = document.nodes![outer.children![0]!]!;
    assert.equal(group.name, GROUP);
    assert.equal(group.children?.length, 2, "the walls came along under it");
});

test("child links that form a cycle are refused", async () => {
    await assert.rejects(
        () => composeHierarchy(doc => {
            // The front wall adopts the group that already parents it.
            doc.index.sections.push(section("cycle", WALL_FRONT, {
                name: GROUP, typeID: CORE_TYPE.child, componentIndex: 0, operation: "VALUE",
            }));
        }),
        /Child links form a cycle/,
    );
});

// ---------------------------------------------------------------------------
// The instancing example: one mesh, placed four times through two levels of links
// ---------------------------------------------------------------------------

/** The core::name a composed node carries, which is how the example labels its nodes. */
function labelOf(node: any): string | undefined {
    const carried = node.extensions?.[MOSAIC_COMPONENTS_EXTENSION]?.components ?? [];
    return carried.find((c: any) => c.typeID === CORE_TYPE.name)?.value?.name;
}

async function composeInstancedBoxes() {
    const out = tempDir();
    const document = readExample("instanced-boxes");
    fs.writeFileSync(path.join(out, "boxes.tsr"), await packMosaicSource(document, resolveExampleSchema));

    return await composeArchive(path.join(out, "boxes.tsr"));
}

test("the instancing example places one mesh four times", async () => {
    const { document, warnings } = await composeInstancedBoxes();

    assert.deepEqual(warnings, []);
    assert.equal(document.meshes?.length, 1, "one mesh...");
    assert.equal(document.accessors?.length, 2, "...and one set of accessors");
    assert.equal(document.nodes!.filter(n => n.mesh !== undefined).length, 4, "placed four times");
});

test("a subtree named by two parents is written out under each of them", async () => {
    const { document } = await composeInstancedBoxes();

    // Two rows, each holding a pair, each holding two placements of the one box.
    assert.equal(document.nodes!.filter(n => labelOf(n) === "Pair").length, 2);
    assert.equal(document.nodes!.filter(n => labelOf(n) === "Left").length, 2);
    assert.equal(document.nodes!.filter(n => labelOf(n) === "Right").length, 2);
    assert.equal(document.nodes!.filter(n => labelOf(n) === "Box").length, 4);
});

test("each placement of the example sits where its parents put it", async () => {
    const { document } = await composeInstancedBoxes();

    // A box's world position is its row plus its side; the four differ.
    const placements = document.nodes!
        .filter(n => n.children?.some(i => labelOf(document.nodes![i]!) === "Box"))
        .map(n => n.translation);

    assert.equal(placements.length, 4);
    assert.deepEqual(
        [...new Set(placements.map(p => JSON.stringify(p)))].sort(),
        ["[-1,0,0]", "[1,0,0]"].sort(),
        "two sides, each appearing under both rows",
    );

    const rows = document.nodes!.filter(n => labelOf(n)?.endsWith("row")).map(n => n.translation);
    assert.deepEqual(rows.sort(), [[0, 0, -2], [0, 0, 2]].sort());
});

test("the geometry is stored once however often it is placed", async () => {
    const { document, binary } = await composeInstancedBoxes();

    // 8 VEC3 positions and 36 UNSIGNED_SHORT indices: the same 168 bytes as one box.
    assert.equal(binary.byteLength, 168);
    assert.equal(document.bufferViews?.length, 2);
});

test("a missing input archive is reported by name", async () => {
    await assert.rejects(() => composeArchiveToGlb("no-such.tsr"), /no-such\.tsr does not exist/);
});
