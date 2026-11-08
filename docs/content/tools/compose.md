# Composing a renderable GLB

`mosaic compose` reads an archive together with everything it imports and writes a binary glTF:

```bash
mosaic compose <input.tsr|input.duckdb> [output.glb] [--file <id>]...
```

Imports are resolved relative to the archive that names them, recursively, and merged underneath it
so a later section still wins; an import naming a URI that is not on disk is skipped and reported.
Every Mosaic node in the result becomes a glTF node keeping its id as the node name, and its
components are written one of two ways:

- **Natively**, for the `khronos::gltf` namespace. Meshes and transforms go onto the node itself;
  buffers, bufferViews, accessors, images, samplers, textures and materials are hoisted into the
  document's arrays, and node ids become the array indices glTF expects. Nodes sharing a primitive
  share a mesh.
- **As a transform**, for `core::transform`. Its shape follows the glTF node transform, so it goes
  straight onto the node as a `matrix` or as `translation`/`rotation`/`scale`.
- **As inheritance**, for `core::inherit`, expanded before anything else is read. A node that names
  another with an is-a link receives all of that node's components, except where it carries one under
  the same reference `id` — its own always wins. Several links are allowed, and so are chains; where
  two inherited nodes offer the same `id`, the one named first wins. The is-a links come along with
  the components, so a node two steps down a chain still answers to the type at the top, which is
  what makes "everything that is a Chair" a question about nodes rather than a graph walk. Unlike a
  child link, this changes the node itself, not what hangs beneath it. Inheritance is expanded when
  composing only: the file always records what was written.
- **As hierarchy**, for `core::child`. That component carries no value: the *name* of the reference
  is the id of the child node, so one node can hold many children and a later section can drop a
  single link with a `DELETE` on that name. Composing turns those links into glTF `children`, and a
  node that is someone's child is left out of the scene's root list.
- **As an extension**, for everything else, including `core::name`, `w3c::svg` and `core::edges`. The components ride along under `MOSAIC_components` on
  the node, listed in `extensionsUsed` but never in `extensionsRequired`, so a viewer that does not
  know Mosaic still renders the file.

Composing writes **a glTF node per child relation**, and only for the nodes a picture needs: one
that carries no geometry, no transform, no children and no components is left out. That is not a
rounding: a Mosaic node holding a bufferView is a real node of the archive, but by the time the
scene is written that bufferView is already in the document's own array, so there is nothing left
for the node to be. On a converted building those are most of the nodes there are — 104,927 of the
architectural model's 153,549 — and a loader builds an object for every one it is given. Nodes that
carry components are always written, since the components are what they are for.

Naming the same node from three parents places it three times. The copies share their mesh, so the geometry is stored once no matter how
often it appears — three helmets come to 32 nodes, one mesh, and the same 3.7 MB binary chunk as one
helmet would. A node placed twice brings its whole subtree along each time. Links that would expand
forever are refused: a cycle is reported with the path that closes it.

Buffers are written as a real binary chunk, not data URIs: every buffer is decoded and laid end to
end into the GLB's BIN chunk on 4-byte boundaries, with each bufferView shifted to match. An image
held inline as a data URI is moved into that chunk too, and given a bufferView of its own, so the
textures ship as bytes rather than as base64 text in the JSON.

Round-tripping `DamagedHelmet.glb` through `mosaic pack` and `mosaic compose` returns a file whose materials,
textures, images, samplers, accessors, bufferViews and meshes are all identical to the original, with
byte-identical geometry and texture payloads. The output passes the Khronos glTF validator with no
errors, reporting only the tangent-space warning the original itself carries.

The composition lives in the SDK under [`sdk/ts/src/composition/`](https://github.com/tomvandig/mosaic/tree/main/sdk/ts/src/composition/); the CLI
command is a thin wrapper over it.

## Example: one box, many places

A single mesh placed through two levels of `core::child` links. Composing writes the whole
`Pair → Left/Right → Box` subtree once per placement, and every copy shares the one mesh.

::: code-group

```bash [terminal]
mosaic pack    sdk/ts/test-data/instanced-boxes.mosaic.json
mosaic compose sdk/ts/test-data/instanced-boxes.tsr boxes.glb
```

<<< ../../../sdk/ts/test-data/instanced-boxes.mosaic.json [instanced-boxes.mosaic.json]

:::

<MosaicViewer example="instanced-boxes" />
