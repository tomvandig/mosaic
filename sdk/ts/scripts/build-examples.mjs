/**
 * Fills `examples/viewer/examples` with the archives the static viewer shows.
 *
 * Each example is a folder of its own holding everything it needs and nothing it does
 * not. That is the rule the viewer enforces from the other side: an import is resolved
 * relative to the archive that declares it and is refused if it points outside the
 * example, so an example has to be self-contained to work at all.
 *
 * Which files those are is not listed here, only the archives to show. Everything else
 * follows from what they import -- the campus is one 13 KB file that names eleven others,
 * one of which names three more, and all fifteen are found by reading rather than by
 * being written down.
 *
 * Archives are deflated on the way through. They are mostly json and mostly repetition,
 * so the campus goes from 14.3 MB to 1.2 MB, which is the difference between a page that
 * opens and one that is waited for.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LoadMosaicFile, WriteMosaicFile } from "../src/MosaicFile.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(root, "..", "..");
const into = path.join(repo, "examples", "viewer", "examples");

/**
 * What to publish.
 *
 * `archives` names what becomes a tessera in the viewer -- one row in its list. Imports
 * are not tesserae: they are merged underneath the archive that imports them, which is
 * what the campus is, one file standing for fifteen.
 */
const EXAMPLES = [
    {
        id: "campus",
        name: "Campus",
        description: "Three buildings and a site, each split into structure, architecture and services, "
            + "over a shared library of types. One archive importing eleven.",
        from: "examples/campus",
        archives: ["campus.tsr"],
    },
    {
        id: "buildings",
        name: "Campus, by discipline",
        description: "The same three buildings, with each discipline as its own tessera, "
            + "so they can be shown and hidden separately.",
        from: "examples/campus",
        archives: [
            "campus-site.tsr",
            "bldg-a-structure.tsr", "bldg-a-architecture.tsr", "bldg-a-services.tsr",
            "bldg-b-structure.tsr", "bldg-b-architecture.tsr", "bldg-b-services.tsr",
            "bldg-c-structure.tsr", "bldg-c-architecture.tsr", "bldg-c-services.tsr",
        ],
        shown: ["campus-site.tsr", "bldg-a-structure.tsr", "bldg-a-architecture.tsr"],
    },
    {
        id: "helmet",
        name: "Helmet on a plaza",
        description: "A small scene importing a model: two archives, one of which places the other.",
        from: "sdk/ts/test-data",
        archives: ["helmet-plaza.tsr"],
    },
    {
        id: "instanced-boxes",
        name: "One box, many places",
        description: "A single mesh placed a dozen times. Every box in the tree is the same geometry.",
        from: "sdk/ts/test-data",
        archives: ["instanced-boxes.tsr"],
    },
    {
        id: "typed-boxes",
        name: "Boxes by type",
        description: "Parts whose geometry belongs to the type they are, rather than to them. "
            + "Turn compose off and they disappear.",
        from: "sdk/ts/test-data",
        archives: ["typed-boxes.tsr"],
    },
];

const KB = bytes => (bytes / 1024).toFixed(0) + " KB";
const MB = bytes => (bytes / 1048576).toFixed(1) + " MB";

/** An import as a path relative to the archive that declares it, or nothing. */
function importedPath(from, uri) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uri) && !/^file:/i.test(uri)) return undefined;
    const cleaned = decodeURIComponent(uri.replace(/^file:\/*/i, ""));
    return path.normalize(path.join(path.dirname(from), cleaned));
}

/**
 * Every archive an example needs, found by following what it imports.
 *
 * Paths come back relative to the source directory, so copying them keeps whatever shape
 * they had -- an import naming `parts/wall.tsr` still finds it there afterwards.
 */
async function reachable(directory, archives, warnings) {
    const found = new Map();

    async function visit(relative) {
        if (found.has(relative)) return;

        const file = path.join(directory, relative);
        if (!fs.existsSync(file)) throw new Error(`${relative} is not in ${directory}`);

        const loaded = await LoadMosaicFile(new Uint8Array(fs.readFileSync(file)));
        found.set(relative, loaded);

        for (const entry of loaded.index.imports ?? []) {
            const next = importedPath(relative, entry.uri);
            if (next === undefined) {
                warnings.push(`${relative} imports ${entry.uri}, which is not a file to copy`);
                continue;
            }
            if (next.startsWith("..")) {
                throw new Error(`${relative} imports ${entry.uri}, which is outside ${directory}`);
            }
            await visit(next);
        }
    }

    for (const archive of archives) await visit(archive);
    return found;
}

fs.rmSync(into, { recursive: true, force: true });
fs.mkdirSync(into, { recursive: true });

const manifests = [];
let totalBefore = 0, totalAfter = 0;

for (const example of EXAMPLES) {
    const directory = path.join(repo, example.from);
    const warnings = [];

    const files = await reachable(directory, example.archives, warnings);
    const target = path.join(into, example.id);

    let before = 0, after = 0;
    for (const [relative, loaded] of files) {
        const wrote = await WriteMosaicFile(loaded);
        const file = path.join(target, relative);

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, wrote);

        before += fs.statSync(path.join(directory, relative)).size;
        after += wrote.byteLength;
    }

    totalBefore += before;
    totalAfter += after;

    manifests.push({
        id: example.id,
        name: example.name,
        ...(example.description ? { description: example.description } : {}),
        archives: example.archives,
        ...(example.shown ? { shown: example.shown } : {}),
    });

    console.log(example.id.padEnd(14) + String(files.size).padStart(3) + " files  "
        + KB(before).padStart(10) + " -> " + KB(after).padStart(9)
        + (warnings.length ? "   (" + warnings.length + " skipped)" : ""));
    for (const warning of warnings) console.log("               " + warning);
}

fs.writeFileSync(path.join(into, "index.json"), JSON.stringify({ examples: manifests }, null, 2) + "\n");

console.log("\n" + manifests.length + " examples, " + MB(totalBefore) + " -> " + MB(totalAfter)
    + "  ->  " + path.relative(repo, into));
