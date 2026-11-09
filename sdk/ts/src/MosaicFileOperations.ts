import {
    Operation,
    type ComponentElement,
    type NodeElement,
    type SectionElement,
    type SectionHeader,
} from './MosaicIndexFile.ts';
import { MosaicFile } from './MosaicFile.ts';
import { hasValue, indexOf, operationOf } from './ComponentReference.ts';

// ---------------------------------------------------------------------------
// Merge: applies newNode onto oldNode in-place (operation-aware)
// ---------------------------------------------------------------------------

/**
 * Applies one node's components onto another's, in place.
 *
 * Two components clash when they share a reference id, so the work is finding the one
 * already there with the same id. That lookup is a map rather than a scan: a node can hold
 * a great many components -- a converted IFC model hangs every buffer and accessor off one
 * parent, which is hundreds of thousands of child links on a single node -- and scanning
 * the list for each of them made this quadratic in the width of the widest node.
 *
 * A delete leaves a hole rather than splicing, which would move every position after it;
 * the holes are closed once at the end, so order is what it would have been.
 */
function mergeComponents(oldList: ComponentElement[], newList: ComponentElement[]): ComponentElement[] {
    const positions = new Map<string, number>();
    for (const [index, existing] of oldList.entries()) {
        // First one wins, which is what scanning from the front used to do.
        if (!positions.has(existing.id)) positions.set(existing.id, index);
    }

    const removed = new Set<number>();

    for (const item of newList) {
        const at = positions.get(item.id);
        const operation = operationOf(item);

        if (at === undefined) {
            if (operation === Operation.Value) {
                positions.set(item.id, oldList.length);
                oldList.push({ ...item });
            }
        } else if (operation === Operation.Delete) {
            removed.add(at);
            positions.delete(item.id);
        } else if (operation === Operation.Value) {
            oldList[at] = { ...item };
        }
    }

    if (removed.size > 0) {
        let write = 0;
        for (let read = 0; read < oldList.length; read++) {
            if (!removed.has(read)) oldList[write++] = oldList[read]!;
        }
        oldList.length = write;
    }

    return oldList;
}

function merge(oldNode: NodeElement, newNode: NodeElement): void {
    mergeComponents(oldNode.components ??= [], newNode.components ?? []);
}

// ---------------------------------------------------------------------------
// CollapseNodesByPath
// ---------------------------------------------------------------------------

export function collapseNodesByPath(file: MosaicFile): Map<string, NodeElement> {
    const nodes = new Map<string, NodeElement>();

    for (const sec of file.index.sections) {
        for (const node of sec.nodes) {
            if (!nodes.has(node.id)) {
                nodes.set(node.id, { id: node.id, components: [] });
            }
            merge(nodes.get(node.id)!, node);
        }
    }

    return nodes;
}

// ---------------------------------------------------------------------------
// DiffNodes / DiffFiles
// ---------------------------------------------------------------------------

/** Whether two references, of the same id, say the same thing. */
type SameComponent = (oldRef: ComponentElement, newRef: ComponentElement) => boolean;

/** Two references are the same when they point at the same row: right within one file's tables. */
const sameRow: SameComponent = (a, b) => indexOf(a) === indexOf(b) && a.type === b.type;

function diffNodes(
    oldNode: NodeElement,
    newNode: NodeElement,
    markMissingFromNewAsDelete: boolean,
    same: SameComponent = sameRow,
): NodeElement {
    const result: NodeElement = {
        id: oldNode.id ?? newNode.id,
        components: [],
    };

    // components
    for (const item of (newNode.components ?? [])) {
        const match = (oldNode.components ?? []).find(x => x.id === item.id);
        if (!match || !same(match, item)) {
            result.components!.push(item);
        }
    }
    if (markMissingFromNewAsDelete) {
        for (const item of (oldNode.components ?? [])) {
            if (!(newNode.components ?? []).find(x => x.id === item.id)) {
                // A delete carries no value, so no index; the type says what is going.
                result.components!.push({ id: item.id, type: item.type, operation: Operation.Delete });
            }
        }
    }

    return result;
}

export function diffFiles(oldFile: MosaicFile, newFile: MosaicFile, markMissingFromNewAsDelete: boolean): SectionElement {
    const oldNodes = collapseNodesByPath(oldFile);
    const newNodes = collapseNodesByPath(newFile);

    const emptyHeader: SectionHeader = { id: '', application: '', author: '', dataVersion: '', timestamp: '', message: '' };
    const result: SectionElement = { header: emptyHeader, nodes: [] };

    for (const [key, newNode] of newNodes) {
        const oldNode = oldNodes.get(key);
        result.nodes.push(diffNodes(oldNode ?? { id: key, components: [] }, newNode, markMissingFromNewAsDelete));
    }

    if (markMissingFromNewAsDelete) {
        for (const [key, oldNode] of oldNodes) {
            if (!newNodes.has(key)) {
                result.nodes.push(diffNodes(oldNode, { id: key, components: [] }, markMissingFromNewAsDelete));
            }
        }
    }

    result.nodes = result.nodes.filter(n =>
        (n.components?.length ?? 0) > 0
    );

    return result;
}

// ---------------------------------------------------------------------------
// DiffArchives: the changes between two independent files, as a file
// ---------------------------------------------------------------------------

export interface DiffArchivesOptions {
    /**
     * Write a DELETE for every component, and every node, the old file has and the new one
     * does not. On by default: without them, applying the diff can add and change but never
     * take anything away.
     */
    deletes?: boolean;
    /** The provenance of the section the diff is written as. */
    header?: Partial<SectionHeader>;
}

/** A row as a value: key order and spacing do not make two rows different. */
function canonical(raw: string): string {
    const sorted = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(sorted);
        if (value !== null && typeof value === "object") {
            return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted((value as Record<string, unknown>)[key])]));
        }
        return value;
    };
    try {
        return JSON.stringify(sorted(JSON.parse(raw)));
    } catch {
        return raw;
    }
}

/**
 * The changes that turn one file into another, as a file of its own.
 *
 * `diffFiles` compares references by the row they point at, which is right when the newer
 * file is the older one with sections added, since they share their tables. Two archives
 * packed apart do not: each numbers its own rows, so the same value can sit at different
 * rows and different values at the same one. This compares what the rows hold instead,
 * then copies the rows the changes need into a file that stands alone -- one section,
 * the new file's schemas for the types it carries, and the new file's imports.
 *
 * Applying it is federating it over the old file: `federate(old, diff, true)` reads, node
 * for node and component for component, the same as `newFile`.
 */
export function diffArchives(oldFile: MosaicFile, newFile: MosaicFile, options: DiffArchivesOptions = {}): MosaicFile {
    const deletes = options.deletes ?? true;
    const oldNodes = collapseNodesByPath(oldFile);
    const newNodes = collapseNodesByPath(newFile);

    const valueOf = (file: MosaicFile, ref: ComponentElement) =>
        hasValue(ref) ? canonical(file.readRawComponent(ref.type, indexOf(ref))) : undefined;

    const sameValue: SameComponent = (oldRef, newRef) =>
        oldRef.type === newRef.type
        && hasValue(oldRef) === hasValue(newRef)
        && valueOf(oldFile, oldRef) === valueOf(newFile, newRef);

    const changed: NodeElement[] = [];
    for (const [id, newNode] of newNodes) {
        changed.push(diffNodes(oldNodes.get(id) ?? { id, components: [] }, newNode, deletes, sameValue));
    }
    if (deletes) {
        for (const [id, oldNode] of oldNodes) {
            if (!newNodes.has(id)) changed.push(diffNodes(oldNode, { id, components: [] }, true, sameValue));
        }
    }

    // The rows the changes point at, copied out of the new file into this one.
    const result = new MosaicFile();
    result.index.header = { ...newFile.index.header };
    result.index.imports = newFile.index.imports.map(entry => ({ ...entry }));

    const nodes: NodeElement[] = [];
    for (const node of changed) {
        if ((node.components?.length ?? 0) === 0) continue;

        nodes.push({
            id: node.id,
            components: node.components!.map(ref => {
                if (operationOf(ref) !== Operation.Value || !hasValue(ref)) return { ...ref };
                const index = result.addSerializedComponent(ref.type, newFile.readRawComponent(ref.type, indexOf(ref)));
                return { ...ref, index };
            }),
        });
    }

    for (const type of result.serializedComponents.keys()) {
        const table = newFile.index.componentTables.find(entry => entry.filename === `${type}.ndjson`);
        if (table) result.index.componentTables.push({ ...table });
    }

    const latest = newFile.index.sections.at(-1)?.header;
    result.AddSection({
        header: {
            id: latest?.id ?? "",
            application: "mosaic diff",
            author: latest?.author ?? "",
            dataVersion: latest?.dataVersion ?? "",
            timestamp: new Date().toISOString(),
            message: "Changes",
            ...options.header,
        },
        nodes,
    });

    return result;
}

// ---------------------------------------------------------------------------
// Federate
// ---------------------------------------------------------------------------

interface NodeLineage {
    fromNew: boolean;
    header: SectionHeader;
    node: NodeElement;
}

export function federate(oldFile: MosaicFile, newFile: MosaicFile, keepHistory: boolean): MosaicFile {
    const result = new MosaicFile();
    result.index.header = newFile.index.header;
    result.index.imports = newFile.index.imports;
    result.index.componentTables = [...oldFile.index.componentTables, ...newFile.index.componentTables];
    // TODO: deduplicate component tables by filename

    if (keepHistory) {
        // Append change to old file, keeping all history

        for (const sec of oldFile.index.sections) {
            result.AddSection(sec);
        }

        for (const [typeID, components] of oldFile.serializedComponents) {
            for (const component of components) {
                result.addSerializedComponent(typeID, component);
            }
        }

        for (const sec of newFile.index.sections) {
            const newSection: SectionElement = { header: sec.header, nodes: [] };

            for (const node of sec.nodes) {
                const newNode: NodeElement = {
                    id: node.id,
                    components: [],
                };

                for (const componentRef of (node.components ?? [])) {
                    if (!hasValue(componentRef)) {
                        // Nothing to copy: the reference says all it has to say in its id.
                        newNode.components!.push({ ...componentRef });
                        continue;
                    }

                    const component = newFile.readRawComponent(componentRef.type, indexOf(componentRef));
                    const newIndex = result.addSerializedComponent(componentRef.type, component);
                    newNode.components!.push({ ...componentRef, index: newIndex });
                }

                newSection.nodes.push(newNode);
            }

            result.AddSection(newSection);
        }
    } else {
        // Collapse: remove historical data that is no longer leading

        const pathToNodes = new Map<string, NodeLineage[]>();

        for (const sec of oldFile.index.sections) {
            for (const node of sec.nodes) {
                if (!pathToNodes.has(node.id)) pathToNodes.set(node.id, []);
                pathToNodes.get(node.id)!.push({ fromNew: false, header: sec.header, node });
            }
        }
        for (const sec of newFile.index.sections) {
            for (const node of sec.nodes) {
                if (!pathToNodes.has(node.id)) pathToNodes.set(node.id, []);
                pathToNodes.get(node.id)!.push({ fromNew: true, header: sec.header, node });
            }
        }

        const idToSection = new Map<string, SectionElement>();

        for (const [, lineages] of pathToNodes) {
            const allComponents: string[] = [];

            // Walk backwards: newest first, so first-seen = winner
            for (let i = lineages.length - 1; i >= 0; i--) {
                const { fromNew, header, node } = lineages[i]!;
                const resultNode: NodeElement = { id: node.id, components: [] };

                for (const componentRef of (node.components ?? [])) {
                    if (!allComponents.includes(componentRef.id)) {
                        if (operationOf(componentRef) !== Operation.PassThrough) {
                            if (operationOf(componentRef) === Operation.Value && hasValue(componentRef)) {
                                const sourceFile = fromNew ? newFile : oldFile;
                                const component = sourceFile.readRawComponent(componentRef.type, indexOf(componentRef));
                                // Collapsing drops superseded rows, so the reference has to
                                // follow the row to its position in the new component table.
                                const newIndex = result.addSerializedComponent(componentRef.type, component);
                                resultNode.components!.push({ ...componentRef, index: newIndex });
                            } else {
                                resultNode.components!.push(componentRef);
                            }
                        }
                        allComponents.push(componentRef.id);
                    }
                }

                if (!idToSection.has(header.id)) {
                    idToSection.set(header.id, { header, nodes: [] });
                }
                idToSection.get(header.id)!.nodes.push(resultNode);
            }
        }

        for (const [, sec] of idToSection) {
            sec.nodes = sec.nodes.filter(n =>
                (n.components?.length ?? 0) > 0
            );
            if (sec.nodes.length > 0) {
                result.AddSection(sec);
            }
        }
    }

    return result;
}
