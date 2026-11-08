"use strict";

/**
 * DuckDB's native binding, carried inside the executable.
 *
 * `@duckdb/node-api` is JavaScript all the way down to one file: `duckdb.node`, an addon
 * the operating system has to load from disk, and the shared library beside it that the
 * addon links against. Those two cannot live inside a single-file executable -- nothing
 * can dlopen a byte range -- but they can ride along as data, which is what this does.
 * The build compresses them into the executable as assets; the first command that opens a
 * database unpacks them into a cache directory and loads them from there. Later runs find
 * them already unpacked and just load.
 *
 * This file stands in for `@duckdb/node-bindings` when the CLI is bundled; the build
 * points that import here. Running from source, nothing about this is involved and the
 * real package is used as it is.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { createRequire } = require("node:module");

/** Stamped in by the build, so unpacked copies of different DuckDBs never collide. */
const VERSION = typeof MOSAIC_DUCKDB_VERSION === "string" ? MOSAIC_DUCKDB_VERSION : "unknown";

/** The assets the build put in, under this prefix. */
const PREFIX = "duckdb/";

/** Where unpacked binaries are kept between runs. */
function cacheRoot() {
    const asked = process.env.MOSAIC_DUCKDB_CACHE;
    if (asked) return asked;

    const home = os.homedir();
    if (process.platform === "win32") {
        return process.env.LOCALAPPDATA || (home ? path.join(home, "AppData", "Local") : os.tmpdir());
    }
    if (process.platform === "darwin") {
        return home ? path.join(home, "Library", "Caches") : os.tmpdir();
    }
    return process.env.XDG_CACHE_HOME || (home ? path.join(home, ".cache") : os.tmpdir());
}

/**
 * Unpacks the binaries if they are not already there, and says where they went.
 *
 * Two copies of the CLI can start at once, so nothing is written under the name it will
 * finally have: each file is inflated beside itself and moved into place, which is atomic
 * on both filesystems this runs on. A file that is already there is left alone -- it was
 * put there by a build of this same DuckDB, since the version is in the directory name.
 */
function unpack(sea) {
    const into = path.join(cacheRoot(), "mosaic", "duckdb-" + VERSION);
    const keys = sea.getAssetKeys().filter(key => key.startsWith(PREFIX));

    if (keys.length === 0) return undefined;

    fs.mkdirSync(into, { recursive: true });

    for (const key of keys) {
        const name = path.basename(key).replace(/\.br$/, "");
        const target = path.join(into, name);

        // Present and not empty is present: a half-written file cannot get here, since a
        // file only arrives under this name by being renamed onto it whole.
        try {
            if (fs.statSync(target).size > 0) continue;
        } catch {
            // Not there yet, which is the ordinary case on a first run.
        }

        const packed = Buffer.from(sea.getRawAsset(key));
        const bytes = key.endsWith(".br") ? zlib.brotliDecompressSync(packed) : packed;

        const partial = target + "." + process.pid + ".part";
        fs.writeFileSync(partial, bytes);
        try {
            fs.renameSync(partial, target);
        } catch (error) {
            // Another process got there first; its copy is as good as this one.
            fs.rmSync(partial, { force: true });
            if (!fs.existsSync(target)) throw error;
        }
    }

    return into;
}

/** Loads the addon at a path, with the shared library beside it. */
function open(file) {
    const holder = { exports: {} };
    process.dlopen(holder, file);
    return holder.exports;
}

/**
 * The binding from an installed copy of the package, wherever that is.
 *
 * Resolution starts from a file inside the directory given, so a root is named as a
 * directory and node walks up from there the way it would for anything else. The require
 * is made rather than written, which also keeps the bundler from rewriting it back to
 * this file.
 */
function fromInstall(root) {
    const from = createRequire(path.join(path.resolve(root), "index.js"));
    return from("@duckdb/node-bindings");
}

function load() {
    // An install the caller points at wins, so a newer DuckDB can be tried without a
    // rebuild -- which is what the variable was for before any of this was carried along.
    const asked = process.env.MOSAIC_DUCKDB;
    if (asked) {
        try {
            return fromInstall(asked);
        } catch (error) {
            throw new Error(
                `MOSAIC_DUCKDB points at ${asked}, but @duckdb/node-bindings could not be ` +
                `loaded from there: ${first(error)}\n` +
                `Unset MOSAIC_DUCKDB to use the copy built into this executable.`);
        }
    }

    let sea;
    try {
        sea = require("node:sea");
    } catch {
        sea = undefined;
    }

    if (sea && sea.isSea()) {
        const into = unpack(sea);
        if (into) return open(path.join(into, "duckdb.node"));
    }

    // Not a single-file executable: the bundle is being run by node, so the package is
    // somewhere on disk, or nowhere. DuckDB is not a dependency of the published CLI --
    // its native binary is large and most commands never need it -- so it is looked for
    // where someone who installed it would have put it: beside the bundle (installed
    // next to the CLI, or globally alongside it), in the working directory, and, running
    // from this repository, in the linked mosaic-ts.
    const roots = [
        __dirname,
        path.join(__dirname, ".."),
        process.cwd(),
        path.join(process.cwd(), "node_modules", "mosaic-ts"),
        path.dirname(process.execPath),
    ];

    const tried = [];
    for (const root of roots) {
        try {
            return fromInstall(root);
        } catch (error) {
            tried.push(`  - ${root}: ${first(error)}`);
        }
    }

    // The JavaScript half of DuckDB is bundled; only the native half is missing, and the two
    // have to be the same version, so the instruction names it.
    const wanted = VERSION === "unknown" ? "@duckdb/node-api" : "@duckdb/node-api@" + VERSION;
    // Tagged, so the SDK's own loader (mosaic-ts/src/duckdb/runtime.ts), which catches
    // this on the way out, passes it on as it is rather than wrapping it in a vaguer one.
    throw Object.assign(new Error(
        "DuckDB is not installed, and this command needs it to read or write a database.\n" +
        "\n" +
        "It is left out of the CLI because it is large and only the database commands use it.\n" +
        "Install it in the directory you are running from:\n" +
        "\n" +
        "    npm install " + wanted + "\n" +
        "\n" +
        "or point MOSAIC_DUCKDB at a directory where it is installed. Looked in:\n" +
        tried.join("\n")), { code: "MOSAIC_DUCKDB_MISSING" });
}

function first(error) {
    const text = error instanceof Error ? error.message : String(error);
    return text.split("\n")[0];
}

module.exports = load();
