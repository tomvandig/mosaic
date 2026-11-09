import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";
import deflist from "markdown-it-deflist";
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

/**
 * Code groups with ids that are the same on every build.
 *
 * VitePress names each `::: code-group` and its tabs with random ids, so every page holding
 * one came out different on every build, edited or not, and the committed site churned.
 * The ids only have to be unique within a page, so they are numbered in the order the
 * groups appear on it instead.
 */
function stableCodeGroupIds(md: { renderer: { rules: Record<string, any> } }) {
    const rule = "container_code-group_open";
    const original = md.renderer.rules[rule];
    if (!original) return;

    md.renderer.rules[rule] = (tokens: unknown, idx: number, options: unknown, env: any, self: unknown) => {
        const html: string = original(tokens, idx, options, env, self);
        if (!html.includes('name="group-')) return html;

        const group = env.mosaicCodeGroups = (env.mosaicCodeGroups ?? 0) + 1;
        const tabs = new Map<string, string>();
        return html
            .replace(/name="group-[^"]+"/g, `name="group-${group}"`)
            .replace(/tab-([A-Za-z0-9_-]+)/g, (_, id: string) => {
                if (!tabs.has(id)) tabs.set(id, `tab-${group}-${tabs.size + 1}`);
                return tabs.get(id)!;
            });
    };
}

export default defineConfig({
    title: "Mosaic",
    description: "A file format for incremental collaboration on geometric, structured data.",
    base,
    srcDir: "content",
    outDir: "dist/docs",
    cleanUrls: true,
    // The built site is committed, so keep a one-line edit from touching every page: the map
    // of page hashes goes in a chunk of its own instead of being inlined in every HTML file.
    metaChunk: true,
    lastUpdated: false,
    head: [["meta", { name: "theme-color", content: "#16867c" }]],

    markdown: {
        theme: { light: "github-light", dark: "github-dark" },
        config: md => {
            // `Term` / `: definition` lists, for the Definitions page.
            md.use(deflist);
            stableCodeGroupIds(md);
        },
    },

    themeConfig: {
        // Read by the MosaicViewer component.
        viewer,

        search: { provider: "local" },

        nav: [
            { text: "Welcome", link: "/welcome/" },
            { text: "Standard", link: "/standard/" },
            { text: "Examples", link: "/examples/" },
            // The theme puts the base in front of a link starting with "/", so the sibling
            // folder is written relative to it.
            { text: "Viewer", link: process.env.VIEWER_URL ?? "/../viewer/", target: "_blank" },
        ],

        sidebar: [
            {
                text: "Welcome",
                items: [
                    { text: "What is Mosaic", link: "/welcome/" },
                    { text: "Why Mosaic exists", link: "/welcome/why" },
                    { text: "Who it is for", link: "/welcome/who" },
                    { text: "Definitions", link: "/welcome/definitions" },
                    { text: "A minimal example", link: "/welcome/minimal-example" },
                ],
            },
            {
                text: "Standard",
                items: [
                    { text: "Overview", link: "/standard/" },
                    {
                        text: "File standard",
                        link: "/standard/file/",
                        items: [{ text: "The format, by example", link: "/standard/file/format" }],
                    },
                    { text: "API standard", link: "/standard/api" },
                    { text: "Core components", link: "/standard/core-components" },
                ],
            },
            {
                text: "SDK",
                items: [
                    { text: "Overview", link: "/sdk/" },
                    { text: "Querying with DuckDB", link: "/sdk/duckdb" },
                    { text: "The HTTP API", link: "/sdk/http-api" },
                ],
            },
            {
                text: "CLI",
                items: [
                    { text: "Overview", link: "/tools/" },
                    { text: "Packing", link: "/tools/pack" },
                    { text: "Importing glTF", link: "/tools/gltf" },
                    { text: "Importing IFC", link: "/tools/ifc" },
                    { text: "SVG", link: "/tools/svg" },
                    { text: "Diffing", link: "/tools/diff" },
                    { text: "Composing a GLB", link: "/tools/compose" },
                    { text: "Code generation", link: "/tools/codegen" },
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

        footer: {
            message: 'Background: the Alexander Mosaic, House of the Faun, Pompeii (c. 100 BC). '
                + 'Photo by Berthold Werner, public domain, via '
                + '<a href="https://commons.wikimedia.org/wiki/File:Battle_of_Issus_mosaic_-_Museo_Archeologico_Nazionale_-_Naples_2013-05-16_16-25-06_BW.jpg">Wikimedia Commons</a>. '
                + '<br>Damaged Helmet: © 2018 ctxwing, CC BY 4.0 (rebuild and glTF conversion); '
                + '© 2016 theblueturtle_, CC BY-NC 4.0 (earlier version), via the '
                + '<a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DamagedHelmet">Khronos glTF sample assets</a>.',
        },
    },

    vite: {
        plugins: [
            {
                // Every edit changes the search index, and its hashed name is written into the
                // search box, whose name is written into the theme, whose name is in every page:
                // one changed line renamed every file. A fixed name for the index stops that
                // chain where it starts. (VitePress sets chunk names after the user config is
                // read, so this has to happen here, as the bundle is written.)
                name: "mosaic-stable-search-index",
                apply: "build",
                outputOptions(options) {
                    const named = options.chunkFileNames;
                    if (typeof named !== "function") return;
                    return {
                        ...options,
                        chunkFileNames: chunk => chunk.name.startsWith("@localSearchIndex")
                            ? "assets/chunks/[name].js"
                            : named(chunk),
                    };
                },
            },
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
