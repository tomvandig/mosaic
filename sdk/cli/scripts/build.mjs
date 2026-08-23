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
    sourcemap: true,
    logLevel: "info"
});
