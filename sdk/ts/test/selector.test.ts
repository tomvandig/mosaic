import test from "node:test";
import assert from "node:assert/strict";
import { LoadMosaicFile } from "../src/MosaicFile.ts";
import { packMosaicSource } from "../src/MosaicPack.ts";
import { parseSelector, buildNodeFacts, selectNodes } from "../src/core/Selector.ts";
import { GLTF_TYPE } from "../src/gltf/schemas.ts";
import { readExample, resolveExampleSchema } from "./fixtures.ts";

const WALL_FRONT = "55555555-5555-4555-8555-555555555555";
const WALL_SIDE = "66666666-6666-4666-8666-666666666666";

async function boxFacts() {
    const file = await LoadMosaicFile(await packMosaicSource(readExample("gltf-box"), resolveExampleSchema));
    return buildNodeFacts(file);
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

test("a bare uuid is the id of a node, so plain ids stay valid selectors", () => {
    assert.deepEqual(parseSelector(WALL_FRONT).simples, [{ kind: "id", value: WALL_FRONT }]);
    assert.deepEqual(parseSelector(`#${WALL_FRONT}`).simples, [{ kind: "id", value: WALL_FRONT }]);
});

test("the pieces of a compound selector all have to hold", () => {
    const parsed = parseSelector('.mesh[name="Brick"]');

    assert.deepEqual(parsed.simples, [
        { kind: "componentName", value: "mesh" },
        { kind: "attribute", key: "name", operator: "=", value: "Brick" },
    ]);
});

test("a bare token is a component type, the way a bare token is a tag in CSS", () => {
    assert.deepEqual(parseSelector(GLTF_TYPE.meshPrimitive).simples, [
        { kind: "componentType", value: GLTF_TYPE.meshPrimitive },
    ]);
});

test("a namespace-style prefix scopes the match to one section", () => {
    const parsed = parseSelector("DamagedHelmet.glb|.mesh");

    assert.equal(parsed.scope, "DamagedHelmet.glb");
    assert.deepEqual(parsed.simples, [{ kind: "componentName", value: "mesh" }]);
});

test("the substring operators parse", () => {
    for (const [text, operator] of [["^=", "^="], ["$=", "$="], ["*=", "*="], ["=", "="]] as const) {
        const parsed = parseSelector(`[name${text}"wall"]`);
        assert.deepEqual(parsed.simples, [{ kind: "attribute", key: "name", operator, value: "wall" }]);
    }
});

test("a backslash escapes a dot inside a component name", () => {
    // Component names such as "mesh.0" would otherwise read as two class selectors.
    assert.deepEqual(parseSelector(".mesh\\.0").simples, [{ kind: "componentName", value: "mesh.0" }]);
    assert.deepEqual(parseSelector(".mesh.0").simples, [
        { kind: "componentName", value: "mesh" },
        { kind: "componentName", value: "0" },
    ]);
});

test("a bar inside brackets is part of the value, not a scope", () => {
    const parsed = parseSelector('[name="a|b"]');

    assert.equal(parsed.scope, undefined);
    assert.deepEqual(parsed.simples, [{ kind: "attribute", key: "name", operator: "=", value: "a|b" }]);
});

test("malformed selectors say what is wrong with them", () => {
    assert.throws(() => parseSelector(""), /it is empty/);
    assert.throws(() => parseSelector("#"), /# with no id after it/);
    assert.throws(() => parseSelector("."), /with no component name after it/);
    assert.throws(() => parseSelector("[name]"), /expected =, \^=, \$= or \*=/);
    assert.throws(() => parseSelector('[name="x"'), /unclosed \[/);
    assert.throws(() => parseSelector('[name="x]'), /unterminated " string/);
    assert.throws(() => parseSelector("helmet.tsr|"), /nothing follows the scope/);
});

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

test("an id selector picks exactly one node", async () => {
    const facts = await boxFacts();

    assert.deepEqual(selectNodes(`#${WALL_FRONT}`, facts).map(f => f.id), [WALL_FRONT]);
});

test("a component-name selector picks every node carrying that component", async () => {
    const facts = await boxFacts();

    assert.deepEqual(selectNodes(".mesh", facts).map(f => f.id), [WALL_FRONT, WALL_SIDE]);
    assert.deepEqual(selectNodes(".transform", facts).map(f => f.id), [WALL_FRONT, WALL_SIDE]);
});

test("a component-type selector picks by typeID", async () => {
    const facts = await boxFacts();

    assert.equal(selectNodes(GLTF_TYPE.accessor, facts).length, 2);
    assert.equal(selectNodes(GLTF_TYPE.buffer, facts).length, 1);
});

test("an attribute selector reaches into the component values", async () => {
    const facts = await boxFacts();

    assert.equal(selectNodes('[name="POSITION"]', facts).length, 1);
    assert.equal(selectNodes('[name="Painted brick"]', facts).length, 1);
    assert.equal(selectNodes('[name^="Pain"]', facts).length, 1);
    assert.equal(selectNodes('[name$="brick"]', facts).length, 1);
    assert.equal(selectNodes('[name*="aint"]', facts).length, 1);
    assert.equal(selectNodes('[name="nothing here"]', facts).length, 0);
});

test("a non-string value is matched against its JSON", async () => {
    const facts = await boxFacts();

    assert.equal(selectNodes("[componentType=5126]", facts).length, 1);
    assert.equal(selectNodes('[byteLength="96"]', facts).length, 1);
});

test("the pieces of a compound narrow each other", async () => {
    const facts = await boxFacts();

    assert.equal(selectNodes(`.mesh#${WALL_FRONT}`, facts).length, 1);
    // The side wall carries a mesh, but it is not the front wall.
    assert.equal(selectNodes(`.mesh#${WALL_SIDE}#${WALL_FRONT}`, facts).length, 0);
    assert.equal(selectNodes(`${GLTF_TYPE.accessor}[name="indices"]`, facts).length, 1);
});

test("* matches every node", async () => {
    const facts = await boxFacts();

    assert.equal(selectNodes("*", facts).length, facts.length);
});

test("a scope limits the match to nodes in that section", async () => {
    const facts = await boxFacts();

    assert.equal(selectNodes("box-geometry|.mesh", facts).length, 2);
    assert.equal(selectNodes("*|.mesh", facts).length, 2);
    assert.equal(selectNodes("some-other-section|.mesh", facts).length, 0);
});
