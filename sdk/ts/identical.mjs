/**
 * Composes each archive again and compares the bytes with the .glb written before the
 * merge fix. Same input, same output, or the change altered behaviour.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const load = (file) => import(pathToFileURL(`D:/mosaic/sdk/ts/src/${file}`).href);
const { LoadMosaicFile } = await load("MosaicFile.ts");
const { mosaicToGltf } = await load("composition/MosaicToGltf.ts");
const { writeGlb } = await load("composition/GlbWriter.ts");

const OUT = "D:/s1/mosaic";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex").slice(0, 16);

for (const stem of fs.readdirSync(OUT).filter(f => f.endsWith(".tsr")).map(f => f.replace(/\.tsr$/, ""))) {
    const before = path.join(OUT, `${stem}.glb`);
    if (!fs.existsSync(before)) {
        console.log(`${stem}: no .glb from the earlier run to compare against`);
        continue;
    }

    const file = await LoadMosaicFile(new Uint8Array(fs.readFileSync(path.join(OUT, `${stem}.tsr`))));
    const composed = mosaicToGltf(file);
    const now = writeGlb(composed.document, composed.binary);
    const then = new Uint8Array(fs.readFileSync(before));

    const same = now.byteLength === then.byteLength && digest(now) === digest(then);
    console.log(`${same ? "same " : "DIFFERS"} ${stem}`
        + `  ${(now.byteLength / 1048576).toFixed(1)} MB  ${digest(now)}`
        + (same ? "" : ` vs ${digest(then)} (${(then.byteLength / 1048576).toFixed(1)} MB)`)
        + `  warnings: ${composed.warnings.length}`);
}
