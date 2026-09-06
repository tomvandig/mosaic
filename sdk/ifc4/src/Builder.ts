import type { ComponentElement, NodeElement } from "mosaic-ts";

/**
 * The document being built, as a pile of component rows and the nodes referencing them.
 *
 * Two things here are worth knowing. Rows are shared: `addRow` returns an index, and any
 * number of nodes may point at it, which is how one property set defines four hundred
 * elements without being written four hundred times. And a reference name has to be unique
 * within its node, so `NodeRecord.hold` says whether the name was free rather than
 * silently producing an archive that will not load.
 */
export class NodeRecord {
    readonly refs: ComponentElement[] = [];
    private readonly taken = new Set<string>();

    constructor(readonly id: string) {}

    /** True when nothing on this node has claimed `name` yet. */
    free(name: string): boolean {
        return !this.taken.has(name);
    }

    /**
     * Adds a reference. `index` is left off for a component that carries no value, where
     * the name is the whole of it -- a child link, a name, an is-a.
     *
     * Returns false, having added nothing, when the name is already taken.
     */
    hold(type: string, name: string, index?: number): boolean {
        if (this.taken.has(name)) return false;

        this.taken.add(name);
        this.refs.push(index === undefined ? { type, id: name } : { type, id: name, index });
        return true;
    }
}

export class MosaicBuilder {
    /** typeID -> rows, in the order they were added. */
    readonly components = new Map<string, unknown[]>();
    private readonly byId = new Map<string, NodeRecord>();
    readonly warnings: string[] = [];

    /** Adds a component row and returns the index a reference points at. */
    addRow(typeID: string, row: unknown): number {
        const rows = this.components.get(typeID);
        if (rows) return rows.push(row) - 1;

        this.components.set(typeID, [row]);
        return 0;
    }

    /** The node with this id, made on first use. */
    node(id: string): NodeRecord {
        const existing = this.byId.get(id);
        if (existing) return existing;

        const made = new NodeRecord(id);
        this.byId.set(id, made);
        return made;
    }

    has(id: string): boolean {
        return this.byId.has(id);
    }

    warn(message: string): void {
        this.warnings.push(message);
    }

    /** Every node made, in the order they were first touched. */
    nodes(): NodeElement[] {
        return [...this.byId.values()].map(record => ({ id: record.id, components: record.refs }));
    }

    get nodeCount(): number {
        return this.byId.size;
    }

    /** Rows written, by component type -- what the CLI reports. */
    counts(): Record<string, number> {
        return Object.fromEntries([...this.components].map(([typeID, rows]) => [typeID, rows.length]));
    }
}
