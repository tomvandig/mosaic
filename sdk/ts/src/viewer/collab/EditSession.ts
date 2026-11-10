import { LoadMosaicFile, MosaicFile, WriteMosaicFile } from "../../MosaicFile.ts";
import { Type, type NodeElement } from "../../MosaicIndexFile.ts";

/**
 * Several people editing one archive at once.
 *
 * Everyone starts from the same archive and exchanges *edits*, and an edit is Mosaic all the
 * way through: a `.tsr` holding one section, with the rows it sets. It can be opened, diffed,
 * federated or published like any other archive -- which is what lets the same edits travel
 * through the tessera API later, each published as a version, as easily as between tabs now.
 *
 * Every participant keeps the whole log of edits, adds each one to its archive as it arrives,
 * and answers a newcomer with what it has seen, which is how someone who joins late catches
 * up. How edits travel is an `EditTransport`'s business; nothing here depends on which.
 *
 * Conflicts are settled by "latest wins", using Mosaic's own rule: a later section wins over
 * an earlier one. Edits are ordered by a logical clock, kept in the section header's
 * `dataVersion`, then by author, then by id; an archive keeps its edit sections in that
 * order however they arrived. So every participant ends up with the same sections in the
 * same order, and the same picture -- late, repeated or out-of-order arrivals included.
 */

/** The `application` an edit's section is written by. */
export const EDIT_APPLICATION = "mosaic edit";

/** One component set on one node. */
export interface EditOp {
    /** The Mosaic node id. */
    node: string;
    /** The component type, such as `core::transform`. */
    type: string;
    /** The component's new value, as its table row holds it. */
    value: unknown;
}

/** One edit: an archive of one section, and what its header says. */
export interface Edit {
    /** The section's id; unique, so an edit that arrives twice is added once. */
    id: string;
    /** Who made it: the section's author. */
    author: string;
    /**
     * Its place in the order of edits, kept in the section's `dataVersion`. A Lamport clock:
     * one more than the highest the author had seen when making it, so an edit made after
     * seeing another always sorts after it. A transport with an order of its own, such as a
     * server's version sequence, can stand in for it.
     */
    clock: number;
    time: string;
    message: string;
    /** The archive. */
    file: MosaicFile;
    /** The archive as it travels: the `.tsr` bytes. */
    bytes: Uint8Array;
}

/**
 * How edits get from one participant to the others. What it carries is `.tsr` bytes.
 *
 * A transport only carries edits: it does not read, order or deduplicate them -- the session
 * does -- so it may deliver one more than once, or deliver the sender's own back.
 */
export interface EditTransport {
    /**
     * Starts listening, and finds out what was edited before this participant joined.
     *
     * From the moment this is called, every edit anyone sends is handed to `receive`. It
     * resolves with the edits made before joining, as far as it can find them. `known`
     * gives the edits this participant holds, for transports where participants answer
     * each other's catching up rather than a server doing it.
     */
    join(receive: (tsr: Uint8Array) => void, known: () => Uint8Array[]): Promise<Uint8Array[]>;
    /** Sends one edit to everyone else. */
    send(tsr: Uint8Array): Promise<void>;
    /** Stops listening and answering. */
    leave(): void;
}

type Ordered = Pick<Edit, "clock" | "author" | "id">;

/** Sorts edits oldest first: by clock, then author, then id. */
export function byOrder(a: Ordered, b: Ordered): number {
    if (a.clock !== b.clock) return a.clock - b.clock;
    if (a.author !== b.author) return a.author < b.author ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** What an edit section's header says about its place in the order, if it is one. */
export function orderOf(header: { application: string; author: string; dataVersion: string; id: string }): Ordered | undefined {
    if (header.application !== EDIT_APPLICATION || !/^\d+$/.test(header.dataVersion)) return undefined;
    return { clock: Number(header.dataVersion), author: header.author, id: header.id };
}

/** What an archive builder needs to know about the archive being edited. */
export interface EditContext {
    /**
     * The reference id the node already gives this component, so the edit replaces it
     * rather than sitting beside it.
     */
    referenceOf(node: string, type: string): string;
    /** The schema of a component type, for the edit's table; the node says which archive. */
    schemaOf(node: string, type: string): unknown;
}

/** Writes an edit as an archive: one section, its header, and one row per op. */
export function editFile(
    about: { id: string; author: string; clock: number; time: string; message: string },
    ops: EditOp[],
    context: EditContext,
): MosaicFile {
    const file = new MosaicFile();
    const nodes = new Map<string, NodeElement>();

    for (const op of ops) {
        if (!file.serializedComponents.has(op.type)) {
            file.serializedComponents.set(op.type, []);
            file.index.componentTables.push({ filename: `${op.type}.ndjson`, type: Type.Ndjson, schema: context.schemaOf(op.node, op.type) });
        }
        const rows = file.serializedComponents.get(op.type)!;
        const index = rows.push(JSON.stringify(op.value)) - 1;

        let node = nodes.get(op.node);
        if (!node) {
            node = { id: op.node, components: [] };
            nodes.set(op.node, node);
        }
        node.components!.push({ type: op.type, id: context.referenceOf(op.node, op.type), index });
    }

    file.AddSection({
        header: {
            id: about.id,
            application: EDIT_APPLICATION,
            author: about.author,
            dataVersion: String(about.clock),
            timestamp: about.time,
            message: about.message,
        },
        nodes: [...nodes.values()],
    });
    return file;
}

/** Reads an edit from its bytes; throws if it is not an archive of one edit section. */
export async function readEdit(bytes: Uint8Array): Promise<Edit> {
    const file = await LoadMosaicFile(bytes);
    const [section, ...more] = file.index.sections;
    if (!section || more.length > 0) throw new Error("an edit is an archive of exactly one section");
    const order = orderOf(section.header);
    if (!order) throw new Error(`not an edit: written by "${section.header.application}" without a clock`);
    return { ...order, time: section.header.timestamp, message: section.header.message, file, bytes };
}

/** The ops an edit carries, read back out of its section. */
export function opsOf(edit: Edit): EditOp[] {
    const ops: EditOp[] = [];
    for (const node of edit.file.index.sections[0]?.nodes ?? []) {
        for (const ref of node.components ?? []) {
            const row = ref.index === undefined ? undefined : edit.file.serializedComponents.get(ref.type)?.[ref.index];
            if (row !== undefined) ops.push({ node: node.id, type: ref.type, value: JSON.parse(row) });
        }
    }
    return ops;
}

export interface EditSessionOptions {
    transport: EditTransport;
    /** This participant's id, which is the author of its edits; a fresh one when left out. */
    author?: string;
    /** What building an edit needs to know about the archive. */
    context: EditContext;
    /**
     * Adds an edit to the archive -- in its place in the order, not simply at the end.
     * Called once per edit, for this participant's own edits too, with `remote` false, so
     * there is one way an edit gets into the archive.
     */
    apply: (edit: Edit, remote: boolean) => void;
}

/** One participant's side of an editing session. */
export class EditSession {
    readonly author: string;

    private readonly transport: EditTransport;
    private readonly context: EditContext;
    private readonly applyEdit: EditSessionOptions["apply"];
    /** Every edit seen, by id. */
    private readonly log = new Map<string, Edit>();
    private clock = 0;
    /** Edits are read one at a time, in the order they came, since reading is async. */
    private queue: Promise<unknown> = Promise.resolve();

    constructor(options: EditSessionOptions) {
        this.transport = options.transport;
        this.context = options.context;
        this.applyEdit = options.apply;
        this.author = options.author ?? crypto.randomUUID();
    }

    /**
     * Joins: listens for edits, and adds what was edited before this participant came.
     * Resolves with how many edits that was.
     */
    async join(): Promise<number> {
        const history = await this.transport.join(
            bytes => void this.receive(bytes).catch(() => {}),
            () => this.edits().map(edit => edit.bytes),
        );
        let caught = 0;
        for (const bytes of history) {
            try { if (await this.receive(bytes)) caught++; } catch { /* not an edit; skipped */ }
        }
        return caught;
    }

    /** Every edit seen so far, oldest first. */
    edits(): Edit[] {
        return [...this.log.values()].sort(byOrder);
    }

    /** Makes an edit here: writes it as an archive, adds it, and sends it to everyone else. */
    async make(ops: EditOp[], message = ""): Promise<Edit> {
        const about = {
            id: crypto.randomUUID(),
            author: this.author,
            clock: ++this.clock,
            time: new Date().toISOString(),
            message,
        };
        const file = editFile(about, ops, this.context);
        const edit: Edit = { ...about, file, bytes: await WriteMosaicFile(file) };
        await this.serially(async () => this.take(edit, false));
        await this.transport.send(edit.bytes);
        return edit;
    }

    /** An edit from elsewhere, as bytes. Adds it, unless it was seen before; says which. */
    receive(bytes: Uint8Array): Promise<boolean> {
        return this.serially(async () => {
            const edit = await readEdit(bytes);
            if (this.log.has(edit.id)) return false;
            this.clock = Math.max(this.clock, edit.clock);
            this.take(edit, edit.author !== this.author);
            return true;
        });
    }

    leave(): void {
        this.transport.leave();
    }

    private serially<T>(work: () => Promise<T>): Promise<T> {
        const next = this.queue.then(work);
        this.queue = next.catch(() => {});
        return next;
    }

    private take(edit: Edit, remote: boolean): void {
        this.log.set(edit.id, edit);
        this.applyEdit(edit, remote);
    }
}

/** A transport that goes nowhere: a session on its own. Useful for tests. */
export class LocalTransport implements EditTransport {
    async join(): Promise<Uint8Array[]> { return []; }
    async send(): Promise<void> {}
    leave(): void {}
}
