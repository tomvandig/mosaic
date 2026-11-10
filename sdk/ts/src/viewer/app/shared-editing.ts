import type { ArchiveSource } from "../ArchiveSource.ts";
import { CORE_TYPE } from "../../core/schemas.ts";
import { EditSession, type EditTransport } from "../collab/EditSession.ts";
import type { EditorHandle } from "./editor.ts";
// @ts-expect-error -- the viewer is plain JavaScript, deliberately.
import { moveInPlace, reload, startEditing } from "./app.js";

/**
 * Moving parts in 3D, shared with whoever else is editing the same model.
 *
 * Every move is an edit in a shared session: applied here, and sent to the others, which
 * apply it too. Someone who joins later catches up from the others. Each participant's
 * moves go in a section of their own, named for them, and where two move the same part the
 * later move wins.
 *
 * Used by both pages that edit: the one `mosaic edit` serves, and the static viewer with
 * `?edit`, which is how the documentation shows two editors side by side. Where the edits
 * travel is the transport's business.
 */
export interface SharedEditingOptions {
    source: ArchiveSource;
    /** The archive an edit to this node is written into; nothing is written if none. */
    archiveFor: (nodeId: string) => string | undefined;
    transport: EditTransport;
    /** The Files drawer, refreshed when the archive changes under it. */
    editor: EditorHandle;
    say: (message: string, isError?: boolean) => void;
    /** This participant's name; a fresh `tab-xxxx` when left out. */
    me?: string;
}

export interface SharedEditing {
    me: string;
    /** How many edits were caught up on when joining. */
    caught: number;
    leave(): void;
}

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

export async function startSharedEditing(options: SharedEditingOptions): Promise<SharedEditing> {
    const { source, archiveFor, transport, editor, say } = options;
    const me = options.me ?? "tab-" + crypto.randomUUID().slice(0, 4);

    const drawerNote = (refreshed: boolean) => refreshed ? ""
        : " — the Files drawer has unsaved typing, so it was not refreshed: "
        + "Revert there before saving, or the drawer will put the old transform back";

    // Someone else's edit changes the archive, and the drawing has to be built again to
    // show it -- but not mid-drag, and only once for a burst, such as catching up.
    let dragging = () => false;
    let redrawPending = false;
    let redrawing: Promise<void> | undefined;
    const redraw = () => {
        if (dragging()) { redrawPending = true; return; }
        redrawPending = false;
        redrawing ??= Promise.resolve().then(() => reload()).finally(() => {
            redrawing = undefined;
            if (redrawPending) redraw();
        });
    };

    // A move is shown by moving what is drawn; anything else, or a move that cannot be
    // shown that way, draws the model again.
    const showInPlace = async (ops: Array<{ node: string; type: string; value: unknown }>) => {
        for (const op of ops) {
            const moved = op.type === CORE_TYPE.transform && !redrawPending && await moveInPlace(op.node, op.value) as boolean;
            if (!moved) return redraw();
        }
    };

    // --- how much has been edited, in the header ---------------------------------
    const stats = document.createElement("span");
    stats.className = "edit-stats";
    const status = document.getElementById("status");
    if (status) status.before(stats);
    else document.querySelector("header")?.append(stats);

    const size = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
    const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;
    const showStats = () => {
        const edits = shared.edits().length;
        const { sections, nodes, bytes } = source.editStats();
        stats.textContent = `${plural(edits, "edit")} · ${plural(sections, "section")} · ${size(bytes)}`;
        stats.title = `${plural(edits, "edit")} made in this session, by every editor in it. `
            + `They are written in ${plural(sections, "section")} of the archive, one per run of edits by one editor, `
            + `setting ${plural(nodes, "node")}: ${size(bytes)} on top of the original, `
            + `which is about what mosaic diff would keep.`;
    };

    const shared = new EditSession({
        author: me,
        transport,
        apply: (ops, edit, remote) => {
            for (const op of ops) {
                const url = archiveFor(op.node);
                if (url) source.setComponent(url, op.node, op.type, op.value, edit.author);
            }
            const refreshed = editor.refresh();
            showStats();
            if (remote) {
                void showInPlace(ops);
                say(`${edit.author}: ${edit.message ?? "edited"}` + drawerNote(refreshed));
            }
        },
    });
    const caught = await shared.join();
    showStats();
    window.addEventListener("pagehide", () => shared.leave());

    // A drag has already moved the drawing; this writes the same move into the archive,
    // so the Files drawer and saving see it, and shares it.
    ({ dragging } = await startEditing({
        onMoved: (nodeId: string, transform: { translation: number[]; rotation: number[]; scale: number[] }, label: string) => {
            shared.make([{ node: nodeId, type: CORE_TYPE.transform, value: transform }], `moved ${label}`)
                .then(() => say(`moved ${label}` + drawerNote(!editor.dirty())))
                .catch(error => say(`could not move ${label}: ${errorText(error)}`, true))
                // Whatever others did during the drag can be drawn now.
                .finally(() => { if (redrawPending) redraw(); });
        },
    }) as { dragging: () => boolean });

    return { me, caught, leave: () => shared.leave() };
}

/** The keys, for a status line. */
export const EDIT_KEYS = "W move · E rotate · R scale · ↑ parent · Esc or click empty space to deselect";
