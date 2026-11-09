/**
 * After `vitepress build`: makes `dist/` ready to publish as it stands.
 *
 * GitHub Pages runs a site through Jekyll unless told not to, which drops anything whose
 * name begins with an underscore. And the root of `dist/` gets a page that sends a visitor
 * on to the docs, so the bare site address leads somewhere.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");

/**
 * The page metadata chunk, under a fixed name.
 *
 * VitePress names it after a hash of its contents, and every HTML page loads it by that
 * name, so editing any one page renamed it and changed every page with it. The site is
 * committed, so that was a hundred changed files for a one-line edit. Under a fixed name
 * only the chunk itself changes. (A browser may hold the old one for as long as the host
 * lets it cache, which on GitHub Pages is ten minutes.)
 */
function fixMetadataName(docs) {
    const chunks = path.join(docs, "assets", "chunks");
    if (!fs.existsSync(chunks)) return;
    const hashed = fs.readdirSync(chunks).find(name => /^metadata\.[0-9a-f]+\.js$/.test(name));
    if (!hashed) return;

    fs.renameSync(path.join(chunks, hashed), path.join(chunks, "metadata.js"));

    const walk = directory => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(file);
            else if (/\.(html|js)$/.test(entry.name)) {
                const text = fs.readFileSync(file, "utf-8");
                if (text.includes(hashed)) fs.writeFileSync(file, text.split(hashed).join("metadata.js"));
            }
        }
    };
    walk(docs);
}

fixMetadataName(path.join(dist, "docs"));

fs.writeFileSync(path.join(dist, ".nojekyll"), "");
fs.writeFileSync(path.join(dist, "index.html"), `<!doctype html>
<meta charset="utf-8">
<title>Mosaic</title>
<meta http-equiv="refresh" content="0; url=docs/">
<a href="docs/">Mosaic documentation</a>
`);

console.log("dist ready: docs/ and viewer/ side by side in " + dist);
