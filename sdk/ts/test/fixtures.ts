import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MosaicFile, LoadMosaicFile } from "../src/MosaicFile.ts";
import { collapseNodesByPath } from "../src/MosaicFileOperations.ts";
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
export function resolve(file: MosaicFile, typeID: string, index: number): unknown {
    return JSON.parse(file.readRawComponent(typeID, index));
}

export type Row = Record<string, any>;

/** The components a node carries, keyed by reference name. */
export function componentsOf(file: MosaicFile, nodeId: string): Record<string, Row> {
    const node = collapseNodesByPath(file).get(nodeId);
    if (!node) throw new Error(`no node ${nodeId}`);

    return Object.fromEntries(
        (node.components ?? []).map(ref => [ref.id, resolve(file, ref.type, ref.index) as Row]),
    );
}

/** Follows a glTF-style reference -- a node id -- to the single component that node carries. */
export function follow(file: MosaicFile, nodeId: unknown): Row {
    if (typeof nodeId !== "string") throw new Error(`expected a node id, got ${JSON.stringify(nodeId)}`);

    const node = collapseNodesByPath(file).get(nodeId);
    if (!node) throw new Error(`no node ${nodeId}`);

    const [ref, ...rest] = node.components ?? [];
    if (!ref) throw new Error(`node ${nodeId} carries no component`);
    if (rest.length > 0) throw new Error(`node ${nodeId} carries more than one component`);

    return resolve(file, ref.type, ref.index) as Row;
}

/** Reads a glTF buffer component's data: URI back into bytes. */
export function decodeBuffer(uri: string): Buffer {
    const marker = ";base64,";
    const at = uri.indexOf(marker);
    if (at === -1) throw new Error("buffer uri is not a base64 data URI");
    return Buffer.from(uri.slice(at + marker.length), "base64");
}
