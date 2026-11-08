# A minimal example

Five helmets on a plaza, made from **two files**: a converted glTF model, and a small hand-written
scene that imports it and places it five times. The model is never copied. The scene only says
*where* it goes.

<MosaicViewer example="helmet" height="460" caption="helmet-plaza.tsr, with helmet.tsr imported beneath it." />

## The two files

| File | Made by | Holds |
| --- | --- | --- |
| `helmet.tsr` | `mosaic gltf-pack` from `DamagedHelmet.glb` | The model: 27 nodes for its buffer, bufferViews, accessors, images, textures, material and mesh. About 3.5 MB |
| `helmet-plaza.tsr` | `mosaic pack` from `helmet-plaza.mosaic.json` | The scene: six nodes and five transforms, a little over 1 KB. It imports `helmet.tsr` |

Each is a zip holding an `index.json` and one `.ndjson` table per component type:

```
helmet.tsr                              helmet-plaza.tsr
├─ index.json                           ├─ index.json        (imports helmet.tsr)
├─ khronos::gltf::buffer.ndjson         └─ core::transform.ndjson
├─ khronos::gltf::bufferView.ndjson
├─ khronos::gltf::accessor.ndjson
├─ khronos::gltf::meshPrimitive.ndjson
├─ khronos::gltf::material.ndjson
├─ khronos::gltf::texture.ndjson
├─ khronos::gltf::image.ndjson
├─ khronos::gltf::sampler.ndjson
└─ core::transform.ndjson
```

## The scene

The plaza is a small tree of nodes. Each one has a [`core::name`](/standard/core-components#core-name),
most have a [`core::transform`](/standard/core-components#core-transform), and
[`core::child`](/standard/core-components#core-child) links hold the tree together:

```
Near row ─┐                       ┌─ Left plinth  ──▶ helmet
          ├─▶ Pair ───────────────┤
Far row  ─┘                       └─ Right plinth ──▶ helmet
Spinner  ────────────────────────────────────────────▶ helmet
```

- **Left plinth** and **Right plinth** each place the helmet, 1.5 m either side of the middle.
- **Pair** holds both plinths. It has no transform of its own.
- **Near row** and **Far row** each hold the *same* Pair, 2 m in front and 2 m behind, so the pair
  and everything under it appear twice. That's four helmets.
- **Spinner** places a fifth helmet on its own: raised, turned a quarter turn and scaled to 60%.

The arrow to the helmet crosses files. `d6c1d2ba-…` is the id of the helmet's mesh node *inside*
`helmet.tsr`. That works because `helmet.tsr` was converted with `--stable-ids`, so its ids are the
same every time it is rebuilt.

::: code-group

```json [helmet-plaza.tsr → index.json]
{
  "header": { "MosaicVersion": "post-alpha" },
  "imports": [{ "uri": "helmet.tsr" }], // [!code highlight]
  "componentTables": [
    { "filename": "core::transform.ndjson", "type": "NDJSON", "schema": { "…": "inlined" } }
  ],
  "sections": [{
    "header": {
      "id": "helmet-plaza",
      "message": "Five helmets from one imported model",
      "dataVersion": "1.0.0",
      "author": "ada@example.com",
      "timestamp": "2026-09-01T11:00:00Z",
      "application": "mosaic-tests"
    },
    "nodes": [
      {
        "id": "11110000-1111-4111-8111-111100001111",
        "components": [
          { "type": "core::transform", "id": "transform", "index": 0 },
          { "type": "core::name", "id": "Left plinth" },
          { "type": "core::child", "id": "d6c1d2ba-9376-4461-8c56-27c496c1d2ba" } // [!code highlight]
        ]
      },
      {
        "id": "22220000-2222-4222-8222-222200002222",
        "components": [
          { "type": "core::transform", "id": "transform", "index": 1 },
          { "type": "core::name", "id": "Right plinth" },
          { "type": "core::child", "id": "d6c1d2ba-9376-4461-8c56-27c496c1d2ba" }
        ]
      },
      {
        "id": "33330000-3333-4333-8333-333300003333",
        "components": [
          { "type": "core::name", "id": "Pair" },
          { "type": "core::child", "id": "11110000-1111-4111-8111-111100001111" },
          { "type": "core::child", "id": "22220000-2222-4222-8222-222200002222" }
        ]
      },
      {
        "id": "44440000-4444-4444-8444-444400004444",
        "components": [
          { "type": "core::transform", "id": "transform", "index": 2 },
          { "type": "core::name", "id": "Near row" },
          { "type": "core::child", "id": "33330000-3333-4333-8333-333300003333" }
        ]
      },
      {
        "id": "55550000-5555-4555-8555-555500005555",
        "components": [
          { "type": "core::transform", "id": "transform", "index": 3 },
          { "type": "core::name", "id": "Far row" },
          { "type": "core::child", "id": "33330000-3333-4333-8333-333300003333" }
        ]
      },
      {
        "id": "66660000-6666-4666-8666-666600006666",
        "components": [
          { "type": "core::transform", "id": "transform", "index": 4 },
          { "type": "core::name", "id": "Spinner" },
          { "type": "core::child", "id": "d6c1d2ba-9376-4461-8c56-27c496c1d2ba" }
        ]
      }
    ]
  }]
}
```

```json [helmet-plaza.tsr → core::transform.ndjson]
{"translation":[-1.5,0,0]}
{"translation":[1.5,0,0]}
{"translation":[0,0,-2]}
{"translation":[0,0,2]}
{"translation":[0,1.5,0],"rotation":[0,0.7071068,0,0.7071068],"scale":[0.6,0.6,0.6]}
```

```json [helmet.tsr → index.json (excerpt)]
{
  "header": { "MosaicVersion": "post-alpha" },
  "imports": [],
  "sections": [{
    "header": { "id": "DamagedHelmet.glb", "message": "Imported from DamagedHelmet.glb", "…": "…" },
    "nodes": [
      {
        "id": "d6c1d2ba-9376-4461-8c56-27c496c1d2ba", // [!code highlight]
        "components": [
          { "type": "khronos::gltf::meshPrimitive", "id": "mesh", "index": 0 },
          { "type": "core::transform", "id": "transform", "index": 0 },
          { "type": "core::name", "id": "node_damagedHelmet_-6514" }
        ]
      }
      // … 26 more nodes: buffer, bufferViews, accessors, images, textures, material
    ]
  }]
}
```

<<< ../../../sdk/ts/test-data/helmet-plaza.mosaic.json [helmet-plaza.mosaic.json (source)]

:::

The `index` on each `core::transform` reference is a line number in `core::transform.ndjson`,
counting from 0. The `core::name` and `core::child` references have no `index`: everything they say
is in their `id`.

## Building it

```bash
# 1. the model, with ids that stay the same every time it is converted
mosaic gltf-pack DamagedHelmet.glb helmet.tsr --stable-ids

# 2. the scene, from its source document
mosaic pack helmet-plaza.mosaic.json            # -> helmet-plaza.tsr

# 3. one renderable file, following the import
mosaic compose helmet-plaza.tsr                 # -> helmet-plaza.glb
```

The source document, `helmet-plaza.mosaic.json`, is the scene as one readable file: the index with the
component rows beside it, and schemas referenced by path. `mosaic pack` turns it into the archive:
it writes the rows as `core::transform.ndjson` and inlines the schema. See
[Packing a dataset](/tools/pack).

## What composing does

`mosaic compose` reads `helmet-plaza.tsr`, follows its import to `helmet.tsr`, and layers the helmet
*underneath* the scene. Then it walks the `core::child` links from the roots (Near row, Far row and
Spinner) and writes a glTF node for every placement it reaches. The result has five helmets in it, but
the mesh, the images and the 3.7 MB buffer are each written once and shared by all five.

Nothing about the helmet was restated in the scene. If the model is converted again, or improved, the
plaza picks up the change the next time it is composed. See [Composing a GLB](/tools/compose).
