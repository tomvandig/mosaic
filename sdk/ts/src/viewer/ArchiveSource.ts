import { LoadMosaicFile, MosaicFile } from "../MosaicFile.ts";
import { Convert } from "../MosaicIndexFile.ts";
import { collapseNodesByPath, federate } from "../MosaicFileOperations.ts";
import { selectNodes } from "../Selection.ts";
import { mosaicToGltf } from "../composition/MosaicToGltf.ts";
import { writeGlb } from "../composition/GlbWriter.ts";
import { CORE_SCHEMAS, CORE_TYPE } from "../core/schemas.ts";
import { Operation, Type, type NodeElement, type SectionElement } from "../MosaicIndexFile.ts";
import { indexOf, operationOf } from "../ComponentReference.ts";
import type {
    MosaicSource, Scene, SceneComponent, SceneNode, SelectionAcross, TesseraSummary, VersionRef,
} from "./MosaicSource.ts";

/**
 * One .tsr, as it was written.
 *
 * Nothing is merged in here. What an archive imports is named, not included, and the
 * merging happens when a version is asked about -- so that every file in an example is
 * still a file in its own right, one that can be opened and edited on its own, however
 * many others it is folded into when drawn.
 */
export interface LoadedArchive {
    /** Where it was read from, which is how everything else refers to it. */
    url: string;
    /** The file name, for showing. */
    name: string;
    alone: MosaicFile;
    /** The archives it imports, in the order it names them, by url. */
    imports: string[];
}

/** Every archive one example reached, by url. Shared by all the versions in it. */
export type ArchiveGraph = Map<string, LoadedArchive>;

/**
 * One version of one tessera: an archive in the graph, and what it reads as with its
 * imports merged underneath.
 *
 * `file` and `own` are worked out from the graph, not stored alongside it -- an edit to
 * any archive in the graph can change both for every version above it, so they are
 * rebuilt rather than kept.
 */
export interface LoadedVersion {
    versionId: string;
    message?: string;
    author?: string;
    /** The archive this version is, as a key into the graph. */
    top: string;
    graph: ArchiveGraph;
    /** `top` layered over everything it imports. Rebuilt whenever the graph changes. */
    file: MosaicFile;
    /**
     * The nodes `top` writes itself, as opposed to the ones it got from an import.
     * Which archive a node belongs to is a question the viewer asks about every node it
     * draws, and it cannot be recovered from the merged file.
     */
    own: Set<string>;
}

/** The files inside an archive, as the zip holds them. */
export interface ArchiveFiles {
    url: string;
    /** The file name, for the panel heading. */
    name: string;
    /** Filename to contents: `index.json`, and one `.ndjson` per component type. */
    files: Record<string, string>;
}

/**
 * An archive with its imports merged underneath it, the way the composer does it: each
 * import in the order named, then the archive itself over them so its sections win.
 */
export function mergedFrom(graph: ArchiveGraph, url: string, memo = new Map<string, MosaicFile>()): MosaicFile {
    const done = memo.get(url);
    if (done) return done;

    const archive = graph.get(url);
    if (!archive) throw new Error(`${url} is not in the graph`);

    let beneath: MosaicFile | undefined;
    for (const dep of archive.imports) {
        const imported = mergedFrom(graph, dep, memo);
        beneath = beneath ? federate(beneath, imported, true) : imported;
    }

    const merged = beneath ? federate(beneath, archive.alone, true) : archive.alone;
    memo.set(url, merged);
    return merged;
}

/** The node ids an archive writes itself. */
export function ownNodesOf(alone: MosaicFile): Set<string> {
    const own = new Set<string>();
    for (const section of alone.index.sections) {
        for (const node of section.nodes) own.add(node.id);
    }
    return own;
}

/** A version of the archive at `top`, with its merged file and its own nodes worked out. */
export function versionFrom(
    graph: ArchiveGraph,
    top: string,
    about: { versionId: string; message?: string; author?: string },
): LoadedVersion {
    const archive = graph.get(top);
    if (!archive) throw new Error(`${top} is not in the graph`);

    return {
        ...about,
        top,
        graph,
        file: mergedFrom(graph, top),
        own: ownNodesOf(archive.alone),
    };
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
        const alone = await LoadMosaicFile(bytes);

        // A url of its own, so it can sit in the files list beside archives that have one.
        const url = "dropped:" + name;
        const graph: ArchiveGraph = new Map([[url, { url, name, alone, imports: [] }]]);

        return this.put(name.replace(/\.tsr$/i, ""),
            versionFrom(graph, url, { versionId: crypto.randomUUID(), message: "dropped in" }));
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

    /** Every archive graph any version here points into, each once. */
    private graphs(): ArchiveGraph[] {
        const seen = new Set<ArchiveGraph>();
        for (const tessera of this.held.values()) {
            for (const version of tessera.versions) seen.add(version.graph);
        }
        return [...seen];
    }

    /** The archive at a url, from whichever graph has it. */
    private archiveAt(url: string): LoadedArchive | undefined {
        for (const graph of this.graphs()) {
            const found = graph.get(url);
            if (found) return found;
        }
        return undefined;
    }

    /**
     * Every archive that was loaded, whether it is shown as a tessera or only imported by
     * one. Roots first -- the archives nothing here imports -- since those are the ones
     * someone is most likely to have come looking for.
     */
    archives(): Array<{ url: string; name: string; imported: boolean }> {
        const all = new Map<string, LoadedArchive>();
        const importedUrls = new Set<string>();

        for (const graph of this.graphs()) {
            for (const archive of graph.values()) {
                all.set(archive.url, archive);
                for (const dep of archive.imports) importedUrls.add(dep);
            }
        }

        return [...all.values()]
            .map(archive => ({ url: archive.url, name: archive.name, imported: importedUrls.has(archive.url) }))
            .sort((a, b) => Number(a.imported) - Number(b.imported) || a.name.localeCompare(b.name));
    }

    /**
     * The files an archive is made of, as text.
     *
     * A .tsr is a zip of an index and one newline-delimited table per component type, and
     * that is exactly what comes back -- no view, no summary, the files themselves. What
     * is shown is the archive as written, without what it imports, since that is what
     * editing it would change.
     */
    filesOf(url: string): ArchiveFiles | undefined {
        const archive = this.archiveAt(url);
        if (!archive) return undefined;

        const files: Record<string, string> = {
            "index.json": JSON.stringify(archive.alone.index, null, 4),
        };

        for (const [type, rows] of archive.alone.serializedComponents) {
            files[type + ".ndjson"] = rows.join("\n");
        }

        return { url, name: archive.name, files };
    }

    /**
     * Puts edited files back, in place of the archive they came from.
     *
     * Everything above the edited archive is merged again afterwards: an edit to a model
     * changes every scene that imports it, and an edit can add an import or move a
     * component to another node, so no merge that included it can be trusted. What it
     * cannot do is fetch a newly named import -- nothing here has a network -- so a new
     * import is reported rather than silently ignored.
     */
    replaceFiles(url: string, files: Record<string, string>): { warnings: string[] } {
        const archive = this.archiveAt(url);
        if (!archive) throw new Error("that archive is not open");

        const index = files["index.json"];
        if (index === undefined) throw new Error("an archive needs an index.json");

        const edited = new MosaicFile();
        edited.index = Convert.toMosaicIndexFile(index);

        for (const [name, text] of Object.entries(files)) {
            if (!name.endsWith(".ndjson")) continue;
            edited.serializedComponents.set(name.replace(/\.ndjson$/, ""), text.split("\n"));
        }

        const warnings: string[] = [];
        const had = new Set((archive.alone.index.imports ?? []).map(entry => entry.uri));
        for (const entry of edited.index.imports ?? []) {
            if (!had.has(entry.uri)) {
                warnings.push(`import "${entry.uri}" was added; reload the example to fetch it`);
            }
        }

        // The archive is shared by every graph that holds it, so one change reaches all.
        archive.alone = edited;
        this.remerge(url);

        return { warnings };
    }

    /**
     * Rebuilds every version whose graph has this archive in it -- not only the one that is
     * this archive, but anything that imports it, however far up.
     */
    private remerge(url: string): void {
        for (const tessera of this.held.values()) {
            for (const version of tessera.versions) {
                if (!version.graph.has(url)) continue;
                version.file = mergedFrom(version.graph, version.top);
                version.own = ownNodesOf(version.graph.get(version.top)!.alone);
            }
        }
    }

    /**
     * Sets a node's local transform, the way an editor moving it would.
     *
     * The edit is a layer, not a rewrite: it goes in a section of its own at the end of the
     * archive, written by "mosaic edit", which wins over whatever placed the node before.
     * Moving the same node again changes its row in that section rather than adding
     * another, so however long an editing session runs, it is one section with one
     * transform per node it touched. The reference keeps the id the node's transform
     * already had, which is what makes it replace that transform rather than sit beside it.
     */
    setTransform(
        url: string,
        nodeId: string,
        value: { translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[] },
        by?: string,
    ): void {
        this.setComponent(url, nodeId, CORE_TYPE.transform, value, by);
    }

    /**
     * Sets one component of a node, as an edit layered on top -- what `setTransform` does,
     * for any component type.
     *
     * `by` names who made the edit. Each author's edits go in a section of their own, so
     * when several people edit one archive, who changed what stays readable in it: a run of
     * edits by one author shares a section, and an edit by someone else starts a new one
     * after it. Since the last section wins, the edit applied last is the one that shows.
     * Left out, the edit joins whatever "mosaic edit" section is last.
     *
     * A type the archive has no table for needs a schema to start one, and only the core
     * types' are known here.
     */
    setComponent(url: string, nodeId: string, type: string, value: unknown, by?: string): void {
        const archive = this.archiveAt(url);
        if (!archive) throw new Error("that archive is not open");
        const file = archive.alone;

        // The table, and its schema, if the archive has never had one of these.
        if (!file.serializedComponents.has(type)) file.serializedComponents.set(type, []);
        if (!file.index.componentTables.some(table => table.filename === `${type}.ndjson`)) {
            const schema = (CORE_SCHEMAS as Record<string, unknown>)[type];
            if (schema === undefined) throw new Error(`the archive has no ${type} table, and its schema is not known here`);
            file.index.componentTables.push({ filename: `${type}.ndjson`, type: Type.Ndjson, schema: schema as never });
        }
        const rows = file.serializedComponents.get(type)!;

        const referenceId = this.referenceOf(url, nodeId, type);

        const last = file.index.sections.at(-1);
        let section: SectionElement;
        if (last?.header.application === "mosaic edit" && (by === undefined || last.header.author === by)) {
            section = last;
        } else {
            const before = last?.header;
            section = {
                header: {
                    id: before?.id ?? archive.name,
                    application: "mosaic edit",
                    author: by ?? before?.author ?? "",
                    dataVersion: before?.dataVersion ?? "",
                    timestamp: new Date().toISOString(),
                    message: by === undefined ? "Edited in mosaic edit" : `Edited by ${by} in mosaic edit`,
                },
                nodes: [],
            };
            file.index.sections.push(section);
        }
        section.header.timestamp = new Date().toISOString();

        let node: NodeElement | undefined = section.nodes.find(entry => entry.id === nodeId);
        if (!node) {
            node = { id: nodeId, components: [] };
            section.nodes.push(node);
        }
        node.components ??= [];

        const row = JSON.stringify(value);
        const existing = node.components.find(ref => ref.type === type && ref.id === referenceId);
        if (existing && indexOf(existing) >= 0) {
            rows[indexOf(existing)] = row;
        } else {
            node.components.push({ type, id: referenceId, index: rows.push(row) - 1 });
        }

        this.remerge(url);
    }

    /**
     * An archive with its imports merged underneath: the version's merged file when there
     * is a version on top of it, worked out otherwise.
     */
    private mergedAt(url: string): MosaicFile | undefined {
        for (const tessera of this.held.values()) {
            for (const version of tessera.versions) if (version.top === url) return version.file;
        }
        const graph = this.graphs().find(one => one.has(url));
        return graph ? mergedFrom(graph, url) : undefined;
    }

    /**
     * The reference id a node already gives a component, so that an edit setting it
     * replaces it rather than sitting beside it -- looked up with the imports merged in,
     * since an edit to an imported node goes in the archive that imports it and has to
     * replace what the import gave it. A component the node does not have yet gets an id
     * named for its type.
     */
    referenceOf(url: string, nodeId: string, type: string): string {
        const merged = this.mergedAt(url);
        const current = merged && collapseNodesByPath(merged).get(nodeId)?.components
            ?.find(ref => ref.type === type && operationOf(ref) === Operation.Value);
        return current?.id ?? type.split("::").at(-1)!;
    }

    /** The schema of a component type: as the archive (or an import) declares it, else a core type's. */
    schemaOf(url: string, type: string): unknown {
        const table = this.mergedAt(url)?.index.componentTables.find(one => one.filename === `${type}.ndjson`);
        const schema = table?.schema ?? (CORE_SCHEMAS as Record<string, unknown>)[type];
        if (schema === undefined) throw new Error(`the schema of ${type} is not known here`);
        return schema;
    }

    /** What a node's component reads as now, with every edit and import merged in. */
    valueOf(url: string, nodeId: string, type: string): unknown {
        const merged = this.mergedAt(url);
        const ref = merged && collapseNodesByPath(merged).get(nodeId)?.components
            ?.find(one => one.type === type && operationOf(one) === Operation.Value);
        if (!merged || !ref || indexOf(ref) < 0) return undefined;
        return JSON.parse(merged.readRawComponent(type, indexOf(ref)));
    }

    /**
     * Adds an edit -- an archive of one section, as `EditSession` writes them -- to an
     * archive, as a section of its own.
     *
     * It goes in its place in the order of edits rather than at the end: the edit sections
     * at the end of an archive are kept sorted by `order`, so an edit that arrives late is
     * put before the newer ones it lost to, and since a later section wins, the newest edit
     * shows whatever order they came in. Everyone who adds the same edits ends up with the
     * same archive. Sections without an order -- the original ones, or edits saved without a
     * clock -- are never reordered; edits go after them.
     *
     * Its rows are copied into the archive's tables and its references pointed at them. An
     * edit already here, by section id, is not added twice. Says whether it was added.
     */
    addEdit(
        url: string,
        edit: MosaicFile,
        order: (header: SectionElement["header"]) => { clock: number; author: string; id: string } | undefined,
        compare: (a: { clock: number; author: string; id: string }, b: { clock: number; author: string; id: string }) => number,
    ): boolean {
        const archive = this.archiveAt(url);
        if (!archive) throw new Error("that archive is not open");
        const file = archive.alone;

        const [incoming] = edit.index.sections;
        if (!incoming) return false;
        if (file.index.sections.some(section => section.header.id === incoming.header.id
            && section.header.application === incoming.header.application)) return false;
        const placed = order(incoming.header);
        if (!placed) throw new Error("an edit needs a place in the order");

        // Its rows, into the archive's tables.
        const section: SectionElement = { header: { ...incoming.header }, nodes: [] };
        for (const node of incoming.nodes) {
            const components = [];
            for (const ref of node.components ?? []) {
                if (ref.index === undefined) { components.push({ ...ref }); continue; }
                if (!file.serializedComponents.has(ref.type)) file.serializedComponents.set(ref.type, []);
                if (!file.index.componentTables.some(table => table.filename === `${ref.type}.ndjson`)) {
                    const table = edit.index.componentTables.find(one => one.filename === `${ref.type}.ndjson`);
                    file.index.componentTables.push({
                        filename: `${ref.type}.ndjson`, type: Type.Ndjson,
                        schema: table?.schema ?? this.schemaOf(url, ref.type),
                    });
                }
                const row = edit.serializedComponents.get(ref.type)?.[ref.index];
                if (row === undefined) throw new Error(`the edit's ${ref.type} row ${ref.index} is missing`);
                components.push({ ...ref, index: file.serializedComponents.get(ref.type)!.push(row) - 1 });
            }
            section.nodes.push({ id: node.id, components });
        }

        // Its place: after every section that comes before it.
        let at = file.index.sections.length;
        while (at > 0) {
            const before = order(file.index.sections[at - 1]!.header);
            if (!before || compare(before, placed) < 0) break;
            at--;
        }
        file.index.sections.splice(at, 0, section);

        this.remerge(url);
        return true;
    }

    /**
     * How much has been edited, across every archive open: the sections editing wrote
     * ("mosaic edit"), the nodes they touch, and their size in bytes -- the sections as JSON
     * plus the table rows they point at, which is roughly what `mosaic diff` would keep.
     */
    editStats(): { sections: number; nodes: number; bytes: number } {
        const encoder = new TextEncoder();
        let sections = 0, nodes = 0, bytes = 0;
        const seen = new Set<LoadedArchive>();
        for (const graph of this.graphs()) {
            for (const archive of graph.values()) {
                if (seen.has(archive)) continue;
                seen.add(archive);
                for (const section of archive.alone.index.sections) {
                    if (section.header.application !== "mosaic edit") continue;
                    sections++;
                    nodes += section.nodes.length;
                    bytes += encoder.encode(JSON.stringify(section)).byteLength;
                    for (const node of section.nodes) {
                        for (const ref of node.components ?? []) {
                            const row = archive.alone.serializedComponents.get(ref.type)?.[indexOf(ref)];
                            if (row !== undefined) bytes += encoder.encode(row).byteLength + 1;
                        }
                    }
                }
            }
        }
        return { sections, nodes, bytes };
    }

    /**
     * The archive an edit to a node belongs in: the top of the newest version of whichever
     * tessera has the node -- written there itself if one does, or reached through an
     * import otherwise. An edit to an imported node goes in the archive that imports it, as
     * a layer over the import, so the imported file is left as it is.
     */
    archiveOf(nodeId: string): string | undefined {
        let reached: string | undefined;
        for (const tessera of this.held.values()) {
            const newest = tessera.versions.at(-1);
            if (!newest) continue;
            if (newest.own.has(nodeId)) return newest.top;
            reached ??= newest.file.index.sections.some(section => section.nodes.some(node => node.id === nodeId))
                ? newest.top : undefined;
        }
        return reached;
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
