import path from "node:path";
import {
    convertIfcToSourceFile,
    convertIfcToArchiveFile,
    MOSAIC_SOURCE_EXTENSION,
    type Ifc4FileOptions,
    type Ifc4FileResult,
} from "mosaic-ifc4";

const CENTER = "--center";
const NO_GEOMETRY = "--no-geometry";
const SEED = "--seed=";

const FLAGS = `[${CENTER}] [${NO_GEOMETRY}] [${SEED}<text>]`;

export const IFC_USAGE = `mosaic ifc <input.ifc> [output${MOSAIC_SOURCE_EXTENSION}] ${FLAGS}`;
export const IFC_PACK_USAGE = `mosaic ifc-pack <input.ifc> [output.tsr] ${FLAGS}`;

/** Splits the flags off the positional arguments. */
function readArgs(argv: string[]): { positional: string[]; options: Ifc4FileOptions } {
    const seed = argv.find(arg => arg.startsWith(SEED))?.slice(SEED.length);

    return {
        positional: argv.filter(arg => !arg.startsWith("--")),
        options: {
            center: argv.includes(CENTER),
            withoutGeometry: argv.includes(NO_GEOMETRY),
            ...(seed === undefined ? {} : { seed }),
        },
    };
}

function report(inputPath: string, result: Ifc4FileResult): void {
    const { stats } = result;

    console.log(`Converted: ${path.resolve(inputPath)} -> ${result.outputPath}`);
    console.log();
    console.log(`Schema: ${stats.schema}`);
    console.log(`Nodes: ${stats.nodes} (${stats.entities} from IFC entities)`);
    console.log(`References: ${stats.references}`);
    console.log(`Relationships: ${stats.relationships}`);
    console.log(`Property sets: ${stats.propertySets}, quantity sets: ${stats.quantitySets}`);

    if (stats.triangles > 0) {
        console.log(`Geometry: ${stats.triangles} triangles, ${stats.vertices} vertices, `
            + `${(stats.geometryBytes / 1024).toFixed(0)} KB before encoding`);
    } else {
        console.log(`Geometry: none`);
    }

    console.log(`Components:`);
    for (const [typeID, count] of Object.entries(stats.components)) {
        console.log(` - ${typeID}: ${count}`);
    }

    if (result.warnings.length > 0) {
        console.log();
        console.log(`Warnings (IFC data the Mosaic components do not carry):`);
        result.warnings.forEach(warning => console.log(` ! ${warning}`));
    }

    console.log();
    console.log(`Wrote ${result.byteLength} bytes.`);
}

/** Converts an IFC file into a Mosaic source document. */
export async function runIfc(argv: string[]): Promise<void> {
    const { positional, options } = readArgs(argv);
    const [input_path, output_path] = positional;
    if (input_path === undefined) throw new Error(`Usage: ${IFC_USAGE}`);

    report(input_path, await convertIfcToSourceFile(input_path, output_path, options));
}

/** Converts an IFC file straight into a packed .tsr archive. */
export async function runIfcPack(argv: string[]): Promise<void> {
    const { positional, options } = readArgs(argv);
    const [input_path, output_path] = positional;
    if (input_path === undefined) throw new Error(`Usage: ${IFC_PACK_USAGE}`);

    report(input_path, await convertIfcToArchiveFile(input_path, output_path, options));
}
