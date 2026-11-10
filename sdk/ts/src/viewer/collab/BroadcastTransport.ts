import type { Edit, EditTransport } from "./EditSession.ts";

/**
 * Edits passed between the tabs of one browser, with no server in between.
 *
 * Every tab open on the same channel name, on the same origin, hears what the others
 * send; a tab does not hear itself. There is nobody keeping the history, so the tabs keep
 * it between them: a tab that joins asks "hello", every tab that has edits answers with
 * all of them, and the newcomer takes whatever arrives within a short wait. Answers that
 * come later are not lost -- they are handed over like any other edit, and the session
 * drops what it already has.
 */

type Message =
    | { kind: "edit"; edit: Edit }
    | { kind: "hello"; from: string }
    | { kind: "history"; to: string; edits: Edit[] };

function isEdit(value: unknown): value is Edit {
    const edit = value as Partial<Edit> | null;
    return typeof edit === "object" && edit !== null
        && typeof edit.id === "string" && typeof edit.author === "string"
        && typeof edit.clock === "number" && Array.isArray(edit.ops);
}

export interface BroadcastTransportOptions {
    /** How long a joining tab waits for others to answer, in milliseconds. */
    wait?: number;
}

export class BroadcastTransport implements EditTransport {
    private channel: InstanceType<typeof BroadcastChannel> | undefined;
    private readonly me = crypto.randomUUID();
    private readonly wait: number;

    /** `name` picks the channel: tabs editing the same thing should use the same one. */
    constructor(private readonly name: string, options: BroadcastTransportOptions = {}) {
        this.wait = options.wait ?? 300;
    }

    join(receive: (edit: Edit) => void, known: () => Edit[]): Promise<Edit[]> {
        if (this.channel) throw new Error("already joined");
        const channel = new BroadcastChannel(this.name);
        this.channel = channel;

        let collecting: Map<string, Edit> | undefined = new Map();

        channel.onmessage = (event: { data: unknown }) => {
            const message = event.data as Message;
            if (typeof message !== "object" || message === null) return;

            if (message.kind === "edit" && isEdit(message.edit)) {
                receive(message.edit);
            } else if (message.kind === "hello" && typeof message.from === "string") {
                const edits = known();
                if (edits.length > 0) channel.postMessage({ kind: "history", to: message.from, edits } satisfies Message);
            } else if (message.kind === "history" && message.to === this.me && Array.isArray(message.edits)) {
                for (const edit of message.edits) {
                    if (!isEdit(edit)) continue;
                    if (collecting) collecting.set(edit.id, edit);
                    else receive(edit);
                }
            }
        };

        channel.postMessage({ kind: "hello", from: this.me } satisfies Message);

        return new Promise(resolve => setTimeout(() => {
            const history = [...(collecting ?? new Map<string, Edit>()).values()];
            collecting = undefined;
            resolve(history);
        }, this.wait));
    }

    async send(edit: Edit): Promise<void> {
        if (!this.channel) throw new Error("not joined");
        this.channel.postMessage({ kind: "edit", edit } satisfies Message);
    }

    leave(): void {
        this.channel?.close();
        this.channel = undefined;
    }
}
