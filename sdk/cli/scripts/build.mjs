import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Where DuckDB's native binding lives, and which version it is.
 *
 * The package is a dependency of mosaic-ts rather than of the CLI, so it is resolved from
 * there rather than from here. The version goes into the bundle so that unpacked copies
 * of different DuckDBs never land on each other.
 */
const fromSdk = createRequire(path.join(root, "node_modules", "mosaic-ts", "index.js"));
const bindings = path.dirname(fromSdk.resolve("@duckdb/node-bindings/package.json"));
const duckdbVersion = JSON.parse(
    fs.readFileSync(path.join(bindings, "package.json"), "utf-8")).version;

/**
 * Sends DuckDB's native binding to the copy that can find itself inside the executable.
 *
 * Everything above the binding is ordinary JavaScript and bundles like anything else. The
 * one file that cannot is `duckdb.node`, which the operating system loads from disk; the
 * stand-in knows how to put it there first.
 */
const carryDuckDB = {
    name: "duckdb-binding",
    setup(build) {
        const shim = path.join(root, "src", "duckdb-binding.cjs");
        build.onResolve({ filter: /^@duckdb\/node-bindings$/ }, args =>
            args.importer === shim ? undefined : { path: shim });
    },
};

await esbuild.build({
    entryPoints: [path.join(root, "src", "mosaic.ts")],
    outfile: path.join(root, "dist", "mosaic.cjs"),
    bundle: true,
    platform: "node",
    // Node's SEA loader only supports CommonJS entry points.
    format: "cjs",
    target: "node24",
    // web-ifc is a WebAssembly module that locates its .wasm relative to the JavaScript
    // loading it, so it is left out and resolved at run time by the commands that need it.
    // DuckDB used to be left out too; it now travels inside the executable instead, with
    // its native binding carried as an asset and unpacked on first use.
    external: ["web-ifc"],
    plugins: [carryDuckDB],
    define: { MOSAIC_DUCKDB_VERSION: JSON.stringify(duckdbVersion) },
    sourcemap: true,
    logLevel: "info"
});

console.log(`Bundled with DuckDB ${duckdbVersion} from ${path.relative(root, bindings)}`);
