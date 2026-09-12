// Builds a standalone executable using Node's built-in Single Executable
// Application support: `node --experimental-sea-config` produces a blob, which
// postject injects into a copy of the node binary.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, "build");
const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";
const exeName = isWindows ? "mosaic.exe" : "mosaic";
const exePath = path.join(buildDir, exeName);

const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: "inherit" });
const MB = bytes => (bytes / 1048576).toFixed(1) + " MB";

/**
 * Replaces just the files this script produces, rather than the whole directory.
 * On Windows a virus scanner or an open handle can hold a freshly written binary for a
 * moment, and removing the directory then fails outright; retrying the individual file
 * rides that out and leaves anything else in the directory alone.
 */
function removeWithRetries(file) {
    for (let attempt = 0; ; attempt++) {
        try {
            fs.rmSync(file, { force: true });
            return;
        } catch (err) {
            if (attempt >= 20) throw err;
            // A short spin, rather than a sleep, so the build stays synchronous.
            const until = Date.now() + 100;
            while (Date.now() < until);
        }
    }
}

fs.mkdirSync(buildDir, { recursive: true });
removeWithRetries(exePath);
removeWithRetries(path.join(buildDir, "mosaic.blob"));

/**
 * DuckDB's binaries, compressed, as assets for the executable to carry.
 *
 * Only the host's binaries go in: this script copies the node binary it is running under,
 * so it was never building for anywhere else. Everything in the platform package that is
 * not paperwork is taken -- the addon and the shared library it links against -- rather
 * than a list of names, since which files those are differs by platform.
 */
function duckdbAssets() {
    const fromSdk = createRequire(path.join(root, "node_modules", "mosaic-ts", "index.js"));
    const pkg = `@duckdb/node-bindings-${process.platform}-${process.arch}`;

    let dir;
    try {
        dir = path.dirname(fromSdk.resolve(`${pkg}/package.json`));
    } catch {
        throw new Error(
            `${pkg} is not installed, so the executable would have no DuckDB to carry.\n` +
            `Install the sdk/ts dependencies, or build on a platform DuckDB ships for.`);
    }

    const paperwork = new Set(["package.json", "README.md", "LICENSE"]);
    const files = fs.readdirSync(dir).filter(name => !paperwork.has(name));
    if (files.length === 0) throw new Error(`${pkg} has no binaries in ${dir}`);

    const into = path.join(buildDir, "sea-assets");
    fs.rmSync(into, { recursive: true, force: true });
    fs.mkdirSync(into, { recursive: true });

    const assets = {};
    let raw = 0, packed = 0;

    for (const name of files) {
        const bytes = fs.readFileSync(path.join(dir, name));
        // Unpacking happens once per machine, so the slower setting is the right trade:
        // it is a smaller executable to hand around for a few hundred milliseconds paid
        // on one run out of however many.
        const squeezed = zlib.brotliCompressSync(bytes, {
            params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
                [zlib.constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
            },
        });

        fs.writeFileSync(path.join(into, name + ".br"), squeezed);
        assets[`duckdb/${name}.br`] = path.relative(root, path.join(into, name + ".br"))
            .split(path.sep).join("/");

        raw += bytes.length;
        packed += squeezed.length;
        console.log(`  ${name.padEnd(14)} ${MB(bytes.length).padStart(9)} -> ${MB(squeezed.length)}`);
    }

    console.log(`  carrying DuckDB ${MB(raw)} as ${MB(packed)}`);
    return assets;
}

console.log("Packing DuckDB...");
const assets = duckdbAssets();

// The checked-in config holds the settings; the assets are worked out per platform, so
// the config the blob is actually generated from is written here.
const base = JSON.parse(fs.readFileSync(path.join(root, "sea-config.json"), "utf-8"));
const configPath = path.join(buildDir, "sea-config.json");
fs.writeFileSync(configPath, JSON.stringify({ ...base, assets }, null, 4));

console.log("Generating SEA blob...");
run(process.execPath, ["--experimental-sea-config", path.relative(root, configPath)]);

console.log(`Copying node binary -> ${exePath}`);
fs.copyFileSync(process.execPath, exePath);

if (isMac) {
    // A signed binary must have its signature removed before injection.
    try {
        run("codesign", ["--remove-signature", exePath]);
    } catch {
        console.warn("codesign --remove-signature failed; continuing");
    }
}

console.log("Injecting blob with postject...");
run(process.execPath, [
    path.join(root, "node_modules", "postject", "dist", "cli.js"),
    exePath,
    "NODE_SEA_BLOB",
    path.join(buildDir, "mosaic.blob"),
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    ...(isMac ? ["--macho-segment-name", "NODE_SEA"] : [])
]);

if (isMac) {
    try {
        run("codesign", ["--sign", "-", exePath]);
    } catch {
        console.warn("codesign --sign failed; the binary may not run on this machine");
    }
}

console.log(`\nBuilt ${exePath}  ${MB(fs.statSync(exePath).size)}`);
