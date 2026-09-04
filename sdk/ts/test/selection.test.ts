import test from "node:test";
import assert from "node:assert/strict";
import { selectNodes } from "../src/Selection.ts";
import { LoadMosaicFile, WriteMosaicFile } from "../src/MosaicFile.ts";
import { packMosaicSource } from "../src/MosaicPack.ts";
import { mosaicToGltf } from "../src/composition/MosaicToGltf.ts";
import { collapseNodesByPath } from "../src/MosaicFileOperations.ts";
import { CORE_TYPE } from "../src/core/schemas.ts";
import { GLTF_TYPE } from "../src/gltf/schemas.ts";
import { readExample, resolveExampleSchema } from "./fixtures.ts";

const WALL_FRONT = "55555555-5555-4555-8555-555555555555";
const WALL_SIDE = "66666666-6666-4666-8666-666666666666";
const NORTH = "11111111-1111-4111-8111-111111111111";

/** The box example: two walls sharing a mesh, plus the plumbing the mesh needs. */
async function box() {
    return await LoadMosaicFile(await packMosaicSource(readExample("gltf-box"), resolveExampleSchema));
}

/** The instancing example, which has a hierarchy of child links. */
async function boxes() {
    return await LoadMosaicFile(await packMosaicSource(readExample("instanced-boxes"), resolveExampleSchema));
}

test("asking for one node gives that node", async () => {
    const selection = selectNodes(await box(), { nodes: [WALL_FRONT] });

    assert.ok(selection.nodeIds.includes(WALL_FRONT));
    assert.deepEqual(selection.missing, []);
});

test("a node that is not there is reported rather than invented", async () => {
    const selection = selectNodes(await box(), { nodes: [WALL_FRONT, "00000000-0000-4000-8000-000000000000"] });

    assert.deepEqual(selection.missing, ["00000000-0000-4000-8000-000000000000"]);
    assert.equal(selection.nodeIds.length > 0, true);
});

test("what a kept component points at comes along, so the subset stands on its own", async () => {
    const selection = selectNodes(await box(), { nodes: [WALL_FRONT] });

    // The wall carries a mesh, which names accessors, which name bufferViews and a buffer.
    assert.ok(selection.pulledIn.length > 0, "the geometry the mesh refers to should have come along");

    for (const node of selection.file.index.sections[0]!.nodes) {
        for (const reference of node.components ?? []) {
            if (reference.index === undefined || reference.index < 0) continue;
            assert.doesNotThrow(
                () => selection.file.readRawComponent(reference.type, reference.index!),
                `${node.id}/${reference.id} does not resolve in the subset`,
            );
        }
    }
});

test("a subset is a file in its own right", async () => {
    const selection = selectNodes(await box(), { nodes: [WALL_FRONT] });

    // It writes as an archive and reads back with everything still resolving.
    const reloaded = await LoadMosaicFile(await WriteMosaicFile(selection.file));
    assert.equal(reloaded.index.sections.length, 1);

    // And it composes: one wall, one mesh, the geometry it needs.
    const composed = mosaicToGltf(reloaded);
    assert.equal(composed.document.meshes?.length, 1);
    assert.equal(composed.binary.byteLength, 168);
    assert.deepEqual(composed.warnings, []);
});

test("asking for a subset of component types keeps only those", async () => {
    const selection = selectNodes(await box(), {
        nodes: [WALL_FRONT],
        componentTypes: [CORE_TYPE.transform],
    });

    const wall = selection.file.index.sections[0]!.nodes.find(node => node.id === WALL_FRONT)!;
    assert.deepEqual(wall.components!.map(c => c.type), [CORE_TYPE.transform]);
    // With no mesh kept, there is no geometry to pull in either.
    assert.deepEqual(selection.pulledIn, []);
});

test("the filter applies to what was asked for, not to what was pulled in", async () => {
    const selection = selectNodes(await box(), {
        nodes: [WALL_FRONT],
        componentTypes: [GLTF_TYPE.meshPrimitive],
    });

    const wall = selection.file.index.sections[0]!.nodes.find(node => node.id === WALL_FRONT)!;
    assert.deepEqual(wall.components!.map(c => c.type), [GLTF_TYPE.meshPrimitive], "the wall kept only its mesh");

    // The accessors and buffer it needs are whole, or the mesh would name nothing.
    const types = new Set(selection.file.index.sections[0]!.nodes.flatMap(n => (n.components ?? []).map(c => c.type)));
    assert.ok(types.has(GLTF_TYPE.accessor));
    assert.ok(types.has(GLTF_TYPE.buffer));
    assert.deepEqual(mosaicToGltf(selection.file).warnings, []);
});

test("without asking for children, only the node comes", async () => {
    const file = await boxes();
    const pair = [...collapseNodesByPath(file).values()]
        .find(node => (node.components ?? []).filter(c => c.type === CORE_TYPE.child).length === 2)!;

    const selection = selectNodes(file, { nodes: [pair.id] });

    assert.ok(!selection.nodeIds.includes("10101010-1010-4010-8010-101010101010"), "the box beneath it stayed out");
});

test("asking for children takes everything beneath, however deep", async () => {
    const file = await boxes();
    const collapsed = collapseNodesByPath(file);
    const row = [...collapsed.values()].find(node =>
        (node.components ?? []).some(c => c.type === CORE_TYPE.child) &&
        (node.components ?? []).some(c => c.type === CORE_TYPE.transform))!;

    const selection = selectNodes(file, { nodes: [row.id], includeChildren: true });

    // A row holds a pair, which holds two placements, which hold the box: four levels.
    assert.ok(selection.nodeIds.includes("10101010-1010-4010-8010-101010101010"), "the box at the bottom came along");
    assert.ok(selection.nodeIds.length >= 4, `expected the whole subtree, got ${selection.nodeIds.length}`);

    // And the hierarchy survives into a GLB.
    const composed = mosaicToGltf(selection.file);
    assert.ok(composed.document.nodes!.some(node => (node.children ?? []).length > 0));
});

test("child links survive a filter that does not name them, when children were asked for", async () => {
    const file = await boxes();
    const row = [...collapseNodesByPath(file).values()].find(node =>
        (node.components ?? []).some(c => c.type === CORE_TYPE.child))!;

    const selection = selectNodes(file, {
        nodes: [row.id],
        componentTypes: [CORE_TYPE.transform],
        includeChildren: true,
    });

    const kept = selection.file.index.sections[0]!.nodes.find(node => node.id === row.id)!;
    assert.ok(kept.components!.some(c => c.type === CORE_TYPE.child), "the hierarchy would be lost without them");
});

test("asking for several nodes gives all of them", async () => {
    const selection = selectNodes(await box(), { nodes: [WALL_FRONT, WALL_SIDE] });

    assert.ok(selection.nodeIds.includes(WALL_FRONT));
    assert.ok(selection.nodeIds.includes(WALL_SIDE));
    assert.equal(mosaicToGltf(selection.file).document.nodes!.filter(n => n.mesh !== undefined).length, 2);
});

test("a selection takes the leading state, not the layers that made it", async () => {
    const file = await LoadMosaicFile(await packMosaicSource(readExample("house-v2"), resolveExampleSchema));
    const selection = selectNodes(file, { nodes: [NORTH] });

    // house-v2 raises the north wall in its second section and deletes the paint.
    const node = selection.file.index.sections[0]!.nodes.find(n => n.id === NORTH)!;
    assert.deepEqual(node.components!.map(c => c.id), ["geometry"], "the deleted paint is gone");

    const geometry = node.components![0]!;
    const row = JSON.parse(selection.file.readRawComponent(geometry.type, geometry.index!));
    assert.equal(row.height, 2.7, "and the height is the one that was left standing");
});
