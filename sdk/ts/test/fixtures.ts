import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MosaicFile, LoadMosaicFile } from "../src/MosaicFile.ts";
import { packMosaicSource, type MosaicSourceDocument, type SchemaResolver } from "../src/MosaicPack.ts";

export const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "test-data");

export function examplePath(name: string): string {
    return path.join(DATA_DIR, `${name}.mosaic.json`);
}

export function readExample(name: string): MosaicSourceDocument {
    return JSON.parse(fs.readFileSync(examplePath(name), "utf-8")) as MosaicSourceDocument;
}

export function readSchema(name: string): string {
    return fs.readFileSync(path.join(DATA_DIR, "schemas", `${name}.schema.json`), "utf-8");
}

/** Resolves the schema references the examples use, relative to the data folder. */
export const resolveExampleSchema: SchemaResolver = reference =>
    JSON.parse(fs.readFileSync(path.join(DATA_DIR, reference), "utf-8"));

/**
 * Packs an example and reads it back, so every test starts from a file that was actually
 * parsed off archive bytes rather than assembled in memory.
 */
export async function loadExample(name: string): Promise<MosaicFile> {
    return await LoadMosaicFile(await packMosaicSource(readExample(name), resolveExampleSchema));
}

/** Resolves a component reference to the parsed row it points at. */
export function resolve(file: MosaicFile, typeID: string, componentIndex: number): unknown {
    return JSON.parse(file.readRawComponent(typeID, componentIndex));
}
