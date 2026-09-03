import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { serve, unimplementedOperations, API_ROUTES, type RunningServer } from "../src/api/index.ts";
import { CreateModelVersionResponseState, MosaicFileDownloadType } from "../src/api/MosaicApiTypes.ts";
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

/** Creates a model and uploads an archive into a blob for it. */
async function modelWithBlob(api: Awaited<ReturnType<typeof withServer>>, example = "house-v1") {
    const modelId = randomUUID();
    await api.send("POST", "/Mosaic-api/models", { id: modelId, name: "House" });

    const reserved = await api.send("POST", `/Mosaic-api/models/${modelId}/upload-Mosaic-blob-url`);
    await api.put(`/Mosaic-api/upload/${reserved.body.blobId}`, await archiveBytes(example));

    return { modelId, blobId: reserved.body.blobId as string, putURL: reserved.body.putURL as string };
}

// ---------------------------------------------------------------------------
// The spec and the server
// ---------------------------------------------------------------------------

test("every operation in the spec has a handler", () => {
    // The query API is the one the spec has and this does not answer.
    assert.deepEqual(unimplementedOperations(), []);
    assert.equal(API_ROUTES.length, 11);
});

test("the routes come from the spec, braces and all", () => {
    const byId = Object.fromEntries(API_ROUTES.map(route => [route.operationId, route]));

    assert.equal(byId.Models_models!.path, "/Mosaic-api/models");
    assert.equal(byId.Models_models!.method, "GET");
    assert.deepEqual(byId.ModelVersionRoutes_get_model_version!.pathParameters, ["modelId", "versionId"]);
    assert.deepEqual(byId.ModelVersionRoutes_model_Mosaic!.queryParameters, [{ name: "downloadType", required: true }]);
    assert.equal(byId.Models_createModel!.hasBody, true);
});

test("an unknown path is a 404 and a wrong method is a 405", async () => {
    const api = await withServer();
    try {
        assert.equal((await api.get("/Mosaic-api/nope")).status, 404);
        assert.equal((await api.send("DELETE", "/Mosaic-api/models")).status, 405);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

test("a model can be created, listed, fetched and deleted", async () => {
    const api = await withServer();
    try {
        assert.deepEqual((await api.get("/Mosaic-api/models")).body, []);

        const id = randomUUID();
        assert.equal((await api.send("POST", "/Mosaic-api/models", { id, name: "House" })).status, 200);

        const listed = await api.get("/Mosaic-api/models");
        assert.deepEqual(listed.body, [{ id, name: "House", latestVersion: "" }]);

        const details = await api.get(`/Mosaic-api/models/${id}`);
        assert.deepEqual(details.body, { id, name: "House", history: [] });

        assert.equal((await api.send("DELETE", `/Mosaic-api/models/${id}`)).status, 200);
        assert.deepEqual((await api.get("/Mosaic-api/models")).body, []);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("a model that is not there is a 404, and a duplicate is a 400", async () => {
    const api = await withServer();
    try {
        const missing = await api.get(`/Mosaic-api/models/${randomUUID()}`);
        assert.equal(missing.status, 404);
        assert.match(missing.body.error, /No model/);

        const id = randomUUID();
        await api.send("POST", "/Mosaic-api/models", { id, name: "One" });
        const again = await api.send("POST", "/Mosaic-api/models", { id, name: "Two" });
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
        const { blobId, putURL } = await modelWithBlob(api);
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

test("a version is created from an uploaded blob, and shows up in the model's history", async () => {
    const api = await withServer();
    try {
        const { modelId, blobId } = await modelWithBlob(api);
        const versionId = randomUUID();

        const created = await api.send("POST", `/Mosaic-api/models/${modelId}/versions`, {
            id: versionId, previousModelVersionId: "", blobId,
        });

        assert.equal(created.status, 200);
        assert.equal(created.body.state, CreateModelVersionResponseState.Ok);
        assert.deepEqual(created.body.validationErrors, []);

        // The provenance came off the archive's newest section.
        const version = await api.get(`/Mosaic-api/models/${modelId}/versions/${versionId}`);
        assert.equal(version.body.modelId, modelId);
        assert.equal(version.body.provenance.author, "ada@example.com");
        assert.equal(version.body.provenance.message, "Initial two walls");

        const details = await api.get(`/Mosaic-api/models/${modelId}`);
        assert.equal(details.body.history.length, 1);

        const listed = await api.get("/Mosaic-api/models");
        assert.equal(listed.body[0].latestVersion, versionId);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("a version that does not follow the latest one is OUT_OF_DATE", async () => {
    const api = await withServer();
    try {
        const { modelId, blobId } = await modelWithBlob(api);
        const first = randomUUID();
        await api.send("POST", `/Mosaic-api/models/${modelId}/versions`, { id: first, previousModelVersionId: "", blobId });

        // Claiming to follow nothing, when the model is already on a version.
        const stale = await api.send("POST", `/Mosaic-api/models/${modelId}/versions`, {
            id: randomUUID(), previousModelVersionId: "", blobId,
        });

        assert.equal(stale.body.state, CreateModelVersionResponseState.OutOfDate);
        assert.match(stale.body.validationErrors[0], new RegExp(`on version ${first}`));

        // Following the one it is actually on works.
        const good = await api.send("POST", `/Mosaic-api/models/${modelId}/versions`, {
            id: randomUUID(), previousModelVersionId: first, blobId,
        });
        assert.equal(good.body.state, CreateModelVersionResponseState.Ok);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("a blob that is not an archive is a VALIDATION_ERROR, not a crash", async () => {
    const api = await withServer();
    try {
        const modelId = randomUUID();
        await api.send("POST", "/Mosaic-api/models", { id: modelId, name: "House" });

        const reserved = await api.send("POST", `/Mosaic-api/models/${modelId}/upload-Mosaic-blob-url`);
        await api.put(`/Mosaic-api/upload/${reserved.body.blobId}`, Buffer.from("not an archive"));

        const created = await api.send("POST", `/Mosaic-api/models/${modelId}/versions`, {
            id: randomUUID(), previousModelVersionId: "", blobId: reserved.body.blobId,
        });

        assert.equal(created.body.state, CreateModelVersionResponseState.ValidationError);
        assert.match(created.body.validationErrors[0], /not a readable Mosaic archive/);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("a version naming a blob nobody uploaded is a VALIDATION_ERROR", async () => {
    const api = await withServer();
    try {
        const modelId = randomUUID();
        await api.send("POST", "/Mosaic-api/models", { id: modelId, name: "House" });

        const created = await api.send("POST", `/Mosaic-api/models/${modelId}/versions`, {
            id: randomUUID(), previousModelVersionId: "", blobId: randomUUID(),
        });

        assert.equal(created.body.state, CreateModelVersionResponseState.ValidationError);
        assert.match(created.body.validationErrors[0], /has not been uploaded/);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

/** A model with two versions: house-v1, then house-v2 on top of it. */
async function modelWithHistory(api: Awaited<ReturnType<typeof withServer>>) {
    const modelId = randomUUID();
    await api.send("POST", "/Mosaic-api/models", { id: modelId, name: "House" });

    const versions: string[] = [];
    let previous = "";

    for (const example of ["house-v1", "house-v2"]) {
        const reserved = await api.send("POST", `/Mosaic-api/models/${modelId}/upload-Mosaic-blob-url`);
        await api.put(`/Mosaic-api/upload/${reserved.body.blobId}`, await archiveBytes(example));

        const versionId = randomUUID();
        const created = await api.send("POST", `/Mosaic-api/models/${modelId}/versions`, {
            id: versionId, previousModelVersionId: previous, blobId: reserved.body.blobId,
        });
        assert.equal(created.body.state, CreateModelVersionResponseState.Ok, JSON.stringify(created.body));

        versions.push(versionId);
        previous = versionId;
    }

    return { modelId, versions };
}

test("downloading just this version hands back the archive that was uploaded", async () => {
    const api = await withServer();
    try {
        const { modelId, versions } = await modelWithHistory(api);

        const asked = await api.send("PUT",
            `/Mosaic-api/models/${modelId}/versions/${versions[0]}/download-Mosaic?downloadType=${MosaicFileDownloadType.JustThisVersion}`);
        assert.equal(asked.status, 200);
        assert.match(asked.body.blobUrl, /\/Mosaic-api\/download\//);

        const bytes = await api.bytes(asked.body.blobUrl.replace(api.server.url, ""));
        assert.deepEqual([...bytes.buffer], [...await archiveBytes("house-v1")]);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("downloading the whole history intact keeps every section", async () => {
    const api = await withServer();
    try {
        const { modelId, versions } = await modelWithHistory(api);

        const asked = await api.send("PUT",
            `/Mosaic-api/models/${modelId}/versions/${versions[1]}/download-Mosaic?downloadType=${MosaicFileDownloadType.WholeModelHistoryIntact}`);
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
        const { modelId, versions } = await modelWithHistory(api);

        const asked = await api.send("PUT",
            `/Mosaic-api/models/${modelId}/versions/${versions[1]}/download-Mosaic?downloadType=${MosaicFileDownloadType.WholeModelHistoryCondensed}`);
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
        const { modelId, versions } = await modelWithHistory(api);

        const asked = await api.send("PUT",
            `/Mosaic-api/models/${modelId}/versions/${versions[0]}/download-Mosaic?downloadType=sideways`);

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
        const { modelId, versions } = await modelWithHistory(api);

        // The API's bookkeeping is there...
        const models = await api.server.store.all(`SELECT model_id, name FROM api_model`);
        assert.deepEqual(models, [{ model_id: modelId, name: "House" }]);

        // ...and so is the content of every version, in the component tables.
        const walls = await api.server.store.all(
            `SELECT file_id, name FROM "acme::geometry::wall" ORDER BY file_id, idx`);
        assert.ok(walls.some(row => String(row.file_id) === `${modelId}/${versions[0]}`));
        assert.ok(walls.some(row => row.name === "North wall"));
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});

test("the query API answers 501 until it is written", async () => {
    const api = await withServer();
    try {
        const { modelId, versions } = await modelWithHistory(api);
        const asked = await api.get(`/Mosaic-api/models/${modelId}/versions/${versions[0]}/query?path=/&provenance=false&expandChildren=false&expandChildrenRecursive=false`);

        assert.equal(asked.status, 501);
        assert.match(asked.body.error, /not implemented/);
    } finally {
        await api.server.close();
        fs.rmSync(api.dir, { recursive: true, force: true });
    }
});
