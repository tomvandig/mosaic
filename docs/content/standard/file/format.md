# The format, by example

What the [file standard](/standard/file/) looks like in practice: the parts of an index, how
sections layer, and a real archive opened up.

A Mosaic dataset is described by an **index file** (`MosaicIndexFile`) with four parts:

| Field | Purpose |
| --- | --- |
| `header` | Format version (`MosaicVersion`). |
| `imports` | Other Mosaic files pulled in by URI, optionally pinned with an `integrity` hash. |
| `componentTables` | External component data — an NDJSON or Parquet file plus the schema of its rows. |
| `sections` | The actual content: provenance plus a list of nodes. |

Each **section** carries a `MosaicProvenanceHeader` — who authored it, when, with which application, and a
message describing the change — followed by the nodes it contributes. Because sections are a list, a dataset
is a history of layered edits rather than a single flat snapshot.

A **node** has a `uuid` id and a list of component references. Each reference names a component `type`
and identifies itself within the node with an `id`. Both remaining fields are optional: `index` points
at a row of that type's table and defaults to `-1`, meaning the reference carries no value at all — a
`core::child` or `core::name` says everything in its `id`, so its type needs no table. `operation`
defaults to `VALUE`:

- `PASS_THROUGH` — leave the inherited value alone
- `DELETE` — unset the value
- `VALUE` — set the value

That three-way operation is what lets a later section modify a node introduced by an earlier one without
restating everything about it. Since `VALUE` is the default, a reference that sets something is written
without an `operation` at all:

```json
{ "type": "core::transform", "id": "transform", "index": 0 }
{ "type": "core::name", "id": "Left plinth" }
{ "type": "core::child", "id": "d6c1d2ba-9376-4461-8c56-27c496c1d2ba" }
{ "type": "core::child", "id": "66666666-6666-4666-8666-666666666666", "operation": "DELETE" }
```

## Example: boxes by type

An archive is a zip holding `index.json` and one `.ndjson` table per component type. Here are the
interesting parts of one: two *type* nodes and four nodes that are of those types, linked with
`core::inherit`. The nodes carry a name, an is-a link and a placement — the mesh arrives through
inheritance. The last tab is the whole source document it is packed from.

::: code-group

```json [index.json]
{
  "header": { "MosaicVersion": "post-alpha" },
  "componentTables": [
    { "filename": "core::transform.ndjson", "type": "NDJSON", "schema": { "…": "inlined" } }
  ],
  "sections": [{
    "header": {
      "id": "typed-boxes",
      "message": "Four boxes that inherit their shape from a type",
      "author": "ada@example.com",
      "timestamp": "2026-09-02T09:30:00Z"
    },
    "nodes": [
      {
        "id": "70000000-7000-4000-8000-700000000001",
        "components": [
          { "type": "core::name", "id": "Box type" },
          { "type": "khronos::gltf::meshPrimitive", "id": "mesh", "index": 0 },
          { "type": "core::transform", "id": "transform", "index": 0 }
        ]
      },
      {
        "id": "70000000-7000-4000-8000-700000000002",
        "components": [
          { "type": "core::name", "id": "Small box type" },
          { "type": "core::inherit", "id": "70000000-7000-4000-8000-700000000001" },
          { "type": "core::transform", "id": "transform", "index": 1 }
        ]
      },
      {
        "id": "70000000-7000-4000-8000-700000000003",
        "components": [
          { "type": "core::name", "id": "Near box" },
          { "type": "core::inherit", "id": "70000000-7000-4000-8000-700000000001" }, // [!code highlight]
          { "type": "core::transform", "id": "transform", "index": 2 }
        ]
      }
    ]
  }]
}
```

```json [core::transform.ndjson]
{"translation":[0,2,0],"scale":[0.5,0.5,0.5]}
{"translation":[0,2,1.5],"scale":[0.25,0.25,0.25]}
{"translation":[-1,0,0]}
{"translation":[1,0,0]}
{"translation":[0,0,1.5]}
```

<<< ../../../../sdk/ts/test-data/typed-boxes.mosaic.json [typed-boxes.mosaic.json]

:::

<MosaicViewer example="typed-boxes" caption="The archive above, drawn. Every box gets its mesh from Box type." />

Packed with `mosaic pack typed-boxes.mosaic.json`; see [Packing](/tools/pack).
