/**
 * Several people editing one archive at once.
 *
 * Everyone starts from the same archive and exchanges *edits*: small, self-contained
 * changes, each setting components of nodes. Every participant keeps the whole log of
 * them, applies each edit as it arrives, and answers a newcomer with what it has seen --
 * which is how someone who joins late catches up.
 *
 * How edits travel is a separate thing, an `EditTransport`. Between tabs of one browser
 * that is a BroadcastChannel (see `BroadcastTransport`); through a server it would be the
 * tessera API, with each edit published as a version. Nothing here depends on which.
 *
 * Conflicts are settled by "latest wins": edits are ordered by a logical clock, ties broken
 * by author, and for each component of each node only the latest edit counts. Every
 * participant orders edits the same way, so they all end up showing the same thing however
 * the edits reached them -- late, twice, or out of order.
 */

/** One component set on one node. */
export interface EditOp {
    /** The Mosaic node id. */
    node: string;
    /** The component type, such as `core::transform`. */
    type: string;
    /** The component's new value, as its table row holds it. */
    value: unknown;
}

/**
 * One edit, as it travels.
 *
 * It holds what a Mosaic section holds -- who, when, why, and which components of which
 * nodes -- so it can be published as a section (or a version made of one) as it is.
 */
export interface Edit {
    /** Unique, so an edit that arrives twice is applied once. */
    id: string;
    /** Who made it: one id per participant. */
    author: string;
    /**
     * Its place in the order of edits. A Lamport clock: one more than the highest clock the
     * author had seen when making it, so an edit made after seeing another always sorts
     * after it. A transport with an order of its own, such as a server's version sequence,
     * may set this from that instead.
     */
    clock: number;
    /** When it was made, for showing; the order comes from `clock`. */
    time: string;
    /** What it did, in a few words, for showing: "moved Wheel". */
    message?: string;
    ops: EditOp[];
}

/**
 * How edits get from one participant to the others.
 *
 * A transport only carries edits: it does not apply them, order them or drop repeats --
 * the session does all of that -- so it may deliver an edit more than once, or one it
 * already delivered in the history, and it may deliver the sender's own edits back.
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
    join(receive: (edit: Edit) => void, known: () => Edit[]): Promise<Edit[]>;
    /** Sends one edit to everyone else. */
    send(edit: Edit): Promise<void>;
    /** Stops listening and answering. */
    leave(): void;
}

/** Whether `a` sorts after `b`: later clock, or the same clock and a later author. */
export function isLater(a: Pick<Edit, "clock" | "author">, b: Pick<Edit, "clock" | "author">): boolean {
    return a.clock !== b.clock ? a.clock > b.clock : a.author > b.author;
}

/** Sorts edits oldest first. */
export function byOrder(a: Edit, b: Edit): number {
    return isLater(a, b) ? 1 : isLater(b, a) ? -1 : 0;
}

export interface EditSessionOptions {
    transport: EditTransport;
    /** This participant's id; a fresh random one when left out. */
    author?: string;
    /**
     * Applies the ops of an edit that won: each one is newer than anything applied to that
     * component of that node before. Called for this participant's own edits too, with
     * `remote` false, so there is one way an edit gets into the archive.
     */
    apply: (ops: EditOp[], edit: Edit, remote: boolean) => void;
}

/** One participant's side of an editing session. */
export class EditSession {
    readonly author: string;

    private readonly transport: EditTransport;
    private readonly applyOps: EditSessionOptions["apply"];
    /** Every edit seen, by id. */
    private readonly log = new Map<string, Edit>();
    /** For each `node type` pair, the edit whose value is showing. */
    private readonly winners = new Map<string, Edit>();
    private clock = 0;

    constructor(options: EditSessionOptions) {
        this.transport = options.transport;
        this.applyOps = options.apply;
        this.author = options.author ?? crypto.randomUUID();
    }

    /**
     * Joins: listens for edits, and applies what was edited before this participant came,
     * oldest first. Resolves with how many edits that was.
     */
    async join(): Promise<number> {
        const history = await this.transport.join(edit => this.receive(edit), () => this.edits());
        const sorted = [...history].sort(byOrder);
        let caught = 0;
        for (const edit of sorted) if (this.receive(edit)) caught++;
        return caught;
    }

    /** Every edit seen so far, oldest first. */
    edits(): Edit[] {
        return [...this.log.values()].sort(byOrder);
    }

    /** Makes an edit here: applies it, and sends it to everyone else. */
    async make(ops: EditOp[], message?: string): Promise<Edit> {
        const edit: Edit = {
            id: crypto.randomUUID(),
            author: this.author,
            clock: ++this.clock,
            time: new Date().toISOString(),
            ...(message !== undefined ? { message } : {}),
            ops,
        };
        this.take(edit, false);
        await this.transport.send(edit);
        return edit;
    }

    /**
     * An edit from elsewhere. Applies whichever of its ops are the latest for their
     * component, and nothing if it was seen before. Returns whether it was new.
     */
    receive(edit: Edit): boolean {
        if (this.log.has(edit.id)) return false;
        this.clock = Math.max(this.clock, edit.clock);
        this.take(edit, edit.author !== this.author);
        return true;
    }

    leave(): void {
        this.transport.leave();
    }

    private take(edit: Edit, remote: boolean): void {
        this.log.set(edit.id, edit);
        const winning: EditOp[] = [];
        for (const op of edit.ops) {
            const key = `${op.node} ${op.type}`;
            const showing = this.winners.get(key);
            if (showing && !isLater(edit, showing)) continue;
            this.winners.set(key, edit);
            winning.push(op);
        }
        if (winning.length > 0) this.applyOps(winning, edit, remote);
    }
}

/**
 * A transport that goes nowhere: a session on its own, for when there is nobody to edit
 * with. Useful for tests, and as the default.
 */
export class LocalTransport implements EditTransport {
    async join(): Promise<Edit[]> { return []; }
    async send(): Promise<void> {}
    leave(): void {}
}
