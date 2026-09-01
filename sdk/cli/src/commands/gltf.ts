import path from "node:path";
import {
    convertGltfToSourceFile,
    convertGltfToArchiveFile,
    MOSAIC_SOURCE_EXTENSION,
    type ConvertFileResult,
} from "mosaic-ts";

const STABLE_IDS = "--stable-ids";

export const GLTF_USAGE = `mosaic gltf <input.gltf|input.glb> [output${MOSAIC_SOURCE_EXTENSION}] [${STABLE_IDS}]`;
export const GLTF_PACK_USAGE = `mosaic gltf-pack <input.gltf|input.glb> [output.tsr] [${STABLE_IDS}]`;

/** Splits the flags off the positional arguments. */
function readArgs(argv: string[]): { positional: string[]; stableIds: boolean } {
    return {
        positional: argv.filter(arg => !arg.startsWith("--")),
        stableIds: argv.includes(STABLE_IDS),
    };
}

function report(inputPath: string, result: ConvertFileResult, stable = false): void {
    console.log(`Converted: ${path.resolve(inputPath)} -> ${result.outputPath}`);
    console.log();
    console.log(`Nodes: ${result.nodeCount}`);
    if (stable) console.log(`Ids: derived from the file name, so this conversion repeats exactly`);
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
    const { positional, stableIds } = readArgs(argv);
    const [input_path, output_path] = positional;
    if (input_path === undefined) throw new Error(`Usage: ${GLTF_USAGE}`);

    report(input_path, convertGltfToSourceFile(input_path, output_path, { stableIds }), stableIds);
}

/** Converts a glTF/GLB file straight into a packed .tsr archive. */
export async function runGltfPack(argv: string[]): Promise<void> {
    const { positional, stableIds } = readArgs(argv);
    const [input_path, output_path] = positional;
    if (input_path === undefined) throw new Error(`Usage: ${GLTF_PACK_USAGE}`);

    report(input_path, await convertGltfToArchiveFile(input_path, output_path, { stableIds }), stableIds);
}
