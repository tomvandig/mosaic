# Mosaic documentation

A [VitePress](https://vitepress.dev) site. The pages are Markdown in `content/`, and the
built site goes to `dist/`, next to the viewer:

```
docs/
  content/            the pages (Markdown)
  .vitepress/         config, theme, and the <MosaicViewer> component
  dist/
    docs/             built by `npm run build` -- generated, do not edit
    viewer/           built by `npm run build:static` in sdk/ts -- generated, do not edit
```

Publish `dist/` as the site root and you get `/docs/` and `/viewer/` side by side. The base
defaults to `/mosaic/docs/` for `tomvandig.github.io/mosaic`; set `DOCS_BASE` to build for
somewhere else.

```
npm install
npm run dev       # live preview, at http://localhost:5173/mosaic/docs/ (the viewer is served too)
npm run build     # -> dist/docs, plus dist/index.html and dist/.nojekyll
npm run serve     # the built dist/, the way Pages will serve it
```

## Writing pages

Search, code highlighting and the sidebar come with VitePress. The sidebar is set in
`.vitepress/config.mts`.

**The viewer, inline.** Any page can embed an example from `dist/viewer/examples/`:

```md
<MosaicViewer example="typed-boxes" />
<MosaicViewer example="s1" height="520" caption="Shown under the frame" />
<MosaicViewer example="helmet" files />        <!-- with the archive's files open -->
```

**Code examples across several files** are a code group, one tab per file. A tab can be
written inline or pulled from a real file in the repository, so it stays current:

````md
::: code-group

```json [index.json]
{ "sections": [] }
```

<<< ../../../sdk/ts/test-data/typed-boxes.mosaic.json [typed-boxes.mosaic.json]

:::

<MosaicViewer example="typed-boxes" />
````

A viewer placed right after a code group sits flush beneath it, as that code's result.
