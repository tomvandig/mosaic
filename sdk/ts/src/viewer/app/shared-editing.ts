import type { ArchiveSource } from "../ArchiveSource.ts";
import { CORE_TYPE } from "../../core/schemas.ts";
import { EditSession, byOrder, opsOf, orderOf, type Edit, type EditOp, type EditTransport } from "../collab/EditSession.ts";
import type { EditorHandle } from "./editor.ts";
// @ts-expect-error -- the viewer is plain JavaScript, deliberately.
import { deleteInPlace, moveInPlace, reload, startEditing } from "./app.js";

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
    /** Told of each edit made here, once it is made: the edit, and the name of the part moved. */
    onMade?: (edit: Edit, label: string) => void;
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
    const showInPlace = async (moves: Array<{ node: string; type: string; value: unknown }>) => {
        for (const move of moves) {
            const moved = move.type === CORE_TYPE.transform && !redrawPending && await moveInPlace(move.node, move.value) as boolean;
            if (!moved) return redraw();
        }
    };

    // A delete that leaves a node with nothing -- as deleting a part does -- is shown by
    // hiding that node where it is drawn, along with the links to it. Anything else taken
    // away, such as one component of a node that keeps others, draws the model again.
    // As with a move, it is what the archive now says that is shown, not what the edit said.
    const showDeletes = async (url: string, ops: EditOp[]) => {
        const emptied = new Set([...new Set(ops.filter(op => op.delete).map(op => op.node))]
            .filter(node => source.componentsOf(url, node).length === 0));
        const shownInPlace = ops.every(op => !op.delete || emptied.has(op.node)
            || (op.type === CORE_TYPE.child && op.ref !== undefined && emptied.has(op.ref)));
        if (!shownInPlace || redrawPending) return redraw();
        for (const node of emptied) {
            if (!await deleteInPlace(node)) return redraw();
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
    // The size counted is cumulative: every edit's .tsr, as it travels between editors,
    // added up. The archive holds every edit too, as a section each, but there they share
    // the archive's tables and index rather than each carrying its own.
    const showStats = () => {
        const all = shared.edits();
        const sent = all.reduce((sum, edit) => sum + edit.bytes.byteLength, 0);
        const { sections, nodes, bytes: kept } = source.editStats();
        stats.textContent = `${plural(all.length, "edit")} · ${size(sent)}`;
        stats.title = `${plural(all.length, "edit")} made in this session, by every editor in it, `
            + `each a .tsr of one section: ${size(sent)} sent in all. `
            + `The archive holds them as ${plural(sections, "edit section")} touching ${plural(nodes, "node")}, `
            + `${size(kept)} on top of the original.`;
    };

    /** The archive an edit to these nodes goes in: the one the first of them belongs in. */
    const archiveOfNode = (node: string) => {
        const url = archiveFor(node);
        if (!url) throw new Error(`no archive holds ${node}`);
        return url;
    };

    const shared = new EditSession({
        author: me,
        transport,
        context: {
            referenceOf: (node, type) => source.referenceOf(archiveOfNode(node), node, type),
            schemaOf: (node, type) => source.schemaOf(archiveOfNode(node), type),
        },
        apply: (edit, remote) => {
            const ops = opsOf(edit);
            const url = ops[0] && archiveFor(ops[0].node);
            if (!url) return;
            source.addEdit(url, edit.file, orderOf, byOrder);
            const refreshed = editor.refresh();
            showStats();

            // A delete is shown by taking away what is drawn -- here too, where nothing has
            // changed on screen yet.
            if (ops.some(op => op.delete)) {
                void showDeletes(url, ops);
                if (remote) say(`${edit.author}: ${edit.message || "deleted"}` + drawerNote(refreshed));
                return;
            }

            // What shows is whatever the newest edit says, which is not always this one: an
            // edit that arrives late goes in before the newer ones and changes nothing, and
            // one made here can lose to another made at the same moment. So the drawing is
            // put where the archive now says, not where the edit said.
            const now = ops.map(op => ({ ...op, value: source.valueOf(url, op.node, op.type) }));
            const changed = remote ? now
                : now.filter((op, i) => JSON.stringify(op.value) !== JSON.stringify(ops[i]!.value));
            if (changed.length > 0) void showInPlace(changed);
            if (remote) say(`${edit.author}: ${edit.message || "edited"}` + drawerNote(refreshed));
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
                .then(edit => {
                    say(`moved ${label}` + drawerNote(!editor.dirty()));
                    options.onMade?.(edit, label);
                })
                .catch(error => say(`could not move ${label}: ${errorText(error)}`, true))
                // Whatever others did during the drag can be drawn now.
                .finally(() => { if (redrawPending) redraw(); });
        },
        // Deleting a part takes away every component it has -- so it draws nothing, root or
        // not -- and the link its parent has to it, if it has one. Its children are left as
        // they are: only its links to them go, and they may be placed elsewhere too. All of
        // it is DELETEs layered on top; the original rows stay in the archive beneath.
        onDeleted: (parentId: string | null, nodeId: string, label: string) => {
            let ops: EditOp[];
            try {
                ops = [
                    ...(parentId === null ? [] : [{ node: parentId, type: CORE_TYPE.child, value: undefined, ref: nodeId, delete: true as const }]),
                    ...source.componentsOf(archiveOfNode(nodeId), nodeId)
                        .map(component => ({ node: nodeId, type: component.type, value: undefined, ref: component.id, delete: true as const })),
                ];
            } catch (error) {
                say(`could not delete ${label}: ${errorText(error)}`, true);
                return;
            }
            if (ops.length === 0) return say(`${label} has nothing left to delete`, true);
            shared.make(ops, `deleted ${label}`)
                .then(edit => {
                    say(`deleted ${label}` + drawerNote(!editor.dirty()));
                    options.onMade?.(edit, label);
                })
                .catch(error => say(`could not delete ${label}: ${errorText(error)}`, true));
        },
    }) as { dragging: () => boolean });

    return { me, caught, leave: () => shared.leave() };
}

/** The keys, for a status line. */
export const EDIT_KEYS = "W move · E rotate · R scale · ↑ parent · Del delete · Esc or click empty space to deselect";
