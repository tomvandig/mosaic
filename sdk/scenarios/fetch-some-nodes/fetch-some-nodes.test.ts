// Generated from fetch-some-nodes.md. The prose is the source: when it changes, this is
// regenerated from it, and every step below names the line it came from.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { CreateTesseraVersionResponseState, NodeFetchFormat, type MosaicApiClient } from "mosaic-ts/api";
import { LoadMosaicFile, packMosaicSource, parseGlb, Type, type MosaicSourceDocument } from "mosaic-ts";
import { runScenario, type World } from "../support/scenario.ts";

const FRONT = "55555555-5555-4555-8555-555555555555";
const SIDE = "66666666-6666-4666-8666-666666666666";
const PARENT = "77777777-7777-4777-8777-777777777777";

const WALL = "acme::geometry::wall";
const TRANSFORM = "core::transform";
const NAME = "core::name";
const CHILD = "core::child";

/**
 * Given an archive holding two walls, each with a mesh, a transform and a name, and a
 * third node that is the parent of both.
 *
 * The "mesh" here is an ordinary component that names no other node, which keeps the
 * scenario about selection rather than about glTF.
 */
function terraceDocument(): MosaicSourceDocument {
    const wallSchema = {
        "x-mosaic-id": WALL,
        type: "object",
        additionalProperties: false,
        properties: { name: { type: "string" }, height: { type: "number" } },
        required: ["name", "height"],
    };
    const transformSchema = {
        "x-mosaic-id": TRANSFORM,
        type: "object",
        additionalProperties: false,
        properties: {
            translation: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
        },
    };

    return {
        description: "Two walls under a parent, for the fetching scenario",
        components: {
            [WALL]: [{ name: "North wall", height: 2.4 }, { name: "South wall", height: 2.4 }],
            [TRANSFORM]: [{ translation: [-1, 0, 0] }, { translation: [1, 0, 0] }, { translation: [0, 0, 0] }],
        },
        index: {
            header: { MosaicVersion: "post-alpha" },
            imports: [],
            componentTables: [
                { filename: `${WALL}.ndjson`, type: Type.Ndjson, schema: wallSchema },
                { filename: `${TRANSFORM}.ndjson`, type: Type.Ndjson, schema: transformSchema },
            ],
            sections: [{
                header: {
                    id: "terrace",
                    message: "Two walls under a parent",
                    dataVersion: "1.0.0",
                    author: "ada@example.com",
                    timestamp: "2026-09-04T09:00:00Z",
                    application: "mosaic-scenarios",
                },
                nodes: [
                    {
                        id: FRONT,
                        components: [
                            { type: WALL, id: "mesh", index: 0 },
                            { type: TRANSFORM, id: "transform", index: 0 },
                            { type: NAME, id: "Front wall" },
                        ],
                    },
                    {
                        id: SIDE,
                        components: [
                            { type: WALL, id: "mesh", index: 1 },
                            { type: TRANSFORM, id: "transform", index: 1 },
                            { type: NAME, id: "Side wall" },
                        ],
                    },
                    {
                        id: PARENT,
                        components: [
                            { type: TRANSFORM, id: "transform", index: 2 },
                            { type: NAME, id: "Terrace" },
                            { type: CHILD, id: FRONT },
                            { type: CHILD, id: SIDE },
                        ],
                    },
                ],
            }],
        },
    };
}

/** Given a tessera whose first version was published from that archive. */
async function publishedTerrace(world: World) {
    const client = world.client();
    const bytes = await packMosaicSource(terraceDocument());
    world.write("terrace.tsr", bytes);

    const tesseraId = randomUUID();
    await client.createTessera({ body: { id: tesseraId, name: "Terrace" } });

    const blob = await client.uploadMosaicBlobUrl({ tesseraId });
    await client.upload({ blobId: blob.blobId, body: bytes });

    const versionId = randomUUID();
    const created = await client.createTesseraVersion({
        tesseraId, body: { id: versionId, previousTesseraVersionId: "", blobId: blob.blobId },
    });
    assert.equal(created.state, CreateTesseraVersionResponseState.Ok, JSON.stringify(created));

    return { client, tesseraId, versionId };
}

/** The nodes of a composed glb, by the name each one carries. */
function namesOf(document: ReturnType<typeof parseGlb>["document"]): string[] {
    return (document.nodes ?? [])
        .map(node => (node as any).extensions?.MOSAIC_components?.components
            ?.find((component: any) => component.type === NAME)?.name)
        .filter(Boolean);
}

// ---------------------------------------------------------------------------

test("one node comes back as a viewable file", async () => {
    await runScenario("fetch-some-nodes", async world => {
        await world.startServer();
        const { client, tesseraId, versionId } = await publishedTerrace(world);

        // When I fetch the front wall, asking for glb
        const bytes = await client.fetchNodes({
            tesseraId, versionId, format: NodeFetchFormat.Glb, body: { nodes: [FRONT] },
        });

        // Then the answer is a stream of bytes beginning with the glTF magic
        assert.deepEqual([...bytes.subarray(0, 4)], [0x67, 0x6c, 0x54, 0x46]);

        // And it holds one node
        const { document } = parseGlb(bytes);
        assert.equal(document.nodes?.length, 1);
        assert.deepEqual(namesOf(document), ["Front wall"]);

        // And the file I asked for was never written to disk on the server: the folder
        // holds the database, its blobs, and what this scenario wrote -- no .glb.
        const written = fs.readdirSync(world.folder, { recursive: true, encoding: "utf-8" });
        assert.ok(!written.some(entry => entry.endsWith(".glb")), written.join(", "));
    });
});

test("the same node comes back as an archive I can keep", async () => {
    await runScenario("fetch-some-nodes", async world => {
        await world.startServer();
        const { client, tesseraId, versionId } = await publishedTerrace(world);

        // When I fetch the front wall, asking for tsr
        const bytes = await client.fetchNodes({
            tesseraId, versionId, format: NodeFetchFormat.Tsr, body: { nodes: [FRONT] },
        });

        // Then the answer loads as a Mosaic archive
        const file = await LoadMosaicFile(bytes);
        assert.deepEqual(file.index.sections[0]!.nodes.map(node => node.id), [FRONT]);

        // And every reference in it resolves inside it
        for (const node of file.index.sections[0]!.nodes) {
            for (const reference of node.components ?? []) {
                if ((reference.index ?? -1) < 0) continue;
                assert.doesNotThrow(() => file.readRawComponent(reference.type, reference.index!));
            }
        }

        // And I can publish it again as the first version of another tessera
        const other = randomUUID();
        await client.createTessera({ body: { id: other, name: "Just the front wall" } });
        const blob = await client.uploadMosaicBlobUrl({ tesseraId: other });
        await client.upload({ blobId: blob.blobId, body: bytes });

        const created = await client.createTesseraVersion({
            tesseraId: other,
            body: { id: randomUUID(), previousTesseraVersionId: "", blobId: blob.blobId },
        });
        assert.equal(created.state, CreateTesseraVersionResponseState.Ok, JSON.stringify(created));
    });
});

test("I ask for only the components I care about", async () => {
    await runScenario("fetch-some-nodes", async world => {
        await world.startServer();
        const { client, tesseraId, versionId } = await publishedTerrace(world);

        // When I fetch the front wall, asking for tsr and for core::transform only
        const bytes = await client.fetchNodes({
            tesseraId, versionId, format: NodeFetchFormat.Tsr,
            body: { nodes: [FRONT], componentTypes: [TRANSFORM] },
        });

        const file = await LoadMosaicFile(bytes);
        const wall = file.index.sections[0]!.nodes.find(node => node.id === FRONT)!;

        // Then the wall in the answer carries its transform and nothing else
        assert.deepEqual(wall.components!.map(component => component.type), [TRANSFORM]);

        // And no mesh comes with it
        assert.equal(file.serializedComponents.has(WALL), false);
    });
});

test("I ask for everything beneath a node", async () => {
    await runScenario("fetch-some-nodes", async world => {
        await world.startServer();
        const { client, tesseraId, versionId } = await publishedTerrace(world);

        // When I fetch the parent node, asking for glb, without asking for children
        const alone = parseGlb(await client.fetchNodes({
            tesseraId, versionId, format: NodeFetchFormat.Glb, body: { nodes: [PARENT] },
        })).document;

        // Then nothing in the answer has a mesh
        assert.deepEqual(namesOf(alone), ["Terrace"]);

        // When I fetch the parent node again, asking for glb and for its children
        const deep = parseGlb(await client.fetchNodes({
            tesseraId, versionId, format: NodeFetchFormat.Glb,
            body: { nodes: [PARENT], includeChildren: true },
        })).document;

        // Then both walls are in the answer
        assert.deepEqual(namesOf(deep).sort(), ["Front wall", "Side wall", "Terrace"]);

        // And they hang beneath the parent, as they did in the tessera
        const parent = deep.nodes!.find(node => (node.children ?? []).length > 0)!;
        assert.equal(parent.children?.length, 2);
        assert.deepEqual(
            parent.children!.map(index => namesOf({ nodes: [deep.nodes![index]!] } as any)[0]).sort(),
            ["Front wall", "Side wall"],
        );
    });
});

test("asking for a node that is not there says so", async () => {
    await runScenario("fetch-some-nodes", async world => {
        const server = await world.startServer();
        const { tesseraId, versionId } = await publishedTerrace(world);
        const absent = "00000000-0000-4000-8000-000000000000";

        // When I fetch one wall and one id that the version does not have.
        // The generated client hands back the bytes, so the raw response is read here to
        // get at the headers the server reports the misses in.
        const response = await fetch(
            `${server.url}/Mosaic-api/tesserae/${tesseraId}/versions/${versionId}/nodes?format=tsr`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ nodes: [FRONT, absent] }),
            });

        assert.equal(response.status, 200);

        // Then the wall still comes back
        const file = await LoadMosaicFile(new Uint8Array(await response.arrayBuffer()));
        assert.deepEqual(file.index.sections[0]!.nodes.map(node => node.id), [FRONT]);

        // And the answer says which id was not found
        assert.equal(response.headers.get("x-mosaic-missing"), absent);
        assert.equal(response.headers.get("x-mosaic-nodes"), "1");
    });
});
