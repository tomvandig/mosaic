# Importing glTF

`mosaic` converts a glTF 2.0 model into Mosaic, reading either a `.gltf` document or a `.glb`
container:

```bash
mosaic gltf <input.gltf|input.glb|url> [output.mosaic.json] [--stable-ids]   # to a source document
mosaic pack <input.gltf|input.glb|url> [output.tsr]         [--stable-ids]   # straight to an archive
```

The input can be an `http(s)` URL. The model is downloaded first, along with any buffers and images a
`.gltf` keeps in files beside it, and the result is written to the working directory:

```bash
npx @tomvandig/mosaic pack https://tomvandig.github.io/mosaic/dist/docs/models/DamagedHelmet.glb
```

Both read the same conversion; the first stops at the editable JSON document, the second packs it in
one step. Buffers are resolved from the GLB binary chunk, from `data:` URIs, or from files beside the
input, and inlined as `data:` URIs so the result stands alone. The component schemas are inlined too,
so a converted `.mosaic.json` packs anywhere without needing the schema files.

`--stable-ids` seeds the node ids from the file name rather than drawing them at random, so
converting the same model twice yields the same ids. That is what lets another document name a node
*inside* an import and keep naming it after the import is rebuilt; without it, re-converting orphans
every reference. Leave it off for a one-off import.

Node names come across as `core::name` components — value-less like `core::child`, with the name
itself in the reference — so the name a person would recognise survives
alongside the uuid a node is identified by. Every glTF id becomes the id of the Mosaic node carrying
the referenced component, so later edits to the component tables cannot silently repoint a
reference. Each buffer, bufferView, accessor, image,
sampler, texture and material gets a node of its own; each glTF node with a mesh becomes a node
carrying that mesh and a `core::transform`. The metallic-roughness surface travels whole — base colour,
metallic-roughness, normal, occlusion and emissive textures, along with `emissiveFactor`,
`alphaMode`, `alphaCutoff` and `doubleSided` — so a textured model keeps its appearance. glTF data
outside the component subset (morph targets, `extensions`, `extras`) is reported as a warning rather
than dropped in silence, and a sparse accessor is refused outright rather than converted into
something wrong.

The conversion lives in the SDK under [`sdk/ts/src/gltf/`](https://github.com/tomvandig/mosaic/tree/main/sdk/ts/src/gltf/), which also owns the
glTF-derived component schemas; the CLI commands are a thin wrapper over it.

## Example: a helmet on a plaza

The Damaged Helmet converted with `mosaic pack`, then imported by a second, hand-written archive that
places it with `core::child` links. The helmet's geometry and textures are stored once.

::: code-group

```bash [terminal]
mosaic pack DamagedHelmet.glb helmet.tsr --stable-ids
mosaic pack sdk/ts/test-data/helmet-plaza.mosaic.json
```

<<< ../../../sdk/ts/test-data/helmet-plaza.mosaic.json [helmet-plaza.mosaic.json]

:::

<MosaicViewer example="helmet" />
