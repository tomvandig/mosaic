import { LoadMosaicFile, MosaicFile } from "../MosaicFile.ts";
import { federate } from "../MosaicFileOperations.ts";
import type { LoadedTessera, LoadedVersion } from "./ArchiveSource.ts";

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
 * An archive and everything it imports, merged.
 *
 * This is {@link loadWithImports} without a filesystem: the same walk, the same order --
 * imports underneath the file that imports them, so a later section still wins -- reading
 * through whatever the caller hands over instead of `fs`.
 */
export async function loadArchive(
    directory: string,
    name: string,
    get: Fetcher = fetchBytes,
    warnings: string[] = [],
): Promise<{
    /** The archive with its imports merged underneath, which is what is drawn. */
    file: MosaicFile;
    /** The archive as written, which is what is edited. */
    alone: MosaicFile;
    /** Its imports, merged together. Absent when it imports nothing. */
    beneath: MosaicFile | undefined;
    own: Set<string>;
    sources: string[];
}> {
    const visiting = new Set<string>();
    const sources: string[] = [];

    const top = directory.replace(/\/+$/, "") + "/" + name;

    // What the named archive imports, merged, kept aside as the walk passes through it.
    // An edit to the archive has to be layered over the same thing again, and going back
    // for it would mean fetching everything a second time.
    let beneath: MosaicFile | undefined;

    // An archive is read twice -- once merged with its imports, once on its own to see
    // which nodes are its -- and several archives in one example often import the same
    // library. Asking for any of it twice is asking the network twice.
    const already = new Map<string, Promise<Uint8Array>>();
    const fetchOnce = (url: string): Promise<Uint8Array> => {
        const going = already.get(url) ?? get(url);
        already.set(url, going);
        return going;
    };

    async function load(url: string, importedBy?: string): Promise<MosaicFile> {
        if (visiting.has(url)) throw new Error(`Import cycle: ${url} is already being loaded`);
        visiting.add(url);

        let bytes: Uint8Array;
        try {
            bytes = await fetchOnce(url);
        } catch (error) {
            throw new Error(importedBy
                ? `Import "${url}", referenced by ${importedBy}, could not be read: ${message(error)}`
                : `${url} could not be read: ${message(error)}`);
        }

        const file = await LoadMosaicFile(bytes);

        // Imports are named relative to the archive that declares them.
        const here = url.slice(0, url.lastIndexOf("/"));

        let merged: MosaicFile | undefined;
        for (const entry of file.index.imports ?? []) {
            let target: string;
            try {
                target = resolveWithin(directory, here, entry.uri);
            } catch (error) {
                warnings.push(`skipped ${message(error)}`);
                continue;
            }

            const imported = await load(target, url);
            merged = merged ? federate(merged, imported, true) : imported;
        }

        visiting.delete(url);
        sources.push(url);

        if (url === top) beneath = merged;

        return merged ? federate(merged, file, true) : file;
    }

    const file = await load(top);

    // The archive on its own, which is both what an editor shows and how the nodes it
    // writes are told apart from the ones it imported.
    const alone = await LoadMosaicFile(await fetchOnce(top));
    const own = new Set<string>();
    for (const section of alone.index.sections) {
        for (const node of section.nodes) own.add(node.id);
    }

    return { file, alone, beneath, own, sources };
}

/** Every archive an example lists, as tesserae the viewer can show. */
export async function loadExample(
    directory: string,
    manifest: ExampleManifest,
    get: Fetcher = fetchBytes,
): Promise<{ tesserae: LoadedTessera[]; warnings: string[] }> {
    const warnings: string[] = [];
    const tesserae: LoadedTessera[] = [];

    for (const name of manifest.archives) {
        const { file, alone, beneath, own } = await loadArchive(directory, name, get, warnings);
        const stem = name.replace(/\.[^./]+$/, "").split("/").pop() ?? name;

        const version: LoadedVersion = {
            versionId: idFor(directory + "/" + name),
            message: "as published",
            alone,
            ...(beneath ? { beneath } : {}),
            file,
            own,
        };

        tesserae.push({ id: idFor(directory + "/" + name + "#tessera"), name: stem, versions: [version] });
    }

    return { tesserae, warnings };
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
