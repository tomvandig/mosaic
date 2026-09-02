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

function mergeComponents(oldList: ComponentElement[], newList: ComponentElement[]): ComponentElement[] {
    for (const item of newList) {
        const idx = oldList.findIndex(x => x.id === item.id);
        const operation = operationOf(item);

        if (idx === -1) {
            if (operation === Operation.Value) {
                oldList.push({ ...item });
            }
        } else {
            if (operation === Operation.Delete) {
                oldList.splice(idx, 1);
            } else if (operation === Operation.Value) {
                oldList[idx] = { ...item };
            }
        }
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

function diffNodes(oldNode: NodeElement, newNode: NodeElement, markMissingFromNewAsDelete: boolean): NodeElement {
    const result: NodeElement = {
        id: oldNode.id ?? newNode.id,
        components: [],
    };

    // components
    for (const item of (newNode.components ?? [])) {
        const match = (oldNode.components ?? []).find(x => x.id === item.id);
        if (!match) {
            result.components!.push(item);
        } else if (indexOf(match) !== indexOf(item) || match.type !== item.type) {
            result.components!.push(item);
        }
    }
    if (markMissingFromNewAsDelete) {
        for (const item of (oldNode.components ?? [])) {
            if (!(newNode.components ?? []).find(x => x.id === item.id)) {
                result.components!.push({ id: item.id, operation: Operation.Delete, type: "", index: 0 });
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
