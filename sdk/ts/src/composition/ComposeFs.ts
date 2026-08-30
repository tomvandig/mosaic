import fs from "node:fs";
import path from "node:path";
import { LoadMosaicFile, type MosaicFile } from "../MosaicFile.ts";
import { federate } from "../MosaicFileOperations.ts";
import { mosaicToGltf, type ComposeResult } from "./MosaicToGltf.ts";
import { writeGlb } from "./GlbWriter.ts";

export const GLB_EXTENSION = ".glb";

/** `scene/house.tsr` -> `scene/house.glb` */
export function glbOutputPath(inputPath: string): string {
    const stem = path.basename(inputPath).split(".")[0];
    return path.join(path.dirname(inputPath), `${stem}${GLB_EXTENSION}`);
}

export interface LoadedTree {
    /** Every archive that went in, imports first, in the order they were merged. */
    sources: string[];
    file: MosaicFile;
}

/**
 * Loads an archive and everything it imports, merging imports underneath the file that
 * imports them so a later section still wins. Imports naming a URI this cannot fetch --
 * anything that is not a path on disk -- are skipped and reported.
 */
export async function loadWithImports(inputPath: string, warnings: string[] = []): Promise<LoadedTree> {
    const visiting = new Set<string>();
    const sources: string[] = [];

    async function load(archivePath: string, importedBy?: string): Promise<MosaicFile> {
        const resolved = path.resolve(archivePath);

        if (visiting.has(resolved)) {
            throw new Error(`Import cycle: ${resolved} is already being loaded`);
        }
        if (!fs.existsSync(resolved)) {
            throw new Error(importedBy
                ? `Import "${path.relative(path.dirname(importedBy), resolved)}", referenced by ${path.basename(importedBy)}, does not exist at ${resolved}`
                : `File ${archivePath} does not exist`);
        }

        visiting.add(resolved);
        const file = await LoadMosaicFile(fs.readFileSync(resolved));

        let merged: MosaicFile | undefined;
        for (const entry of file.index.imports) {
            if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(entry.uri) && !/^file:/i.test(entry.uri)) {
                warnings.push(`skipped import "${entry.uri}": only imports on disk can be resolved`);
                continue;
            }

            const importPath = path.resolve(path.dirname(resolved), decodeURIComponent(entry.uri.replace(/^file:\/*/i, "")));
            const imported = await load(importPath, resolved);
            // Imports are the layer underneath, so they merge in as the older file.
            merged = merged ? federate(merged, imported, true) : imported;
        }

        visiting.delete(resolved);
        sources.push(resolved);

        return merged ? federate(merged, file, true) : file;
    }

    return { sources, file: await load(inputPath) };
}

export interface ComposeFileResult {
    outputPath: string;
    byteLength: number;
    /** The archives that were merged, imports first. */
    sources: string[];
    nodeCount: number;
    meshCount: number;
    /** Bytes in the GLB binary chunk. */
    binaryLength: number;
    warnings: string[];
}

/** Composes an archive and its imports into a glTF document plus its binary chunk. */
export async function composeArchive(inputPath: string): Promise<ComposeResult & { sources: string[] }> {
    const warnings: string[] = [];
    const { file, sources } = await loadWithImports(inputPath, warnings);
    const composed = mosaicToGltf(file);

    return { ...composed, sources, warnings: [...warnings, ...composed.warnings] };
}

/** Composes an archive and its imports into a .glb file on disk. */
export async function composeArchiveToGlb(inputPath: string, outputPath?: string): Promise<ComposeFileResult> {
    const composed = await composeArchive(inputPath);
    const target = path.resolve(outputPath ?? glbOutputPath(path.resolve(inputPath)));

    const bytes = writeGlb(composed.document, composed.binary);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);

    return {
        outputPath: target,
        byteLength: bytes.byteLength,
        sources: composed.sources,
        nodeCount: composed.document.nodes?.length ?? 0,
        meshCount: composed.document.meshes?.length ?? 0,
        binaryLength: composed.binary.byteLength,
        warnings: composed.warnings,
    };
}
