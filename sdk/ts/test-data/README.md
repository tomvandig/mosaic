# Example data

Each `*.mosaic.json` file describes one Mosaic dataset in a form that is easy to read and diff — a
Mosaic *source document*, the input format of `mosaic pack` and of the SDK's `packMosaicSource`.
The tests pack these examples into real archives and load them back, so they exercise the same
zip/NDJSON path a real file takes.

```jsonc
{
  "description": "what this dataset is for",
  "components": {
    // component type -> rows, one object per NDJSON line
    "acme::geometry::wall": [ { "name": "North wall", "height": 2.4 } ]
  },
  "index": { /* a literal MosaicIndexFile */ }
}
```

Two conveniences packing applies, so the files stay readable:

- `componentTables[].schema` is written as a path relative to the source document (e.g.
  `schemas/wall.schema.json`); packing inlines the schema document in its place.
- Component rows are written as objects; packing serializes them to NDJSON lines. A row that is
  already a serialized string is kept verbatim.

To build an archive from one of these by hand:

```bash
mosaic pack sdk/ts/test-data/house-v1.mosaic.json
```

Component tables are not stored as `.ndjson` files on disk because a Mosaic component type contains `::`,
which is not a legal character in a Windows filename. Inside the zip archive it is fine.

| File | What it is |
| --- | --- |
| `house-v1.mosaic.json` | Two walls in one section; the north wall is painted. |
| `house-v2.mosaic.json` | The same dataset with a second section layered on top: the north wall is raised, its paint deleted, and an east wall added. |
| `linked-house.mosaic.json` | A dataset that references other datasets through `imports` rather than restating them. Packing carries imports through untouched and never pulls the referenced data in. |
| `gltf-box.mosaic.json` | Geometry: a box mesh described with glTF-derived components, shared by two nodes that differ only in transform. |
| `gltf-box-hierarchy.mosaic.json` | The glTF box with its walls hung off a group node using `core::child` links, whose ids live in the reference names. |
| `helmet-plaza.mosaic.json` | Five Damaged Helmets from one import and one copy of its geometry and textures, placed through two levels of `core::child` links. Needs `helmet.tsr`, built with the command below. |
| `instanced-boxes.mosaic.json` | One box mesh placed four times through two levels of `core::child` links, so composing writes the whole `Pair → Left/Right → Box` subtree once per row. |
| `composed-house.mosaic.json` | Imports the packed glTF box and adds a wall of non-glTF components, so composing it exercises geometry, imports and the extension path together. |
| `schemas/*.schema.json` | Component schemas, referenced by the fixtures and used as `originSchemaSrc` in the typed round-trip test. |

## glTF-derived geometry

[`sdk/ts/src/gltf/schemas/`](../src/gltf/schemas/) holds component schemas modelled on the [glTF 2.0 schemas](https://github.com/KhronosGroup/glTF/tree/main/specification/2.0/schema):
`buffer`, `bufferView`, `accessor`, `meshPrimitive`, `material`, `image`, `sampler` and `texture`.
The node transform is derived from the same specification but lives in the core namespace as
`core::transform`, since a transform is not specific to glTF. Property names,
types, enum values and defaults follow glTF, with three deliberate adaptations:

- **Indices address component rows.** In glTF an accessor's `bufferView` indexes the file's
  `bufferViews` array; here it indexes the `khronos::gltf::bufferView` component table. The
  relationship is the same, but the table is Mosaic's rather than the glTF document's.
- **Enums are closed.** glTF writes `componentType` and `mode` as `anyOf` lists with an open
  integer fallback for extensions; these schemas use `enum`, so a code generator produces a real
  enum instead of a bare number.
- **Subset.** `sparse`, morph `targets`, textures, `extensions` and `extras` are left out, and the
  schemas are sealed with `additionalProperties: false`.

`gltf/` holds the glTF inputs the conversion tests read: the same box as a `.glb` container, as a
`.gltf` with its buffer inlined in a `data:` URI, as a `.gltf` with a sibling `.bin`, as a `.gltf`
whose walls sit under a translated group node (which conversion folds into world space), and
`box-textured.gltf`, which adds TEXCOORD_0, a PNG image inlined as a data URI, a sampler and a
texture, so the texture path is exercised both ways.

`gltf-box.mosaic.json` carries a real unit box: 8 `VEC3` positions and 36 `UNSIGNED_SHORT` indices in
a 168-byte buffer, inlined as a base64 `data:` URI the way glTF allows. The tests decode that buffer
and check it against what the accessors declare, so the geometry cannot drift from its description.

## The helmet plaza

`helmet-plaza.mosaic.json` names a node *inside* an imported archive, which only works if that
archive converts to the same ids every time. Build it with:

```bash
mosaic gltf-pack gltf/DamagedHelmet.glb helmet.tsr --stable-ids
mosaic pack helmet-plaza.mosaic.json
mosaic compose helmet-plaza.tsr
```

`--stable-ids` seeds the node ids from the file name instead of drawing them at random, so
`DamagedHelmet.glb` always yields the same ids and the plaza can go on naming one of them. Without
it, re-converting the helmet would silently orphan every reference to it.
