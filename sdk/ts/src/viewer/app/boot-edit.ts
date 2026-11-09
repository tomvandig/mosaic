import { ArchiveSource } from "../ArchiveSource.ts";
import { mountEditor } from "./editor.ts";
// @ts-expect-error -- the viewer is plain JavaScript, deliberately: it is the same file
// the other builds run, and nothing in it needs types to be correct.
import { reload, start, startEditing } from "./app.js";

/**
 * The viewer as an editor for one model, served by `mosaic edit`.
 *
 * The server holds one archive -- the model it was given, converted if it was a glTF --
 * and this page reads it, draws it, and opens the Files drawer on it. Saving in the
 * drawer changes the archive here and draws it again, as everywhere else. The two
 * buttons this adds ask where to save, then have the server build the archive as it now
 * stands -- as a .tsr, or composed into a .glb -- and write the result there.
 */

interface Session {
    /** The model's name, for the tree and the title. */
    name: string;
    /** The file name Save .tsr suggests. */
    tsr: string;
    /** The file name Export .glb suggests. */
    glb: string;
}

const say = (message: string, isError = false) => {
    const status = document.getElementById("status");
    if (!status) return;
    status.textContent = message;
    status.dataset["error"] = String(isError);
};

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

async function main(): Promise<void> {
    const session = await (await fetch("/edit/session")).json() as Session;
    document.title = `${session.name} — Mosaic edit`;

    say(`reading ${session.name}…`);
    const response = await fetch("/edit/archive.tsr");
    if (!response.ok) throw new Error(`${response.status} reading the archive`);
    const bytes = new Uint8Array(await response.arrayBuffer());

    const source = new ArchiveSource();
    const tessera = await source.add(session.name + ".tsr", bytes);
    await start(source);

    // Show it straight away: the row carries the tessera id as its title.
    const tick = [...document.querySelectorAll<HTMLInputElement>(".tessera input[type=checkbox]")]
        .find(box => box.closest<HTMLElement>(".tessera")?.title === tessera.id);
    if (tick && !tick.checked) tick.click();

    const editor = await mountEditor({
        source,
        onSaved: () => reload(),
        say,
        open: true,
    });

    // --- writing it back to disk ---------------------------------------------
    const url = source.archives()[0]?.url;

    // --- moving parts in 3D ----------------------------------------------------
    // A drag has already moved the drawing; this writes the same move into the archive,
    // so the Files drawer, Save .tsr and Export .glb all see it.
    await startEditing({
        onMoved: (nodeId: string, transform: { translation: number[]; rotation: number[]; scale: number[] }, label: string) => {
            if (!url) return;
            try {
                source.setTransform(url, nodeId, transform);
                const refreshed = editor.refresh();
                say(`moved ${label}` + (refreshed ? "" : " — the Files drawer has unsaved typing, so it was not refreshed: "
                    + "Revert there before saving, or the drawer will put the old transform back"));
            } catch (error) {
                say(`could not move ${label}: ${errorText(error)}`, true);
            }
        },
    });

    /** What each button saves, and how the save dialog describes it. */
    const KINDS = {
        tsr: { name: session.tsr, description: "Mosaic archive", mime: "application/zip", extension: ".tsr" },
        glb: { name: session.glb, description: "glTF binary", mime: "model/gltf-binary", extension: ".glb" },
    } as const;

    /**
     * Asks where to save, then has the server build the file and writes it there.
     *
     * Where the browser has a real save dialog (Chrome, Edge) it is used, and it has to be
     * opened first, straight from the click: a browser only allows it while the click is
     * fresh, and building a large model takes long enough to lose that. Elsewhere the file
     * is handed over as a download, which the browser saves the way it saves downloads.
     */
    const save = async (format: "tsr" | "glb", button: HTMLButtonElement) => {
        if (!url) return;
        if (editor.dirty()) {
            say("there are edits in the Files drawer that are not saved into the archive yet: "
                + "press Save there first", true);
            return;
        }
        const kind = KINDS[format];

        type Picker = (options: unknown) => Promise<{ name: string; createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>;
        const picker = (window as unknown as { showSaveFilePicker?: Picker }).showSaveFilePicker;

        let target: Awaited<ReturnType<Picker>> | undefined;
        if (picker) {
            try {
                target = await picker({
                    suggestedName: kind.name,
                    types: [{ description: kind.description, accept: { [kind.mime]: [kind.extension] } }],
                });
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") return say("not saved");
                throw error;
            }
        }

        const files = source.filesOf(url)?.files;
        if (!files) return;

        button.disabled = true;
        say(format === "tsr" ? "packing the archive…" : "composing…");
        try {
            const reply = await fetch(`/edit/build?format=${format}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ files }),
            });
            if (!reply.ok) {
                const answer = await reply.json().catch(() => ({})) as { error?: string };
                throw new Error(answer.error ?? `${reply.status}`);
            }
            const blob = await reply.blob();
            const size = `${(blob.size / 1048576).toFixed(1)} MB`;

            if (target) {
                const writable = await target.createWritable();
                await writable.write(blob);
                await writable.close();
                say(`saved ${target.name} (${size})`);
            } else {
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = kind.name;
                document.body.append(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
                say(`downloaded ${kind.name} (${size})`);
            }

            const warnings = Number(reply.headers.get("x-mosaic-warnings") ?? 0);
            if (warnings > 0) say(`saved, with ${warnings} composing warning${warnings === 1 ? "" : "s"}: see the terminal`, true);
        } catch (error) {
            say(`could not save: ${errorText(error)}`, true);
        } finally {
            button.disabled = false;
        }
    };

    const button = (label: string, title: string, format: "tsr" | "glb") => {
        const made = document.createElement("button");
        made.textContent = label;
        made.title = title;
        made.onclick = () => void save(format, made).catch(error => say(`could not save: ${errorText(error)}`, true));
        return made;
    };

    const status = document.getElementById("status");
    const header = document.querySelector("header");
    for (const made of [
        button("Save .tsr", "Save the archive, with your edits, as a .tsr: asks where", "tsr"),
        button("Export .glb", "Compose the archive, with your edits, into a .glb: asks where", "glb"),
    ]) {
        if (status) status.before(made);
        else header?.append(made);
    }

    say(`editing ${session.name}: click a part to move it (W move · E rotate · R scale · ↑ parent · Esc deselect), `
        + `or change the files below`);
}

main().catch(error => say(errorText(error), true));
