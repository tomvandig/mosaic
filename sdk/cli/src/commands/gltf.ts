import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
    convertGltfToSourceFile,
    convertGltfToArchiveFile,
    MOSAIC_SOURCE_EXTENSION,
    type ConvertFileResult,
} from "mosaic-ts";

const STABLE_IDS = "--stable-ids";

export const GLTF_USAGE = `mosaic gltf <input.gltf|input.glb|url> [output${MOSAIC_SOURCE_EXTENSION}] [${STABLE_IDS}]`;
export const GLTF_PACK_USAGE = `mosaic pack <input.gltf|input.glb|url> [output.tsr] [${STABLE_IDS}]`;

const isUrl = (input: string) => /^https?:\/\//i.test(input);

/** A relative uri inside a .gltf: one that names a file beside it, not data or a URL of its own. */
const isRelative = (uri: unknown): uri is string =>
    typeof uri === "string" && uri.length > 0 && !/^[a-z][a-z0-9+.-]*:/i.test(uri);

async function download(url: URL, target: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not download ${url}: ${response.status} ${response.statusText}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, new Uint8Array(await response.arrayBuffer()));
}

/**
 * The input as a file on disk.
 *
 * A URL is downloaded into a temporary folder first, under its own file name, so the
 * conversion -- which reads files -- sees exactly what it would if the model had been
 * saved by hand. A .gltf that keeps its buffers or images in files beside it has those
 * fetched too, relative to the URL, into the same places relative to the download.
 *
 * Without an output path, the result is written to the working directory: there is no
 * folder "beside" a URL to put it in.
 */
async function localInput(input: string): Promise<{ file: string; defaultDirectory?: string; done(): void }> {
    if (!isUrl(input)) return { file: input, done() {} };

    const url = new URL(input);
    const name = decodeURIComponent(path.posix.basename(url.pathname)) || "model.glb";
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "mosaic-gltf-"));
    const file = path.join(folder, name);

    console.log(`Downloading ${url}`);
    await download(url, file);

    if (name.toLowerCase().endsWith(".gltf")) {
        const document = JSON.parse(fs.readFileSync(file, "utf-8")) as {
            buffers?: { uri?: unknown }[];
            images?: { uri?: unknown }[];
        };
        const beside = [...(document.buffers ?? []), ...(document.images ?? [])]
            .map(entry => entry.uri)
            .filter(isRelative);

        for (const uri of new Set(beside)) {
            const target = path.resolve(folder, decodeURIComponent(uri));
            if (!target.startsWith(folder + path.sep)) throw new Error(`${name} refers to ${uri}, outside its own folder`);
            await download(new URL(uri, url), target);
        }
    }

    return {
        file,
        defaultDirectory: process.cwd(),
        done: () => fs.rmSync(folder, { recursive: true, force: true }),
    };
}

/** Where to write when no output was named and the input was downloaded. */
function defaultOutput(file: string, directory: string | undefined, extension: string): string | undefined {
    if (directory === undefined) return undefined;
    return path.join(directory, path.basename(file).split(".")[0] + extension);
}

/** Splits the flags off the positional arguments. */
function readArgs(argv: string[]): { positional: string[]; stableIds: boolean } {
    return {
        positional: argv.filter(arg => !arg.startsWith("--")),
        stableIds: argv.includes(STABLE_IDS),
    };
}

function report(inputPath: string, result: ConvertFileResult, stable = false): void {
    console.log(`Converted: ${isUrl(inputPath) ? inputPath : path.resolve(inputPath)} -> ${result.outputPath}`);
    console.log();
    console.log(`Nodes: ${result.nodeCount}`);
    if (stable) console.log(`Ids: derived from the file name, so this conversion repeats exactly`);
    console.log(`Components:`);
    for (const [typeID, count] of Object.entries(result.componentCounts)) {
        console.log(` - ${typeID}: ${count}`);
    }

    if (result.warnings.length > 0) {
        console.log();
        console.log(`Warnings (glTF data the Mosaic components do not carry):`);
        result.warnings.forEach(warning => console.log(` ! ${warning}`));
    }

    console.log();
    console.log(`Wrote ${result.byteLength} bytes.`);
}

/** Converts a glTF/GLB file into a Mosaic source document. */
export async function runGltf(argv: string[]): Promise<void> {
    const { positional, stableIds } = readArgs(argv);
    const [input_path, output_path] = positional;
    if (input_path === undefined) throw new Error(`Usage: ${GLTF_USAGE}`);

    const input = await localInput(input_path);
    try {
        const output = output_path ?? defaultOutput(input.file, input.defaultDirectory, MOSAIC_SOURCE_EXTENSION);
        report(input_path, convertGltfToSourceFile(input.file, output, { stableIds }), stableIds);
    } finally {
        input.done();
    }
}

/** Converts a glTF/GLB file straight into a packed .tsr archive. */
export async function runGltfPack(argv: string[]): Promise<void> {
    const { positional, stableIds } = readArgs(argv);
    const [input_path, output_path] = positional;
    if (input_path === undefined) throw new Error(`Usage: ${GLTF_PACK_USAGE}`);

    const input = await localInput(input_path);
    try {
        const output = output_path ?? defaultOutput(input.file, input.defaultDirectory, ".tsr");
        report(input_path, await convertGltfToArchiveFile(input.file, output, { stableIds }), stableIds);
    } finally {
        input.done();
    }
}
