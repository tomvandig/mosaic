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

Any static host will do. For GitHub Pages, point it at the `docs` folder and open
`/viewer/`. The `.nojekyll` file beside this one stops Pages running the folder through
Jekyll, which would otherwise eat paths beginning with an underscore.

The repository ignores `*.tsr` everywhere except under `examples/` here -- those have to
be committed, or Pages has a viewer and nothing to view.

Two things come from a CDN and need the network: three.js, through the import map in
`index.html`, and Monaco, fetched the first time the **Files** panel is opened. Everything
else is in this folder.

## The examples

Each example is a folder under `examples/` holding every archive it needs and nothing it
does not. `examples/index.json` lists them.

An archive's imports are resolved relative to the archive that declares them, and are
refused if they point outside the example's own folder — so an example is self-contained
or it does not work.

There are two kinds of example folder:

- **Built** ones are declared in `sdk/ts/scripts/build-examples.mjs`, copied in from
  elsewhere in the repository and deflated on the way. The script is told which archives to
  show and finds the rest by reading what they import.
- **Dropped-in** ones are any other folder here holding `.tsr` files. Nothing needs
  declaring: the archives to show are whatever nothing else imports, and the name comes
  from the folder. An `example.json` in the folder can set `name`, `description`,
  `archives` and `shown` if the guess is wrong. These files are never rewritten.

Link to one directly: `?example=s1`, or `?example=s1&files` to open the editor on it. The
address bar follows whatever is chosen, so a reload comes back to it.

## Looking inside an archive

The **Files** button opens a drawer showing the archive as what it actually is: an
`index.json` naming nodes and their components, and one `.ndjson` table per component type
holding the values. They can be edited.

**Save** does not write a file — there is nothing here to write to. It replaces the archive
the page is holding and draws the scene again, so the loop is edit, save, look. Reloading
the page brings back what was published. An edit that names a new import is reported rather
than fetched.

## Adding an example

Make a folder under `examples/` and put the `.tsr` files in it, then run
`npm run build:examples` to list it in `index.json`. Or, for an example built from archives
elsewhere in the repository, add an entry to `EXAMPLES` in
`sdk/ts/scripts/build-examples.mjs` and run the same.
