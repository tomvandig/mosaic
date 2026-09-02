import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { LoadMosaicFile, type MosaicFile } from "../src/MosaicFile.ts";
import { collapseNodesByPath } from "../src/MosaicFileOperations.ts";
import { packMosaicSource } from "../src/MosaicPack.ts";
import { Operation } from "../src/MosaicIndexFile.ts";
import { readExample, resolveExampleSchema, resolve, follow, componentsOf, decodeBuffer, type Row } from "./fixtures.ts";

// The glTF-derived component schemas mirror the glTF 2.0 schemas, except that every glTF
// id is the id of the Mosaic node carrying the referenced component. A reference therefore
// names a thing rather than a position, and stays correct when the component tables change.

const GLTF = {
    buffer: "khronos::gltf::buffer",
    bufferView: "khronos::gltf::bufferView",
    accessor: "khronos::gltf::accessor",
    primitive: "khronos::gltf::meshPrimitive",
    material: "khronos::gltf::material",
    transform: "khronos::gltf::nodeTransform",
} as const;

const WALLS = ["55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"];
const POSITION_NODE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function loadBox(): Promise<MosaicFile> {
    return await LoadMosaicFile(await packMosaicSource(readExample("gltf-box"), resolveExampleSchema));
}

test("the glTF example packs with a table per glTF element type", async () => {
    const bytes = await packMosaicSource(readExample("gltf-box"), resolveExampleSchema);
    const entries = Object.keys((await new JSZip().loadAsync(bytes)).files);

    for (const typeID of Object.values(GLTF)) {
        assert.ok(entries.includes(`${typeID}.ndjson`), `missing table for ${typeID}`);
    }
});

test("each glTF component table carries the schema it was derived from", async () => {
    const packed = await loadBox();

    for (const typeID of Object.values(GLTF)) {
        const table = packed.index.componentTables.find(t => t.filename === `${typeID}.ndjson`);
        assert.ok(table, `no table for ${typeID}`);
        assert.equal(table.schema["x-mosaic-id"], typeID);
        assert.equal(table.schema.type, "object");
    }
});

test("no glTF reference is left as an integer index", () => {
    const document = readExample("gltf-box");
    const references: unknown[] = [];

    for (const view of document.components[GLTF.bufferView]!) references.push((view as Row).buffer);
    for (const accessor of document.components[GLTF.accessor]!) references.push((accessor as Row).bufferView);
    for (const primitive of document.components[GLTF.primitive]!) {
        const row = primitive as Row;
        references.push(row.indices, row.material, ...Object.values(row.attributes));
    }

    // 2 bufferView -> buffer, 2 accessor -> bufferView, and the primitive's indices,
    // material and one POSITION attribute.
    assert.equal(references.length, 7);
    for (const reference of references) {
        assert.match(reference as string, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
});

test("every glTF reference is a node id that resolves to a component", async () => {
    const packed = await loadBox();
    const primitive = componentsOf(packed, WALLS[0]!).mesh!;

    // Walk the whole graph out from the primitive; every hop is a node id.
    const position = follow(packed, primitive.attributes.POSITION);
    const indices = follow(packed, primitive.indices);

    assert.equal(position.name, "POSITION");
    assert.equal(indices.name, "indices");
    assert.equal(follow(packed, primitive.material).name, "Painted brick");

    assert.equal(follow(packed, position.bufferView).name, "positions");
    assert.equal(follow(packed, indices.bufferView).name, "indices");
    assert.equal(follow(packed, follow(packed, position.bufferView).buffer).name, "box");
});

test("each referenced node carries the component type the field expects", async () => {
    const packed = await loadBox();
    const nodes = collapseNodesByPath(packed);
    const primitive = componentsOf(packed, WALLS[0]!).mesh!;

    const expected: Array<[unknown, string]> = [
        [primitive.attributes.POSITION, GLTF.accessor],
        [primitive.indices, GLTF.accessor],
        [primitive.material, GLTF.material],
        [follow(packed, primitive.attributes.POSITION).bufferView, GLTF.bufferView],
        [follow(packed, follow(packed, primitive.indices).bufferView).buffer, GLTF.buffer],
    ];

    for (const [nodeId, typeID] of expected) {
        const node = nodes.get(nodeId as string);
        assert.ok(node, `no node ${nodeId}`);
        assert.equal(node.components![0]!.type, typeID, `node ${nodeId} does not carry a ${typeID}`);
    }
});

test("accessors describe the buffer the example actually carries", async () => {
    const packed = await loadBox();
    const primitive = componentsOf(packed, WALLS[0]!).mesh!;

    const position = follow(packed, primitive.attributes.POSITION);
    const positionView = follow(packed, position.bufferView);
    const buffer = follow(packed, positionView.buffer);
    const bytes = decodeBuffer(buffer.uri);

    assert.equal(bytes.byteLength, buffer.byteLength);

    // POSITION: 8 VEC3 floats, 3 * 4 bytes each.
    assert.equal(position.componentType, 5126);
    assert.equal(position.type, "VEC3");
    assert.equal(position.count * 3 * 4, positionView.byteLength);

    // Indices: 36 UNSIGNED_SHORTs, 2 bytes each.
    const indices = follow(packed, primitive.indices);
    const indexView = follow(packed, indices.bufferView);
    assert.equal(indices.componentType, 5123);
    assert.equal(indices.type, "SCALAR");
    assert.equal(indices.count * 2, indexView.byteLength);

    for (const view of [positionView, indexView]) {
        assert.ok(view.byteOffset + view.byteLength <= bytes.byteLength, `${view.name} runs past the buffer`);
    }
});

test("the declared accessor bounds match the vertices in the buffer", async () => {
    const packed = await loadBox();

    const position = follow(packed, componentsOf(packed, WALLS[0]!).mesh!.attributes.POSITION);
    const view = follow(packed, position.bufferView);
    const bytes = decodeBuffer(follow(packed, view.buffer).uri);

    const start = view.byteOffset + position.byteOffset;
    const vertices = Array.from({ length: position.count }, (_, i) => [
        bytes.readFloatLE(start + i * 12),
        bytes.readFloatLE(start + i * 12 + 4),
        bytes.readFloatLE(start + i * 12 + 8),
    ]);

    for (const axis of [0, 1, 2]) {
        const values = vertices.map(v => v[axis]!);
        assert.equal(Math.min(...values), position.min[axis], `min disagrees on axis ${axis}`);
        assert.equal(Math.max(...values), position.max[axis], `max disagrees on axis ${axis}`);
    }
});

test("every index in the mesh addresses a vertex that exists", async () => {
    const packed = await loadBox();
    const primitive = componentsOf(packed, WALLS[0]!).mesh!;

    assert.equal(primitive.mode, 4, "expected TRIANGLES");

    const position = follow(packed, primitive.attributes.POSITION);
    const indexAccessor = follow(packed, primitive.indices);
    const view = follow(packed, indexAccessor.bufferView);
    const bytes = decodeBuffer(follow(packed, view.buffer).uri);
    const start = view.byteOffset + indexAccessor.byteOffset;

    assert.equal(indexAccessor.count % 3, 0, "triangle indices should come in threes");
    for (let i = 0; i < indexAccessor.count; i++) {
        const vertex = bytes.readUInt16LE(start + i * 2);
        assert.ok(vertex < position.count, `index ${i} addresses vertex ${vertex} of ${position.count}`);
    }
});

test("two nodes share one mesh primitive and differ only by transform", async () => {
    const packed = await loadBox();

    const [front, side] = WALLS.map(id => componentsOf(packed, id));
    assert.deepEqual(front!.mesh, side!.mesh, "both walls should see the same primitive");
    assert.notDeepEqual(front!.transform, side!.transform);
    assert.deepEqual(front!.transform!.scale, [4, 2.4, 0.2]);
});

test("editing a referenced component leaves the references pointing at it", async () => {
    // This is why the ids are node ids: a later section can replace what a node carries
    // without every reference to that node having to be found and rewritten.
    const document = readExample("gltf-box");
    const accessors = document.components[GLTF.accessor] as unknown[];

    const recomputed = { ...(accessors[0] as object), name: "POSITION (recomputed)" };
    const recomputedIndex = accessors.push(recomputed) - 1;

    document.index.sections.push({
        header: {
            id: "recompute-bounds", message: "Recompute the position accessor", dataVersion: "1.0.0",
            author: "grace@example.com", timestamp: "2026-05-19T10:00:00Z", application: "mosaic-tests",
        },
        nodes: [{
            id: POSITION_NODE,
            components: [{ id: "accessor", type: GLTF.accessor, index: recomputedIndex, operation: Operation.Value }],
        }],
    });

    const packed = await LoadMosaicFile(await packMosaicSource(document, resolveExampleSchema));
    const primitive = componentsOf(packed, WALLS[0]!).mesh!;

    // The primitive was never touched, and still names the same node...
    assert.equal(primitive.attributes.POSITION, POSITION_NODE);
    // ...but that node now carries the recomputed component.
    assert.equal(follow(packed, primitive.attributes.POSITION).name, "POSITION (recomputed)");
});
