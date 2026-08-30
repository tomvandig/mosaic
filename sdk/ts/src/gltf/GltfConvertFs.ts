import fs from "node:fs";
import path from "node:path";
import { packMosaicSource } from "../MosaicPack.ts";
import { MOSAIC_ARCHIVE_EXTENSION } from "../MosaicPackFs.ts";
import { parseGltf } from "./GltfDocument.ts";
import { gltfToMosaic, type ConvertOptions, type ConvertResult } from "./GltfToMosaic.ts";

/** The extension a Mosaic source document carries. */
export const MOSAIC_SOURCE_EXTENSION = ".mosaic.json";

const DATA_URI = /^data:([^;,]*)?(;base64)?,/;

/** `scene/box.glb` -> `scene/box.mosaic.json` */
export function sourceOutputPath(inputPath: string): string {
    const stem = path.basename(inputPath).split(".")[0];
    return path.join(path.dirname(inputPath), `${stem}${MOSAIC_SOURCE_EXTENSION}`);
}

/** `scene/box.glb` -> `scene/box.tsr` */
export function archiveOutputPath(inputPath: string): string {
    const stem = path.basename(inputPath).split(".")[0];
    return path.join(path.dirname(inputPath), `${stem}${MOSAIC_ARCHIVE_EXTENSION}`);
}

function decodeDataUri(uri: string): Uint8Array {
    const match = DATA_URI.exec(uri);
    if (!match) throw new Error(`Buffer uri is not a data URI`);

    const payload = uri.slice(match[0].length);
    if (!match[2]) return new TextEncoder().encode(decodeURIComponent(payload));
    return new Uint8Array(Buffer.from(payload, "base64"));
}

/**
 * Reads a .gltf or .glb file and converts it, resolving buffers from the GLB binary
 * chunk, from data URIs, or from files sitting beside the input.
 */
export function convertGltfFile(inputPath: string, options: Partial<ConvertOptions> = {}): ConvertResult {
    if (!fs.existsSync(inputPath)) throw new Error(`File ${inputPath} does not exist`);

    const source = path.resolve(inputPath);
    const { document, binaryChunk } = parseGltf(new Uint8Array(fs.readFileSync(source)));
    const directory = path.dirname(source);

    const resolveBuffer: ConvertOptions["resolveBuffer"] = (buffer, index) => {
        if (buffer.uri === undefined) {
            // Per the spec, only a GLB's first buffer may omit its uri.
            if (!binaryChunk) throw new Error(`Buffer ${index} has no uri and the file has no binary chunk`);
            return binaryChunk;
        }

        if (DATA_URI.test(buffer.uri)) return decodeDataUri(buffer.uri);

        const bufferPath = path.resolve(directory, decodeURIComponent(buffer.uri));
        if (!fs.existsSync(bufferPath)) {
            throw new Error(`Buffer ${index} points at "${buffer.uri}", which does not exist at ${bufferPath}`);
        }
        return new Uint8Array(fs.readFileSync(bufferPath));
    };

    return gltfToMosaic(document, {
        resolveBuffer,
        provenance: { id: path.basename(source), message: `Imported from ${path.basename(source)}`, ...options.provenance },
        ...(options.newId ? { newId: options.newId } : {}),
    });
}

export interface ConvertFileResult {
    outputPath: string;
    byteLength: number;
    warnings: string[];
    /** Component rows written, by component type. */
    componentCounts: Record<string, number>;
    /** Mosaic nodes in the produced document. */
    nodeCount: number;
}

function summarize(result: ConvertResult, outputPath: string, byteLength: number): ConvertFileResult {
    return {
        outputPath,
        byteLength,
        warnings: result.warnings,
        componentCounts: Object.fromEntries(
            Object.entries(result.document.components).map(([typeID, rows]) => [typeID, rows.length]),
        ),
        nodeCount: result.document.index.sections[0]?.nodes.length ?? 0,
    };
}

function write(target: string, data: string | Uint8Array): number {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    return typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
}

/** Converts a .gltf or .glb file into a Mosaic source document on disk. */
export function convertGltfToSourceFile(inputPath: string, outputPath?: string, options?: Partial<ConvertOptions>): ConvertFileResult {
    const result = convertGltfFile(inputPath, options);
    const target = path.resolve(outputPath ?? sourceOutputPath(path.resolve(inputPath)));

    const byteLength = write(target, `${JSON.stringify(result.document, null, 2)}\n`);
    return summarize(result, target, byteLength);
}

/** Converts a .gltf or .glb file straight into a packed Mosaic archive. */
export async function convertGltfToArchiveFile(inputPath: string, outputPath?: string, options?: Partial<ConvertOptions>): Promise<ConvertFileResult> {
    const result = convertGltfFile(inputPath, options);
    const target = path.resolve(outputPath ?? archiveOutputPath(path.resolve(inputPath)));

    // The schemas are already inlined by conversion, so no resolver is needed here.
    const byteLength = write(target, await packMosaicSource(result.document));
    return summarize(result, target, byteLength);
}
