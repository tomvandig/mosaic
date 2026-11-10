import test from "node:test";
import assert from "node:assert/strict";
import { BroadcastTransport } from "../src/viewer/collab/BroadcastTransport.ts";
import { EditSession, LocalTransport, type Edit, type EditOp, type EditTransport } from "../src/viewer/collab/EditSession.ts";

/** What a participant shows: the value applied last for each node's component. */
function participant(author: string, transport: EditTransport) {
    const showing = new Map<string, unknown>();
    const applied: Array<{ ops: EditOp[]; remote: boolean }> = [];
    const session = new EditSession({
        author,
        transport,
        apply: (ops, _edit, remote) => {
            applied.push({ ops, remote });
            for (const op of ops) showing.set(`${op.node} ${op.type}`, op.value);
        },
    });
    return { session, showing, applied };
}

const move = (node: string, x: number): EditOp => ({ node, type: "core::transform", value: { translation: [x, 0, 0] } });

const edit = (author: string, clock: number, ops: EditOp[]): Edit =>
    ({ id: `${author}-${clock}`, author, clock, time: "", ops });

test("an edit made here is applied here, not as a remote one", async () => {
    const a = participant("a", new LocalTransport());
    await a.session.join();
    await a.session.make([move("n", 1)]);
    assert.deepEqual(a.applied.map(one => one.remote), [false]);
    assert.deepEqual(a.showing.get("n core::transform"), { translation: [1, 0, 0] });
});

test("the latest edit wins, whatever order the edits arrive in", async () => {
    const forwards = participant("x", new LocalTransport());
    const backwards = participant("y", new LocalTransport());
    const edits = [edit("a", 1, [move("n", 1)]), edit("b", 2, [move("n", 2)]), edit("a", 3, [move("n", 3)])];

    for (const one of edits) forwards.session.receive(one);
    for (const one of [...edits].reverse()) backwards.session.receive(one);

    assert.deepEqual(forwards.showing.get("n core::transform"), { translation: [3, 0, 0] });
    assert.deepEqual(backwards.showing.get("n core::transform"), { translation: [3, 0, 0] });
    // Arriving backwards, the older edits lose and are never applied.
    assert.equal(backwards.applied.length, 1);
});

test("on the same clock the later author wins, so everyone agrees", async () => {
    const one = participant("x", new LocalTransport());
    const other = participant("y", new LocalTransport());
    const a = edit("a", 5, [move("n", 1)]), b = edit("b", 5, [move("n", 2)]);

    one.session.receive(a); one.session.receive(b);
    other.session.receive(b); other.session.receive(a);

    assert.deepEqual(one.showing.get("n core::transform"), other.showing.get("n core::transform"));
});

test("an edit that arrives twice is applied once", async () => {
    const one = participant("x", new LocalTransport());
    const twice = edit("a", 1, [move("n", 1)]);
    assert.equal(one.session.receive(twice), true);
    assert.equal(one.session.receive(twice), false);
    assert.equal(one.applied.length, 1);
});

test("an edit made after seeing another sorts after it", async () => {
    // "z" sorts after "a" on a tie, so only the clock can make a's edit win.
    const a = participant("a", new LocalTransport());
    a.session.receive(edit("z", 7, [move("n", 1)]));
    const made = await a.session.make([move("n", 2)]);
    assert.ok(made.clock > 7);
    assert.deepEqual(a.showing.get("n core::transform"), { translation: [2, 0, 0] });
});

test("only the ops that win are applied, per component", async () => {
    const one = participant("x", new LocalTransport());
    one.session.receive(edit("a", 5, [move("n", 5)]));
    one.session.receive(edit("b", 3, [move("n", 3), move("m", 3)]));
    assert.deepEqual(one.applied.at(-1)?.ops.map(op => op.node), ["m"]);
    assert.deepEqual(one.showing.get("n core::transform"), { translation: [5, 0, 0] });
});

// --- between tabs ----------------------------------------------------------------
// Node has BroadcastChannel too, and it behaves as a browser's does between tabs.

test("tabs on one channel see each other's edits", async t => {
    const channel = "test-" + crypto.randomUUID();
    const a = participant("a", new BroadcastTransport(channel, { wait: 50 }));
    const b = participant("b", new BroadcastTransport(channel, { wait: 50 }));
    t.after(() => { a.session.leave(); b.session.leave(); });
    await Promise.all([a.session.join(), b.session.join()]);

    await a.session.make([move("n", 4)]);
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.deepEqual(b.showing.get("n core::transform"), { translation: [4, 0, 0] });
    assert.deepEqual(b.applied.map(one => one.remote), [true]);
});

test("a tab that joins late catches up from the others", async t => {
    const channel = "test-" + crypto.randomUUID();
    const a = participant("a", new BroadcastTransport(channel, { wait: 50 }));
    const b = participant("b", new BroadcastTransport(channel, { wait: 50 }));
    t.after(() => { a.session.leave(); b.session.leave(); });

    await a.session.join();
    await b.session.join();
    await a.session.make([move("n", 1)]);
    await b.session.make([move("n", 2), move("m", 2)]);
    await new Promise(resolve => setTimeout(resolve, 50));

    const late = participant("c", new BroadcastTransport(channel, { wait: 100 }));
    t.after(() => late.session.leave());
    const caught = await late.session.join();

    assert.equal(caught, 2);
    assert.deepEqual(late.showing.get("n core::transform"), { translation: [2, 0, 0] });
    assert.deepEqual(late.showing.get("m core::transform"), { translation: [2, 0, 0] });
    assert.deepEqual(late.showing, a.showing);
    assert.deepEqual(late.showing, b.showing);
});
