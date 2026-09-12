import { LoadMosaicFile } from "../MosaicFile.ts";
import { versionFrom, type ArchiveGraph, type LoadedTessera } from "./ArchiveSource.ts";

/** What one example folder says it holds. */
export interface ExampleManifest {
    /** Folder name, which is also the path it is served under. */
    id: string;
    name: string;
    description?: string;
    /**
     * The archives to show, in the order they should layer. A file's own imports are
     * followed as well and do not need listing.
     */
    archives: string[];
    /** Which of them start ticked. All of them when left out. */
    shown?: string[];
}

export interface ExampleIndex {
    examples: ExampleManifest[];
}

/** How bytes are obtained. Separated out so this is testable without a network. */
export type Fetcher = (url: string) => Promise<Uint8Array>;

export const fetchBytes: Fetcher = async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
    return new Uint8Array(await response.arrayBuffer());
};

/** A path with its `.` and `..` segments worked out, as a list of segments. */
function normalise(path: string): string[] {
    const parts: string[] = [];
    for (const part of path.split("/")) {
        if (part === "" || part === ".") continue;
        if (part === "..") {
            parts.pop();
            continue;
        }
        parts.push(part);
    }
    return parts;
}

/**
 * Resolves an import against the archive that declares it, and refuses to leave the root.
 *
 * An archive names its imports relative to itself, so a file in a subfolder importing
 * `../shared.tsr` means the folder above its own -- which is why the base here is the
 * importing file's directory rather than the root.
 *
 * The root is a separate question. On disk, resolving an import is the whole of it; served
 * as static files it also matters where one is allowed to point, since an example is a
 * directory someone published and an import climbing out of it is either a mistake or
 * something worse. Either way it is not fetched.
 */
export function resolveWithin(root: string, fromDirectory: string, uri: string): string {
    const cleaned = decodeURIComponent(uri.replace(/^file:\/*/i, ""));
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned)) {
        throw new Error(`import "${uri}" is not a path this can fetch`);
    }

    const base = normalise(root);
    const target = normalise(fromDirectory + "/" + cleaned);

    if (target.length === 0) throw new Error(`import "${uri}" names nothing`);

    const inside = base.every((part, at) => target[at] === part);
    if (!inside) throw new Error(`import "${uri}" points outside ${base.join("/")}`);

    return target.join("/");
}

/**
 * An archive and everything it imports, as a graph.
 *
 * This is {@link loadWithImports} without a filesystem, and without the merging: the same
 * walk, reading through whatever the caller hands over instead of `fs`, but what comes
 * back is every archive reached, each on its own, with what it imports named by url.
 * Merging is done from the graph when a version is asked about, so that every file stays
 * a file -- one that can be opened and edited -- however many others fold it in.
 *
 * Archives already in the graph are not fetched again: several files in one example often
 * import the same library, and the graph is shared by everything in the example.
 */
export async function loadArchive(
    directory: string,
    name: string,
    get: Fetcher = fetchBytes,
    warnings: string[] = [],
    graph: ArchiveGraph = new Map(),
): Promise<{ top: string; graph: ArchiveGraph }> {
    const visiting = new Set<string>();

    async function load(url: string, importedBy?: string): Promise<void> {
        if (graph.has(url)) return;
        if (visiting.has(url)) throw new Error(`Import cycle: ${url} is already being loaded`);
        visiting.add(url);

        let bytes: Uint8Array;
        try {
            bytes = await get(url);
        } catch (error) {
            throw new Error(importedBy
                ? `Import "${url}", referenced by ${importedBy}, could not be read: ${message(error)}`
                : `${url} could not be read: ${message(error)}`);
        }

        const alone = await LoadMosaicFile(bytes);

        // Imports are named relative to the archive that declares them.
        const here = url.slice(0, url.lastIndexOf("/"));
        const imports: string[] = [];

        for (const entry of alone.index.imports ?? []) {
            let target: string;
            try {
                target = resolveWithin(directory, here, entry.uri);
            } catch (error) {
                warnings.push(`skipped ${message(error)}`);
                continue;
            }

            await load(target, url);
            imports.push(target);
        }

        visiting.delete(url);
        graph.set(url, { url, name: url.slice(url.lastIndexOf("/") + 1), alone, imports });
    }

    const top = directory.replace(/\/+$/, "") + "/" + name;
    await load(top);

    return { top, graph };
}

/**
 * Every archive an example lists, as tesserae the viewer can show.
 *
 * One graph serves the whole example: an archive two tesserae both import is read once
 * and is one object, so an edit to it reaches both.
 */
export async function loadExample(
    directory: string,
    manifest: ExampleManifest,
    get: Fetcher = fetchBytes,
): Promise<{ tesserae: LoadedTessera[]; graph: ArchiveGraph; warnings: string[] }> {
    const warnings: string[] = [];
    const tesserae: LoadedTessera[] = [];
    const graph: ArchiveGraph = new Map();

    for (const name of manifest.archives) {
        const { top } = await loadArchive(directory, name, get, warnings, graph);
        const stem = name.replace(/\.[^./]+$/, "").split("/").pop() ?? name;

        const version = versionFrom(graph, top, {
            versionId: idFor(directory + "/" + name),
            message: "as published",
        });

        tesserae.push({ id: idFor(directory + "/" + name + "#tessera"), name: stem, versions: [version] });
    }

    return { tesserae, graph, warnings };
}

/**
 * A stable id for something that has none.
 *
 * Archives in a folder are not a database and have no version ids, but the viewer keys
 * everything by one. Deriving it from the path rather than making one up keeps a reload
 * showing what the last one showed, and keeps a link to a node still meaning that node.
 */
function idFor(key: string): string {
    let hash = 0x811c9dc5;
    for (let at = 0; at < key.length; at++) {
        hash ^= key.charCodeAt(at);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }

    const hex = hash.toString(16).padStart(8, "0");
    const more = Math.imul(hash ^ key.length, 0x01000193) >>> 0;
    const tail = more.toString(16).padStart(8, "0");

    return `${hex}-${tail.slice(0, 4)}-4${tail.slice(4, 7)}-8${hex.slice(0, 3)}-${hex}${tail.slice(0, 4)}`;
}

function message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
