import path from "node:path";
import { packMosaicSourceFile, MOSAIC_ARCHIVE_EXTENSION } from "mosaic-ts";

export const PACK_USAGE = `mosaic pack <input.json> [output${MOSAIC_ARCHIVE_EXTENSION}]`;

export async function runPack(argv: string[]): Promise<void> {
    const [input_path, output_path] = argv;

    if (input_path === undefined) {
        throw new Error(`Usage: ${PACK_USAGE}`);
    }

    const result = await packMosaicSourceFile(input_path, output_path);

    console.log(`Packed: ${path.resolve(input_path)} -> ${result.outputPath}`);
    console.log();
    console.log(`Component tables (${result.componentCount} rows):`);
    result.tables.forEach(table => console.log(` - ${table}`));
    console.log();
    console.log(`Wrote ${result.byteLength} bytes.`);
}
