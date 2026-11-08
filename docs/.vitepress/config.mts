import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";
// @ts-expect-error -- plain JavaScript, shared with scripts/serve.mjs
import { serveStatic } from "../scripts/static.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "..", "dist");

/**
 * Where the site lives. GitHub Pages publishes this `docs/` folder at
 * tomvandig.github.io/mosaic, so the docs built to `dist/docs` are at `/mosaic/dist/docs/`
 * and the viewer beside them at `/mosaic/dist/viewer/`. Set DOCS_BASE to build for
 * somewhere else.
 */
const base = process.env.DOCS_BASE ?? "/mosaic/dist/docs/";

/** The viewer, as the docs embed it: a sibling of the docs, unless VIEWER_URL says otherwise. */
const viewer = process.env.VIEWER_URL ?? path.posix.join(base, "..", "viewer") + "/";

const GITHUB = "https://github.com/tomvandig/mosaic";

export default defineConfig({
    title: "Mosaic",
    description: "A file format for incremental collaboration on geometric, structured data.",
    base,
    srcDir: "content",
    outDir: "dist/docs",
    cleanUrls: true,
    lastUpdated: false,
    head: [["meta", { name: "theme-color", content: "#16867c" }]],

    markdown: {
        theme: { light: "github-light", dark: "github-dark" },
    },

    themeConfig: {
        // Read by the MosaicViewer component.
        viewer,

        search: { provider: "local" },

        nav: [
            { text: "Guide", link: "/guide/" },
            { text: "Examples", link: "/examples/" },
            // The theme puts the base in front of a link starting with "/", so the sibling
            // folder is written relative to it.
            { text: "Viewer", link: process.env.VIEWER_URL ?? "/../viewer/", target: "_blank" },
        ],

        sidebar: [
            {
                text: "Guide",
                items: [
                    { text: "Introduction", link: "/guide/" },
                    { text: "Definitions", link: "/guide/definitions" },
                    { text: "The format", link: "/guide/format" },
                    { text: "Core components", link: "/guide/core-components" },
                    { text: "API", link: "/guide/api" },
                    { text: "Schema & code generation", link: "/guide/schema" },
                    { text: "A worked example", link: "/guide/worked-example" },
                ],
            },
            {
                text: "CLI",
                items: [
                    { text: "Packing a dataset", link: "/tools/pack" },
                    { text: "Importing glTF", link: "/tools/gltf" },
                    { text: "Importing IFC", link: "/tools/ifc" },
                    { text: "SVG", link: "/tools/svg" },
                    { text: "Composing a GLB", link: "/tools/compose" },
                ],
            },
            {
                text: "SDK",
                items: [
                    { text: "Querying with DuckDB", link: "/sdk/duckdb" },
                    { text: "The HTTP API", link: "/sdk/http-api" },
                ],
            },
            {
                text: "Examples",
                items: [{ text: "Gallery", link: "/examples/" }],
            },
            {
                text: "Contributing",
                items: [
                    { text: "Tests", link: "/contributing/tests" },
                    { text: "Scenarios", link: "/contributing/scenarios" },
                ],
            },
        ],

        socialLinks: [{ icon: "github", link: GITHUB }],

        editLink: {
            pattern: GITHUB + "/edit/main/docs/content/:path",
            text: "Edit this page on GitHub",
        },

        outline: { level: [2, 3] },
    },

    vite: {
        plugins: [
            {
                // `vitepress dev` serves the docs only; this puts the built viewer beside
                // them, at the same address it will have once published.
                name: "mosaic-viewer-dev",
                configureServer(server) {
                    const prefix = path.posix.join(base, "..", "viewer") + "/";
                    server.middlewares.use((request, response, next) => {
                        if (!serveStatic(request, response, prefix, path.join(dist, "viewer"))) next();
                    });
                },
            },
        ],
    },
});
