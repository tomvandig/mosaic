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
 * What a hash asks for: an example, and whether the files drawer is open.
 *
 * Written as `#campus` or `#campus/files`, so a link can point at either.
 */
function asked(): { id: string; files: boolean } {
    const raw = decodeURIComponent(location.hash.replace(/^#/, ""));
    const files = raw.endsWith("/files");
    return { id: files ? raw.slice(0, -"/files".length) : raw, files };
}

/** Loads one example and shows it. */
async function show(example: ExampleManifest, openFiles: boolean): Promise<void> {
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

    await mountEditor({ source, onSaved: () => reload(), say, open: openFiles });

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

    const choose = async (id: string, openFiles = false) => {
        const example = index.examples.find(one => one.id === id) ?? index.examples[0]!;
        location.hash = example.id + (openFiles ? "/files" : "");
        try {
            await show(example, openFiles);
        } catch (error) {
            say(example.name + ": " + (error instanceof Error ? error.message : String(error)), true);
        }
    };

    // A link to an example is a link to that example, so the hash decides what opens.
    const wanted = asked();
    const opening = index.examples.find(one => one.id === wanted.id) ?? index.examples[0]!;

    const select = picker(index.examples, id => void choose(id));
    select.value = opening.id;

    window.addEventListener("hashchange", () => {
        const now = asked();
        if (now.id && now.id !== select.value && index.examples.some(one => one.id === now.id)) {
            select.value = now.id;
            void choose(now.id, now.files);
        }
    });

    await choose(opening.id, wanted.files);
}

await main();
