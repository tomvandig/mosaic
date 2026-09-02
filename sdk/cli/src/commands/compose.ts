import path from "node:path";
import { composeArchiveToGlb, GLB_EXTENSION } from "mosaic-ts";

/** Extensions that mean "this is a database", not an archive. */
const DATABASE_EXTENSIONS = [".duckdb", ".db", ".ddb"];

export const COMPOSE_USAGE =
    `mosaic compose <input.tsr|input.duckdb> [output${GLB_EXTENSION}] [--file <id>]...`;

function isDatabase(inputPath: string): boolean {
    return DATABASE_EXTENSIONS.includes(path.extname(inputPath).toLowerCase());
}

/** Reads the repeatable --file option, which narrows a database to some of its archives. */
function readArgs(argv: string[]): { positional: string[]; files: string[] } {
    const positional: string[] = [];
    const files: string[] = [];

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === "--file") {
            const value = argv[++i];
            if (value === undefined) throw new Error(`--file needs the id of an archive in the database`);
            files.push(value);
        } else if (arg.startsWith("--file=")) {
            files.push(arg.slice("--file=".length));
        } else if (!arg.startsWith("--")) {
            positional.push(arg);
        }
    }

    return { positional, files };
}

export async function runCompose(argv: string[]): Promise<void> {
    const { positional, files } = readArgs(argv);
    const [input_path, output_path] = positional;
    if (input_path === undefined) throw new Error(`Usage: ${COMPOSE_USAGE}`);

    if (isDatabase(input_path)) return await composeFromDatabase(input_path, output_path, files);
    if (files.length > 0) throw new Error(`--file only means something for a database, not for an archive`);

    const result = await composeArchiveToGlb(input_path, output_path);

    console.log(`Composed: ${path.resolve(input_path)} -> ${result.outputPath}`);
    console.log();
    console.log(`Sources (imports first):`);
    result.sources.forEach(source => console.log(` - ${source}`));
    console.log();
    console.log(`Nodes: ${result.nodeCount}`);
    console.log(`Meshes: ${result.meshCount}`);
    console.log(`Binary chunk: ${result.binaryLength} bytes`);

    if (result.warnings.length > 0) {
        console.log();
        console.log(`Warnings:`);
        result.warnings.forEach(warning => console.log(` ! ${warning}`));
    }

    console.log();
    console.log(`Wrote ${result.byteLength} bytes.`);
}

/**
 * Composing a database needs DuckDB, which is a native module and so cannot be bundled
 * into this executable. It is loaded only when a database is actually asked for, which
 * keeps every other command working with nothing installed.
 */
async function composeFromDatabase(inputPath: string, outputPath: string | undefined, files: string[]): Promise<void> {
    const { composeDatabaseToGlb } = await import("mosaic-ts/duckdb");
    const result = await composeDatabaseToGlb(inputPath, outputPath, files.length > 0 ? { files } : {});

    console.log(`Composed: ${path.resolve(inputPath)} -> ${result.outputPath}`);
    console.log();
    console.log(`Archives (in the order they were inserted):`);
    result.sources.forEach(source => console.log(` - ${source}`));
    console.log();
    console.log(`Nodes: ${result.nodeCount}`);
    console.log(`Meshes: ${result.meshCount}`);
    console.log(`Binary chunk: ${result.binaryLength} bytes`);

    if (result.warnings.length > 0) {
        console.log();
        console.log(`Warnings:`);
        result.warnings.forEach(warning => console.log(` ! ${warning}`));
    }

    console.log();
    console.log(`Wrote ${result.byteLength} bytes.`);
}
