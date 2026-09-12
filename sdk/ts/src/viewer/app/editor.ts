import type { ArchiveSource } from "../ArchiveSource.ts";
import type { TesseraSummary, VersionRef } from "../MosaicSource.ts";

/**
 * The inside of an archive, open in an editor.
 *
 * A .tsr is a zip of text: an index naming the nodes and their components, and one
 * newline-delimited table per component type holding the values. The viewer draws what
 * that text means; this shows the text itself, and lets it be changed.
 *
 * Saving does not write a file -- there is nothing to write to, and nothing here has a
 * network. It replaces the archive the page is holding and draws the scene again, so the
 * loop is edit, save, look, which is the loop the format is for. A reload of the page
 * brings back what was published.
 *
 * The panel is closed until it is asked for, and Monaco is fetched at that moment rather
 * than on load: someone who came to look at a building should not wait for an editor.
 */

const MONACO = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min";

/** Monaco's global, once its loader has run. */
declare const monaco: any;
declare const require: any;

let loading: Promise<void> | undefined;

/** Fetches Monaco once, however many times it is asked for. */
function monacoReady(): Promise<void> {
    loading ??= new Promise<void>((resolve, reject) => {
        // Monaco's workers are fetched from the same place it is, which a cross-origin
        // script cannot do directly; a blob that imports it is the way round that.
        (globalThis as any).MonacoEnvironment = {
            getWorkerUrl: () => URL.createObjectURL(new Blob([
                "self.MonacoEnvironment = { baseUrl: '" + MONACO + "/' };\n"
                + "importScripts('" + MONACO + "/vs/base/worker/workerMain.js');",
            ], { type: "text/javascript" })),
        };

        const script = document.createElement("script");
        script.src = MONACO + "/vs/loader.js";
        script.onload = () => {
            require.config({ paths: { vs: MONACO + "/vs" } });
            require(["vs/editor/editor.main"], () => resolve(), reject);
        };
        script.onerror = () => reject(new Error("could not load the editor"));
        document.head.append(script);
    });

    return loading;
}

/** A source that can be read into and written back, which not every source can. */
export interface EditableSource extends ArchiveSource {}

export interface EditorOptions {
    source: ArchiveSource;
    /** Called after a save, to draw the scene again from the changed archives. */
    onSaved: () => Promise<void>;
    /** Called with anything worth saying, to reach the page's own status line. */
    say: (message: string, isError?: boolean) => void;
    /** Whether to start with the drawer open, as a link naming it asks for. */
    open?: boolean;
    /** Called when the drawer is opened or hidden, so the address can keep up. */
    onToggled?: (open: boolean) => void;
}

/**
 * Builds the panel and the button that opens it.
 *
 * Returns nothing: from here on the panel looks after itself, and the page's only tie to
 * it is the archives it shares with the viewer.
 */
export async function mountEditor(options: EditorOptions): Promise<void> {
    const { source, onSaved, say } = options;

    // --- the drawer ---------------------------------------------------------
    const drawer = document.createElement("section");
    drawer.className = "editor";
    drawer.id = "editor";
    drawer.hidden = true;

    const bar = document.createElement("div");
    bar.className = "editor-bar";

    const which = document.createElement("select");
    which.className = "which";
    which.title = "Which archive to look inside";

    const files = document.createElement("select");
    files.className = "which";
    files.title = "Which file in it";

    const save = document.createElement("button");
    save.textContent = "Save";
    save.title = "Replace the archive with what is written here and draw it again";
    save.disabled = true;

    const revert = document.createElement("button");
    revert.className = "quiet";
    revert.textContent = "Revert";
    revert.disabled = true;

    const note = document.createElement("span");
    note.className = "editor-note";

    const close = document.createElement("button");
    close.className = "quiet close";
    close.textContent = "Hide";

    bar.append(which, files, save, revert, note, close);

    const host = document.createElement("div");
    host.className = "editor-host";

    drawer.append(bar, host);
    document.querySelector("main")?.after(drawer);

    // --- the button that opens it -------------------------------------------
    const toggle = document.createElement("button");
    toggle.id = "files-toggle";
    toggle.textContent = "Files";
    toggle.title = "Look inside the archives, and edit them";
    const status = document.getElementById("status");
    if (status) status.before(toggle);
    else document.querySelector("header")?.append(toggle);

    // --- state ---------------------------------------------------------------
    let editor: any;
    /** The text of every file of the archive on show, as it currently stands. */
    let open: Record<string, string> = {};
    let openRef: VersionRef | undefined;
    let showing = "";
    let dirty = false;
    /** Set while the editor's contents are being replaced by this code rather than typed. */
    let filling = false;

    const languageOf = (name: string) => name.endsWith(".json") ? "json" : "plaintext";

    const markDirty = (is: boolean) => {
        dirty = is;
        save.disabled = !is;
        revert.disabled = !is;
        note.textContent = is ? "edited" : "";
    };

    /** The archives the viewer knows about, as rows in the first picker. */
    async function fillArchives(): Promise<TesseraSummary[]> {
        const tesserae = await source.tesserae();

        which.innerHTML = "";
        for (const tessera of tesserae) {
            for (const version of tessera.versions) {
                const option = document.createElement("option");
                option.value = tessera.id + " " + version.versionId;
                option.textContent = tessera.versions.length > 1
                    ? tessera.name + " · " + (version.message ?? version.versionId.slice(0, 8))
                    : tessera.name;
                which.append(option);
            }
        }

        return tesserae;
    }

    /** Reads one archive's files in, and shows the first of them. */
    function openArchive(value: string): void {
        const [tesseraId, versionId] = value.split(" ");
        if (!tesseraId || !versionId) return;

        const held = source.filesOf({ tesseraId, versionId });
        if (!held) {
            note.textContent = "that archive is not open";
            return;
        }

        openRef = { tesseraId, versionId };
        open = { ...held.files };

        // index.json first; the component tables are alphabetical after it, which is the
        // order they are written in the zip.
        const names = Object.keys(open).sort((a, b) =>
            a === "index.json" ? -1 : b === "index.json" ? 1 : a.localeCompare(b));

        files.innerHTML = "";
        for (const name of names) {
            const option = document.createElement("option");
            option.value = name;
            const lines = open[name]!.split("\n").length;
            option.textContent = name + "  (" + lines + (lines === 1 ? " line)" : " lines)");
            files.append(option);
        }

        showFile(names[0] ?? "");
        markDirty(false);
    }

    function showFile(name: string): void {
        if (!name || !editor) return;

        // What is on screen is kept before moving away from it, so switching files does
        // not quietly throw away what was typed.
        if (showing && open[showing] !== undefined) open[showing] = editor.getValue();

        showing = name;
        files.value = name;

        const model = editor.getModel();
        monaco.editor.setModelLanguage(model, languageOf(name));

        // Putting a file on screen is not an edit to it, though it reaches the change
        // event the same way typing does.
        filling = true;
        editor.setValue(open[name] ?? "");
        filling = false;
    }

    // --- what the controls do ------------------------------------------------
    which.onchange = () => openArchive(which.value);
    files.onchange = () => showFile(files.value);

    revert.onclick = () => {
        if (openRef) openArchive(openRef.tesseraId + " " + openRef.versionId);
    };

    save.onclick = async () => {
        if (!openRef) return;
        if (showing) open[showing] = editor.getValue();

        save.disabled = true;
        try {
            const { warnings } = source.replaceFiles(openRef, open);
            markDirty(false);

            await onSaved();

            note.textContent = warnings.length > 0 ? warnings.join(" · ") : "saved";
            if (warnings.length > 0) say(warnings.join(" · "), true);
        } catch (error) {
            // A bad edit is the ordinary case here, so it is reported where it was made
            // rather than only in the page's status line.
            const message = error instanceof Error ? error.message : String(error);
            note.textContent = message;
            say("could not save: " + message, true);
            save.disabled = false;
        }
    };

    const setOpen = async (wanted: boolean, quietly = false) => {
        drawer.hidden = !wanted;
        toggle.setAttribute("aria-pressed", String(wanted));
        document.body.classList.toggle("editing", wanted);
        if (!quietly) options.onToggled?.(wanted);

        if (!wanted) return;

        if (!editor) {
            note.textContent = "loading the editor…";
            try {
                await monacoReady();
            } catch (error) {
                note.textContent = error instanceof Error ? error.message : String(error);
                return;
            }

            editor = monaco.editor.create(host, {
                value: "",
                language: "json",
                automaticLayout: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12,
                tabSize: 4,
                renderWhitespace: "none",
                // A component table is one object per line and lines get long; wrapping
                // them beats scrolling sideways through a hundred thousand of them.
                wordWrap: "on",
            });

            editor.onDidChangeModelContent(() => { if (!dirty && !filling) markDirty(true); });
            note.textContent = "";
        }

        const tesserae = await fillArchives();
        if (tesserae.length === 0) {
            note.textContent = "nothing to look inside yet";
            return;
        }

        if (!openRef) openArchive(which.value);
    };

    toggle.onclick = () => void setOpen(drawer.hidden);
    close.onclick = () => void setOpen(false);

    // A link can name the drawer as well as the example, so "look at this file" is a
    // thing that can be sent to someone.
    if (options.open) await setOpen(true, true);
}
