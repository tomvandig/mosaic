# The Mosaic viewer, as static files

This folder is the viewer with no server behind it. It reads `.tsr` archives sitting
beside it, follows what they import, runs the selection and the glTF conversion in the
browser, and draws the result — the same code the CLI's `mosaic serve` runs, given a
different place to get archives from.

It is built. Nothing here is edited by hand:

```
cd sdk/ts
npm run build:static      # both of the below
```

| | |
|---|---|
| `npm run build:viewer` | bundles `src/viewer/app` twice: into `index.html` + `app.js` here, and into `src/api/app/page.ts` for the CLI |
| `npm run build:examples` | fills `examples/` from the archives named in `scripts/build-examples.mjs` |

## Hosting it

Any static host will do. For GitHub Pages, serve the repository and open
`/examples/viewer/`. The `.nojekyll` file beside this one stops Pages running the folder
through Jekyll, which would otherwise eat paths beginning with an underscore.

Two things come from a CDN and need the network: three.js, through the import map in
`index.html`, and Monaco, fetched the first time the **Files** panel is opened. Everything
else is in this folder.

## The examples

Each example is a folder under `examples/` holding every archive it needs and nothing it
does not. `examples/index.json` lists them.

An archive's imports are resolved relative to the archive that declares them, and are
refused if they point outside the example's own folder — so an example is self-contained
or it does not work. `build-examples.mjs` follows the same rule from the other side: it is
told which archives to show and finds the rest by reading what they import. The campus is
one 13 KB file naming eleven others, one of which names three more.

Archives are deflated on the way in. The campus is 14.3 MB as source and 1.2 MB here.

Link to one directly with the hash: `#campus`, or `#campus/files` to open the editor on it.

## Looking inside an archive

The **Files** button opens a drawer showing the archive as what it actually is: an
`index.json` naming nodes and their components, and one `.ndjson` table per component type
holding the values. They can be edited.

**Save** does not write a file — there is nothing here to write to. It replaces the archive
the page is holding and draws the scene again, so the loop is edit, save, look. Reloading
the page brings back what was published. An edit that names a new import is reported rather
than fetched.

## Adding an example

Add an entry to `EXAMPLES` in `sdk/ts/scripts/build-examples.mjs` naming the folder its
archives live in and which of them to show, then run `npm run build:examples`. Imports are
found for you.
