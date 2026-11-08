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

fs.writeFileSync(path.join(dist, ".nojekyll"), "");
fs.writeFileSync(path.join(dist, "index.html"), `<!doctype html>
<meta charset="utf-8">
<title>Mosaic</title>
<meta http-equiv="refresh" content="0; url=docs/">
<a href="docs/">Mosaic documentation</a>
`);

console.log("dist ready: docs/ and viewer/ side by side in " + dist);
