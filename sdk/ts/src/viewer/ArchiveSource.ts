import { LoadMosaicFile, MosaicFile } from "../MosaicFile.ts";
import { Convert } from "../MosaicIndexFile.ts";
import { collapseNodesByPath, federate } from "../MosaicFileOperations.ts";
import { selectNodes } from "../Selection.ts";
import { mosaicToGltf } from "../composition/MosaicToGltf.ts";
import { writeGlb } from "../composition/GlbWriter.ts";
import { CORE_TYPE } from "../core/schemas.ts";
import type {
    MosaicSource, Scene, SceneComponent, SceneNode, SelectionAcross, TesseraSummary, VersionRef,
} from "./MosaicSource.ts";

/**
 * One version of one tessera, as the archive it was loaded from.
 *
 * The archive is kept twice over: as it was written, and as it reads once its imports are
 * merged underneath it. Both are needed. Drawing wants the merged one, and editing wants
 * the written one -- what someone opens and changes is the file, not the file plus
 * everything it pulled in, and the merge has to be redone afterwards rather than undone.
 */
export interface LoadedVersion {
    versionId: string;
    message?: string;
    author?: string;
    /** The archive as written, which is what its own files say. */
    alone: MosaicFile;
    /**
     * Everything it imports, already merged. Absent when it imports nothing.
     *
     * Imports are resolved when the archive is loaded rather than when it is asked about,
     * because resolving one means fetching more files.
     */
    beneath?: MosaicFile;
    /** `alone` layered over `beneath`. Rebuilt whenever `alone` changes. */
    file: MosaicFile;
    /**
     * The nodes this archive writes itself, as opposed to the ones it got from an import.
     * Which archive a node belongs to is a question the viewer asks about every node it
     * draws, and it cannot be recovered once the files are merged.
     */
    own: Set<string>;
}

/** The files inside an archive, as the zip holds them. */
export interface ArchiveFiles {
    /** The tessera's name, for the panel heading. */
    name: string;
    /** Filename to contents: `index.json`, and one `.ndjson` per component type. */
    files: Record<string, string>;
}

export interface LoadedTessera {
    id: string;
    name: string;
    /** Oldest first, so the last is the newest. */
    versions: LoadedVersion[];
}

/**
 * Archives held in memory, answering the viewer's questions out of themselves.
 *
 * This is the whole of the static viewer's back end. Nothing here is a port or a
 * reimplementation: the selection, the inheritance pass and the glTF conversion are the
 * same functions the server calls, which is the reason a .tsr opened in a browser shows
 * what the server would have shown. What the server has and this does not is a database,
 * and what that buys is answering without reading the whole archive first -- which
 * matters at a gigabyte and does not at the size of a file someone opened by hand.
 */
export class ArchiveSource implements MosaicSource {
    readonly kind = "archives";

    private readonly held = new Map<string, LoadedTessera>();

    constructor(loaded: LoadedTessera[] = []) {
        for (const tessera of loaded) this.held.set(tessera.id, tessera);
    }

    async tesserae(): Promise<TesseraSummary[]> {
        return this.summaries();
    }

    private summaries(): TesseraSummary[] {
        return [...this.held.values()].map(tessera => ({
            id: tessera.id,
            name: tessera.name,
            versions: tessera.versions.map(version => ({
                versionId: version.versionId,
                ...(version.message !== undefined ? { message: version.message } : {}),
                ...(version.author !== undefined ? { author: version.author } : {}),
            })),
        }));
    }

    /**
     * Takes an archive someone handed over, rather than one loaded from a folder.
     *
     * Its imports are not followed: a file dropped on the page came without the folder it
     * sat in, so there is nowhere to look for them. An archive that stands on its own
     * shows as it is, and one that does not shows what it has.
     */
    async add(name: string, bytes: Uint8Array): Promise<TesseraSummary> {
        const file = await LoadMosaicFile(bytes);

        const own = new Set<string>();
        for (const section of file.index.sections) {
            for (const node of section.nodes) own.add(node.id);
        }

        return this.put(name.replace(/\.tsr$/i, ""), {
            versionId: crypto.randomUUID(),
            message: "dropped in",
            alone: file,
            file,
            own,
        });
    }

    /** Adds a tessera, or another version of one already here under that name. */
    put(name: string, version: LoadedVersion): TesseraSummary {
        const existing = [...this.held.values()].find(tessera => tessera.name === name);
        const tessera = existing ?? { id: crypto.randomUUID(), name, versions: [] };

        tessera.versions.push(version);
        this.held.set(tessera.id, tessera);

        return this.summaries().find(summary => summary.id === tessera.id)!;
    }

    // --- what is inside an archive ------------------------------------------

    /**
     * The files an archive is made of, as text.
     *
     * A .tsr is a zip of an index and one newline-delimited table per component type, and
     * that is exactly what comes back -- no view, no summary, the files themselves. What
     * is shown is the archive as written, without what it imports, since that is what
     * editing it would change.
     */
    filesOf(ref: VersionRef): ArchiveFiles | undefined {
        const tessera = this.held.get(ref.tesseraId);
        const version = tessera?.versions.find(one => one.versionId === ref.versionId);
        if (!tessera || !version) return undefined;

        const files: Record<string, string> = {
            "index.json": JSON.stringify(version.alone.index, null, 4),
        };

        for (const [type, rows] of version.alone.serializedComponents) {
            files[type + ".ndjson"] = rows.join("\n");
        }

        return { name: tessera.name, files };
    }

    /**
     * Puts edited files back, in place of the archive they came from.
     *
     * The imports are merged again afterwards rather than kept: an edit can add one, or
     * change which node a component belongs to, and a stale merge would show the old
     * answer. What it cannot do is fetch a newly named import -- nothing here has a
     * network -- so a new import is reported rather than silently ignored.
     */
    replaceFiles(ref: VersionRef, files: Record<string, string>): { warnings: string[] } {
        const tessera = this.held.get(ref.tesseraId);
        const version = tessera?.versions.find(one => one.versionId === ref.versionId);
        if (!tessera || !version) throw new Error("that archive is not open");

        const index = files["index.json"];
        if (index === undefined) throw new Error("an archive needs an index.json");

        const edited = new MosaicFile();
        edited.index = Convert.toMosaicIndexFile(index);

        for (const [name, text] of Object.entries(files)) {
            if (!name.endsWith(".ndjson")) continue;
            edited.serializedComponents.set(name.replace(/\.ndjson$/, ""), text.split("\n"));
        }

        const warnings: string[] = [];
        const had = new Set((version.alone.index.imports ?? []).map(entry => entry.uri));
        for (const entry of edited.index.imports ?? []) {
            if (!had.has(entry.uri)) {
                warnings.push(`import "${entry.uri}" was added; reload the example to fetch it`);
            }
        }

        version.alone = edited;
        version.file = version.beneath ? federate(version.beneath, edited, true) : edited;

        version.own = new Set();
        for (const section of edited.index.sections) {
            for (const node of section.nodes) version.own.add(node.id);
        }

        return { warnings };
    }

    /** The versions named, in the order they were named, skipping any that are not here. */
    private resolve(refs: VersionRef[]): Array<{ ref: VersionRef; name: string; version: LoadedVersion }> {
        const found = [];
        for (const ref of refs) {
            const tessera = this.held.get(ref.tesseraId);
            const version = tessera?.versions.find(one => one.versionId === ref.versionId);
            if (tessera && version) found.push({ ref, name: tessera.name, version });
        }
        return found;
    }

    /**
     * Everything asked for, as one file.
     *
     * Later versions layer over earlier ones, in the order the caller named them, which is
     * what makes several tesserae on show a single tree rather than several.
     */
    private scopeOf(refs: VersionRef[]): { file: MosaicFile; parts: Array<{ ref: VersionRef; name: string; version: LoadedVersion }> } {
        const parts = this.resolve(refs);

        let file: MosaicFile | undefined;
        for (const part of parts) {
            file = file ? federate(file, part.version.file, true) : part.version.file;
        }

        return { file: file ?? new MosaicFile(), parts };
    }

    /**
     * The nodes nothing in scope holds as a child.
     *
     * Being a root is judged across the whole scope rather than inside one archive: a node
     * that is a root of the file it is written in stops being one as soon as something
     * shown beside it holds it as a child.
     */
    private rootsOf(file: MosaicFile): string[] {
        const collapsed = collapseNodesByPath(file);

        const asChild = new Set<string>();
        for (const node of collapsed.values()) {
            for (const reference of node.components ?? []) {
                if (reference.type === CORE_TYPE.child) asChild.add(reference.id);
            }
        }

        return [...collapsed.keys()].filter(id => !asChild.has(id));
    }

    /** The selection both answers are built from. */
    private select(request: SelectionAcross) {
        const { file, parts } = this.scopeOf(request.versions);
        const asked = request.nodes && request.nodes.length > 0 ? request.nodes : undefined;
        const seeds = asked ?? this.rootsOf(file);

        const selection = selectNodes(file, {
            nodes: seeds,
            includeChildren: request.includeChildren ?? true,
            ...(request.compose !== undefined ? { compose: request.compose } : {}),
            ...(request.componentTypes ? { componentTypes: request.componentTypes } : {}),
        });

        return { selection, parts, seeds, scope: file };
    }

    async glb(request: SelectionAcross): Promise<Uint8Array> {
        const { selection } = this.select(request);
        const composed = mosaicToGltf(selection.file);
        return writeGlb(composed.document, composed.binary);
    }

    async scene(request: SelectionAcross): Promise<Scene> {
        const { selection, parts, seeds, scope } = this.select(request);
        const file = selection.file;

        // Which archive each node was written in. The topmost that writes it wins, the
        // same way its components do.
        const origin = new Map<string, { ref: VersionRef; name: string }>();
        for (const part of parts) {
            for (const id of part.version.own) origin.set(id, { ref: part.ref, name: part.name });
        }

        const nodes: Record<string, SceneNode> = {};
        for (const node of file.index.sections[0]?.nodes ?? []) {
            const components: SceneComponent[] = (node.components ?? []).map(reference => {
                const index = reference.index ?? -1;
                return {
                    type: reference.type,
                    id: reference.id,
                    index,
                    value: index >= 0 ? JSON.parse(file.readRawComponent(reference.type, index)) : null,
                };
            });

            const from = origin.get(node.id);

            nodes[node.id] = {
                id: node.id,
                name: components.find(component => component.type === CORE_TYPE.name)?.id ?? null,
                children: components
                    .filter(component => component.type === CORE_TYPE.child)
                    .map(component => component.id),
                components,
                tessera: from?.name ?? null,
                tesseraId: from?.ref.tesseraId ?? null,
                versionId: from?.ref.versionId ?? null,
            };
        }

        const roots = request.nodes && request.nodes.length > 0 ? seeds : this.rootsOf(scope);

        return {
            versions: parts.map(part => ({
                ...part.ref,
                name: part.name,
                roots: roots.filter(id => origin.get(id)?.ref.versionId === part.ref.versionId
                    && nodes[id] !== undefined),
            })),
            // Nothing arrives here by import that the caller did not name: imports are
            // resolved into the archive as it is loaded, so there is no second tessera to
            // report having dragged in.
            imported: [],
            roots: roots.filter(id => nodes[id] !== undefined),
            nodes,
            warnings: [],
        };
    }
}
