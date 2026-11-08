# Examples

Every example here is a folder of `.tsr` archives served beside the viewer, drawn in the browser with
no server behind it. Each frame loads when it scrolls into view; **Open in viewer** shows the same
example with the tree, the components and the archive's files.

## Helmet on a plaza

A small scene importing a model: two archives, one of which places the other.

<MosaicViewer example="helmet" />

## One box, many places

A single mesh placed a dozen times. Every box in the tree is the same geometry.

<MosaicViewer example="instanced-boxes" />

## Boxes by type

Parts whose geometry belongs to the type they are, rather than to them. The source is on
[The format](/guide/format#example-boxes-by-type) page.

<MosaicViewer example="typed-boxes" />

## S1

Several real-world models — two buildings, a tree and a helmet — federated by one archive that
imports them all. About 20 MB, so it takes a moment.

<MosaicViewer example="s1" height="520" />

## Adding an example

Put a folder of `.tsr` files under `docs/dist/viewer/examples/` and run `npm run build:examples` in
`sdk/ts`; it is listed in `examples/index.json`, and `<MosaicViewer example="<folder>" />` embeds it
in any page.
