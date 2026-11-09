import path from "node:path";
import { packMosaicSourceFile, MOSAIC_ARCHIVE_EXTENSION, MOSAIC_SOURCE_EXTENSION } from "mosaic-ts";
import { runGltf, runGltfPack } from "./gltf.js";
import { runIfc, runIfcPack } from "./ifc.js";
import { runSvgPack } from "./svg.js";

export const PACK_USAGE =
    `mosaic pack <input.json|.gltf|.glb|.ifc|.svg|url> [output${MOSAIC_ARCHIVE_EXTENSION}|output${MOSAIC_SOURCE_EXTENSION}] [flags]`;

/** What `mosaic help` prints under the usage line: which input does what, and its flags. */
export const PACK_DETAILS = [
    `.json, .mosaic.json  a Mosaic source document`,
    `.gltf, .glb          a glTF model, or an http(s) URL to one   [--stable-ids]`,
    `.ifc                 an IFC4 / IFC2X3 model                   [--center] [--no-geometry] [--seed=<text>]`,
    `.svg                 a drawing, as one node`,
    ``,
    `The output is a ${MOSAIC_ARCHIVE_EXTENSION} archive. Name it ${MOSAIC_SOURCE_EXTENSION} to get an editable source`,
    `document instead (glTF and IFC only), to change before packing.`,
];

const isUrl = (input: string) => /^https?:\/\//i.test(input);

/** The extension that decides what an input is, read off a URL's path for a URL. */
function extensionOf(input: string): string {
    const name = isUrl(input) ? new URL(input).pathname : input;
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

const details = () => `\n\n  ${PACK_DETAILS.join("\n  ")}`;

/**
 * Packs anything Mosaic reads, choosing how by the extensions.
 *
 * The input's extension says what it is. The output's says what to write: a .tsr archive
 * by default, or, named .mosaic.json, the converted model as an editable source document,
 * which `mosaic pack` turns into an archive once it has been changed. Either way the
 * schemas are inlined, so what this writes stands alone.
 */
export async function runPack(argv: string[]): Promise<void> {
    const [input, output] = argv.filter(arg => !arg.startsWith("--"));
    if (input === undefined) throw new Error(`Usage: ${PACK_USAGE}${details()}`);

    const extension = extensionOf(input);
    const toSource = output !== undefined && output.toLowerCase().endsWith(MOSAIC_SOURCE_EXTENSION);
    const fromUrl = isUrl(input);

    if (fromUrl && extension !== ".gltf" && extension !== ".glb") {
        throw new Error(`Cannot pack ${input}: only glTF (.gltf, .glb) can be packed from a URL. `
            + `Download it first and pack the file.`);
    }

    switch (extension) {
        case ".gltf":
        case ".glb":
            return toSource ? runGltf(argv) : runGltfPack(argv);
        case ".ifc":
            return toSource ? runIfc(argv) : runIfcPack(argv);
        case ".svg":
            if (toSource) {
                throw new Error(`Cannot write ${output}: an SVG is carried whole rather than taken apart, `
                    + `so there is no source document to edit. Pack it to ${MOSAIC_ARCHIVE_EXTENSION} instead.`);
            }
            return runSvgPack(argv);
        case ".json":
            if (toSource) {
                throw new Error(`Cannot write ${output}: ${input} is already a source document. `
                    + `Pack it to ${MOSAIC_ARCHIVE_EXTENSION} instead.`);
            }
            return packSource(argv);
        default:
            throw new Error(`Cannot pack ${input}: `
                + `${extension ? `"${extension}" is not` : "no extension says what it is, and it is not"} `
                + `a format mosaic reads.${details()}`);
    }
}
