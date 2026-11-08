import path from "node:path";
import { packMosaicSourceFile, MOSAIC_ARCHIVE_EXTENSION } from "mosaic-ts";
import { runGltfPack } from "./gltf.js";
import { runIfcPack } from "./ifc.js";
import { runSvgPack } from "./svg.js";

export const PACK_USAGE =
    `mosaic pack <input.json|.gltf|.glb|.ifc|.svg|url> [output${MOSAIC_ARCHIVE_EXTENSION}] [flags]`;

/** What `mosaic help` prints under the usage line: which input does what, and its flags. */
export const PACK_DETAILS = [
    `.json, .mosaic.json  a Mosaic source document`,
    `.gltf, .glb          a glTF model, or an http(s) URL to one   [--stable-ids]`,
    `.ifc                 an IFC4 / IFC2X3 model                   [--center] [--no-geometry] [--seed=<text>]`,
    `.svg                 a drawing, as one node`,
];

/** The extension that decides what an input is, read off a URL's path for a URL. */
function extensionOf(input: string): string {
    const name = /^https?:\/\//i.test(input) ? new URL(input).pathname : input;
    return path.extname(name).toLowerCase();
}

/** Packs a Mosaic source document. */
async function packSource(argv: string[]): Promise<void> {
    const [input_path, output_path] = argv.filter(arg => !arg.startsWith("--"));
    if (input_path === undefined) throw new Error(`Usage: ${PACK_USAGE}`);

    const result = await packMosaicSourceFile(input_path, output_path);

    console.log(`Packed: ${path.resolve(input_path)} -> ${result.outputPath}`);
    console.log();
    console.log(`Component tables (${result.componentCount} rows):`);
    result.tables.forEach(table => console.log(` - ${table}`));
    console.log();
    console.log(`Wrote ${result.byteLength} bytes.`);
}

/**
 * Packs anything Mosaic can read into a .tsr archive, choosing how by the extension.
 *
 * A source document is packed as it is written. The other formats are converted first,
 * with their schemas inlined, so every archive this writes stands alone.
 */
export async function runPack(argv: string[]): Promise<void> {
    const input = argv.find(arg => !arg.startsWith("--"));
    if (input === undefined) throw new Error(`Usage: ${PACK_USAGE}\n\n  ${PACK_DETAILS.join("\n  ")}`);

    const isUrl = /^https?:\/\//i.test(input);
    const extension = extensionOf(input);

    switch (extension) {
        case ".gltf":
        case ".glb":
            return runGltfPack(argv);
        case ".json":
            if (isUrl) break;
            return packSource(argv);
        case ".ifc":
            if (isUrl) break;
            return runIfcPack(argv);
        case ".svg":
            if (isUrl) break;
            return runSvgPack(argv);
        default:
            throw new Error(
                `Cannot pack ${input}: ${extension ? `"${extension}" is not` : "no extension says what it is, and it is not"} `
                + `a format mosaic reads.\n\n  ${PACK_DETAILS.join("\n  ")}`);
    }

    throw new Error(`Cannot pack ${input}: only glTF (.gltf, .glb) can be packed from a URL. `
        + `Download it first and pack the file.`);
}
