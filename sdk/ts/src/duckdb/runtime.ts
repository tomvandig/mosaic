import { createRequire } from "node:module";
import path from "node:path";

type DuckDBModule = typeof import("@duckdb/node-api");

let loaded: DuckDBModule | undefined;

/**
 * Finds DuckDB at run time rather than at build time.
 *
 * `@duckdb/node-api` is a native module, so it cannot be bundled into the single-file
 * executable the CLI ships as. Loading it on demand keeps the executable free of it: the
 * archive commands never touch this, and a command that reads a database resolves the
 * module when it runs -- from the process, from the working directory, or from wherever
 * `MOSAIC_DUCKDB` points.
 */
export async function duckdb(): Promise<DuckDBModule> {
    if (loaded) return loaded;

    const attempts: string[] = [];

    // Running from source, or from anywhere the module is on the normal resolution path.
    try {
        loaded = await import("@duckdb/node-api");
        return loaded;
    } catch (error) {
        attempts.push(`import: ${message(error)}`);
    }

    // Bundled: nothing resolves relative to the bundle, so try the obvious places.
    // Each root is a directory; createRequire wants a file inside it to resolve from.
    const roots = [
        process.env.MOSAIC_DUCKDB,
        process.cwd(),
        path.dirname(process.execPath),
    ]
        .filter((root): root is string => typeof root === "string" && root.length > 0)
        .map(root => path.join(root, "index.js"));

    for (const root of roots) {
        try {
            const require = createRequire(path.resolve(root));
            loaded = require("@duckdb/node-api") as DuckDBModule;
            return loaded;
        } catch (error) {
            attempts.push(`${root}: ${message(error)}`);
        }
    }

    throw new Error(
        `Could not load @duckdb/node-api, which reading a database needs.\n` +
        `Install it beside where you are running (npm install @duckdb/node-api), or point ` +
        `MOSAIC_DUCKDB at a directory that has it.\n` +
        attempts.map(line => `  - ${line}`).join("\n"),
    );
}

function message(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    return text.split("\n")[0]!;
}
