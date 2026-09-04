import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MosaicDatabase } from "../src/duckdb/Export.ts";
import { selectNodesFromDatabase } from "../src/duckdb/SelectFromDatabase.ts";
import { selectNodes, type SelectionRequest } from "../src/Selection.ts";
import { LoadMosaicFile, WriteMosaicFile, type MosaicFile } from "../src/MosaicFile.ts";
import { packMosaicSource } from "../src/MosaicPack.ts";
import { mosaicToGltf } from "../src/composition/MosaicToGltf.ts";
import { CORE_TYPE } from "../src/core/schemas.ts";
import { GLTF_TYPE } from "../src/gltf/schemas.ts";
import { readExample, resolveExampleSchema } from "./fixtures.ts";

const WALL_FRONT = "55555555-5555-4555-8555-555555555555";
const WALL_SIDE = "66666666-6666-4666-8666-666666666666";
const NORTH = "11111111-1111-4111-8111-111111111111";
const ROW = "50505050-5050-4050-8050-505050505050";

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mosaic-select-"));
}

/** An example, both in a database and in memory, so the two paths can be compared. */
async function bothWays(example: string) {
    const dir = tempDir();
    const database = await MosaicDatabase.open(path.join(dir, "select.duckdb"));

    const bytes = await packMosaicSource(readExample(example), resolveExampleSchema);
    const file = await LoadMosaicFile(bytes);
    const inserted = await database.insertFile(file, example);

    return {
        dir, database, file, fileId: inserted.fileId,
        async close() {
            await database.close();
            fs.rmSync(dir, { recursive: true, force: true });
        },
    };
}

/** What a selection amounts to, in a form the two paths can be compared on. */
function shapeOf(file: MosaicFile) {
    const section = file.index.sections[0]!;
    return {
        nodes: section.nodes.map(node => ({
            id: node.id,
            components: (node.components ?? [])
                .map(reference => ({
                    type: reference.type,
                    id: reference.id,
                    // Indices differ between the two, since each packs its own tables;
                    // the row behind the reference is what has to match.
                    value: (reference.index ?? -1) < 0
                        ? null
                        : JSON.parse(file.readRawComponent(reference.type, reference.index!)),
                }))
                .sort((a, b) => `${a.type} ${a.id}`.localeCompare(`${b.type} ${b.id}`)),
        })).sort((a, b) => a.id.localeCompare(b.id)),
        types: [...file.serializedComponents.keys()].sort(),
    };
}

/** Runs a request both ways and asserts they agree. */
async function agree(example: string, request: SelectionRequest): Promise<void> {
    const world = await bothWays(example);
    try {
        const inMemory = selectNodes(world.file, request);
        const inDatabase = await selectNodesFromDatabase(world.database, world.fileId, request);

        assert.deepEqual([...inDatabase.nodeIds].sort(), [...inMemory.nodeIds].sort(), "the same nodes");
        assert.deepEqual([...inDatabase.missing].sort(), [...inMemory.missing].sort(), "the same misses");
        assert.deepEqual([...inDatabase.pulledIn].sort(), [...inMemory.pulledIn].sort(), "the same nodes pulled in");
        assert.deepEqual(shapeOf(inDatabase.file), shapeOf(inMemory.file), "the same content");
    } finally {
        await world.close();
    }
}

// ---------------------------------------------------------------------------
// The database path answers exactly as reading the whole file would
// ---------------------------------------------------------------------------

test("one node", async () => {
    await agree("gltf-box", { nodes: [WALL_FRONT] });
});

test("several nodes", async () => {
    await agree("gltf-box", { nodes: [WALL_FRONT, WALL_SIDE] });
});

test("a node that is not there", async () => {
    await agree("gltf-box", { nodes: [WALL_FRONT, "00000000-0000-4000-8000-000000000000"] });
});

test("only some component types", async () => {
    await agree("gltf-box", { nodes: [WALL_FRONT], componentTypes: [CORE_TYPE.transform] });
});

test("a component type whose rows point at other nodes", async () => {
    await agree("gltf-box", { nodes: [WALL_FRONT], componentTypes: [GLTF_TYPE.meshPrimitive] });
});

test("everything beneath a node", async () => {
    await agree("instanced-boxes", { nodes: [ROW], includeChildren: true });
});

test("a node with children, without asking for them", async () => {
    await agree("instanced-boxes", { nodes: [ROW] });
});

test("children with a filter that does not name the child links", async () => {
    await agree("instanced-boxes", { nodes: [ROW], componentTypes: [CORE_TYPE.transform], includeChildren: true });
});

test("with compose, so inheritance is resolved", async () => {
    await agree("typed-boxes", { nodes: ["70000000-7000-4000-8000-700000000003"], compose: true });
});

test("with compose and children together", async () => {
    await agree("typed-boxes", { nodes: ["70000000-7000-4000-8000-700000000003"], compose: true, includeChildren: true });
});

test("without compose, an is-a link is left as a link", async () => {
    await agree("typed-boxes", { nodes: ["70000000-7000-4000-8000-700000000003"] });
});

test("a file whose sections layer over each other", async () => {
    // house-v2 raises a wall and deletes its paint in a later section: the database path
    // has to collapse in SQL exactly as reading the file does in memory.
    await agree("house-v2", { nodes: [NORTH] });
});

// ---------------------------------------------------------------------------
// ...and what it produces is a file in its own right
// ---------------------------------------------------------------------------

test("what comes back writes as an archive and composes", async () => {
    const world = await bothWays("gltf-box");
    try {
        const selection = await selectNodesFromDatabase(world.database, world.fileId, { nodes: [WALL_FRONT] });

        const reloaded = await LoadMosaicFile(await WriteMosaicFile(selection.file));
        const composed = mosaicToGltf(reloaded);

        assert.equal(composed.document.meshes?.length, 1);
        assert.equal(composed.binary.byteLength, 168);
        assert.deepEqual(composed.warnings, []);
    } finally {
        await world.close();
    }
});

test("a DELETE in a later section is not handed back", async () => {
    const world = await bothWays("house-v2");
    try {
        const selection = await selectNodesFromDatabase(world.database, world.fileId, { nodes: [NORTH] });
        const node = selection.file.index.sections[0]!.nodes.find(candidate => candidate.id === NORTH)!;

        assert.deepEqual(node.components!.map(c => c.id), ["geometry"], "the paint was deleted");
        const geometry = node.components![0]!;
        assert.equal(JSON.parse(selection.file.readRawComponent(geometry.type, geometry.index!)).height, 2.7);
    } finally {
        await world.close();
    }
});

test("asking for nothing that exists gives an empty file rather than failing", async () => {
    const world = await bothWays("gltf-box");
    try {
        const selection = await selectNodesFromDatabase(world.database, world.fileId, {
            nodes: ["00000000-0000-4000-8000-000000000000"],
        });

        assert.deepEqual(selection.nodeIds, []);
        assert.deepEqual(selection.missing, ["00000000-0000-4000-8000-000000000000"]);
        assert.equal(selection.file.index.sections.length, 0);
    } finally {
        await world.close();
    }
});

test("only the rows the selection needs are read", async () => {
    // The point of doing this in the database: a version with far more in it than was
    // asked for costs what was asked for, not what it holds.
    const world = await bothWays("instanced-boxes");
    try {
        const whole = await world.database.all(
            `SELECT count(*) AS n FROM mosaic_component_ref WHERE file_id = '${world.fileId}'`);
        const selection = await selectNodesFromDatabase(world.database, world.fileId, { nodes: [ROW] });

        const taken = selection.file.index.sections[0]!.nodes
            .reduce((total, node) => total + (node.components ?? []).length, 0);

        assert.ok(taken < Number(whole[0]!.n), `took ${taken} of ${whole[0]!.n} references`);
        assert.equal(selection.nodeIds.length, 1, "and only the node that was asked for");
    } finally {
        await world.close();
    }
});
