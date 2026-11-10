import type { EditTransport } from "./EditSession.ts";

/**
 * Edits passed between the tabs of one browser -- or the frames of one page -- with no
 * server in between. What travels is each edit's `.tsr` bytes.
 *
 * Every tab open on the same channel name, on the same origin, hears what the others
 * send; a tab does not hear itself. There is nobody keeping the history, so the tabs keep
 * it between them: a tab that joins asks "hello", every tab that has edits answers with
 * all of them, and the newcomer takes whatever arrives within a short wait. Answers that
 * come later are not lost -- they are handed over like any other edit, and the session
 * drops what it already has.
 */

type Message =
    | { kind: "edit"; tsr: Uint8Array }
    | { kind: "hello"; from: string }
    | { kind: "history"; to: string; edits: Uint8Array[] };

const isBytes = (value: unknown): value is Uint8Array => value instanceof Uint8Array;

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

    join(receive: (tsr: Uint8Array) => void, known: () => Uint8Array[]): Promise<Uint8Array[]> {
        if (this.channel) throw new Error("already joined");
        const channel = new BroadcastChannel(this.name);
        this.channel = channel;

        let collecting: Uint8Array[] | undefined = [];

        channel.onmessage = (event: { data: unknown }) => {
            const message = event.data as Message;
            if (typeof message !== "object" || message === null) return;

            if (message.kind === "edit" && isBytes(message.tsr)) {
                receive(message.tsr);
            } else if (message.kind === "hello" && typeof message.from === "string") {
                const edits = known();
                if (edits.length > 0) channel.postMessage({ kind: "history", to: message.from, edits } satisfies Message);
            } else if (message.kind === "history" && message.to === this.me && Array.isArray(message.edits)) {
                for (const tsr of message.edits) {
                    if (!isBytes(tsr)) continue;
                    if (collecting) collecting.push(tsr);
                    else receive(tsr);
                }
            }
        };

        channel.postMessage({ kind: "hello", from: this.me } satisfies Message);

        return new Promise(resolve => setTimeout(() => {
            const history = collecting ?? [];
            collecting = undefined;
            resolve(history);
        }, this.wait));
    }

    async send(tsr: Uint8Array): Promise<void> {
        if (!this.channel) throw new Error("not joined");
        this.channel.postMessage({ kind: "edit", tsr } satisfies Message);
    }

    leave(): void {
        this.channel?.close();
        this.channel = undefined;
    }
}
