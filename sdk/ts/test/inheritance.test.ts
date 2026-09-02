import test from "node:test";
import assert from "node:assert/strict";
import type { ComponentElement, NodeElement } from "../src/MosaicIndexFile.ts";
import { resolveInheritance } from "../src/composition/Inheritance.ts";
import { CORE_TYPE } from "../src/core/schemas.ts";

/** A reference that points at a row. */
function ref(id: string, type: string, index: number): ComponentElement {
    return { type, id, index };
}

/** An is-a link: no value, the id names the node to inherit from. */
function inherits(nodeId: string): ComponentElement {
    return { type: CORE_TYPE.inherit, id: nodeId };
}

function graph(...nodes: NodeElement[]): Map<string, NodeElement> {
    return new Map(nodes.map(node => [node.id, node]));
}

/** The reference ids a node ends up carrying, and where each came from. */
function componentsOf(resolved: Map<string, NodeElement>, id: string): Record<string, string> {
    return Object.fromEntries((resolved.get(id)!.components ?? []).map(c => [c.id, `${c.type}[${c.index ?? -1}]`]));
}

test("a node receives the components of the node it inherits", () => {
    const resolved = resolveInheritance(graph(
        { id: "chair", components: [ref("mesh", "khronos::gltf::meshPrimitive", 0), ref("material", "khronos::gltf::material", 0)] },
        { id: "seat-1", components: [inherits("chair"), ref("transform", CORE_TYPE.transform, 0)] },
    ));

    assert.deepEqual(componentsOf(resolved, "seat-1"), {
        chair: "core::inherit[-1]",
        transform: "core::transform[0]",
        mesh: "khronos::gltf::meshPrimitive[0]",
        material: "khronos::gltf::material[0]",
    });
});

test("the node it is inherited from is left as it was", () => {
    const chair: NodeElement = { id: "chair", components: [ref("mesh", "khronos::gltf::meshPrimitive", 0)] };
    const resolved = resolveInheritance(graph(chair, { id: "seat-1", components: [inherits("chair")] }));

    assert.deepEqual(componentsOf(resolved, "chair"), { mesh: "khronos::gltf::meshPrimitive[0]" });
    assert.deepEqual(chair.components!.map(c => c.id), ["mesh"], "the input is not mutated");
});

test("a component the node carries itself beats the inherited one", () => {
    const resolved = resolveInheritance(graph(
        { id: "chair", components: [ref("mesh", "khronos::gltf::meshPrimitive", 0), ref("material", "khronos::gltf::material", 0)] },
        // Same reference id, a different row: the node's own material wins.
        { id: "red-seat", components: [ref("material", "khronos::gltf::material", 7), inherits("chair")] },
    ));

    assert.equal(componentsOf(resolved, "red-seat").material, "khronos::gltf::material[7]");
    assert.equal(componentsOf(resolved, "red-seat").mesh, "khronos::gltf::meshPrimitive[0]");
});

test("own components win wherever the inherit link is written", () => {
    // The link comes first here, and the outcome is the same: position does not decide.
    const resolved = resolveInheritance(graph(
        { id: "chair", components: [ref("material", "khronos::gltf::material", 0)] },
        { id: "red-seat", components: [inherits("chair"), ref("material", "khronos::gltf::material", 7)] },
    ));

    assert.equal(componentsOf(resolved, "red-seat").material, "khronos::gltf::material[7]");
});

test("inheriting from several nodes takes from each of them", () => {
    const resolved = resolveInheritance(graph(
        { id: "shape", components: [ref("mesh", "khronos::gltf::meshPrimitive", 0)] },
        { id: "finish", components: [ref("material", "khronos::gltf::material", 0)] },
        { id: "thing", components: [inherits("shape"), inherits("finish")] },
    ));

    assert.equal(componentsOf(resolved, "thing").mesh, "khronos::gltf::meshPrimitive[0]");
    assert.equal(componentsOf(resolved, "thing").material, "khronos::gltf::material[0]");
});

test("between two inherited nodes, the one named first wins", () => {
    const resolved = resolveInheritance(graph(
        { id: "first", components: [ref("material", "khronos::gltf::material", 1)] },
        { id: "second", components: [ref("material", "khronos::gltf::material", 2)] },
        { id: "thing", components: [inherits("first"), inherits("second")] },
        { id: "other", components: [inherits("second"), inherits("first")] },
    ));

    assert.equal(componentsOf(resolved, "thing").material, "khronos::gltf::material[1]");
    assert.equal(componentsOf(resolved, "other").material, "khronos::gltf::material[2]");
});

test("inheritance is followed through a chain", () => {
    const resolved = resolveInheritance(graph(
        { id: "furniture", components: [ref("category", "acme::meta", 0)] },
        { id: "chair", components: [inherits("furniture"), ref("mesh", "khronos::gltf::meshPrimitive", 0)] },
        { id: "seat-1", components: [inherits("chair"), ref("transform", CORE_TYPE.transform, 0)] },
    ));

    const seat = componentsOf(resolved, "seat-1");
    assert.equal(seat.transform, "core::transform[0]", "its own");
    assert.equal(seat.mesh, "khronos::gltf::meshPrimitive[0]", "from the chair");
    assert.equal(seat.category, "acme::meta[0]", "and from furniture, two links away");
});

test("a link further up the chain comes along, so is-a can be asked of one node", () => {
    const resolved = resolveInheritance(graph(
        { id: "furniture", components: [] },
        { id: "chair", components: [inherits("furniture")] },
        { id: "seat-1", components: [inherits("chair")] },
    ));

    const links = (resolved.get("seat-1")!.components ?? []).filter(c => c.type === CORE_TYPE.inherit);
    assert.deepEqual(links.map(c => c.id).sort(), ["chair", "furniture"]);
});

test("a middle link that overrides shields what it inherited", () => {
    const resolved = resolveInheritance(graph(
        { id: "furniture", components: [ref("material", "khronos::gltf::material", 1)] },
        { id: "chair", components: [inherits("furniture"), ref("material", "khronos::gltf::material", 2)] },
        { id: "seat-1", components: [inherits("chair")] },
    ));

    assert.equal(componentsOf(resolved, "seat-1").material, "khronos::gltf::material[2]");
});

test("a node inheriting nothing is left alone", () => {
    const resolved = resolveInheritance(graph(
        { id: "plain", components: [ref("mesh", "khronos::gltf::meshPrimitive", 0)] },
        { id: "bare" },
    ));

    assert.deepEqual(componentsOf(resolved, "plain"), { mesh: "khronos::gltf::meshPrimitive[0]" });
    assert.equal(resolved.get("bare")!.components, undefined);
});

test("inheriting from a node that is not there is reported and skipped", () => {
    const warnings: string[] = [];
    const resolved = resolveInheritance(graph(
        { id: "seat-1", components: [inherits("missing"), ref("transform", CORE_TYPE.transform, 0)] },
    ), warnings);

    assert.ok(warnings.some(w => w.includes("no such node is present")), warnings.join("; "));
    assert.equal(componentsOf(resolved, "seat-1").transform, "core::transform[0]");
});

test("a node inheriting from itself is reported and skipped", () => {
    const warnings: string[] = [];
    const resolved = resolveInheritance(graph(
        { id: "seat-1", components: [inherits("seat-1"), ref("transform", CORE_TYPE.transform, 0)] },
    ), warnings);

    assert.ok(warnings.some(w => w.includes("inherits from itself")), warnings.join("; "));
    assert.equal(componentsOf(resolved, "seat-1").transform, "core::transform[0]");
});

test("inheritance that forms a cycle is refused, naming the path", () => {
    assert.throws(
        () => resolveInheritance(graph(
            { id: "a", components: [inherits("b")] },
            { id: "b", components: [inherits("c")] },
            { id: "c", components: [inherits("a")] },
        )),
        /Inheritance forms a cycle: a -> b -> c -> a/,
    );
});

test("a diamond takes each component once", () => {
    const resolved = resolveInheritance(graph(
        { id: "base", components: [ref("category", "acme::meta", 0)] },
        { id: "left", components: [inherits("base"), ref("mesh", "khronos::gltf::meshPrimitive", 0)] },
        { id: "right", components: [inherits("base"), ref("material", "khronos::gltf::material", 0)] },
        { id: "thing", components: [inherits("left"), inherits("right")] },
    ));

    const ids = (resolved.get("thing")!.components ?? []).map(c => c.id);
    assert.equal(new Set(ids).size, ids.length, "no component should be taken twice");
    assert.equal(componentsOf(resolved, "thing").category, "acme::meta[0]");
    assert.equal(componentsOf(resolved, "thing").mesh, "khronos::gltf::meshPrimitive[0]");
    assert.equal(componentsOf(resolved, "thing").material, "khronos::gltf::material[0]");
});
