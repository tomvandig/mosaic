// Generated from import-between-tesserae.md. The prose is the source: when it changes,
// this is regenerated from it, and every step below names the line it came from.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CreateTesseraVersionResponseState, NodeFetchFormat, type MosaicApiClient } from "mosaic-ts/api";
import { LoadMosaicFile, packMosaicSource, parseGlb, Type, type MosaicSourceDocument } from "mosaic-ts";
import { runScenario, type World } from "../support/scenario.ts";

const BENCH = "11111111-1111-4111-8111-111111111111";
const SEAT = "22222222-2222-4222-8222-222222222222";
const ARMREST = "33333333-3333-4333-8333-333333333333";

const PLAZA = "44444444-4444-4444-8444-444444444444";
const NORTH = "55555555-5555-4555-8555-555555555555";
const SOUTH = "66666666-6666-4666-8666-666666666666";

const FURNITURE = "acme::furniture::part";
const TRANSFORM = "core::transform";
const NAME = "core::name";
const CHILD = "core::child";

const FURNITURE_SCHEMA = {
    "x-mosaic-id": FURNITURE,
    type: "object",
    additionalProperties: false,
    properties: { material: { type: "string" }, width: { type: "number" } },
    required: ["material", "width"],
};

const TRANSFORM_SCHEMA = {
    "x-mosaic-id": TRANSFORM,
    type: "object",
    additionalProperties: false,
    properties: { translation: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 } },
};

const TABLES = [
    { filename: `${FURNITURE}.ndjson`, type: Type.Ndjson, schema: FURNITURE_SCHEMA },
    { filename: `${TRANSFORM}.ndjson`, type: Type.Ndjson, schema: TRANSFORM_SCHEMA },
];

function header(id: string, message: string) {
    return {
        id, message,
        dataVersion: "1.0.0",
        author: "ada@example.com",
        timestamp: "2026-09-04T09:00:00Z",
        application: "mosaic-scenarios",
    };
}

/** Given a bench with a seat beneath it, and an armrest as well in its second version. */
function benchDocument(withArmrest: boolean): MosaicSourceDocument {
    const parts = [{ material: "oak", width: 1.6 }, { material: "oak", width: 1.6 }];

    return {
        description: "A bench, published on its own so that anything can place one",
        components: {
            [FURNITURE]: withArmrest ? parts : [parts[0]!],
            [TRANSFORM]: [{ translation: [0, 0, 0] }, { translation: [0, 0.4, 0] }, { translation: [0.8, 0.4, 0] }],
        },
        index: {
            header: { MosaicVersion: "post-alpha" },
            imports: [],
            componentTables: TABLES,
            sections: [{
                header: header("bench", withArmrest ? "A bench with an armrest" : "A bench"),
                nodes: [
                    {
                        id: BENCH,
                        components: [
                            { type: TRANSFORM, id: "transform", index: 0 },
                            { type: NAME, id: "Bench" },
                            { type: CHILD, id: SEAT },
                            ...(withArmrest ? [{ type: CHILD, id: ARMREST }] : []),
                        ],
                    },
                    {
                        id: SEAT,
                        components: [
                            { type: FURNITURE, id: "part", index: 0 },
                            { type: TRANSFORM, id: "transform", index: 1 },
                            { type: NAME, id: "Seat" },
                        ],
                    },
                    ...(withArmrest ? [{
                        id: ARMREST,
                        components: [
                            { type: FURNITURE, id: "part", index: 1 },
                            { type: TRANSFORM, id: "transform", index: 2 },
                            { type: NAME, id: "Armrest" },
                        ],
                    }] : []),
                ],
            }],
        },
    };
}

/**
 * Given a courtyard that imports bench.tsr and holds a plaza with two spots, each naming
 * the bench as its child.
 *
 * The import is a uri and nothing more: the bench's own rows are not in here, only the id
 * of a node that lives over there.
 */
function courtyardDocument(): MosaicSourceDocument {
    return {
        description: "A plaza with two spots, each holding the imported bench",
        components: {
            [TRANSFORM]: [{ translation: [0, 0, 0] }, { translation: [-2, 0, 0] }, { translation: [2, 0, 0] }],
        },
        index: {
            header: { MosaicVersion: "post-alpha" },
            imports: [{ uri: "bench.tsr" }],
            componentTables: [TABLES[1]!],
            sections: [{
                header: header("courtyard", "A plaza with two benches"),
                nodes: [
                    {
                        id: PLAZA,
                        components: [
                            { type: TRANSFORM, id: "transform", index: 0 },
                            { type: NAME, id: "Plaza" },
                            { type: CHILD, id: NORTH },
                            { type: CHILD, id: SOUTH },
                        ],
                    },
                    {
                        id: NORTH,
                        components: [
                            { type: TRANSFORM, id: "transform", index: 1 },
                            { type: NAME, id: "North spot" },
                            { type: CHILD, id: BENCH },
                        ],
                    },
                    {
                        id: SOUTH,
                        components: [
                            { type: TRANSFORM, id: "transform", index: 2 },
                            { type: NAME, id: "South spot" },
                            { type: CHILD, id: BENCH },
                        ],
                    },
                ],
            }],
        },
    };
}

/** Publishes a version of a tessera, creating the tessera when it is the first one. */
async function publish(
    world: World,
    name: string,
    document: MosaicSourceDocument,
    onto?: { tesseraId: string; versionId: string },
): Promise<{ tesseraId: string; versionId: string }> {
    const client = world.client();
    const bytes = await packMosaicSource(document);

    // The file name is what an import names, so it is written under that name here too.
    world.write(`${name.toLowerCase()}.tsr`, bytes);

    const tesseraId = onto?.tesseraId ?? randomUUID();
    if (!onto) await client.createTessera({ body: { id: tesseraId, name } });

    const blob = await client.uploadMosaicBlobUrl({ tesseraId });
    await client.upload({ blobId: blob.blobId, body: bytes });

    const versionId = randomUUID();
    const created = await client.createTesseraVersion({
        tesseraId,
        body: { id: versionId, previousTesseraVersionId: onto?.versionId ?? "", blobId: blob.blobId },
    });
    assert.equal(created.state, CreateTesseraVersionResponseState.Ok, JSON.stringify(created));

    return { tesseraId, versionId };
}

/** Given both tesserae, published to the server this scenario started. */
async function published(world: World): Promise<{
    client: MosaicApiClient;
    bench: { tesseraId: string; versionId: string };
    courtyard: { tesseraId: string; versionId: string };
}> {
    const bench = await publish(world, "Bench", benchDocument(false));
    const courtyard = await publish(world, "Courtyard", courtyardDocument());

    return { client: world.client(), bench, courtyard };
}

/** The name each node in an archive carries, which is the id of its core::name. */
function namesIn(file: Awaited<ReturnType<typeof LoadMosaicFile>>): string[] {
    return (file.index.sections[0]?.nodes ?? [])
        .map(node => node.components?.find(component => component.type === NAME)?.id)
        .filter((name): name is string => name !== undefined);
}

/** The names of the nodes of a composed glb, in the order they were written. */
function namesOf(document: ReturnType<typeof parseGlb>["document"]): string[] {
    return (document.nodes ?? [])
        .map(node => (node as any).extensions?.MOSAIC_components?.components
            ?.find((component: any) => component.type === NAME)?.name)
        .filter(Boolean);
}

// ---------------------------------------------------------------------------

test("a reference that leaves one tessera lands in the other", async () => {
    await runScenario("import-between-tesserae", async world => {
        await world.startServer();
        const { client, courtyard } = await published(world);

        // When I fetch the plaza from the courtyard, with its children, asking for tsr
        const bytes = await client.fetchNodes({
            tesseraId: courtyard.tesseraId, versionId: courtyard.versionId,
            format: NodeFetchFormat.Tsr,
            body: { nodes: [PLAZA], includeChildren: true },
        });

        const file = await LoadMosaicFile(bytes);
        const ids = (file.index.sections[0]?.nodes ?? []).map(node => node.id);

        // Then the plaza and both spots come back
        assert.ok([PLAZA, NORTH, SOUTH].every(id => ids.includes(id)), ids.join(", "));

        // And the bench comes back too, with its seat, though it was published in another
        // tessera
        assert.deepEqual(namesIn(file).sort(), ["Bench", "North spot", "Plaza", "Seat", "South spot"]);

        // And the bench keeps the id it has there, so both spots point at the same node
        assert.equal(ids.filter(id => id === BENCH).length, 1);
        for (const spot of [NORTH, SOUTH]) {
            const node = file.index.sections[0]!.nodes.find(candidate => candidate.id === spot)!;
            assert.ok(node.components!.some(component => component.type === CHILD && component.id === BENCH));
        }

        // And nothing is reported as missing: the seat's own component row came across
        // with it, so the archive stands on its own.
        assert.equal(file.serializedComponents.get(FURNITURE)?.length, 1);
    });
});

test("the same, as something a viewer can open", async () => {
    await runScenario("import-between-tesserae", async world => {
        await world.startServer();
        const { client, courtyard } = await published(world);

        // When I fetch the plaza from the courtyard, with its children, asking for glb
        const bytes = await client.fetchNodes({
            tesseraId: courtyard.tesseraId, versionId: courtyard.versionId,
            format: NodeFetchFormat.Glb,
            body: { nodes: [PLAZA], includeChildren: true },
        });

        // Then the answer begins with the glTF magic
        assert.deepEqual([...bytes.subarray(0, 4)], [0x67, 0x6c, 0x54, 0x46]);

        // And the bench appears once per spot, written from the one bench that was
        // published: composing writes a node per child relation.
        const names = namesOf(parseGlb(bytes).document);
        assert.equal(names.filter(name => name === "Bench").length, 2);
        assert.equal(names.filter(name => name === "Seat").length, 2);
    });
});

test("publishing a new version of the bench changes what the courtyard shows", async () => {
    await runScenario("import-between-tesserae", async world => {
        await world.startServer();
        const { client, bench, courtyard } = await published(world);

        // Given a second version of Bench, which adds an armrest beneath the bench
        await publish(world, "Bench", benchDocument(true), bench);

        // When I fetch the plaza from the courtyard again, without republishing it
        const file = await LoadMosaicFile(await client.fetchNodes({
            tesseraId: courtyard.tesseraId, versionId: courtyard.versionId,
            format: NodeFetchFormat.Tsr,
            body: { nodes: [PLAZA], includeChildren: true },
        }));

        // Then the armrest is in the answer
        assert.ok(namesIn(file).includes("Armrest"), namesIn(file).join(", "));

        // And the courtyard is still on its first version
        const details = await client.getTessera({ tesseraId: courtyard.tesseraId });
        assert.equal(details.history.length, 1);
        assert.equal(details.history[0]!.versionId, courtyard.versionId);
    });
});

test("an import nothing has published is left out rather than failing", async () => {
    await runScenario("import-between-tesserae", async world => {
        await world.startServer();

        // Given a server with only the courtyard published to it
        const courtyard = await publish(world, "Courtyard", courtyardDocument());
        const client = world.client();

        // When I fetch the plaza from the courtyard, with its children
        const file = await LoadMosaicFile(await client.fetchNodes({
            tesseraId: courtyard.tesseraId, versionId: courtyard.versionId,
            format: NodeFetchFormat.Tsr,
            body: { nodes: [PLAZA], includeChildren: true },
        }));

        // Then the plaza and both spots still come back
        assert.deepEqual(namesIn(file).sort(), ["North spot", "Plaza", "South spot"]);

        // And the seat is nowhere in the answer, because the tessera holding it is not here
        assert.equal(file.serializedComponents.has(FURNITURE), false);
    });
});
