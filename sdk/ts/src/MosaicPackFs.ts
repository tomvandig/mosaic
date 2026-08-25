import fs from "node:fs";
import path from "node:path";
import { packMosaicSource, type MosaicSourceDocument, type SchemaResolver } from "./MosaicPack.ts";

/** The extension a packed Mosaic archive carries. */
export const MOSAIC_ARCHIVE_EXTENSION = ".tsr";

/** `foo/bar.mosaic.json` -> `foo/bar.tsr` */
export function defaultOutputPath(inputPath: string): string {
    const directory = path.dirname(inputPath);
    // Strip every extension, so `house-v1.mosaic.json` does not become `house-v1.mosaic.tsr`.
    const stem = path.basename(inputPath).split(".")[0];

    return path.join(directory, `${stem}${MOSAIC_ARCHIVE_EXTENSION}`);
}

export interface PackResult {
    outputPath: string;
    /** Bytes written. */
    byteLength: number;
    /** Component tables in the packed index, by the NDJSON file each one names. */
    tables: string[];
    /** Total component rows across every table. */
    componentCount: number;
}

/**
 * Reads a source document from disk and writes the archive beside it, resolving each
 * `componentTables[].schema` reference relative to the source document's own directory.
 */
export async function packMosaicSourceFile(inputPath: string, outputPath?: string): Promise<PackResult> {
    if (!fs.existsSync(inputPath)) throw new Error(`File ${inputPath} does not exist`);

    const source = path.resolve(inputPath);
    const target = path.resolve(outputPath ?? defaultOutputPath(source));

    if (source === target) throw new Error(`Refusing to overwrite the source document ${source}`);

    let document: MosaicSourceDocument;
    try {
        document = JSON.parse(fs.readFileSync(source, "utf-8")) as MosaicSourceDocument;
    } catch (cause) {
        throw new Error(`${inputPath} is not valid JSON`, { cause });
    }

    const sourceDirectory = path.dirname(source);
    const resolveSchema: SchemaResolver = reference => {
        const schemaPath = path.resolve(sourceDirectory, reference);
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema "${reference}", referenced by ${path.basename(source)}, does not exist at ${schemaPath}`);
        }
        return JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
    };

    const bytes = await packMosaicSource(document, resolveSchema);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);

    return {
        outputPath: target,
        byteLength: bytes.byteLength,
        tables: (document.index?.componentTables ?? []).map(table => table.filename),
        componentCount: Object.values(document.components ?? {}).reduce((total, rows) => total + rows.length, 0),
    };
}
