import test from "node:test";
import assert from "node:assert/strict";
import { collapseNodesByPath, diffFiles, federate } from "../src/MosaicFileOperations.ts";
import { MosaicFile } from "../src/MosaicFile.ts";
import { Operation } from "../src/MosaicIndexFile.ts";
import { loadExample, resolve } from "./fixtures.ts";
import { indexOf, operationOf } from "../src/ComponentReference.ts";

const WALL = "acme::geometry::wall";
const NORTH = "11111111-1111-4111-8111-111111111111";
const SOUTH = "22222222-2222-4222-8222-222222222222";
const EAST = "33333333-3333-4333-8333-333333333333";

/**
 * The state a reader actually sees: every node's surviving components, resolved to the
 * rows they point at. Comparing this rather than raw indices keeps the assertions about
 * what the format means instead of how a particular operation happened to lay it out.
 */
function leadingState(file: MosaicFile): Record<string, Record<string, unknown>> {
    const state: Record<string, Record<string, unknown>> = {};

    for (const [id, node] of collapseNodesByPath(file)) {
        const components: Record<string, unknown> = {};
        for (const ref of node.components ?? []) {
            components[ref.id] = resolve(file, ref.type, indexOf(ref));
        }
        state[id] = components;
    }

    return state;
}

test("collapsing layered sections applies the newest value per component", async () => {
    const file = await loadExample("house-v2");

    assert.deepEqual(leadingState(file), {
        [NORTH]: { geometry: { name: "North wall", height: 2.7, loadBearing: true } },
        [SOUTH]: { geometry: { name: "South wall", height: 2.4, loadBearing: false } },
        [EAST]: { geometry: { name: "East wall", height: 2.7, loadBearing: false } },
    });
});

test("a DELETE in a later section removes the inherited component", async () => {
    const v1 = await loadExample("house-v1");
    const v2 = await loadExample("house-v2");

    assert.deepEqual(Object.keys(leadingState(v1)[NORTH]), ["geometry", "paint"]);
    assert.deepEqual(Object.keys(leadingState(v2)[NORTH]), ["geometry"]);
});

test("diffing reports changed and added nodes, and leaves untouched ones out", async () => {
    const diff = diffFiles(await loadExample("house-v1"), await loadExample("house-v2"), false);

    assert.deepEqual(diff.nodes.map(n => n.id), [NORTH, EAST]);

    const north = diff.nodes[0].components!;
    assert.deepEqual(north.map(c => c.id), ["geometry"]);
    // An absent operation is VALUE, which is what a diff writes for a change.
    assert.equal(operationOf(north[0]!), Operation.Value);
    assert.equal(north[0].index, 2);

    assert.deepEqual(diff.nodes[1].components!.map(c => c.id), ["geometry"]);
});

test("diffing with markMissingFromNewAsDelete emits DELETE for dropped components", async () => {
    const diff = diffFiles(await loadExample("house-v1"), await loadExample("house-v2"), true);

    const north = diff.nodes.find(n => n.id === NORTH)!.components!;
    assert.deepEqual(north.map(c => c.id), ["geometry", "paint"]);
    assert.equal(operationOf(north[1]!), Operation.Delete);
});

test("federating with history keeps every section from both files", async () => {
    const v1 = await loadExample("house-v1");
    const v2 = await loadExample("house-v2");

    const merged = federate(v1, v2, true);

    assert.deepEqual(merged.index.sections.map(s => s.header.id), ["house-v1", "house-v1", "house-v2"]);
    assert.equal(merged.index.header.MosaicVersion, v2.index.header.MosaicVersion);
    for (const filename of [`${WALL}.ndjson`, "acme::material::paint.ndjson"]) {
        assert.ok(merged.index.componentTables.some(t => t.filename === filename), `missing table ${filename}`);
    }
});

test("federating with history preserves what a reader sees", async () => {
    const v1 = await loadExample("house-v1");
    const v2 = await loadExample("house-v2");

    assert.deepEqual(leadingState(federate(v1, v2, true)), leadingState(v2));
});

test("federating with history rewrites component indices to stay resolvable", async () => {
    const v1 = await loadExample("house-v1");
    const v2 = await loadExample("house-v2");

    const merged = federate(v1, v2, true);

    for (const section of merged.index.sections) {
        for (const node of section.nodes) {
            for (const ref of node.components ?? []) {
                assert.doesNotThrow(
                    () => merged.readRawComponent(ref.type, indexOf(ref)),
                    `${section.header.id}/${node.id}/${ref.id} points at a missing row`,
                );
            }
        }
    }
});

test("federating without history drops superseded component rows", async () => {
    const v1 = await loadExample("house-v1");
    const v2 = await loadExample("house-v2");

    const collapsed = federate(v1, v2, false);
    const kept = collapsed.serializedComponents.get(WALL)!.map(row => JSON.parse(row).name);

    // Only the three walls still standing, not the six rows the two files hold between them.
    assert.deepEqual(kept.sort(), ["East wall", "North wall", "South wall"]);
});

test("federating without history preserves what a reader sees", async () => {
    const v1 = await loadExample("house-v1");
    const v2 = await loadExample("house-v2");

    assert.deepEqual(leadingState(federate(v1, v2, false)), leadingState(v2));
});
