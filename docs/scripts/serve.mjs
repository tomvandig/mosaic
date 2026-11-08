/**
 * Serves `dist/` the way GitHub Pages will: the docs and the viewer side by side under
 * one base, so the viewer embedded in the docs is the built one.
 *
 *   npm run build && npm run serve      # then open http://localhost:4173/mosaic/docs/
 *
 * The base defaults to /mosaic/, matching tomvandig.github.io/mosaic. Set SITE_BASE to
 * serve it elsewhere (it should agree with DOCS_BASE at build time).
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "./static.mjs";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const base = process.env.SITE_BASE ?? "/mosaic/";
const port = Number(process.env.PORT ?? 4173);

http.createServer((request, response) => {
    if (serveStatic(request, response, base, dist)) return;
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
}).listen(port, () => {
    console.log(`serving ${dist} at http://localhost:${port}${base}docs/`);
});
