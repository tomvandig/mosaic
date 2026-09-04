import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { serve, unimplementedOperations, API_ROUTES, type RunningServer } from "../src/api/index.ts";
import { CreateTesseraVersionResponseState, MosaicFileDownloadType } from "../src/api/MosaicApiTypes.ts";
import { LoadMosaicFile } from "../src/MosaicFile.ts";
import { packMosaicSource } from "../src/MosaicPack.ts";
import { readExample, resolveExampleSchema } from "./fixtures.ts";

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mosaic-api-"));
}

/** A server on a scratch database, with the calls the tests make wrapped up. */
async function withServer(): Promise<{
    server: RunningServer;
    dir: string;
    get(route: string): Promise<{ status: number; body: any }>;
    send(method: string, route: string, body?: unknown): Promise<{ status: number; body: any }>;
    put(route: string, bytes: Buffer): Promise<{ status: number; body: any }>;
    bytes(route: string): Promise<{ status: number; buffer: Buffer }>;
}> {
    const dir = tempDir();
    const server = await serve({ database: path.join(dir, "api.duckdb") });

    const call = async (method: string, route: string, init: RequestInit = {}) => {
        const response = await fetch(`${server.url}${route}`, { method, ...init });
        const text = await response.text();
        return { status: response.status, body: text.length > 0 ? JSON.parse(text) : undefined };
    };

    return {
        server, dir,
        get: route => call("GET", route),
        send: (method, route, body) => call(method, route, body === undefined ? {} : {
            body: JSON.stringify(body),
            headers: { "content-type": "application/json" },
        }),
        put: (route, bytes) => call("PUT", route, { body: new Uint8Array(bytes) }),
        async bytes(route) {
            const response = await fetch(`${server.url}${route}`, { method: "PUT" });
            return { status: response.status, buffer: Buffer.from(await response.arrayBuffer()) };
        },
    };
}

async function archiveBytes(name: string): Promise<Buffer> {
    return Buffer.from(await packMosaicSource(readExample(name), resolveExampleSchema));
}

/** Creates a tessera and uploads an archive into a blob for it. */
async function tesseraWithBlob(api: Awaited<ReturnType<typeof withServer>>, example = "house-v1") {
    const tesseraId = randomUUID();
    await api.send("POST", "/Mosaic-api/tesserae", { id: tesseraId, name: "House" });

    const reserved = await api.send("POST", `/Mosaic-api/tesserae/${tesseraId}/upload-Mosaic-blob-url`);
    await api.put(`/Mosaic-api/upload/${reserved.body.blobId}`, await archiveBytes(example));

    return { tesseraId, blobId: reserved.body.blobId as string, putURL: reserved.body.putURL as string };
}

// ---------------------------------------------------------------------------
// The spec and the server
// ---------------------------------------------------------------------------

test("every operation in the spec has a handler", () => {
    // The query API is the one the spec has and this does not answer.
    assert.deepEqual(unimplementedOperations(), []);
    assert.equal(API_ROUTES.length, 12);
    assert.ok(API_ROUTES.some(route => route.operationId === "TesseraVersionRoutes_fetchNodes"));
});

test("the routes come from the spec, braces and all", () => {
    const byId = Object.fromEntries(API_ROUTES.map(route => [route.operationId, route]));

    assert.equal(byId.Tesserae_tesserae!.path, "/Mosaic-api/tesserae");
    assert.equal(byId.Tesserae_tesserae!.method, "GET");
    assert.deepEqual(byId.TesseraVersionRoutes_get_tessera_version!.pathParameters, ["tesseraId", "versionId"]);
    assert.deepEqual(byId.TesseraVersionRoutes_tessera_Mosaic!.queryParameters, [{ name: "downloadType", required: true }]);
    assert.equal(byId.Tesserae_createTessera!.hasBody, true);
});

test("an unknown path is a 404 and a wrong method is a 405", async () => {
    const api = await withServer();
    try {
        assert.equal((await api.get("/Mosaic-api/nope")).status, 404);
        assert.equal((await api.send("DELETE", "/Mosaic-api/tesserae")).status, 405);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

// ---------------------------------------------------------------------------
// Tesserae
// ---------------------------------------------------------------------------

test("a tessera can be created, listed, fetched and deleted", async () => {
    const api = await withServer();
    try {
        assert.deepEqual((await api.get("/Mosaic-api/tesserae")).body, []);

        const id = randomUUID();
        assert.equal((await api.send("POST", "/Mosaic-api/tesserae", { id, name: "House" })).status, 200);

        const listed = await api.get("/Mosaic-api/tesserae");
        assert.deepEqual(listed.body, [{ id, name: "House", latestVersion: "" }]);

        const details = await api.get(`/Mosaic-api/tesserae/${id}`);
        assert.deepEqual(details.body, { id, name: "House", history: [] });

        assert.equal((await api.send("DELETE", `/Mosaic-api/tesserae/${id}`)).status, 200);
        assert.deepEqual((await api.get("/Mosaic-api/tesserae")).body, []);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("a tessera that is not there is a 404, and a duplicate is a 400", async () => {
    const api = await withServer();
    try {
        const missing = await api.get(`/Mosaic-api/tesserae/${randomUUID()}`);
        assert.equal(missing.status, 404);
        assert.match(missing.body.error, /No tessera/);

        const id = randomUUID();
        await api.send("POST", "/Mosaic-api/tesserae", { id, name: "One" });
        const again = await api.send("POST", "/Mosaic-api/tesserae", { id, name: "Two" });
        assert.equal(again.status, 400);
        assert.match(again.body.error, /already exists/);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

// ---------------------------------------------------------------------------
// Blobs
// ---------------------------------------------------------------------------

test("a blob url is handed out, uploaded to, and read back byte for byte", async () => {
    const api = await withServer();
    try {
        const { blobId, putURL } = await tesseraWithBlob(api);
        assert.equal(putURL, `${api.server.url}/Mosaic-api/upload/${blobId}`);

        const uploaded = await archiveBytes("house-v1");
        const downloaded = await api.bytes(`/Mosaic-api/download/${blobId}`);

        assert.equal(downloaded.status, 200);
        assert.deepEqual([...downloaded.buffer], [...uploaded], "what came back is what went up");

        // And it really is an archive.
        const file = await LoadMosaicFile(downloaded.buffer);
        assert.equal(file.index.sections[0]!.header.id, "house-v1");
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("a blob nobody uploaded is a 404", async () => {
    const api = await withServer();
    try {
        assert.equal((await api.bytes(`/Mosaic-api/download/${randomUUID()}`)).status, 404);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

test("a version is created from an uploaded blob, and shows up in the tessera's history", async () => {
    const api = await withServer();
    try {
        const { tesseraId, blobId } = await tesseraWithBlob(api);
        const versionId = randomUUID();

        const created = await api.send("POST", `/Mosaic-api/tesserae/${tesseraId}/versions`, {
            id: versionId, previousTesseraVersionId: "", blobId,
        });

        assert.equal(created.status, 200);
        assert.equal(created.body.state, CreateTesseraVersionResponseState.Ok);
        assert.deepEqual(created.body.validationErrors, []);

        // The provenance came off the archive's newest section.
        const version = await api.get(`/Mosaic-api/tesserae/${tesseraId}/versions/${versionId}`);
        assert.equal(version.body.tesseraId, tesseraId);
        assert.equal(version.body.provenance.author, "ada@example.com");
        assert.equal(version.body.provenance.message, "Initial two walls");

        const details = await api.get(`/Mosaic-api/tesserae/${tesseraId}`);
        assert.equal(details.body.history.length, 1);

        const listed = await api.get("/Mosaic-api/tesserae");
        assert.equal(listed.body[0].latestVersion, versionId);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("a version that does not follow the latest one is OUT_OF_DATE", async () => {
    const api = await withServer();
    try {
        const { tesseraId, blobId } = await tesseraWithBlob(api);
        const first = randomUUID();
        await api.send("POST", `/Mosaic-api/tesserae/${tesseraId}/versions`, { id: first, previousTesseraVersionId: "", blobId });

        // Claiming to follow nothing, when the tessera is already on a version.
        const stale = await api.send("POST", `/Mosaic-api/tesserae/${tesseraId}/versions`, {
            id: randomUUID(), previousTesseraVersionId: "", blobId,
        });

        assert.equal(stale.body.state, CreateTesseraVersionResponseState.OutOfDate);
        assert.match(stale.body.validationErrors[0], new RegExp(`on version ${first}`));

        // Following the one it is actually on works.
        const good = await api.send("POST", `/Mosaic-api/tesserae/${tesseraId}/versions`, {
            id: randomUUID(), previousTesseraVersionId: first, blobId,
        });
        assert.equal(good.body.state, CreateTesseraVersionResponseState.Ok);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("a blob that is not an archive is a VALIDATION_ERROR, not a crash", async () => {
    const api = await withServer();
    try {
        const tesseraId = randomUUID();
        await api.send("POST", "/Mosaic-api/tesserae", { id: tesseraId, name: "House" });

        const reserved = await api.send("POST", `/Mosaic-api/tesserae/${tesseraId}/upload-Mosaic-blob-url`);
        await api.put(`/Mosaic-api/upload/${reserved.body.blobId}`, Buffer.from("not an archive"));

        const created = await api.send("POST", `/Mosaic-api/tesserae/${tesseraId}/versions`, {
            id: randomUUID(), previousTesseraVersionId: "", blobId: reserved.body.blobId,
        });

        assert.equal(created.body.state, CreateTesseraVersionResponseState.ValidationError);
        assert.match(created.body.validationErrors[0], /not a readable Mosaic archive/);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("a version naming a blob nobody uploaded is a VALIDATION_ERROR", async () => {
    const api = await withServer();
    try {
        const tesseraId = randomUUID();
        await api.send("POST", "/Mosaic-api/tesserae", { id: tesseraId, name: "House" });

        const created = await api.send("POST", `/Mosaic-api/tesserae/${tesseraId}/versions`, {
            id: randomUUID(), previousTesseraVersionId: "", blobId: randomUUID(),
        });

        assert.equal(created.body.state, CreateTesseraVersionResponseState.ValidationError);
        assert.match(created.body.validationErrors[0], /has not been uploaded/);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

/** A tessera with two versions: house-v1, then house-v2 on top of it. */
async function tesseraWithHistory(api: Awaited<ReturnType<typeof withServer>>) {
    const tesseraId = randomUUID();
    await api.send("POST", "/Mosaic-api/tesserae", { id: tesseraId, name: "House" });

    const versions: string[] = [];
    let previous = "";

    for (const example of ["house-v1", "house-v2"]) {
        const reserved = await api.send("POST", `/Mosaic-api/tesserae/${tesseraId}/upload-Mosaic-blob-url`);
        await api.put(`/Mosaic-api/upload/${reserved.body.blobId}`, await archiveBytes(example));

        const versionId = randomUUID();
        const created = await api.send("POST", `/Mosaic-api/tesserae/${tesseraId}/versions`, {
            id: versionId, previousTesseraVersionId: previous, blobId: reserved.body.blobId,
        });
        assert.equal(created.body.state, CreateTesseraVersionResponseState.Ok, JSON.stringify(created.body));

        versions.push(versionId);
        previous = versionId;
    }

    return { tesseraId, versions };
}

test("downloading just this version rebuilds what was published, out of the database", async () => {
    const api = await withServer();
    try {
        const { tesseraId, versions } = await tesseraWithHistory(api);

        const asked = await api.send("PUT",
            `/Mosaic-api/tesserae/${tesseraId}/versions/${versions[0]}/download-Mosaic?downloadType=${MosaicFileDownloadType.JustThisVersion}`);
        assert.equal(asked.status, 200);
        assert.match(asked.body.blobUrl, /\/Mosaic-api\/download\//);

        // The answer is built from what the database holds, not handed back from the blob
        // the version arrived in, so it matches in content rather than byte for byte.
        const rebuilt = await LoadMosaicFile((await api.bytes(asked.body.blobUrl.replace(api.server.url, ""))).buffer);
        const published = await LoadMosaicFile(await archiveBytes("house-v1"));

        assert.deepEqual(
            rebuilt.index.sections.map(section => section.nodes.map(node => node.id)),
            published.index.sections.map(section => section.nodes.map(node => node.id)),
        );
        assert.deepEqual(
            [...rebuilt.serializedComponents].map(([type, rows]) => [type, rows.map(row => JSON.parse(row))]),
            [...published.serializedComponents].map(([type, rows]) => [type, rows.map(row => JSON.parse(row))]),
        );
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("emptying the blob table really does remove the bytes", async () => {
    const api = await withServer();
    try {
        const { tesseraId } = await tesseraWithHistory(api);
        void tesseraId;

        const before = await api.server.store.all(`SELECT count(*) AS n FROM api_blob WHERE bytes IS NOT NULL`);
        assert.ok(Number(before[0]!.n) > 0, "the uploads should be there to begin with");

        await api.server.store.forgetBlobs();

        const after = await api.server.store.all(`SELECT count(*) AS n FROM api_blob WHERE bytes IS NOT NULL`);
        assert.equal(Number(after[0]!.n), 0);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("a version is still readable once its blob is gone", async () => {
    const api = await withServer();
    try {
        const { tesseraId, versions } = await tesseraWithHistory(api);

        // Blobs carry bytes in and out; they are not storage. Once published, nothing the
        // server answers should depend on them still being there.
        await api.server.store.forgetBlobs();

        const asked = await api.send("PUT",
            `/Mosaic-api/tesserae/${tesseraId}/versions/${versions[1]}/download-Mosaic?downloadType=${MosaicFileDownloadType.WholeTesseraHistoryIntact}`);
        assert.equal(asked.status, 200);

        const file = await LoadMosaicFile((await api.bytes(asked.body.blobUrl.replace(api.server.url, ""))).buffer);
        assert.deepEqual(file.index.sections.map(s => s.header.id), ["house-v1", "house-v1", "house-v2"]);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("nodes can be fetched once the blobs are gone", async () => {
    const api = await withServer();
    try {
        const { tesseraId, versions } = await tesseraWithHistory(api);
        await api.server.store.forgetBlobs();

        const response = await fetch(
            `${api.server.url}/Mosaic-api/tesserae/${tesseraId}/versions/${versions[0]}/nodes?format=tsr`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ nodes: ["11111111-1111-4111-8111-111111111111"] }),
            });

        assert.equal(response.status, 200);
        const file = await LoadMosaicFile(new Uint8Array(await response.arrayBuffer()));
        assert.deepEqual(file.index.sections[0]!.nodes.map(node => node.id), ["11111111-1111-4111-8111-111111111111"]);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("downloading the whole history intact keeps every section", async () => {
    const api = await withServer();
    try {
        const { tesseraId, versions } = await tesseraWithHistory(api);

        const asked = await api.send("PUT",
            `/Mosaic-api/tesserae/${tesseraId}/versions/${versions[1]}/download-Mosaic?downloadType=${MosaicFileDownloadType.WholeTesseraHistoryIntact}`);
        const file = await LoadMosaicFile((await api.bytes(asked.body.blobUrl.replace(api.server.url, ""))).buffer);

        // house-v1 has one section and house-v2 has two, all kept.
        assert.deepEqual(file.index.sections.map(s => s.header.id), ["house-v1", "house-v1", "house-v2"]);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("downloading the whole history condensed drops what is no longer leading", async () => {
    const api = await withServer();
    try {
        const { tesseraId, versions } = await tesseraWithHistory(api);

        const asked = await api.send("PUT",
            `/Mosaic-api/tesserae/${tesseraId}/versions/${versions[1]}/download-Mosaic?downloadType=${MosaicFileDownloadType.WholeTesseraHistoryCondensed}`);
        const file = await LoadMosaicFile((await api.bytes(asked.body.blobUrl.replace(api.server.url, ""))).buffer);

        const walls = file.serializedComponents.get("acme::geometry::wall") ?? [];
        assert.ok(walls.length < 6, `condensed should hold fewer than the 6 rows the two archives have, got ${walls.length}`);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("an unknown downloadType is a 400 that says what is allowed", async () => {
    const api = await withServer();
    try {
        const { tesseraId, versions } = await tesseraWithHistory(api);

        const asked = await api.send("PUT",
            `/Mosaic-api/tesserae/${tesseraId}/versions/${versions[0]}/download-Mosaic?downloadType=sideways`);

        assert.equal(asked.status, 400);
        assert.match(asked.body.error, /Unknown downloadType "sideways"/);
        assert.match(asked.body.error, /just_this_version/);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

// ---------------------------------------------------------------------------
// The database underneath
// ---------------------------------------------------------------------------

test("a version's archive is queryable in the same database it is served from", async () => {
    const api = await withServer();
    try {
        const { tesseraId, versions } = await tesseraWithHistory(api);

        // The API's bookkeeping is there...
        const tesserae = await api.server.store.all(`SELECT tessera_id, name FROM api_tessera`);
        assert.deepEqual(tesserae, [{ tessera_id: tesseraId, name: "House" }]);

        // ...and so is the content of every version, in the component tables.
        const walls = await api.server.store.all(
            `SELECT file_id, name FROM "acme::geometry::wall" ORDER BY file_id, idx`);
        assert.ok(walls.some(row => String(row.file_id) === `${tesseraId}/${versions[0]}`));
        assert.ok(walls.some(row => row.name === "North wall"));
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("the query API answers 501 until it is written", async () => {
    const api = await withServer();
    try {
        const { tesseraId, versions } = await tesseraWithHistory(api);
        const asked = await api.get(`/Mosaic-api/tesserae/${tesseraId}/versions/${versions[0]}/query?path=/&provenance=false&expandChildren=false&expandChildrenRecursive=false`);

        assert.equal(asked.status, 501);
        assert.match(asked.body.error, /not implemented/);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});
