import path from "node:path";
import {
    convertGltfToSourceFile,
    convertGltfToArchiveFile,
    MOSAIC_SOURCE_EXTENSION,
    type ConvertFileResult,
} from "mosaic-ts";

export const GLTF_USAGE = `mosaic gltf <input.gltf|input.glb> [output${MOSAIC_SOURCE_EXTENSION}]`;
export const GLTF_PACK_USAGE = `mosaic gltf-pack <input.gltf|input.glb> [output.tsr]`;

function report(inputPath: string, result: ConvertFileResult): void {
    console.log(`Converted: ${path.resolve(inputPath)} -> ${result.outputPath}`);
    console.log();
    console.log(`Nodes: ${result.nodeCount}`);
    console.log(`Components:`);
    for (const [typeID, count] of Object.entries(result.componentCounts)) {
        console.log(` - ${typeID}: ${count}`);
    }

    if (result.warnings.length > 0) {
        console.log();
        console.log(`Warnings (glTF data the Mosaic components do not carry):`);
        result.warnings.forEach(warning => console.log(` ! ${warning}`));
    }

    console.log();
    console.log(`Wrote ${result.byteLength} bytes.`);
}

/** Converts a glTF/GLB file into a Mosaic source document. */
export async function runGltf(argv: string[]): Promise<void> {
    const [input_path, output_path] = argv;
    if (input_path === undefined) throw new Error(`Usage: ${GLTF_USAGE}`);

    report(input_path, convertGltfToSourceFile(input_path, output_path));
}

/** Converts a glTF/GLB file straight into a packed .tsr archive. */
export async function runGltfPack(argv: string[]): Promise<void> {
    const [input_path, output_path] = argv;
    if (input_path === undefined) throw new Error(`Usage: ${GLTF_PACK_USAGE}`);

    report(input_path, await convertGltfToArchiveFile(input_path, output_path));
}
