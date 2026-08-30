// Builds a standalone executable using Node's built-in Single Executable
// Application support: `node --experimental-sea-config` produces a blob, which
// postject injects into a copy of the node binary.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, "build");
const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";
const exeName = isWindows ? "mosaic.exe" : "mosaic";
const exePath = path.join(buildDir, exeName);

const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: "inherit" });

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

console.log("Generating SEA blob...");
run(process.execPath, ["--experimental-sea-config", "sea-config.json"]);

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

console.log(`\nBuilt ${exePath}`);
