import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { LoadMosaicFile } from "../src/MosaicFile.ts";
import { collapseNodesByPath } from "../src/MosaicFileOperations.ts";
import { parseGlb } from "../src/gltf/GltfDocument.ts";
import { loadWithImports } from "../src/composition/ComposeFs.ts";
import { ArchiveSource, type LoadedTessera } from "../src/viewer/ArchiveSource.ts";
import { loadArchive, resolveWithin, type Fetcher } from "../src/viewer/FetchArchives.ts";
import { GEOMETRY_COMPONENTS } from "../src/viewer/Components.ts";
import { DATA_DIR } from "./fixtures.ts";

/** The archives, read off disk the way the browser reads them off a server. */
const serve: Fetcher = async url => new Uint8Array(fs.readFileSync(url));

/** test-data, named the way a url names it, since that is what the loader takes. */
const DIR = DATA_DIR.split(path.sep).join("/");

/** One tessera per archive, as the static viewer builds them. */
async function sourceOf(...archives: string[]): Promise<ArchiveSource> {
    const loaded: LoadedTessera[] = [];

    for (const name of archives) {
        const { file, alone, beneath, own } = await loadArchive(DIR, name, serve);
        loaded.push({
            id: "t-" + name,
            name,
            versions: [{ versionId: "v-" + name, alone, ...(beneath ? { beneath } : {}), file, own }],
        });
    }

    return new ArchiveSource(loaded);
}

const allOf = (source: ArchiveSource, names: string[]) =>
    names.map(name => ({ tesseraId: "t-" + name, versionId: "v-" + name }));

test("an import is followed and merged underneath, as it is on disk", async () => {
    const overFetch = await loadArchive(DIR, "helmet-plaza.tsr", serve);
    const overDisk = await loadWithImports(path.join(DATA_DIR, "helmet-plaza.tsr"));

    const fetched = [...collapseNodesByPath(overFetch.file).keys()].sort();
    const read = [...collapseNodesByPath(overDisk.file).keys()].sort();

    assert.deepEqual(fetched, read, "fetching the imports gives the same nodes as reading them");
    assert.ok(fetched.length > 0);
});

test("what the archive writes itself is kept apart from what it imported", async () => {
    const { own } = await loadArchive(DIR, "helmet-plaza.tsr", serve);
    const alone = await LoadMosaicFile(new Uint8Array(fs.readFileSync(path.join(DATA_DIR, "helmet-plaza.tsr"))));
    const helmet = await LoadMosaicFile(new Uint8Array(fs.readFileSync(path.join(DATA_DIR, "helmet.tsr"))));

    for (const section of alone.index.sections) {
        for (const node of section.nodes) assert.ok(own.has(node.id), "its own nodes are its own");
    }

    const imported = [...collapseNodesByPath(helmet).keys()];
    const overlap = imported.filter(id => own.has(id));
    assert.equal(overlap.length, 0, "nothing that came from the import is claimed as its own");
});

test("an import that is not a path is skipped, and said so", async () => {
    const warnings: string[] = [];
    const { file } = await loadArchive(DIR, "linked-house.tsr", serve, warnings);

    assert.equal(warnings.length, 1, "one import could not be fetched");
    assert.match(warnings[0]!, /site-survey/, "and it says which");
    assert.ok(collapseNodesByPath(file).size > 0, "the rest of it still loaded");
});

test("an import resolves against the file that declares it", () => {
    const root = "examples/house";

    assert.equal(resolveWithin(root, root, "helmet.tsr"), "examples/house/helmet.tsr");
    assert.equal(resolveWithin(root, root, "./parts/wall.tsr"), "examples/house/parts/wall.tsr");

    // A file in a subfolder means the folder above its own, not the root.
    assert.equal(resolveWithin(root, root + "/parts", "../wall.tsr"), "examples/house/wall.tsr");
    assert.equal(resolveWithin(root, root + "/parts", "./bolt.tsr"), "examples/house/parts/bolt.tsr");
});

test("an import cannot climb out of the example it belongs to", () => {
    const root = "examples/house";

    assert.throws(() => resolveWithin(root, root, "../secrets.tsr"), /outside/);
    assert.throws(() => resolveWithin(root, root + "/parts", "../../../secrets.tsr"), /outside/);
    assert.throws(() => resolveWithin(root, root, "https://elsewhere/x.tsr"), /not a path/);
});

test("a glb built in memory is the one the composer builds", async () => {
    const source = await sourceOf("helmet-plaza.tsr");
    const bytes = await source.glb({ versions: allOf(source, ["helmet-plaza.tsr"]) });

    const glb = parseGlb(bytes);
    const composed = await loadWithImports(path.join(DATA_DIR, "helmet-plaza.tsr"));
    const { mosaicToGltf } = await import("../src/composition/MosaicToGltf.ts");
    const direct = mosaicToGltf(composed.file);

    assert.equal(glb.document.meshes?.length, direct.document.meshes?.length, "the same meshes");
    assert.ok((glb.document.meshes?.length ?? 0) > 0, "and there are some");
});

test("asking for only the drawable components leaves the rest out", async () => {
    const source = await sourceOf("helmet-plaza.tsr");
    const versions = allOf(source, ["helmet-plaza.tsr"]);

    const everything = await source.glb({ versions });
    const drawable = await source.glb({ versions, componentTypes: [...GEOMETRY_COMPONENTS] });

    assert.ok(drawable.byteLength <= everything.byteLength,
        "asking for less does not give more");
    assert.ok(parseGlb(drawable).document.meshes?.length,
        "and what is drawable still draws");
});

test("the scene names the roots, their children and where they are written", async () => {
    const source = await sourceOf("helmet-plaza.tsr");
    const scene = await source.scene({ versions: allOf(source, ["helmet-plaza.tsr"]) });

    assert.ok(scene.roots.length > 0, "something is a root");
    for (const id of scene.roots) assert.ok(scene.nodes[id], "and it is in the answer");

    const named = Object.values(scene.nodes).filter(node => node.name !== null);
    assert.ok(named.length > 0, "nodes carry their names");

    const mine = Object.values(scene.nodes).filter(node => node.tessera === "helmet-plaza.tsr");
    assert.ok(mine.length > 0, "and the archive they were written in");
});

test("two archives shown together are one tree", async () => {
    const source = await sourceOf("house-v1.tsr", "gltf-box.tsr");
    const versions = allOf(source, ["house-v1.tsr", "gltf-box.tsr"]);

    const scene = await source.scene({ versions });
    const alone = await source.scene({ versions: versions.slice(0, 1) });

    assert.ok(Object.keys(scene.nodes).length > Object.keys(alone.nodes).length,
        "showing both shows more than showing one");

    const from = new Set(Object.values(scene.nodes).map(node => node.tessera));
    assert.ok(from.has("house-v1.tsr") && from.has("gltf-box.tsr"),
        "and each node still says which archive it came from");
});

test("naming a node answers about that node alone", async () => {
    const source = await sourceOf("helmet-plaza.tsr");
    const versions = allOf(source, ["helmet-plaza.tsr"]);

    const whole = await source.scene({ versions });
    const one = whole.roots[0]!;

    const just = await source.scene({ versions, nodes: [one], includeChildren: false });

    assert.deepEqual(just.roots, [one]);
    assert.equal(Object.keys(just.nodes).length, 1, "one node, not its children");
    assert.ok(just.nodes[one]!.components.length > 0, "and it carries what it carries");
});

test("a source with nothing in it answers rather than throwing", async () => {
    const source = new ArchiveSource();

    assert.deepEqual(await source.tesserae(), []);

    const scene = await source.scene({ versions: [] });
    assert.deepEqual(scene.roots, []);
    assert.deepEqual(scene.nodes, {});
});

test("an archive can be added after the fact, the way a drop does it", async () => {
    const source = new ArchiveSource();
    const { file, alone, own } = await loadArchive(DIR, "helmet.tsr", serve);

    const summary = source.put("helmet", { versionId: "v1", alone, file, own });

    assert.equal(summary.name, "helmet");
    assert.equal((await source.tesserae()).length, 1);

    const scene = await source.scene({ versions: [{ tesseraId: summary.id, versionId: "v1" }] });
    assert.ok(scene.roots.length > 0, "and it shows");
});

test("an archive opens as the files it is made of", async () => {
    const source = await sourceOf("helmet-plaza.tsr");
    const [ref] = allOf(source, ["helmet-plaza.tsr"]);

    const held = source.filesOf(ref!);
    assert.ok(held, "the archive is there to open");

    assert.ok(held!.files["index.json"], "an archive has an index");
    JSON.parse(held!.files["index.json"]!);

    const tables = Object.keys(held!.files).filter(name => name.endsWith(".ndjson"));
    assert.ok(tables.length > 0, "and a table per component type");

    // What is shown is the archive as written, not the archive plus what it imports.
    const index = JSON.parse(held!.files["index.json"]!);
    assert.ok(index.imports.length > 0, "helmet-plaza imports the helmet");
});

test("what is saved is what is drawn afterwards", async () => {
    const source = await sourceOf("typed-boxes.tsr");
    const [ref] = allOf(source, ["typed-boxes.tsr"]);

    const before = await source.scene({ versions: [ref!], compose: true });
    const named = Object.values(before.nodes).find(node => node.name !== null)!;

    const held = source.filesOf(ref!)!;
    const edited = held.files["index.json"]!.replace(named.name!, "Renamed by the editor");
    assert.notEqual(edited, held.files["index.json"], "the name was there to change");

    const { warnings } = source.replaceFiles(ref!, { ...held.files, "index.json": edited });
    assert.deepEqual(warnings, [], "nothing to warn about");

    const after = await source.scene({ versions: [ref!], compose: true });
    const renamed = Object.values(after.nodes).filter(node => node.name === "Renamed by the editor");
    assert.equal(renamed.length, 1, "the edit shows in the scene");

    // And the glb still builds from it, which is what the viewer draws.
    const bytes = await source.glb({ versions: [ref!], compose: true });
    assert.ok(parseGlb(bytes).document.meshes?.length, "and it still has geometry");
});

test("saving keeps what the archive imports underneath it", async () => {
    const source = await sourceOf("helmet-plaza.tsr");
    const [ref] = allOf(source, ["helmet-plaza.tsr"]);

    const before = await source.glb({ versions: [ref!] });
    const meshesBefore = parseGlb(before).document.meshes?.length ?? 0;

    // Saved back unchanged: the imported helmet has to survive the round trip.
    const held = source.filesOf(ref!)!;
    source.replaceFiles(ref!, held.files);

    const after = await source.glb({ versions: [ref!] });
    assert.equal(parseGlb(after).document.meshes?.length, meshesBefore,
        "the imported geometry is still there");
});

test("a broken edit is refused rather than half applied", async () => {
    const source = await sourceOf("typed-boxes.tsr");
    const [ref] = allOf(source, ["typed-boxes.tsr"]);

    const before = await source.scene({ versions: [ref!] });
    const held = source.filesOf(ref!)!;

    assert.throws(() => source.replaceFiles(ref!, { ...held.files, "index.json": "{ not json" }));

    const after = await source.scene({ versions: [ref!] });
    assert.deepEqual(Object.keys(after.nodes).sort(), Object.keys(before.nodes).sort(),
        "the archive is as it was");
});

test("an import added by an edit is reported, since it cannot be fetched", async () => {
    const source = await sourceOf("typed-boxes.tsr");
    const [ref] = allOf(source, ["typed-boxes.tsr"]);

    const held = source.filesOf(ref!)!;
    const index = JSON.parse(held.files["index.json"]!);
    index.imports.push({ uri: "somewhere-else.tsr" });

    const { warnings } = source.replaceFiles(ref!, {
        ...held.files,
        "index.json": JSON.stringify(index, null, 4),
    });

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /somewhere-else\.tsr/);
});
