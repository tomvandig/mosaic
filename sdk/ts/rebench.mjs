/** Re-measures the two paths that were slow, the same way they were measured before. */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

process.env.MOSAIC_DUCKDB ??= "D:/mosaic/sdk/ts";

const load = (file) => import(pathToFileURL(`D:/mosaic/sdk/ts/src/${file}`).href);
const { ApiStore } = await load("api/Store.ts");
const { LoadMosaicFile } = await load("MosaicFile.ts");
const { mosaicToGltf } = await load("composition/MosaicToGltf.ts");
const { writeGlb } = await load("composition/GlbWriter.ts");

const OUT = "D:/s1/mosaic";
const seconds = (from) => ((Date.now() - from) / 1000).toFixed(1);

// --- composing, which was quadratic in the width of the widest node ----------
if (process.argv.includes("--compose")) {
    for (const stem of ["O-S1-INS-E Installatie", "O-S1-BWK-BIM architectural - BIM bouwkundig"]) {
        const started = Date.now();
        const file = await LoadMosaicFile(new Uint8Array(fs.readFileSync(path.join(OUT, `${stem}.tsr`))));
        const read = seconds(started);

        const composing = Date.now();
        const composed = mosaicToGltf(file);
        const built = seconds(composing);

        const writing = Date.now();
        const glb = writeGlb(composed.document, composed.binary);
        console.log(`${stem}\n  read ${read}s · compose ${built}s · write ${seconds(writing)}s`
            + ` · total ${seconds(started)}s · ${composed.document.nodes.length} nodes`
            + ` · ${composed.document.meshes.length} meshes · ${(glb.byteLength / 1048576).toFixed(1)} MB`);
    }
}

// --- publishing, which was one planned statement per row ---------------------
if (process.argv.includes("--db")) {
    const target = path.join(OUT, "s1.duckdb");
    for (const leftover of [target, `${target}.wal`]) {
        if (fs.existsSync(leftover)) fs.rmSync(leftover);
    }

    const store = await ApiStore.open(target);
    const overall = Date.now();

    try {
        for (const archive of [
            "E-S1-RWB-Dycore-Kanaalplaatvloer.tsr",
            "O-S1-BWK-BIM prefab facade - BIM prefabgevel.tsr",
            "O-S1-CON-Structural engineering - Constructie.tsr",
        ]) {
            const started = Date.now();
            const tesseraId = randomUUID();
            await store.createTessera({ id: tesseraId, name: archive.replace(/\.tsr$/, "") });

            const blobId = randomUUID();
            await store.reserveBlob(blobId, tesseraId);
            await store.writeBlob(blobId, fs.readFileSync(path.join(OUT, archive)));
            await store.createVersion(tesseraId, { id: randomUUID(), previousTesseraVersionId: "", blobId });

            console.log(`published ${archive.replace(/\.tsr$/, "")} in ${seconds(started)}s`);
        }
        console.log(`all three in ${seconds(overall)}s`);
    } finally {
        await store.close();
    }
}

// --- publishing every model, which was out of reach before -------------------
// The two large services models were left out of s1.duckdb because one insert per row put
// them at about an hour each. This publishes all six, smallest first, and reports what
// each one put in the tables.
if (process.argv.includes("--db-all")) {
    const target = path.join(OUT, "s1.duckdb");
    for (const leftover of [target, `${target}.wal`]) {
        if (fs.existsSync(leftover)) fs.rmSync(leftover);
    }

    const archives = fs.readdirSync(OUT).filter(f => f.endsWith(".tsr"))
        .map(f => ({ file: f, bytes: fs.statSync(path.join(OUT, f)).size }))
        .sort((a, b) => a.bytes - b.bytes);

    const store = await ApiStore.open(target);
    const overall = Date.now();

    try {
        for (const { file: archive, bytes } of archives) {
            const started = Date.now();
            const name = archive.replace(/\.tsr$/, "");

            const tesseraId = randomUUID();
            await store.createTessera({ id: tesseraId, name });

            const blobId = randomUUID();
            await store.reserveBlob(blobId, tesseraId);
            await store.writeBlob(blobId, fs.readFileSync(path.join(OUT, archive)));
            await store.createVersion(tesseraId, { id: randomUUID(), previousTesseraVersionId: "", blobId });

            const [counted] = await store.all(
                `SELECT (SELECT count(*) FROM mosaic_node) AS nodes,
                        (SELECT count(*) FROM mosaic_component_ref) AS refs`);

            console.log(`published ${name} (${(bytes / 1048576).toFixed(1)} MB) in ${seconds(started)}s`
                + `  running totals: ${counted.nodes} nodes, ${counted.refs} references`);
        }
        console.log(`all ${archives.length} in ${seconds(overall)}s`
            + `  database ${(fs.statSync(target).size / 1048576).toFixed(1)} MB`);
    } finally {
        await store.close();
    }
}

// --- composing every model, for a table that compares like with like ---------
// The two large models were the ones that were slow, but the whole table's compose column
// should be measured the same way, so this walks all six smallest first.
if (process.argv.includes("--compose-all")) {
    const archives = fs.readdirSync(OUT).filter(f => f.endsWith(".tsr"))
        .map(f => ({ file: f, bytes: fs.statSync(path.join(OUT, f)).size }))
        .sort((a, b) => a.bytes - b.bytes);

    for (const { file: archive } of archives) {
        const stem = archive.replace(/\.tsr$/, "");
        const started = Date.now();
        const file = await LoadMosaicFile(new Uint8Array(fs.readFileSync(path.join(OUT, archive))));
        const read = seconds(started);

        const composing = Date.now();
        const composed = mosaicToGltf(file);
        const built = seconds(composing);

        const writing = Date.now();
        const glb = writeGlb(composed.document, composed.binary);
        console.log(`${stem}\n  read ${read}s · compose ${built}s · write ${seconds(writing)}s`
            + ` · total ${seconds(started)}s · ${composed.document.nodes.length} nodes`
            + ` · ${composed.document.meshes.length} meshes · ${(glb.byteLength / 1048576).toFixed(1)} MB`
            + ` · warnings ${composed.warnings.length}`);
    }
}
