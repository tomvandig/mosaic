import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await esbuild.build({
    entryPoints: [path.join(root, "src", "mosaic.ts")],
    outfile: path.join(root, "dist", "mosaic.cjs"),
    bundle: true,
    platform: "node",
    // Node's SEA loader only supports CommonJS entry points.
    format: "cjs",
    target: "node24",
    // DuckDB is a native module and web-ifc is a WebAssembly one: neither can live inside
    // a single-file executable -- the .wasm is located relative to the JavaScript that
    // loads it -- so both are left out and resolved at run time by the commands that need
    // them.
    external: ["@duckdb/node-api", "web-ifc"],
    sourcemap: true,
    logLevel: "info"
});
