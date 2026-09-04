import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { serve, type RunningServer } from "../src/api/Server.ts";
import { parseGlb } from "../src/gltf/GltfDocument.ts";
import { packMosaicSource } from "../src/MosaicPack.ts";
import { readExample, resolveExampleSchema } from "./fixtures.ts";

/** The page and the endpoints it uses, over a server that is really listening. */

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mosaic-app-"));
}

async function started(): Promise<{ server: RunningServer; dir: string; url: string }> {
    const dir = tempDir();
    const server = await serve({ database: path.join(dir, "app.duckdb") });
    return { server, dir, url: server.url };
}

async function stopped(running: { server: RunningServer; dir: string }): Promise<void> {
    await running.server.close();
    fs.rmSync(running.dir, { recursive: true, force: true });
}

/** Uploads an example the way the page does: one call, with the file name. */
async function upload(url: string, example: string): Promise<any> {
    const bytes = await packMosaicSource(readExample(example), resolveExampleSchema);
    const response = await fetch(`${url}/app/upload?name=${encodeURIComponent(`${example}.tsr`)}`, {
        method: "POST", body: bytes,
    });

    // The body can only be read once, so it is read before it is asserted on.
    const text = await response.text();
    assert.equal(response.status, 200, text);
    return JSON.parse(text);
}

const scene = async (url: string, tesseraId: string, versionId: string, compose = false): Promise<any> =>
    await (await fetch(`${url}/app/scene?tesseraId=${tesseraId}&versionId=${versionId}&compose=${compose}`)).json();

// ---------------------------------------------------------------------------

test("the page is served at the root", async () => {
    const running = await started();
    try {
        const response = await fetch(running.url);

        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /text\/html/);

        const html = await response.text();
        assert.match(html, /<model-viewer/, "the 3D view is a model-viewer element");
        assert.match(html, /id="tree"/);
        assert.match(html, /id="components"/);
        assert.match(html, /id="compose"/, "the compose flag is on the page");
    } finally {
        await stopped(running);
    }
});

test("uploading an archive publishes it as a tessera", async () => {
    const running = await started();
    try {
        const published = await upload(running.url, "gltf-box");

        assert.equal(published.state, "OK");
        assert.equal(published.name, "gltf-box");

        const tesserae = await (await fetch(`${running.url}/app/tesserae`)).json() as any[];
        assert.deepEqual(tesserae.map((t: any) => t.name), ["gltf-box"]);
        assert.equal(tesserae[0].versions.length, 1);
    } finally {
        await stopped(running);
    }
});

test("uploading the same name again adds a version rather than a tessera", async () => {
    const running = await started();
    try {
        const first = await upload(running.url, "house-v1");
        const second = await fetch(`${running.url}/app/upload?name=house-v1.tsr`, {
            method: "POST",
            body: await packMosaicSource(readExample("house-v2"), resolveExampleSchema),
        }).then(response => response.json()) as any;

        assert.equal(second.state, "OK");
        assert.equal(second.tesseraId, first.tesseraId, "the same tessera");

        const tesserae = await (await fetch(`${running.url}/app/tesserae`)).json() as any[];
        assert.equal(tesserae.length, 1);
        assert.equal(tesserae[0].versions.length, 2);
    } finally {
        await stopped(running);
    }
});

test("the scene gives the roots, and every node's name, children and components", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await upload(running.url, "instanced-boxes");
        const answer = await scene(running.url, tesseraId, versionId);

        assert.ok(answer.roots.length > 0);
        assert.ok(Object.keys(answer.nodes).length >= answer.roots.length);

        // The hierarchy the tree draws: a row holds a pair, which holds two placements.
        const named = Object.values(answer.nodes) as any[];
        const row = named.find(node => node.name === "Near row");
        assert.ok(row, "core::name became the node's name");
        assert.equal(row.children.length, 1);

        const pair = answer.nodes[row.children[0]];
        assert.equal(pair.name, "Pair");
        assert.equal(pair.children.length, 2);

        // And a component carries its value, which is what the components panel shows.
        const box = named.find(node => node.name === "Box");
        const mesh = box.components.find((component: any) => component.type.endsWith("meshPrimitive"));
        assert.ok(mesh.value.attributes, "the component's value came with it");
    } finally {
        await stopped(running);
    }
});

test("a node that carries no value shows as having none", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await upload(running.url, "instanced-boxes");
        const answer = await scene(running.url, tesseraId, versionId);

        const box = (Object.values(answer.nodes) as any[]).find(node => node.name === "Box");
        const name = box.components.find((component: any) => component.type === "core::name");

        assert.equal(name.index, -1);
        assert.equal(name.value, null, "there is no row behind it");
        assert.equal(name.id, "Box", "the reference id is the name");
    } finally {
        await stopped(running);
    }
});

test("the compose flag changes what the scene holds", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await upload(running.url, "typed-boxes");

        const plain = await scene(running.url, tesseraId, versionId, false);
        const composed = await scene(running.url, tesseraId, versionId, true);

        const nearBox = (nodes: any) =>
            (Object.values(nodes) as any[]).find(node => node.name === "Near box");

        const before = nearBox(plain.nodes);
        const after = nearBox(composed.nodes);

        // Without composing it is-a box type; with it, it carries what that type holds.
        assert.ok(before.components.some((c: any) => c.type === "core::inherit"));
        assert.ok(!before.components.some((c: any) => c.type.endsWith("meshPrimitive")),
            "the mesh belongs to the type, not to this node");
        assert.ok(after.components.some((c: any) => c.type.endsWith("meshPrimitive")),
            "composing gives it the type's mesh");
    } finally {
        await stopped(running);
    }
});

test("the 3D view goes through the real nodes endpoint", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await upload(running.url, "instanced-boxes");
        const answer = await scene(running.url, tesseraId, versionId);
        const row = (Object.values(answer.nodes) as any[]).find(node => node.name === "Near row");

        // Exactly the call the page makes when a node is selected.
        const response = await fetch(
            `${running.url}/Mosaic-api/tesserae/${tesseraId}/versions/${versionId}/nodes?format=glb`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ nodes: [row.id], includeChildren: true, compose: false }),
            });

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), "model/gltf-binary");

        const { document } = parseGlb(new Uint8Array(await response.arrayBuffer()));
        assert.equal(document.nodes!.filter(node => node.mesh !== undefined).length, 2);
        assert.equal(document.meshes?.length, 1, "and the geometry it needs came with it");
    } finally {
        await stopped(running);
    }
});

test("composing through the 3D call gives a node its type's geometry", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await upload(running.url, "typed-boxes");
        const answer = await scene(running.url, tesseraId, versionId);
        const box = (Object.values(answer.nodes) as any[]).find(node => node.name === "Near box");

        const ask = async (compose: boolean) => {
            const response = await fetch(
                `${running.url}/Mosaic-api/tesserae/${tesseraId}/versions/${versionId}/nodes?format=glb`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ nodes: [box.id], includeChildren: true, compose }),
                });
            assert.equal(response.status, 200);
            return parseGlb(new Uint8Array(await response.arrayBuffer())).document;
        };

        assert.equal((await ask(false)).nodes!.filter(node => node.mesh !== undefined).length, 0,
            "on its own it has no geometry of its own");
        assert.equal((await ask(true)).nodes!.filter(node => node.mesh !== undefined).length, 1,
            "composed, it draws its type's box");
    } finally {
        await stopped(running);
    }
});

test("the app endpoints report what is wrong rather than failing blankly", async () => {
    const running = await started();
    try {
        assert.equal((await fetch(`${running.url}/app/scene`)).status, 400);
        assert.equal((await fetch(`${running.url}/app/upload?name=x.tsr`, { method: "POST" })).status, 400);

        // An upload that is not an archive is a validation answer, not a crash.
        const rubbish = await fetch(`${running.url}/app/upload?name=rubbish.tsr`, {
            method: "POST", body: new Uint8Array([1, 2, 3]),
        });
        assert.equal(rubbish.status, 400);
        assert.match(((await rubbish.json()) as any).validationErrors.join(" "), /not a readable Mosaic archive/);
    } finally {
        await stopped(running);
    }
});
