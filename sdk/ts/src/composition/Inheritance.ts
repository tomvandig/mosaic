import type { ComponentElement, NodeElement } from "../MosaicIndexFile.ts";
import { CORE_TYPE } from "../core/schemas.ts";

/**
 * Resolves `core::inherit` links, which say that one node *is a* kind of another.
 *
 * A node that inherits receives every component of the node it names, except where it
 * already carries one under the same reference id -- its own always wins. Unlike a
 * `core::child` link, this changes the node itself rather than what hangs beneath it, so
 * a node can take its shape, material and transform from a node that stands for a type
 * and then override just the parts that differ.
 *
 * A node may inherit from several nodes, and from a node that itself inherits. Where two
 * inherited nodes offer the same reference id, the one named first wins, so the order the
 * links are written in decides. Inheritance is resolved depth first, so a node inherits
 * what its parent inherited too, and the `core::inherit` references come along with it --
 * which is what lets "everything that is a Chair" be answered by looking at one node.
 *
 * This happens when composing, never when packing or importing: a Mosaic file always
 * records what was written, and the expansion is a view of it.
 */
export function resolveInheritance(
    nodes: Map<string, NodeElement>,
    warnings: string[] = [],
): Map<string, NodeElement> {
    const resolved = new Map<string, ComponentElement[]>();
    const resolving: string[] = [];

    function componentsOf(id: string): ComponentElement[] {
        const done = resolved.get(id);
        if (done) return done;

        const loop = resolving.indexOf(id);
        if (loop !== -1) {
            throw new Error(`Inheritance forms a cycle: ${[...resolving.slice(loop), id].join(" -> ")}`);
        }

        const node = nodes.get(id);
        if (!node) return [];

        resolving.push(id);

        const own = node.components ?? [];
        // The node's own components are settled first, so nothing inherited can displace
        // them; the id of a reference is what two components clash over.
        const merged = [...own];
        const taken = new Set(own.map(ref => ref.id));

        for (const link of own.filter(ref => ref.type === CORE_TYPE.inherit)) {
            if (link.id === id) {
                warnings.push(`node ${id} inherits from itself; the link was ignored`);
                continue;
            }
            if (!nodes.has(link.id)) {
                warnings.push(`node ${id} inherits from ${link.id}, but no such node is present`);
                continue;
            }

            for (const inherited of componentsOf(link.id)) {
                if (taken.has(inherited.id)) continue;
                merged.push({ ...inherited });
                taken.add(inherited.id);
            }
        }

        resolving.pop();
        resolved.set(id, merged);
        return merged;
    }

    const out = new Map<string, NodeElement>();
    for (const [id, node] of nodes) {
        const components = componentsOf(id);
        out.set(id, components.length > 0 ? { ...node, components } : { ...node });
    }

    return out;
}
