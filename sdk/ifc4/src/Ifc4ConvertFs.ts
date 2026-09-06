import fs from "node:fs";
import path from "node:path";
import { packMosaicSource, MOSAIC_ARCHIVE_EXTENSION } from "mosaic-ts";
import { ifc4ToMosaic, type Ifc4Api, type Ifc4ConvertOptions, type Ifc4ConvertResult, type Ifc4Stats } from "./Ifc4ToMosaic.ts";
import { webIfc } from "./runtime.ts";

/** The extension a Mosaic source document carries. */
export const MOSAIC_SOURCE_EXTENSION = ".mosaic.json";

/** `models/tower.ifc` -> `models/tower` */
function stemOf(inputPath: string): string {
    const base = path.basename(inputPath);
    const dot = base.lastIndexOf(".");
    return dot > 0 ? base.slice(0, dot) : base;
}

/** `models/tower.ifc` -> `models/tower.mosaic.json` */
export function sourceOutputPath(inputPath: string): string {
    return path.join(path.dirname(inputPath), `${stemOf(inputPath)}${MOSAIC_SOURCE_EXTENSION}`);
}

/** `models/tower.ifc` -> `models/tower.tsr` */
export function archiveOutputPath(inputPath: string): string {
    return path.join(path.dirname(inputPath), `${stemOf(inputPath)}${MOSAIC_ARCHIVE_EXTENSION}`);
}

export interface Ifc4FileOptions extends Ifc4ConvertOptions {
    /**
     * Move the model to the origin as it is read.
     *
     * A georeferenced model can sit tens of kilometres from zero, and single-precision
     * vertex data has no digits to spare at that distance -- geometry visibly wobbles.
     * Turning this on shifts the whole model, which fixes the wobble and loses the
     * real-world position. Off by default: the coordinates are what the file said.
     */
    center?: boolean;
}

/** An IFC model held open by the parser, with the handle needed to read it. */
export interface OpenIfcModel {
    api: Ifc4Api;
    modelID: number;
    close(): void;
}

/** Opens IFC bytes with web-ifc, loading the parser if this is the first call. */
export async function openIfcModel(bytes: Uint8Array, options: Ifc4FileOptions = {}): Promise<OpenIfcModel> {
    const module = await webIfc();

    const api = new module.IfcAPI();
    await api.Init();

    const modelID = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: options.center === true });

    return {
        api: api as unknown as Ifc4Api,
        modelID,
        close: () => api.CloseModel(modelID),
    };
}

/** Reads an .ifc file and converts it into a Mosaic source document. */
export async function convertIfcFile(inputPath: string, options: Ifc4FileOptions = {}): Promise<Ifc4ConvertResult> {
    if (!fs.existsSync(inputPath)) throw new Error(`File ${inputPath} does not exist`);

    const source = path.resolve(inputPath);
    const model = await openIfcModel(new Uint8Array(fs.readFileSync(source)), options);

    try {
        return ifc4ToMosaic(model.api, model.modelID, {
            // Entities that have no GlobalId are keyed within the file they came from, and
            // the file name is the only name that file has.
            seed: path.basename(source),
            ...options,
            provenance: {
                id: path.basename(source),
                message: `Imported from ${path.basename(source)}`,
                ...options.provenance,
            },
        });
    } finally {
        model.close();
    }
}

export interface Ifc4FileResult {
    outputPath: string;
    byteLength: number;
    warnings: string[];
    stats: Ifc4Stats;
}

function write(target: string, data: string | Uint8Array): number {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    return typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
}

/** Converts an .ifc file into a Mosaic source document on disk. */
export async function convertIfcToSourceFile(inputPath: string, outputPath?: string, options?: Ifc4FileOptions): Promise<Ifc4FileResult> {
    const result = await convertIfcFile(inputPath, options);
    const target = path.resolve(outputPath ?? sourceOutputPath(path.resolve(inputPath)));

    return {
        outputPath: target,
        byteLength: write(target, `${JSON.stringify(result.document, null, 2)}\n`),
        warnings: result.warnings,
        stats: result.stats,
    };
}

/** Converts an .ifc file straight into a packed Mosaic archive. */
export async function convertIfcToArchiveFile(inputPath: string, outputPath?: string, options?: Ifc4FileOptions): Promise<Ifc4FileResult> {
    const result = await convertIfcFile(inputPath, options);
    const target = path.resolve(outputPath ?? archiveOutputPath(path.resolve(inputPath)));

    // Conversion inlines every schema, so no resolver is needed here.
    return {
        outputPath: target,
        byteLength: write(target, await packMosaicSource(result.document)),
        warnings: result.warnings,
        stats: result.stats,
    };
}
