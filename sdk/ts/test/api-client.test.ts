import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { serve, type RunningServer } from "../src/api/Server.ts";
import { MosaicApiClient, ApiError } from "../src/api/MosaicApiClient.ts";
import { API_ROUTES } from "../src/api/MosaicApiRoutes.ts";
import { CreateTesseraVersionResponseState, MosaicFileDownloadType } from "../src/api/MosaicApiTypes.ts";
import { LoadMosaicFile } from "../src/MosaicFile.ts";
import { packMosaicSource } from "../src/MosaicPack.ts";
import { readExample, resolveExampleSchema } from "./fixtures.ts";

/**
 * These talk to a server that is really listening: a real port, real sockets, real HTTP.
 * Starting and stopping it is part of what each test checks, so a server that fails to
 * come up, or fails to let go of its port, fails the test rather than hiding.
 */

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mosaic-client-"));
}

/** True when something is accepting connections on that port. */
function isListening(port: number, host = "127.0.0.1"): Promise<boolean> {
    return new Promise(resolve => {
        const socket = net.connect({ port, host });
        const settle = (answer: boolean) => {
            socket.destroy();
            resolve(answer);
        };
        socket.once("connect", () => settle(true));
        socket.once("error", () => settle(false));
        socket.setTimeout(2000, () => settle(false));
    });
}

/** Starts a server on a port the OS picks, and hands back a client pointed at it. */
async function started(): Promise<{ server: RunningServer; client: MosaicApiClient; dir: string }> {
    const dir = tempDir();
    const server = await serve({ database: path.join(dir, "api.duckdb") });
    return { server, client: new MosaicApiClient(server.url), dir };
}

async function stopped(started: { server: RunningServer; dir: string }): Promise<void> {
    await started.server.close();
    fs.rmSync(started.dir, { recursive: true, force: true });
}

async function archiveBytes(name: string): Promise<Uint8Array> {
    return await packMosaicSource(readExample(name), resolveExampleSchema);
}

// ---------------------------------------------------------------------------
// The server's lifecycle
// ---------------------------------------------------------------------------

test("the server takes a real port, answers on it, and gives it up when closed", async () => {
    const running = await started();
    const { port } = running.server;

    assert.ok(port > 0, "the OS should have handed out a real port");
    assert.equal(await isListening(port), true, "it should be accepting connections");

    // A real round trip over that socket, through the generated client.
    assert.deepEqual(await running.client.tesserae(), []);

    await stopped(running);

    assert.equal(await isListening(port), false, "the port should be free again");
    await assert.rejects(() => running.client.tesserae(), (error: Error) => {
        // Whatever fetch calls it, this is a connection failure and not an ApiError:
        // there is no longer a server to answer.
        assert.ok(!(error instanceof ApiError), `expected a connection failure, got ${error.message}`);
        return true;
    });
});

test("a second server starts on the port the first one released", async () => {
    const first = await started();
    const { port } = first.server;
    await stopped(first);

    const dir = tempDir();
    const second = await serve({ database: path.join(dir, "api.duckdb"), port });
    try {
        assert.equal(second.port, port, "it should have taken the same port");
        assert.deepEqual(await new MosaicApiClient(second.url).tesserae(), []);
    } finally {
        await second.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("two servers run side by side without treading on each other", async () => {
    const one = await started();
    const two = await started();

    try {
        assert.notEqual(one.server.port, two.server.port);

        await one.client.createTessera({ body: { id: randomUUID(), name: "On the first" } });

        assert.equal((await one.client.tesserae()).length, 1);
        assert.equal((await two.client.tesserae()).length, 0, "the second has its own database");
    } finally {
        await stopped(one);
        await stopped(two);
    }
});

// ---------------------------------------------------------------------------
// The client against that server
// ---------------------------------------------------------------------------

test("the client has a method for every operation in the spec", () => {
    const client = new MosaicApiClient("http://example.invalid");
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client))
        .filter(name => name !== "constructor");

    assert.equal(methods.length, API_ROUTES.length);
    for (const name of ["tesserae", "createTessera", "getTessera", "deleteTessera", "uploadMosaicBlobUrl",
        "createTesseraVersion", "getTesseraVersion", "tesseraMosaic", "upload", "download", "query"]) {
        assert.ok(methods.includes(name), `no client method ${name}`);
    }
});

test("a tessera goes through its whole life over HTTP", async () => {
    const running = await started();
    const { client } = running;

    try {
        const tesseraId = randomUUID();
        await client.createTessera({ body: { id: tesseraId, name: "Terrace" } });

        assert.deepEqual(await client.tesserae(), [{ id: tesseraId, name: "Terrace", latestVersion: "" }]);
        assert.deepEqual(await client.getTessera({ tesseraId }), { id: tesseraId, name: "Terrace", history: [] });

        // A blob url, an upload, and a version built on it.
        const blob = await client.uploadMosaicBlobUrl({ tesseraId });
        assert.equal(blob.putURL, `${running.server.url}/Mosaic-api/upload/${blob.blobId}`);

        const uploaded = await archiveBytes("house-v1");
        await client.upload({ blobId: blob.blobId, body: uploaded });

        const versionId = randomUUID();
        const created = await client.createTesseraVersion({
            tesseraId,
            body: { id: versionId, previousTesseraVersionId: "", blobId: blob.blobId },
        });
        assert.equal(created.state, CreateTesseraVersionResponseState.Ok);

        const version = await client.getTesseraVersion({ tesseraId, versionId });
        assert.equal(version.tesseraId, tesseraId);
        assert.equal(version.provenance.message, "Initial two walls");

        assert.equal((await client.tesserae())[0]!.latestVersion, versionId);
        assert.equal((await client.getTessera({ tesseraId })).history.length, 1);

        // ...and back down again.
        await client.deleteTessera({ tesseraId });
        assert.deepEqual(await client.tesserae(), []);
    } finally {
        await stopped(running);
    }
});

test("bytes survive the round trip through the client", async () => {
    const running = await started();
    const { client } = running;

    try {
        const tesseraId = randomUUID();
        await client.createTessera({ body: { id: tesseraId, name: "Terrace" } });

        const blob = await client.uploadMosaicBlobUrl({ tesseraId });
        const uploaded = await archiveBytes("gltf-box");
        await client.upload({ blobId: blob.blobId, body: uploaded });

        const downloaded = await client.download({ blobId: blob.blobId });

        assert.ok(downloaded instanceof Uint8Array);
        assert.deepEqual([...downloaded], [...uploaded], "what came back is what went up");

        // And it is still an archive after all that.
        const file = await LoadMosaicFile(downloaded);
        assert.equal(file.index.sections[0]!.header.id, "box-geometry");
    } finally {
        await stopped(running);
    }
});

test("a download url the server hands out can be fetched with the same client", async () => {
    const running = await started();
    const { client } = running;

    try {
        const tesseraId = randomUUID();
        await client.createTessera({ body: { id: tesseraId, name: "Terrace" } });

        let previous = "";
        const versions: string[] = [];

        for (const example of ["house-v1", "house-v2"]) {
            const blob = await client.uploadMosaicBlobUrl({ tesseraId });
            await client.upload({ blobId: blob.blobId, body: await archiveBytes(example) });

            const versionId = randomUUID();
            const created = await client.createTesseraVersion({
                tesseraId,
                body: { id: versionId, previousTesseraVersionId: previous, blobId: blob.blobId },
            });
            assert.equal(created.state, CreateTesseraVersionResponseState.Ok, JSON.stringify(created));

            versions.push(versionId);
            previous = versionId;
        }

        const asked = await client.tesseraMosaic({
            tesseraId,
            versionId: versions[1]!,
            downloadType: MosaicFileDownloadType.WholeTesseraHistoryIntact,
        });

        // The url points back at this server, and the blob behind it is the whole history.
        assert.ok(asked.blobUrl.startsWith(running.server.url), asked.blobUrl);
        const blobId = asked.blobUrl.split("/").pop()!;
        const file = await LoadMosaicFile(await client.download({ blobId }));

        assert.deepEqual(file.index.sections.map(s => s.header.id), ["house-v1", "house-v1", "house-v2"]);
    } finally {
        await stopped(running);
    }
});

// ---------------------------------------------------------------------------
// What the client does with the answers it does not like
// ---------------------------------------------------------------------------

test("a 404 from the server becomes an ApiError with the reason", async () => {
    const running = await started();

    try {
        await assert.rejects(
            () => running.client.getTessera({ tesseraId: randomUUID() }),
            (error: unknown) => {
                assert.ok(error instanceof ApiError);
                assert.equal(error.status, 404);
                assert.match(error.message, /No tessera/);
                return true;
            },
        );
    } finally {
        await stopped(running);
    }
});

test("a 400 carries the message the server wrote", async () => {
    const running = await started();

    try {
        const id = randomUUID();
        await running.client.createTessera({ body: { id, name: "One" } });

        await assert.rejects(
            () => running.client.createTessera({ body: { id, name: "Two" } }),
            (error: unknown) => {
                assert.ok(error instanceof ApiError);
                assert.equal(error.status, 400);
                assert.match(error.message, /already exists/);
                return true;
            },
        );
    } finally {
        await stopped(running);
    }
});

test("a state the API answers with is not an error", async () => {
    const running = await started();
    const { client } = running;

    try {
        const tesseraId = randomUUID();
        await client.createTessera({ body: { id: tesseraId, name: "Terrace" } });

        // Being out of date is an ordinary answer, so it comes back as a value.
        const answer = await client.createTesseraVersion({
            tesseraId,
            body: { id: randomUUID(), previousTesseraVersionId: randomUUID(), blobId: randomUUID() },
        });

        assert.equal(answer.state, CreateTesseraVersionResponseState.OutOfDate);
        assert.ok(answer.validationErrors.length > 0);
    } finally {
        await stopped(running);
    }
});

test("the query operation reaches the server and reports that it is not written yet", async () => {
    const running = await started();

    try {
        await assert.rejects(
            () => running.client.query({
                tesseraId: randomUUID(), versionId: randomUUID(),
                path: "/", provenance: false, expandChildren: false, expandChildrenRecursive: false,
            }),
            (error: unknown) => {
                assert.ok(error instanceof ApiError);
                assert.equal(error.status, 501);
                return true;
            },
        );
    } finally {
        await stopped(running);
    }
});

test("a client pointed at nothing fails to connect rather than hanging", async () => {
    // Port 1 is not something a server here listens on.
    const client = new MosaicApiClient("http://127.0.0.1:1");

    await assert.rejects(() => client.tesserae(), (error: unknown) => {
        assert.ok(!(error instanceof ApiError), "there is no HTTP answer to make an ApiError from");
        return true;
    });
});
