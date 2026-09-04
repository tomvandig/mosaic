// Generated from publish-a-tessera.md. The prose is the source: when it changes, this is
// regenerated from it, and every step below names the line it came from.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { CreateTesseraVersionResponseState, MosaicFileDownloadType, NodeFetchFormat } from "mosaic-ts/api";
import { LoadMosaicFile, packMosaicSource, composeArchiveToGlb, parseGlb, Type, type MosaicSourceDocument } from "mosaic-ts";
import { runScenario, type World } from "../support/scenario.ts";

// --- Background ------------------------------------------------------------
// Given a temporary folder that exists only for this scenario
// And a Mosaic server running on a free port, keeping its database in that folder
// (both are what runScenario provides; the folder is removed and the server stopped
// afterwards, which is the "Afterwards" section of the scenario.)

/**
 * Given a source document describing two walls in one section, authored by
 * ada@example.com with the message "Initial two walls".
 */
function terraceDocument(): MosaicSourceDocument {
    return {
        description: "Two walls, for the publishing scenario",
        components: {
            "acme::geometry::wall": [
                { name: "North wall", height: 2.4 },
                { name: "South wall", height: 2.4 },
            ],
        },
        index: {
            header: { MosaicVersion: "post-alpha" },
            imports: [],
            componentTables: [{
                filename: "acme::geometry::wall.ndjson",
                type: Type.Ndjson,
                schema: {
                    "x-mosaic-id": "acme::geometry::wall",
                    type: "object",
                    additionalProperties: false,
                    properties: { name: { type: "string" }, height: { type: "number" } },
                    required: ["name", "height"],
                },
            }],
            sections: [{
                header: {
                    id: "terrace",
                    message: "Initial two walls",
                    dataVersion: "1.0.0",
                    author: "ada@example.com",
                    timestamp: "2026-09-04T09:00:00Z",
                    application: "mosaic-scenarios",
                },
                nodes: [
                    { id: "11111111-1111-4111-8111-111111111111", components: [{ type: "acme::geometry::wall", id: "geometry", index: 0 }] },
                    { id: "22222222-2222-4222-8222-222222222222", components: [{ type: "acme::geometry::wall", id: "geometry", index: 1 }] },
                ],
            }],
        },
    };
}

/** And that document packed into an archive `terrace.tsr` in the same folder. */
async function packedArchive(world: World): Promise<{ path: string; bytes: Uint8Array }> {
    world.write("terrace.mosaic.json", `${JSON.stringify(terraceDocument(), null, 2)}\n`);

    const bytes = await packMosaicSource(terraceDocument());
    return { path: world.write("terrace.tsr", bytes), bytes };
}

/** Given a tessera whose first version was published from `terrace.tsr`. */
async function published(world: World) {
    const archive = await packedArchive(world);
    const client = world.client();

    const tesseraId = randomUUID();
    await client.createTessera({ body: { id: tesseraId, name: "Terrace" } });

    const blob = await client.uploadMosaicBlobUrl({ tesseraId });
    await client.upload({ blobId: blob.blobId, body: archive.bytes });

    const versionId = randomUUID();
    const created = await client.createTesseraVersion({
        tesseraId,
        body: { id: versionId, previousTesseraVersionId: "", blobId: blob.blobId },
    });

    return { archive, client, tesseraId, versionId, created };
}

// ---------------------------------------------------------------------------

test("a first version is published and read back unchanged", async () => {
    await runScenario("publish-a-tessera", async world => {
        await world.startServer();
        const client = world.client();
        const archive = await packedArchive(world);

        // When I create a tessera named "Terrace"
        const tesseraId = randomUUID();
        await client.createTessera({ body: { id: tesseraId, name: "Terrace" } });

        // Then it is listed with no version yet
        assert.deepEqual(await client.tesserae(), [{ id: tesseraId, name: "Terrace", latestVersion: "" }]);

        // When I ask the tessera for an upload url
        const blob = await client.uploadMosaicBlobUrl({ tesseraId });

        // Then the url points at this server and names a blob id
        assert.ok(blob.putURL.startsWith(client.baseUrl), blob.putURL);
        assert.ok(blob.putURL.endsWith(blob.blobId), blob.putURL);

        // When I upload the bytes of terrace.tsr to that url
        await client.upload({ blobId: blob.blobId, body: archive.bytes });

        // And I create the first version from that blob, following no previous version
        const versionId = randomUUID();
        const created = await client.createTesseraVersion({
            tesseraId,
            body: { id: versionId, previousTesseraVersionId: "", blobId: blob.blobId },
        });

        // Then the version is accepted
        assert.equal(created.state, CreateTesseraVersionResponseState.Ok);
        assert.deepEqual(created.validationErrors, []);

        // And the tessera lists it as the latest version
        assert.equal((await client.tesserae())[0]!.latestVersion, versionId);
        assert.deepEqual((await client.getTessera({ tesseraId })).history.map(v => v.versionId), [versionId]);

        // And the version carries the provenance the archive was authored with
        const version = await client.getTesseraVersion({ tesseraId, versionId });
        assert.equal(version.provenance.author, "ada@example.com");
        assert.equal(version.provenance.message, "Initial two walls");
    });
});

test("the published version comes back, rebuilt from the database", async () => {
    await runScenario("publish-a-tessera", async world => {
        await world.startServer();
        const { client, tesseraId, versionId } = await published(world);

        // When I ask to download just that version
        const asked = await client.tesseraMosaic({
            tesseraId, versionId, downloadType: MosaicFileDownloadType.JustThisVersion,
        });

        // Then the server answers with a blob url
        assert.ok(asked.blobUrl.startsWith(client.baseUrl), asked.blobUrl);

        // And what is behind it is an archive with one section holding the same two walls
        const file = await LoadMosaicFile(await client.download({ blobId: asked.blobUrl.split("/").pop()! }));
        assert.equal(file.index.sections.length, 1);

        const walls = file.serializedComponents.get("acme::geometry::wall")!.map(row => JSON.parse(row));
        assert.deepEqual(walls, [{ name: "North wall", height: 2.4 }, { name: "South wall", height: 2.4 }]);

        // And it holds the provenance the version was published with
        assert.equal(file.index.sections[0]!.header.author, "ada@example.com");
        assert.equal(file.index.sections[0]!.header.message, "Initial two walls");
    });
});

test("a version outlives the blob it arrived in", async () => {
    await runScenario("publish-a-tessera", async world => {
        const server = await world.startServer();
        const { client, tesseraId, versionId } = await published(world);

        // And every blob on the server has been deleted
        await server.store.forgetBlobs();

        // When I ask to download just that version
        const asked = await client.tesseraMosaic({
            tesseraId, versionId, downloadType: MosaicFileDownloadType.JustThisVersion,
        });

        // Then it still comes back, with both walls in it
        const file = await LoadMosaicFile(await client.download({ blobId: asked.blobUrl.split("/").pop()! }));
        assert.equal(file.serializedComponents.get("acme::geometry::wall")!.length, 2);

        // When I fetch one of its nodes -- Then that comes back too
        const fetched = await client.fetchNodes({
            tesseraId, versionId,
            format: NodeFetchFormat.Tsr,
            body: { nodes: ["11111111-1111-4111-8111-111111111111"] },
        });
        const subset = await LoadMosaicFile(fetched);
        assert.deepEqual(
            subset.index.sections[0]!.nodes.map(node => node.id),
            ["11111111-1111-4111-8111-111111111111"],
        );
    });
});

test("what was published can be composed into a viewable file", async () => {
    await runScenario("publish-a-tessera", async world => {
        await world.startServer();
        const { client, tesseraId, versionId } = await published(world);

        // When I download that version to downloaded.tsr in the folder
        const asked = await client.tesseraMosaic({
            tesseraId, versionId, downloadType: MosaicFileDownloadType.JustThisVersion,
        });
        const downloaded = world.write("downloaded.tsr", await client.download({
            blobId: asked.blobUrl.split("/").pop()!,
        }));

        // And I compose that archive into terrace.glb
        const composed = await composeArchiveToGlb(downloaded, world.file("terrace.glb"));

        // Then terrace.glb exists on disk and begins with the glTF magic bytes
        assert.ok(fs.existsSync(composed.outputPath));
        const bytes = new Uint8Array(fs.readFileSync(composed.outputPath));
        assert.deepEqual([...bytes.subarray(0, 4)], [0x67, 0x6c, 0x54, 0x46], "glTF");

        // And it holds one node for each wall
        const { document } = parseGlb(bytes);
        assert.equal(document.nodes?.length, 2);
    });
});

test("a version that does not follow the latest one is refused", async () => {
    await runScenario("publish-a-tessera", async world => {
        await world.startServer();
        const { archive, client, tesseraId, versionId } = await published(world);

        // When I try to create another version that also claims to follow no previous version
        const blob = await client.uploadMosaicBlobUrl({ tesseraId });
        await client.upload({ blobId: blob.blobId, body: archive.bytes });

        const second = await client.createTesseraVersion({
            tesseraId,
            body: { id: randomUUID(), previousTesseraVersionId: "", blobId: blob.blobId },
        });

        // Then the answer is OUT_OF_DATE rather than an error
        assert.equal(second.state, CreateTesseraVersionResponseState.OutOfDate);

        // And it says which version the tessera is actually on
        assert.match(second.validationErrors.join(" "), new RegExp(versionId));

        // And the tessera still lists only the first version
        assert.deepEqual((await client.getTessera({ tesseraId })).history.map(v => v.versionId), [versionId]);
    });
});
