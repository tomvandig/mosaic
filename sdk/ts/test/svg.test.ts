import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { svgToMosaic } from "../src/svg/SvgToMosaic.ts";
import { convertSvgToArchiveFile } from "../src/svg/SvgConvertFs.ts";
import { SVG_TYPE } from "../src/svg/schemas.ts";
import { CORE_TYPE } from "../src/core/schemas.ts";
import { LoadMosaicFile } from "../src/MosaicFile.ts";
import { collapseNodesByPath } from "../src/MosaicFileOperations.ts";
import { mosaicToGltf, MOSAIC_COMPONENTS_EXTENSION } from "../src/composition/MosaicToGltf.ts";
import { indexOf } from "../src/ComponentReference.ts";

const DRAWING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">
  <rect x="5" y="5" width="90" height="40" fill="#f4efe4" stroke="#4f4c46"/>
  <circle cx="30" cy="25" r="10" fill="#e2a84c"/>
</svg>`;

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mosaic-svg-"));
}

test("packing an svg gives one node carrying the markup", () => {
    const { document, nodeId, componentCounts } = svgToMosaic(DRAWING, { name: "plan" });

    assert.match(nodeId, UUID, "the node gets a made-up id, the way a converted file does");
    assert.deepEqual(componentCounts, { [SVG_TYPE.svg]: 1, [CORE_TYPE.name]: 1 });

    const nodes = document.index.sections[0]!.nodes;
    assert.equal(nodes.length, 1, "one drawing is one node");
    assert.equal(nodes[0]!.id, nodeId);

    // The name is the reference id, the way core::name always works.
    const named = nodes[0]!.components!.find(c => c.type === CORE_TYPE.name);
    assert.equal(named?.id, "plan");

    // And the markup is kept whole rather than taken apart.
    const rows = document.components[SVG_TYPE.svg] as any[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].svg, DRAWING.trim());
});

test("the svg component type brings its own schema", () => {
    const { document } = svgToMosaic(DRAWING, { name: "plan" });

    const table = document.index.componentTables.find(t => t.filename.startsWith(SVG_TYPE.svg));
    assert.ok(table, "the archive declares the type it uses");
    assert.equal((table!.schema as any)["x-mosaic-id"], SVG_TYPE.svg);
    assert.deepEqual((table!.schema as any).required, ["svg"]);
});

test("what is not svg is refused rather than packed", () => {
    assert.throws(() => svgToMosaic("   "), /no SVG in that/);
    assert.throws(() => svgToMosaic("<html><body>not a drawing</body></html>"), /does not look like SVG/);
});

test("packing a file names the node after it and reads back", async () => {
    const dir = tempDir();
    try {
        const input = path.join(dir, "plattegrond.svg");
        fs.writeFileSync(input, DRAWING);

        const result = await convertSvgToArchiveFile(input);
        assert.equal(result.name, "plattegrond", "named after the file");
        assert.equal(result.outputPath, path.join(dir, "plattegrond.tsr"), "beside it, unless told otherwise");
        assert.equal(fs.statSync(result.outputPath).size, result.byteLength);

        const file = await LoadMosaicFile(new Uint8Array(fs.readFileSync(result.outputPath)));
        const node = collapseNodesByPath(file).get(result.nodeId);
        assert.ok(node, "the node is there when the archive is read back");

        const reference = node!.components!.find(c => c.type === SVG_TYPE.svg);
        assert.ok(reference, "carrying the drawing");

        const row = JSON.parse(file.readRawComponent(SVG_TYPE.svg, indexOf(reference!)));
        assert.equal(row.svg, DRAWING.trim(), "the same markup that went in");
        assert.equal(row.source, "plattegrond.svg", "and where it came from");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("two packs of the same file are two different nodes", async () => {
    const dir = tempDir();
    try {
        const input = path.join(dir, "plan.svg");
        fs.writeFileSync(input, DRAWING);

        const first = await convertSvgToArchiveFile(input, path.join(dir, "a.tsr"));
        const second = await convertSvgToArchiveFile(input, path.join(dir, "b.tsr"));

        // The id is made up, so packing twice makes two drawings rather than one twice.
        assert.notEqual(first.nodeId, second.nodeId);
        assert.match(second.nodeId, UUID);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("composing carries the drawing into the glb as extension data", async () => {
    const dir = tempDir();
    try {
        const input = path.join(dir, "plan.svg");
        fs.writeFileSync(input, DRAWING);
        const packed = await convertSvgToArchiveFile(input);

        const file = await LoadMosaicFile(new Uint8Array(fs.readFileSync(packed.outputPath)));
        const composed = mosaicToGltf(file);

        assert.equal(composed.warnings.length, 0);
        assert.deepEqual(composed.document.extensionsUsed, [MOSAIC_COMPONENTS_EXTENSION]);

        // A glb has nowhere native to put a drawing, so it rides on the node. The node has
        // no mesh at all, and is written anyway because it is carrying something.
        assert.equal(composed.document.nodes?.length, 1);
        assert.equal(composed.document.meshes?.length ?? 0, 0);

        const carried = (composed.document.nodes![0] as any)
            .extensions[MOSAIC_COMPONENTS_EXTENSION].components as any[];
        const drawing = carried.find(c => c.type === SVG_TYPE.svg);

        assert.ok(drawing, "the viewer has something to find");
        assert.equal(drawing.value.svg, DRAWING.trim());
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
