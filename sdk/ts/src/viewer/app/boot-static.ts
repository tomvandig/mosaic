import { ArchiveSource } from "../ArchiveSource.ts";
import { loadExample, type ExampleIndex, type ExampleManifest } from "../FetchArchives.ts";
import { mountEditor } from "./editor.ts";
// @ts-expect-error -- the viewer is plain JavaScript, deliberately: it is the same file
// the served build runs, and nothing in it needs types to be correct.
import { reload, start } from "./app.js";

/**
 * The viewer, with no server behind it.
 *
 * Everything the served page asks a database for is worked out here instead, out of the
 * .tsr files sitting beside this page: the archives are fetched, their imports followed,
 * and the selection and glTF conversion run in the browser. That is the whole difference
 * between the two builds -- the page, the tree and the renderer are the same files.
 *
 * Which archives is a matter of which example is chosen. Each example is a folder of
 * static files with a manifest saying what to show, listed in `examples/index.json`.
 */

const EXAMPLES = "examples";

const say = (message: string, isError = false) => {
    const status = document.getElementById("status");
    if (!status) return;
    status.textContent = message;
    status.dataset["error"] = String(isError);
};

/** The picker, put into the header beside everything else. */
function picker(examples: ExampleManifest[], onChoose: (id: string) => void): HTMLSelectElement {
    const label = document.createElement("label");
    label.className = "examples";
    label.append("example ");

    const select = document.createElement("select");
    select.id = "example";
    for (const example of examples) {
        const option = document.createElement("option");
        option.value = example.id;
        option.textContent = example.name;
        if (example.description) option.title = example.description;
        select.append(option);
    }

    select.onchange = () => onChoose(select.value);
    label.append(select);

    const header = document.querySelector("header");
    const before = document.getElementById("status");
    if (before) header?.insertBefore(label, before);
    else header?.append(label);

    return select;
}

/**
 * What the address asks for: an example, and whether the files drawer is open.
 *
 * `?example=campus`, and `?example=campus&files` for the drawer as well. A reload keeps
 * what was being looked at, and a link to it is the address bar rather than something to
 * be assembled by hand.
 *
 * The older `#campus` form is still read, since links to it exist; choosing anything
 * rewrites the address to the query form.
 */
function asked(): { id: string; files: boolean } {
    const query = new URLSearchParams(location.search);
    const named = query.get("example");

    if (named !== null) {
        // `?files` and `?files=1` both open it; anything explicitly off does not.
        const flag = query.get("files");
        const files = flag !== null && flag !== "0" && flag !== "false";
        return { id: named, files };
    }

    const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    const files = hash.endsWith("/files");
    return { id: files ? hash.slice(0, -"/files".length) : hash, files };
}

/**
 * Puts the choice in the address bar.
 *
 * Opening the page is a replacement -- there is nothing to go back to -- and choosing
 * afterwards is a step, so the browser's back button walks through what was looked at.
 */
function remember(id: string, files: boolean, replace: boolean): void {
    const query = new URLSearchParams(location.search);
    query.set("example", id);
    if (files) query.set("files", "1");
    else query.delete("files");

    const url = location.pathname + "?" + query.toString();
    if (replace) history.replaceState({ id, files }, "", url);
    else history.pushState({ id, files }, "", url);
}

/** Loads one example and shows it. */
async function show(
    example: ExampleManifest,
    openFiles: boolean,
    onFilesToggled: (open: boolean) => void,
): Promise<void> {
    const directory = EXAMPLES + "/" + example.id;
    say("reading " + example.name + "…");

    const { tesserae, warnings } = await loadExample(directory, example, undefined);
    const source = new ArchiveSource(tesserae);

    await start(source);

    // Built again against the new source, so saving edits the archive on screen rather
    // than one from the example that was open before.
    document.getElementById("files-toggle")?.remove();
    document.getElementById("editor")?.remove();
    document.body.classList.remove("editing");

    await mountEditor({
        source,
        onSaved: () => reload(),
        say,
        open: openFiles,
        onToggled: onFilesToggled,
    });

    // What the manifest says to show, or everything it lists.
    const wanted = example.shown ?? example.archives;
    const stems = new Set(wanted.map(name => name.replace(/\.[^./]+$/, "").split("/").pop()));

    for (const tessera of await source.tesserae()) {
        if (!stems.has(tessera.name)) continue;
        // The row carries the tessera id as its title, which is how a row is matched to
        // the tessera it stands for without the viewer having to expose its own state.
        const tick = [...document.querySelectorAll<HTMLInputElement>(".tessera input[type=checkbox]")]
            .find(box => box.closest<HTMLElement>(".tessera")?.title === tessera.id);
        if (tick && !tick.checked) tick.click();
    }

    if (warnings.length > 0) {
        const panel = document.getElementById("warnings");
        if (panel) {
            panel.hidden = false;
            panel.textContent = warnings.join(" · ");
        }
    }
}

async function main(): Promise<void> {
    let index: ExampleIndex;
    try {
        const response = await fetch(EXAMPLES + "/index.json");
        if (!response.ok) throw new Error(response.status + " reading the example list");
        index = await response.json() as ExampleIndex;
    } catch (error) {
        say("no examples to show: " + (error instanceof Error ? error.message : String(error)), true);
        await start(new ArchiveSource());
        return;
    }

    if (index.examples.length === 0) {
        say("no examples to show", true);
        await start(new ArchiveSource());
        return;
    }

    /** Whether the drawer is open, kept so the address can say so as it changes. */
    let filesOpen = false;

    const choose = async (id: string, openFiles = false, replace = false) => {
        const example = index.examples.find(one => one.id === id) ?? index.examples[0]!;
        filesOpen = openFiles;
        remember(example.id, openFiles, replace);

        try {
            await show(example, openFiles, open => {
                filesOpen = open;
                remember(example.id, open, true);
            });
        } catch (error) {
            say(example.name + ": " + (error instanceof Error ? error.message : String(error)), true);
        }
    };

    // A link to an example is a link to that example, so the address decides what opens.
    const wanted = asked();
    const opening = index.examples.find(one => one.id === wanted.id) ?? index.examples[0]!;

    const select = picker(index.examples, id => void choose(id, filesOpen));
    select.value = opening.id;

    // Back and forward walk through what was looked at, rather than leaving the page.
    window.addEventListener("popstate", () => {
        const now = asked();
        const id = index.examples.some(one => one.id === now.id) ? now.id : opening.id;
        select.value = id;
        void choose(id, now.files, true);
    });

    await choose(opening.id, wanted.files, true);
}

await main();
