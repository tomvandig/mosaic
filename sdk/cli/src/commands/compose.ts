import path from "node:path";
import { composeArchiveToGlb, GLB_EXTENSION } from "mosaic-ts";

export const COMPOSE_USAGE = `mosaic compose <input.tsr> [output${GLB_EXTENSION}]`;

export async function runCompose(argv: string[]): Promise<void> {
    const [input_path, output_path] = argv;
    if (input_path === undefined) throw new Error(`Usage: ${COMPOSE_USAGE}`);

    const result = await composeArchiveToGlb(input_path, output_path);

    console.log(`Composed: ${path.resolve(input_path)} -> ${result.outputPath}`);
    console.log();
    console.log(`Sources (imports first):`);
    result.sources.forEach(source => console.log(` - ${source}`));
    console.log();
    console.log(`Nodes: ${result.nodeCount}`);
    console.log(`Meshes: ${result.meshCount}`);
    console.log(`Binary chunk: ${result.binaryLength} bytes`);

    if (result.warnings.length > 0) {
        console.log();
        console.log(`Warnings:`);
        result.warnings.forEach(warning => console.log(` ! ${warning}`));
    }

    console.log();
    console.log(`Wrote ${result.byteLength} bytes.`);
}
