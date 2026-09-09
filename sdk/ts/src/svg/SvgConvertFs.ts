import fs from "node:fs";
import path from "node:path";
import { packMosaicSource } from "../MosaicPack.ts";
import { MOSAIC_ARCHIVE_EXTENSION } from "../MosaicPackFs.ts";
import { svgToMosaic, type SvgConvertOptions, type SvgConvertResult } from "./SvgToMosaic.ts";

export interface SvgConvertFileResult extends SvgConvertResult {
    outputPath: string;
    /** What the node is called, which is what the file was called. */
    name: string;
    byteLength: number;
}

/** Where an archive lands when the caller does not say: beside the input. */
export function archiveOutputPath(inputPath: string): string {
    const parsed = path.parse(path.resolve(inputPath));
    return path.join(parsed.dir, parsed.name + MOSAIC_ARCHIVE_EXTENSION);
}

/**
 * Reads an .svg file and packs it into an archive of one node.
 *
 * The node is named after the file, which is the only name an SVG on its own has to give.
 */
export async function convertSvgToArchiveFile(
    inputPath: string,
    outputPath?: string,
    options: SvgConvertOptions = {},
): Promise<SvgConvertFileResult> {
    if (!fs.existsSync(inputPath)) throw new Error(`File ${inputPath} does not exist`);

    const source = path.resolve(inputPath);
    const name = options.name ?? path.parse(source).name;
    const markup = fs.readFileSync(source, "utf-8");

    const result = svgToMosaic(markup, {
        ...options,
        name,
        source: options.source ?? path.basename(source),
        provenance: { id: path.basename(source), message: `Imported from ${path.basename(source)}`, ...options.provenance },
    });

    const target = path.resolve(outputPath ?? archiveOutputPath(source));
    const bytes = await packMosaicSource(result.document);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);

    return { ...result, outputPath: target, name, byteLength: bytes.byteLength };
}
