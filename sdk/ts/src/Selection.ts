import { MosaicFile } from "./MosaicFile.ts";
import type { ComponentElement, NodeElement } from "./MosaicIndexFile.ts";
import { collapseNodesByPath } from "./MosaicFileOperations.ts";
import { hasValue, indexOf } from "./ComponentReference.ts";
import { CORE_TYPE } from "./core/schemas.ts";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export interface SelectionRequest {
    /** The nodes to take, by id. */
    nodes: string[];
    /** Only these component types. All of them when left out or empty. */
    componentTypes?: string[];
    /** Take everything beneath them, however deep. */
    includeChildren?: boolean;
}

export interface SelectionResult {
    file: MosaicFile;
    /** The nodes that ended up in it, in the order they were reached. */
    nodeIds: string[];
    /** Ids that were asked for but are not in the file. */
    missing: string[];
    /** Nodes pulled in because something kept refers to them. */
    pulledIn: string[];
}

/** Every node id mentioned anywhere inside a component's value. */
function referencedIds(value: unknown, into: Set<string>): void {
    if (typeof value === "string") {
        if (UUID.test(value)) into.add(value);
        return;
    }
    if (Array.isArray(value)) return value.forEach(entry => referencedIds(entry, into));
    if (value && typeof value === "object") {
        for (const entry of Object.values(value)) referencedIds(entry, into);
    }
}

/**
 * Takes a subset of a file: some nodes, some of their components, and optionally whatever
 * hangs beneath them.
 *
 * What comes back is a file in its own right, not a view of the original. That means a
 * reference in it has to resolve in it, so anything a kept component points at is pulled
 * in too -- an accessor named by a mesh, the bufferView it reads, the buffer beneath that.
 * Without it a subset could name geometry it did not carry, and neither an archive nor a
 * GLB built from it would be readable.
 *
 * The file is collapsed first, so what is taken is the leading state rather than the
 * layers that produced it.
 */
export function selectNodes(source: MosaicFile, request: SelectionRequest): SelectionResult {
    const collapsed = collapseNodesByPath(source);
    const wanted = request.componentTypes && request.componentTypes.length > 0
        ? new Set(request.componentTypes)
        : undefined;

    const missing = request.nodes.filter(id => !collapsed.has(id));
    const chosen: string[] = [];
    const seen = new Set<string>();

    const take = (id: string) => {
        if (seen.has(id) || !collapsed.has(id)) return;
        seen.add(id);
        chosen.push(id);
    };

    for (const id of request.nodes) take(id);

    // --- children, however deep ---------------------------------------------
    if (request.includeChildren) {
        for (let at = 0; at < chosen.length; at++) {
            const node = collapsed.get(chosen[at]!)!;
            for (const reference of node.components ?? []) {
                if (reference.type === CORE_TYPE.child) take(reference.id);
            }
        }
    }

    /** The components of a node that this selection keeps. */
    const keptComponents = (node: NodeElement, filtered: boolean): ComponentElement[] =>
        (node.components ?? []).filter(reference => {
            if (!filtered || !wanted) return true;
            // A child link is what the hierarchy is made of, so it stays whenever the
            // children were asked for, whatever else was filtered out.
            if (request.includeChildren && reference.type === CORE_TYPE.child) return true;
            return wanted.has(reference.type);
        });

    // --- whatever the kept components point at -------------------------------
    const asked = new Set(chosen);
    const pulledIn: string[] = [];

    for (let at = 0; at < chosen.length; at++) {
        const id = chosen[at]!;
        const node = collapsed.get(id)!;
        const references = new Set<string>();

        for (const reference of keptComponents(node, asked.has(id))) {
            if (!hasValue(reference)) continue;
            try {
                referencedIds(JSON.parse(source.readRawComponent(reference.type, indexOf(reference))), references);
            } catch {
                // A component that cannot be read points at nothing that can be followed.
            }
        }

        for (const referenced of references) {
            if (seen.has(referenced) || !collapsed.has(referenced)) continue;
            take(referenced);
            pulledIn.push(referenced);
        }
    }

    // --- build the file ------------------------------------------------------
    const file = new MosaicFile();
    file.index.header = { ...source.index.header };

    const schemas = new Map(source.index.componentTables.map(table => [table.filename.replace(/\.ndjson$/i, ""), table]));
    const usedTypes = new Set<string>();
    const nodes: NodeElement[] = [];

    for (const id of chosen) {
        const node = collapsed.get(id)!;
        const components: ComponentElement[] = [];

        // A node pulled in for its data keeps everything it has; a node that was asked for
        // keeps what the request asked for.
        for (const reference of keptComponents(node, asked.has(id))) {
            usedTypes.add(reference.type);

            if (!hasValue(reference)) {
                components.push({ ...reference });
                continue;
            }

            const row = source.readRawComponent(reference.type, indexOf(reference));
            components.push({ ...reference, index: file.addSerializedComponent(reference.type, row) });
        }

        nodes.push({ id, components });
    }

    for (const type of [...usedTypes].sort()) {
        const table = schemas.get(type);
        file.index.componentTables.push({
            filename: `${type}.ndjson`,
            type: table?.type ?? source.index.componentTables[0]?.type ?? ("NDJSON" as never),
            schema: table?.schema ?? {},
        });
    }

    const provenance = source.index.sections.at(-1)?.header;
    file.index.sections.push({
        header: {
            id: provenance?.id ?? "selection",
            message: `A selection of ${nodes.length} node(s)`,
            dataVersion: provenance?.dataVersion ?? "1.0.0",
            author: provenance?.author ?? "",
            timestamp: new Date().toISOString(),
            application: "mosaic",
        },
        nodes,
    });

    return { file, nodeIds: chosen, missing, pulledIn };
}
