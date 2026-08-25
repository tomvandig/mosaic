import test from "node:test";
import assert from "node:assert/strict";
import { MosaicFile, WriteMosaicFile, LoadMosaicFile } from "../src/MosaicFile.ts";
import { Type } from "../src/MosaicIndexFile.ts";
import { loadExample, readSchema, resolve } from "./fixtures.ts";

const WALL = "acme::geometry::wall";
const PAINT = "acme::material::paint";

test("an example file survives a write/load round trip", async () => {
    const file = await loadExample("house-v1");
    const reloaded = await LoadMosaicFile(await WriteMosaicFile(file));

    assert.deepEqual(reloaded.index, file.index);
    assert.deepEqual([...reloaded.serializedComponents], [...file.serializedComponents]);
});

test("loading an example exposes its sections, nodes and component rows", async () => {
    const file = await loadExample("house-v1");

    assert.equal(file.index.header.MosaicVersion, "post-alpha");
    assert.equal(file.index.sections.length, 1);

    const section = file.index.sections[0];
    assert.equal(section.header.author, "ada@example.com");
    assert.equal(section.nodes.length, 2);

    const [north, south] = section.nodes;
    assert.deepEqual(north.components?.map(c => c.name), ["geometry", "paint"]);
    assert.deepEqual(resolve(file, WALL, north.components![0].componentIndex), {
        name: "North wall", height: 2.4, loadBearing: true,
    });
    assert.deepEqual(resolve(file, PAINT, north.components![1].componentIndex), {
        color: "white", finish: "matte",
    });
    assert.deepEqual(resolve(file, WALL, south.components![0].componentIndex), {
        name: "South wall", height: 2.4, loadBearing: false,
    });
});

test("component tables carry the schema each table was generated from", async () => {
    const file = await loadExample("house-v1");
    const table = file.index.componentTables.find(t => t.filename === `${WALL}.ndjson`);

    assert.ok(table);
    assert.equal(table.type, Type.Ndjson);
    assert.equal(table.schema["x-mosaic-id"], WALL);
    assert.deepEqual(table.schema.required, ["name", "height"]);
});

interface Wall {
    name: string;
    height: number;
    loadBearing?: boolean;
}

// The shape mosaic-codegen emits alongside each generated class.
const WallIdentity = {
    typeID: WALL,
    originSchemaSrc: readSchema("wall"),
    fromJSONString: (str: string) => JSON.parse(str) as Wall,
    toJSONString: (wall: Wall) => JSON.stringify(wall, null, 2),
};

test("a typed component written through an identity reads back equal", async () => {
    const file = new MosaicFile();
    const wall = { name: "West wall", height: 3.1, loadBearing: true };

    const index = file.AddComponent(WallIdentity, wall);
    const reloaded = await LoadMosaicFile(await WriteMosaicFile(file));

    assert.deepEqual(reloaded.ReadComponent(WallIdentity, index), wall);
});

test("adding a typed component registers its table in the index", async () => {
    const file = new MosaicFile();
    file.AddComponent(WallIdentity, { name: "West wall", height: 3.1 });

    assert.equal(file.index.componentTables.length, 1);
    assert.deepEqual(file.index.componentTables[0], {
        type: Type.Ndjson,
        filename: `${WALL}.ndjson`,
        schema: JSON.parse(readSchema("wall")),
    });
});

test("reading past the end of a component table throws", async () => {
    const file = await loadExample("house-v1");

    assert.throws(() => file.readRawComponent(PAINT, 7), /No component with index 7/);
});

test("loading bytes without an index.json throws", async () => {
    const empty = await WriteMosaicFile(new MosaicFile());
    const stripped = await LoadMosaicFile(empty);
    assert.ok(stripped.index);

    await assert.rejects(() => LoadMosaicFile(new Uint8Array([1, 2, 3])));
});
