import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { LoadMosaicFile } from "../src/MosaicFile.ts";
import { CORE_SCHEMAS } from "../src/core/schemas.ts";
import { ArchiveSource, versionFrom, type LoadedTessera } from "../src/viewer/ArchiveSource.ts";
import { loadArchive, type Fetcher } from "../src/viewer/FetchArchives.ts";
import { BroadcastTransport } from "../src/viewer/collab/BroadcastTransport.ts";
import {
    EDIT_APPLICATION, EditSession, LocalTransport, byOrder, editFile, opsOf, orderOf, readEdit,
    type Edit, type EditContext, type EditOp, type EditTransport,
} from "../src/viewer/collab/EditSession.ts";
import { WriteMosaicFile } from "../src/MosaicFile.ts";
import { DATA_DIR } from "./fixtures.ts";

const NODE = "70000000-7000-4000-8000-700000000003";
const move = (node: string, x: number): EditOp => ({ node, type: "core::transform", value: { translation: [x, 0, 0] } });

const context: EditContext = {
    referenceOf: () => "transform",
    schemaOf: (_node, type) => (CORE_SCHEMAS as Record<string, unknown>)[type],
};

/** An edit as another participant would have sent it. */
async function sent(author: string, clock: number, ops: EditOp[], id = `${author}-${clock}`): Promise<Uint8Array> {
    return WriteMosaicFile(editFile({ id, author, clock, time: "2026-11-10T00:00:00Z", message: "" }, ops, context));
}

/** A participant that just records what it is given. */
function participant(author: string, transport: EditTransport) {
    const applied: Array<{ edit: Edit; remote: boolean }> = [];
    const session = new EditSession({ author, transport, context, apply: (edit, remote) => applied.push({ edit, remote }) });
    return { session, applied };
}

// --- an edit is an archive -------------------------------------------------------

test("an edit travels as a .tsr of one section, and reads back as it was made", async () => {
    const one = participant("tab-a", new LocalTransport());
    await one.session.join();
    const made = await one.session.make([move(NODE, 4)], "moved a box");

    // A real archive: anything that reads .tsr files can read it.
    const file = await LoadMosaicFile(made.bytes);
    assert.equal(file.index.sections.length, 1);
    const header = file.index.sections[0]!.header;
    assert.equal(header.application, EDIT_APPLICATION);
    assert.equal(header.author, "tab-a");
    assert.equal(header.dataVersion, "1", "the clock");
    assert.equal(header.message, "moved a box");
    assert.deepEqual(file.index.componentTables.map(table => table.filename), ["core::transform.ndjson"]);

    const read = await readEdit(made.bytes);
    assert.equal(read.id, made.id);
    assert.deepEqual(opsOf(read), [move(NODE, 4)]);
    assert.deepEqual(one.applied.map(one => one.remote), [false]);
});

test("an edit that arrives twice is applied once", async () => {
    const one = participant("x", new LocalTransport());
    const bytes = await sent("a", 1, [move(NODE, 1)]);
    assert.equal(await one.session.receive(bytes), true);
    assert.equal(await one.session.receive(bytes), false);
    assert.equal(one.applied.length, 1);
});

test("an edit made after seeing another gets a later clock", async () => {
    const one = participant("a", new LocalTransport());
    await one.session.receive(await sent("z", 7, [move(NODE, 1)]));
    const made = await one.session.make([move(NODE, 2)]);
    assert.ok(made.clock > 7);
});

test("edits are ordered by clock, then author, then id", () => {
    const sorted = [
        { clock: 2, author: "a", id: "1" }, { clock: 1, author: "b", id: "2" },
        { clock: 1, author: "a", id: "3" }, { clock: 1, author: "a", id: "0" },
    ].sort(byOrder);
    assert.deepEqual(sorted.map(one => one.id), ["0", "3", "2", "1"]);
});

// --- into an archive -----------------------------------------------------------------

const serve: Fetcher = async url => new Uint8Array(fs.readFileSync(url));
const DIR = DATA_DIR.split(path.sep).join("/");

async function boxes(): Promise<{ source: ArchiveSource; url: string }> {
    const graph = new Map();
    const { top } = await loadArchive(DIR, "typed-boxes.tsr", serve, [], graph);
    const loaded: LoadedTessera[] = [{ id: "t", name: "typed-boxes", versions: [versionFrom(graph, top, { versionId: "v" })] }];
    return { source: new ArchiveSource(loaded), url: top };
}

test("the newest edit shows, whatever order the edits arrive in, and the archives come out the same", async () => {
    const edits = [
        await readEdit(await sent("a", 1, [move(NODE, 1)])),
        await readEdit(await sent("b", 2, [move(NODE, 2)])),
        await readEdit(await sent("a", 3, [move(NODE, 3)])),
    ];

    const forwards = await boxes();
    const backwards = await boxes();
    for (const edit of edits) forwards.source.addEdit(forwards.url, edit.file, orderOf, byOrder);
    for (const edit of [...edits].reverse()) backwards.source.addEdit(backwards.url, edit.file, orderOf, byOrder);

    assert.deepEqual(forwards.source.valueOf(forwards.url, NODE, "core::transform"), { translation: [3, 0, 0] });
    assert.deepEqual(backwards.source.valueOf(backwards.url, NODE, "core::transform"), { translation: [3, 0, 0] });

    // The same sections in the same order: each edit is a section of its own, sorted.
    const sections = (one: { source: ArchiveSource; url: string }) =>
        JSON.parse(one.source.filesOf(one.url)!.files["index.json"]!).sections
            .filter((section: { header: { application: string } }) => section.header.application === EDIT_APPLICATION)
            .map((section: { header: { id: string } }) => section.header.id);
    assert.deepEqual(sections(forwards), ["a-1", "b-2", "a-3"]);
    assert.deepEqual(sections(backwards), ["a-1", "b-2", "a-3"]);
});

test("an edit already in the archive is not added again", async () => {
    const { source, url } = await boxes();
    const edit = await readEdit(await sent("a", 1, [move(NODE, 1)]));
    assert.equal(source.addEdit(url, edit.file, orderOf, byOrder), true);
    assert.equal(source.addEdit(url, edit.file, orderOf, byOrder), false);
});

test("an edit replaces the component the node already has rather than adding one beside it", async () => {
    const { source, url } = await boxes();
    const reference = source.referenceOf(url, NODE, "core::transform");
    const edit = editFile({ id: "e", author: "a", clock: 1, time: "", message: "" }, [move(NODE, 5)], {
        referenceOf: (node, type) => source.referenceOf(url, node, type),
        schemaOf: (_node, type) => source.schemaOf(url, type),
    });
    assert.equal(edit.index.sections[0]!.nodes[0]!.components![0]!.id, reference);
    source.addEdit(url, edit, orderOf, byOrder);
    assert.deepEqual(source.valueOf(url, NODE, "core::transform"), { translation: [5, 0, 0] });
});

// --- between tabs ----------------------------------------------------------------
// Node has BroadcastChannel too, and it behaves as a browser's does between tabs.

test("tabs on one channel see each other's edits", async t => {
    const channel = "test-" + crypto.randomUUID();
    const a = participant("a", new BroadcastTransport(channel, { wait: 50 }));
    const b = participant("b", new BroadcastTransport(channel, { wait: 50 }));
    t.after(() => { a.session.leave(); b.session.leave(); });
    await Promise.all([a.session.join(), b.session.join()]);

    await a.session.make([move(NODE, 4)]);
    await new Promise(resolve => setTimeout(resolve, 100));

    assert.equal(b.applied.length, 1);
    assert.equal(b.applied[0]!.remote, true);
    assert.deepEqual(opsOf(b.applied[0]!.edit), [move(NODE, 4)]);
});

test("a tab that joins late catches up from the others", async t => {
    const channel = "test-" + crypto.randomUUID();
    const a = participant("a", new BroadcastTransport(channel, { wait: 50 }));
    const b = participant("b", new BroadcastTransport(channel, { wait: 50 }));
    t.after(() => { a.session.leave(); b.session.leave(); });

    await a.session.join();
    await b.session.join();
    await a.session.make([move(NODE, 1)]);
    await b.session.make([move(NODE, 2)]);
    await new Promise(resolve => setTimeout(resolve, 100));

    const late = participant("c", new BroadcastTransport(channel, { wait: 150 }));
    t.after(() => late.session.leave());
    const caught = await late.session.join();

    assert.equal(caught, 2);
    assert.deepEqual(late.session.edits().map(edit => edit.id), a.session.edits().map(edit => edit.id));
    assert.deepEqual(late.session.edits().map(edit => edit.id), b.session.edits().map(edit => edit.id));
});
