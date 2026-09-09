import path from "node:path";
import { convertSvgToArchiveFile } from "mosaic-ts";

export const SVG_PACK_USAGE = `mosaic svg-pack <input.svg> [output.tsr]`;

/**
 * Packs an SVG into an archive of one node.
 *
 * Unlike the glTF and IFC readers there is nothing to take apart: an SVG is already a
 * description of a drawing, so the archive carries it whole, under a node named after the
 * file it came from.
 */
export async function runSvgPack(argv: string[]): Promise<void> {
    const [input_path, output_path] = argv.filter(arg => !arg.startsWith("--"));
    if (input_path === undefined) throw new Error(`Usage: ${SVG_PACK_USAGE}`);

    const result = await convertSvgToArchiveFile(input_path, output_path);

    console.log(`Packed: ${path.resolve(input_path)} -> ${result.outputPath}`);
    console.log();
    console.log(`Node: ${result.nodeId}`);
    console.log(`Name: ${result.name}`);
    console.log(`Components:`);
    for (const [typeID, count] of Object.entries(result.componentCounts)) {
        console.log(` - ${typeID}: ${count}`);
    }
    console.log();
    console.log(`Wrote ${result.byteLength} bytes.`);
}
