import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import zlib from "node:zlib";
import path from "node:path";
import os from "node:os";
import { serve, type RunningServer } from "../src/api/Server.ts";
import { parseGlb } from "../src/gltf/GltfDocument.ts";
import { packMosaicSource } from "../src/MosaicPack.ts";
import { Type } from "../src/MosaicIndexFile.ts";
import { DATA_DIR, readExample, resolveExampleSchema } from "./fixtures.ts";

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

/** Publishes an archive that is already packed, the way a user drops a .tsr on the page. */
async function uploadArchive(url: string, name: string): Promise<any> {
    const bytes = fs.readFileSync(path.join(DATA_DIR, `${name}.tsr`));
    const response = await fetch(`${url}/app/upload?name=${encodeURIComponent(`${name}.tsr`)}`, {
        method: "POST", body: bytes,
    });

    const text = await response.text();
    assert.equal(response.status, 200, text);
    return JSON.parse(text);
}

const scene = async (url: string, tesseraId: string, versionId: string, compose = false): Promise<any> =>
    await (await fetch(`${url}/app/scene?tesseraId=${tesseraId}&versionId=${versionId}&compose=${compose}`)).json();

/** The scene over several versions at once, which is what ticking two tesserae asks for. */
const sceneOf = async (url: string, versions: any[], compose = false): Promise<any> => {
    const pairs = versions.map(version => `${version.tesseraId}:${version.versionId}`).join(",");
    const response = await fetch(`${url}/app/scene?versions=${pairs}&compose=${compose}`);

    const text = await response.text();
    assert.equal(response.status, 200, text);
    return JSON.parse(text);
};

const named = (answer: any, name: string): any =>
    (Object.values(answer.nodes) as any[]).find(node => node.name === name);

// ---------------------------------------------------------------------------

test("the page is served at the root", async () => {
    const running = await started();
    try {
        const response = await fetch(running.url);

        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /text\/html/);

        const html = await response.text();
        assert.match(html, /<canvas id="viewer">/, "the 3D view is a canvas the renderer draws into");
        assert.match(html, /"three": "https:/, "three.js is named in the import map");
        assert.match(html, /id="tree"/);
        assert.match(html, /id="components"/);
        // Inheritance is always resolved now, so there is no flag to find -- and the page
        // is generated from src/viewer/app, so this is also the check that it was built.
        assert.doesNotMatch(html, /id="compose"/, "composing is not a choice the page offers");
        assert.match(html, /id="tesserae"/, "the page is the viewer, not a placeholder");
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

test("an answer with no geometry says so, rather than looking like a broken viewer", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await upload(running.url, "typed-boxes");
        const answer = await scene(running.url, tesseraId, versionId);
        const box = (Object.values(answer.nodes) as any[]).find(node => node.name === "Near box");

        const ask = async (compose: boolean) => await fetch(
            `${running.url}/Mosaic-api/tesserae/${tesseraId}/versions/${versionId}/nodes?format=glb`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ nodes: [box.id], includeChildren: true, compose }),
            });

        // A node whose geometry belongs to the type it is-a has none of its own, and the
        // page needs to be able to tell that from a viewer that failed.
        assert.equal((await ask(false)).headers.get("x-mosaic-meshes"), "0");
        assert.equal((await ask(true)).headers.get("x-mosaic-meshes"), "1");
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

// --- more than one tessera at a time ---------------------------------------

test("two tesserae can be on show at once, each with its own roots", async () => {
    const running = await started();
    try {
        const boxes = await upload(running.url, "instanced-boxes");
        const house = await upload(running.url, "house-v1");

        const answer = await sceneOf(running.url, [boxes, house]);

        assert.deepEqual(answer.versions.map((version: any) => version.name), ["instanced-boxes", "house-v1"]);
        assert.ok(answer.versions.every((version: any) => version.roots.length > 0));

        // Every node says which tessera it is written in, and both are represented.
        const tesserae = new Set((Object.values(answer.nodes) as any[]).map(node => node.tessera));
        assert.deepEqual([...tesserae].sort(), ["house-v1", "instanced-boxes"]);
    } finally {
        await stopped(running);
    }
});

test("a version asked for on its own still reads what it imports", async () => {
    const running = await started();
    try {
        await uploadArchive(running.url, "helmet");
        const plaza = await upload(running.url, "helmet-plaza");

        const answer = await sceneOf(running.url, [plaza]);

        // The helmet was not asked for; it is here because the plaza imports it.
        assert.deepEqual(answer.imported.map((entry: any) => entry.name), ["helmet"]);
        assert.deepEqual(answer.versions.map((version: any) => version.name), ["helmet-plaza"]);
        assert.deepEqual(answer.warnings, []);

        // And a plinth's child is a node written in the other tessera.
        const plinth = named(answer, "Left plinth") ?? named(answer, "Lone plinth");
        assert.ok(plinth, "the plaza's own nodes are there");

        const child = answer.nodes[plinth.children[0]];
        assert.ok(child, "the child a plinth names resolved");
        assert.equal(child.tessera, "helmet", "and it is written in the imported tessera");
    } finally {
        await stopped(running);
    }
});

test("with both on show, the imported node hangs under the tessera that imports it", async () => {
    const running = await started();
    try {
        const helmet = await uploadArchive(running.url, "helmet");
        const plaza = await upload(running.url, "helmet-plaza");

        const alone = await sceneOf(running.url, [helmet]);
        const together = await sceneOf(running.url, [helmet, plaza]);

        const helmetGroup = (answer: any) => answer.versions.find((version: any) => version.name === "helmet");
        const held = new Set(
            (Object.values(together.nodes) as any[]).flatMap(node => node.children ?? []));

        // Being a root is judged across everything on show, so the node the plaza holds
        // as a child stops being a root of the helmet as soon as the plaza is there too.
        assert.ok(helmetGroup(alone).roots.length > helmetGroup(together).roots.length);
        assert.ok(helmetGroup(alone).roots.some((id: string) => held.has(id)),
            "and it is the plaza that holds it");
    } finally {
        await stopped(running);
    }
});

test("a glb of everything on show is built across the tesserae", async () => {
    const running = await started();
    try {
        await uploadArchive(running.url, "helmet");
        const plaza = await upload(running.url, "helmet-plaza");
        const boxes = await upload(running.url, "instanced-boxes");

        const answer = await sceneOf(running.url, [plaza, boxes]);
        const roots = answer.versions.flatMap((version: any) => version.roots);

        const response = await fetch(`${running.url}/app/glb`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                versions: [plaza, boxes].map(({ tesseraId, versionId }) => ({ tesseraId, versionId })),
                nodes: roots,
                includeChildren: true,
                compose: false,
            }),
        });

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), "model/gltf-binary");

        const { document } = parseGlb(new Uint8Array(await response.arrayBuffer()));

        // Five helmets from the imported tessera and the boxes from the other one, all
        // drawn from geometry that was written once.
        assert.ok(document.nodes!.filter(node => node.mesh !== undefined).length >= 7);
        assert.ok((document.meshes?.length ?? 0) >= 2);
    } finally {
        await stopped(running);
    }
});

test("the 3D view of an imported node goes through that tessera's own version", async () => {
    const running = await started();
    try {
        await uploadArchive(running.url, "helmet");
        const plaza = await upload(running.url, "helmet-plaza");

        const answer = await sceneOf(running.url, [plaza]);
        const imported = (Object.values(answer.nodes) as any[]).find(node => node.tessera === "helmet");

        // Exactly the call the page makes: the node's own tessera and version, which is
        // not the one on screen.
        assert.notEqual(imported.tesseraId, plaza.tesseraId);

        const response = await fetch(
            `${running.url}/Mosaic-api/tesserae/${imported.tesseraId}/versions/${imported.versionId}/nodes?format=glb`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ nodes: [imported.id], includeChildren: true }),
            });

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("x-mosaic-missing"), null, "the node is in that version");
    } finally {
        await stopped(running);
    }
});

test("an import naming something the server does not have is reported", async () => {
    const running = await started();
    try {
        const linked = await upload(running.url, "linked-house");
        const answer = await sceneOf(running.url, [linked]);

        assert.equal(answer.imported.length, 0);
        assert.equal(answer.warnings.length, 2, "both unresolved imports are named");
        assert.match(answer.warnings.join(" "), /house-v1\.tsr/);
        assert.match(answer.warnings.join(" "), /site-survey\.tsr/);

        // The version itself still shows: an import that cannot be followed is missing
        // context, not a failure.
        assert.ok(answer.versions[0].roots.length > 0);
    } finally {
        await stopped(running);
    }
});

test("a scene needs to be told what to show", async () => {
    const running = await started();
    try {
        assert.equal((await fetch(`${running.url}/app/scene?versions=`)).status, 400);
        assert.equal((await fetch(`${running.url}/app/scene?versions=not-a-pair`)).status, 400);

        const glb = await fetch(`${running.url}/app/glb`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ nodes: ["55555555-5555-4555-8555-555555555555"] }),
        });
        assert.equal(glb.status, 400);
    } finally {
        await stopped(running);
    }
});

/**
 * The instanced boxes, with a property set hung off every node that has geometry.
 *
 * No example carries both geometry and components a glb has nowhere to put, and that
 * combination is the whole point of asking for a subset: the properties are what a
 * converted building is mostly made of, and none of them are drawable.
 */
function boxesWithProperties(): any {
    const document = structuredClone(readExample("instanced-boxes")) as any;

    document.components["acme::propertySet"] = [];
    document.index.componentTables.push({
        filename: "acme::propertySet.ndjson",
        type: Type.Ndjson,
        schema: {
            "x-mosaic-id": "acme::propertySet",
            type: "object",
            additionalProperties: false,
            properties: { note: { type: "string" } },
        },
    });

    for (const node of document.index.sections[0].nodes) {
        if (!(node.components ?? []).some((c: any) => c.type === "khronos::gltf::meshPrimitive")) continue;

        const index = document.components["acme::propertySet"].length;
        // Big enough that leaving it out of a glb is visible in the byte count.
        document.components["acme::propertySet"].push({ note: "PROPERTY-MARKER-" + index + "-" + "x".repeat(4096) });
        node.components.push({ type: "acme::propertySet", id: "properties", index });
    }

    return document;
}

/** Publishes a source document the page's own upload route, as a named tessera. */
async function publish(url: string, name: string, document: any): Promise<any> {
    const response = await fetch(`${url}/app/upload?name=${encodeURIComponent(`${name}.tsr`)}`, {
        method: "POST", body: await packMosaicSource(document, resolveExampleSchema),
    });

    const text = await response.text();
    assert.equal(response.status, 200, text);
    return JSON.parse(text);
}

test("a scene can be asked for only the component types a tree draws", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await publish(running.url, "boxes", boxesWithProperties());

        const everything = await scene(running.url, tesseraId, versionId);
        const typesIn = (answer: any) => new Set(
            (Object.values(answer.nodes) as any[]).flatMap(node => node.components.map((c: any) => c.type)));

        assert.ok(typesIn(everything).has("acme::propertySet"), "the unfiltered scene has the properties");
        assert.ok(typesIn(everything).has("khronos::gltf::meshPrimitive"), "and the geometry");

        const tree = await (await fetch(
            `${running.url}/app/scene?tesseraId=${tesseraId}&versionId=${versionId}`
            + `&components=${encodeURIComponent("core::child,core::inherit,core::name")}`)).json() as any;

        // The same tree: every node still there, still named, still holding its children.
        assert.deepEqual(Object.keys(tree.nodes).sort(), Object.keys(everything.nodes).sort());
        assert.deepEqual(tree.roots, everything.roots);
        for (const [id, node] of Object.entries(tree.nodes) as any[]) {
            assert.equal(node.name, everything.nodes[id].name, `name of ${id}`);
            assert.deepEqual(node.children, everything.nodes[id].children, `children of ${id}`);
        }

        // And nothing else came with it.
        assert.deepEqual([...typesIn(tree)].sort(), ["core::child", "core::name"],
            "only the types asked for, of those the file holds");
    } finally {
        await stopped(running);
    }
});

test("a scene can be asked about one node rather than the roots", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await publish(running.url, "boxes", boxesWithProperties());

        const everything = await scene(running.url, tesseraId, versionId);
        const box = (Object.values(everything.nodes) as any[])
            .find(node => node.components.some((c: any) => c.type === "acme::propertySet"));

        const one = await (await fetch(
            `${running.url}/app/scene?tesseraId=${tesseraId}&versionId=${versionId}`
            + `&nodes=${box.id}&children=false`)).json() as any;

        assert.deepEqual(one.roots, [box.id], "the node asked for is what the answer is about");

        // It carries everything, filter or no filter: this is the call the panel makes
        // once the tree has been read without any of it.
        const carried = one.nodes[box.id].components.map((c: any) => c.type).sort();
        assert.deepEqual(carried, box.components.map((c: any) => c.type).sort());
        assert.ok(one.nodes[box.id].components.some((c: any) => c.value?.note?.startsWith("PROPERTY-MARKER-")),
            "with the values, which is what it is for");

        // Not the whole building: only what that node needed to stand on its own.
        assert.ok(Object.keys(one.nodes).length < Object.keys(everything.nodes).length);
    } finally {
        await stopped(running);
    }
});

test("a glb can be asked for only what a glb can draw", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await publish(running.url, "boxes", boxesWithProperties());

        const ask = async (componentTypes?: string[]) => {
            const response = await fetch(
                `${running.url}/app/glb`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        versions: [{ tesseraId, versionId }],
                        nodes: (await scene(running.url, tesseraId, versionId)).roots,
                        includeChildren: true,
                        ...(componentTypes ? { componentTypes } : {}),
                    }),
                });
            // The bytes are read first: reading the body as text to explain a failure
            // would leave nothing to read as bytes.
            const bytes = Buffer.from(await response.arrayBuffer());
            assert.equal(response.status, 200, bytes.toString("utf-8").slice(0, 200));

            return { bytes, meshes: response.headers.get("x-mosaic-meshes") };
        };

        const whole = await ask();
        const drawable = await ask([
            "khronos::gltf::buffer", "khronos::gltf::bufferView", "khronos::gltf::accessor",
            "khronos::gltf::meshPrimitive", "khronos::gltf::image", "khronos::gltf::sampler",
            "khronos::gltf::texture", "khronos::gltf::material", "core::transform", "core::child",
        ]);

        // The same picture out of a smaller file: the properties travelled as extension
        // data on every node, and asking for the drawable components leaves them behind.
        assert.equal(drawable.meshes, whole.meshes, "the same meshes");
        assert.ok(whole.bytes.includes("PROPERTY-MARKER-"), "the whole glb carries the properties");
        assert.ok(!drawable.bytes.includes("PROPERTY-MARKER-"), "the drawable one does not");
        assert.ok(drawable.bytes.byteLength < whole.bytes.byteLength,
            `${drawable.bytes.byteLength} should be under ${whole.bytes.byteLength}`);
    } finally {
        await stopped(running);
    }
});

/**
 * A request made without fetch, so what comes back over the wire can be looked at.
 *
 * `fetch` decodes a compressed body before anyone sees it, which is exactly what is being
 * tested here, so these go through node's own client and read the bytes as they arrive.
 */
function raw(url: string, encoding: string): Promise<{ status: number; headers: any; body: Buffer }> {
    const target = new URL(url);

    return new Promise((resolve, reject) => {
        const request = http.request(
            {
                hostname: target.hostname, port: target.port, path: target.pathname + target.search,
                method: "GET", headers: { "accept-encoding": encoding },
            },
            response => {
                const chunks: Buffer[] = [];
                response.on("data", chunk => chunks.push(chunk as Buffer));
                response.on("end", () => resolve({
                    status: response.statusCode ?? 0,
                    headers: response.headers,
                    body: Buffer.concat(chunks),
                }));
            });

        request.on("error", reject);
        request.end();
    });
}

test("a big answer is compressed when the client takes gzip", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await publish(running.url, "boxes", boxesWithProperties());
        const where = `${running.url}/app/scene?tesseraId=${tesseraId}&versionId=${versionId}`;

        const packed = await raw(where, "gzip");
        assert.equal(packed.status, 200);
        assert.equal(packed.headers["content-encoding"], "gzip");
        assert.match(String(packed.headers["vary"]), /accept-encoding/i);

        const plain = await raw(where, "identity");
        assert.equal(plain.headers["content-encoding"], undefined, "not compressed for a client that said no");

        // The same answer either way, and smaller on the wire.
        assert.deepEqual(
            JSON.parse(zlib.gunzipSync(packed.body).toString("utf-8")),
            JSON.parse(plain.body.toString("utf-8")));
        assert.ok(packed.body.byteLength < plain.body.byteLength,
            `${packed.body.byteLength} should be under ${plain.body.byteLength}`);

        // And the length said is the length sent, or a browser hangs waiting for the rest.
        assert.equal(Number(packed.headers["content-length"]), packed.body.byteLength);
        assert.equal(Number(plain.headers["content-length"]), plain.body.byteLength);
    } finally {
        await stopped(running);
    }
});

test("a glb is compressed too, and arrives as the same file", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await publish(running.url, "boxes", boxesWithProperties());
        const roots = (await scene(running.url, tesseraId, versionId)).roots;

        const ask = (encoding: string) => new Promise<{ headers: any; body: Buffer }>((resolve, reject) => {
            const target = new URL(`${running.url}/Mosaic-api/tesserae/${tesseraId}/versions/${versionId}/nodes?format=glb`);
            const request = http.request(
                {
                    hostname: target.hostname, port: target.port, path: target.pathname + target.search,
                    method: "POST",
                    headers: { "content-type": "application/json", "accept-encoding": encoding },
                },
                response => {
                    const chunks: Buffer[] = [];
                    response.on("data", chunk => chunks.push(chunk as Buffer));
                    response.on("end", () => resolve({ headers: response.headers, body: Buffer.concat(chunks) }));
                });
            request.on("error", reject);
            request.end(JSON.stringify({ nodes: roots, includeChildren: true }));
        });

        const packed = await ask("gzip");
        const plain = await ask("identity");

        assert.equal(packed.headers["content-encoding"], "gzip");
        assert.ok(zlib.gunzipSync(packed.body).equals(plain.body), "the same glb, byte for byte");
        assert.ok(packed.body.byteLength < plain.body.byteLength);

        // The headers a caller reads to know what it got survive being compressed.
        assert.equal(packed.headers["x-mosaic-meshes"], plain.headers["x-mosaic-meshes"]);
    } finally {
        await stopped(running);
    }
});

test("a small answer is sent as it is", async () => {
    const running = await started();
    try {
        // Nothing published, so this is a couple of bytes and not worth compressing.
        const answer = await raw(`${running.url}/app/tesserae`, "gzip");

        assert.equal(answer.status, 200);
        assert.equal(answer.headers["content-encoding"], undefined);
        assert.deepEqual(JSON.parse(answer.body.toString("utf-8")), []);
    } finally {
        await stopped(running);
    }
});

test("a glb with no nodes named is everything on show", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await publish(running.url, "boxes", boxesWithProperties());
        const roots = (await scene(running.url, tesseraId, versionId)).roots;

        const ask = async (nodes: unknown) => {
            const response = await fetch(`${running.url}/app/glb`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ versions: [{ tesseraId, versionId }], includeChildren: true, nodes }),
            });
            const bytes = Buffer.from(await response.arrayBuffer());
            assert.equal(response.status, 200, bytes.toString("utf-8").slice(0, 200));
            return { bytes, nodes: response.headers.get("x-mosaic-nodes") };
        };

        // The page cannot name the roots in the request that fetches them, so leaving them
        // out has to mean all of them.
        const named = await ask(roots);
        for (const missing of [null, undefined, []]) {
            const answer = await ask(missing);
            assert.equal(answer.nodes, named.nodes, `nodes: ${JSON.stringify(missing)}`);
            assert.ok(answer.bytes.equals(named.bytes), `the same glb for ${JSON.stringify(missing)}`);
        }
    } finally {
        await stopped(running);
    }
});

test("a tree can be read out of the glb the viewer draws", async () => {
    const running = await started();
    try {
        const { tesseraId, versionId } = await publish(running.url, "boxes", boxesWithProperties());

        const response = await fetch(`${running.url}/app/glb`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                versions: [{ tesseraId, versionId }],
                includeChildren: true,
                componentTypes: [
                    "khronos::gltf::buffer", "khronos::gltf::bufferView", "khronos::gltf::accessor",
                    "khronos::gltf::meshPrimitive", "khronos::gltf::image", "khronos::gltf::sampler",
                    "khronos::gltf::texture", "khronos::gltf::material",
                    "core::transform", "core::child", "core::name",
                ],
            }),
        });

        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(response.status, 200);

        // Read the json chunk the way the page does: a header, then chunks.
        assert.equal(bytes.toString("ascii", 0, 4), "glTF");
        const length = bytes.readUInt32LE(12);
        assert.equal(bytes.toString("ascii", 16, 20), "JSON");
        const gltf = JSON.parse(bytes.toString("utf-8", 20, 20 + length));

        const nodes = gltf.nodes ?? [];
        assert.ok(nodes.length > 0);

        // Every node the tree would draw carries the Mosaic id as its glTF name, and its
        // display name as a core::name component.
        const named = nodes.filter((n: any) =>
            (n.extensions?.MOSAIC_components?.components ?? []).some((c: any) => c.type === "core::name"));
        assert.ok(named.length > 0, "the names the tree is drawn from are in the glb");
        for (const node of nodes) assert.ok(typeof node.name === "string", "every node keeps its Mosaic id");

        // And the hierarchy is whole: everything is reachable from the scene's roots.
        const seen = new Set<number>();
        const walk = (at: number) => {
            if (seen.has(at)) return;
            seen.add(at);
            for (const child of nodes[at]?.children ?? []) walk(child);
        };
        for (const root of gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? []) walk(root);
        assert.equal(seen.size, nodes.length, "no node is stranded outside the scene");
    } finally {
        await stopped(running);
    }
});
