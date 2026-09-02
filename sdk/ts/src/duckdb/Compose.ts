import fs from "node:fs";
import path from "node:path";
import { mosaicToGltf } from "../composition/MosaicToGltf.ts";
import { writeGlb } from "../composition/GlbWriter.ts";
import { GLB_EXTENSION } from "../composition/ComposeFs.ts";
import { MosaicDatabase } from "./Export.ts";
import { readMosaicFile, listFiles, type ReadOptions } from "./Import.ts";

/** `scene.duckdb` -> `scene.glb` */
export function glbOutputPathForDatabase(databasePath: string): string {
    const stem = path.basename(databasePath).split(".")[0];
    return path.join(path.dirname(databasePath), `${stem}${GLB_EXTENSION}`);
}

export interface ComposeDatabaseResult {
    outputPath: string;
    byteLength: number;
    /** The archives that went into it, in the order their sections were layered. */
    sources: string[];
    nodeCount: number;
    meshCount: number;
    binaryLength: number;
    warnings: string[];
}

/**
 * Composes everything a database holds into one .glb.
 *
 * A database is the same thing an archive is, only spread over several inserts, so this
 * reads it back into one file and hands it to the composer the archives go through. What
 * a database does not have is an import graph -- imports were resolved into rows when the
 * archives went in -- so the layering here is the order the archives were inserted.
 */
export async function composeDatabaseToGlb(
    databasePath: string,
    outputPath?: string,
    options: ReadOptions = {},
): Promise<ComposeDatabaseResult> {
    if (!fs.existsSync(databasePath)) throw new Error(`File ${databasePath} does not exist`);

    const database = await MosaicDatabase.open(databasePath);
    try {
        const wanted = options.files;
        const sources = (await listFiles(database))
            .filter(file => !wanted || wanted.includes(file.fileId))
            .map(file => file.fileId);

        const file = await readMosaicFile(database, options);
        const composed = mosaicToGltf(file);

        const target = path.resolve(outputPath ?? glbOutputPathForDatabase(path.resolve(databasePath)));
        const bytes = writeGlb(composed.document, composed.binary);

        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);

        return {
            outputPath: target,
            byteLength: bytes.byteLength,
            sources,
            nodeCount: composed.document.nodes?.length ?? 0,
            meshCount: composed.document.meshes?.length ?? 0,
            binaryLength: composed.binary.byteLength,
            warnings: composed.warnings,
        };
    } finally {
        await database.close();
    }
}
