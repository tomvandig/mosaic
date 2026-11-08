/**
 * A few lines of static file serving, shared by the dev server (for the viewer, which
 * VitePress knows nothing about) and `npm run serve` (for the whole built site).
 */
import fs from "node:fs";
import path from "node:path";

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".tsr": "application/zip",
};

/**
 * Serves `request` out of `root` when its path begins with `prefix`, and says whether it
 * did. A folder answers with its index.html.
 */
export function serveStatic(request, response, prefix, root) {
    const url = new URL(request.url ?? "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith(prefix)) return false;

    let file = path.join(root, pathname.slice(prefix.length));
    if (!path.resolve(file).startsWith(path.resolve(root))) return false;

    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        if (!pathname.endsWith("/")) {
            response.writeHead(301, { location: pathname + "/" + url.search });
            response.end();
            return true;
        }
        file = path.join(file, "index.html");
    }
    // Pretty URLs, as GitHub Pages does them: /guide/format -> /guide/format.html
    if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
    if (!fs.existsSync(file)) return false;

    response.writeHead(200, {
        "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
    });
    fs.createReadStream(file).pipe(response);
    return true;
}
