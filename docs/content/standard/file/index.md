# File standard

The file standard defines what a Mosaic file is: its index, sections, nodes and component
references. This page describes the schema. [The format, by example](/standard/file/format) walks
through a real archive.

[`standard/`](https://github.com/tomvandig/mosaic/tree/main/standard/) holds two documents. Both are
generated, so they are never edited by hand:

| File | Describes | Generated from |
| --- | --- | --- |
| `mosaic-index-file.schema.json` | The index of a Mosaic file (JSON Schema 2020-12) | [`src/mosaic-json-file.tsp`](https://github.com/tomvandig/mosaic/blob/main/src/mosaic-json-file.tsp) |
| `mosaic-api.openapi3.json` | The HTTP API for keeping tesserae and their versions (OpenAPI 3) | [`src/mosaic-api.tsp`](https://github.com/tomvandig/mosaic/blob/main/src/mosaic-api.tsp) |

They are checked in so consumers can use them without running the toolchain.

## Generating them

The source of truth is [TypeSpec](https://typespec.io) in `src/`. To change the standard, edit the
`.tsp` and regenerate:

```bash
cd src
npm install
npm run compile-json-spec    # mosaic-json-file.tsp -> standard/mosaic-index-file.schema.json
npm run compile-api-spec     # mosaic-api.tsp       -> standard/mosaic-api.openapi3.json
```

Commit the regenerated output alongside the spec change. Two more scripts carry the change into the
reference implementation:

```bash
npm run gen-sdk-index-ts     # index schema -> sdk/ts/src/MosaicIndexFile.ts
npm run gen-api-sdk          # OpenAPI      -> sdk/ts/src/api/ (types, routes, client)
```

Every object schema is **sealed** (`"additionalProperties": false`). A property the standard does not
name is invalid, not ignored, and code generators produce exact types with no catch-all field.

## The index file

`MosaicIndexFile` is the root. A file is valid when its index validates against this schema.

::: code-group

```ts [mosaic-json-file.tsp]
model MosaicIndexFile {
    header: MosaicFileHeader;              // { MosaicVersion: string }
    "imports": ImportNode[];               // { uri: string; integrity?: string }
    componentTables: ComponentTableReference[];
    sections: MosaicDataSection[];
}

model MosaicDataSection {
    header: MosaicProvenanceHeader;
    nodes: MosaicNode[];
}

model MosaicNode {
    id: uuid;
    components?: ComponentReference[];
}

model ComponentReference {
    type: string;                          // e.g. "khronos::gltf::meshPrimitive"
    id: string;                            // names this reference within the node
    index?: int32 = -1;                    // row in the type's table; -1 = no value
    operation?: OperationType = OperationType.VALUE;
}

enum OperationType { PASS_THROUGH, DELETE, VALUE }
```

```json [index.json (minimal)]
{
  "header": { "MosaicVersion": "post-alpha" },
  "imports": [],
  "componentTables": [],
  "sections": [{
    "header": {
      "id": "hello",
      "message": "A single named node",
      "dataVersion": "1.0.0",
      "author": "ada@example.com",
      "timestamp": "2026-11-08T12:00:00Z",
      "application": "by hand"
    },
    "nodes": [{
      "id": "11111111-1111-4111-8111-111111111111",
      "components": [{ "type": "core::name", "id": "Hello" }]
    }]
  }]
}
```

:::

| Model | Fields | Notes |
| --- | --- | --- |
| `MosaicFileHeader` | `MosaicVersion` | Which version of the standard the file follows |
| `ImportNode` | `uri`, `integrity?` | Another Mosaic file, optionally pinned by a hash |
| `ComponentTableReference` | `filename`, `type`, `schema` | One table of component values. `type` is `NDJSON` or `PARQUET`, and `schema` is the JSON Schema of its rows, inlined |
| `MosaicDataSection` | `header`, `nodes` | One layer of edits |
| `MosaicProvenanceHeader` | `id`, `message`, `dataVersion`, `author`, `timestamp`, `application` | Who made the layer, when and why. All required |
| `MosaicNode` | `id` (uuid), `components?` | A node is an id and its references |
| `ComponentReference` | `type`, `id`, `index?`, `operation?` | See [The format](/standard/file/format) |

## What the schemas say, and what they don't

The schemas fix the **shape** of a file. A few rules sit in the description of the format rather than
in the schema itself:

- **Sections are ordered.** A later section wins over an earlier one, and `operation` says how:
  `VALUE` sets, `DELETE` unsets, `PASS_THROUGH` leaves the earlier value alone.
- **`index: -1` means no value.** The reference's `id` is the whole of what it says. This is how
  [value-less components](/standard/core-components#value-less-components) work.
- **Imports layer underneath.** An imported file's sections count as older than the importing
  file's own.

Some things are **not standardised yet** and are defined only by what the reference implementation
does:

- **The archive container.** A `.tsr` is a zip with `index.json` at its root and one
  `<type>.ndjson` per component table. No schema describes the zip itself.
- **Component schemas.** The standard says a table carries a schema but not which component types
  exist. `core::*`, `khronos::gltf::*`, `w3c::svg` and `ifc4::*` are all defined in the SDK (see
  below), as is the `x-mosaic-id` keyword that names a schema's type.
- **Composition.** Inheritance through `core::inherit`, hierarchy through `core::child`, and the
  mapping to glTF are SDK behaviour.

## Component schemas

Component schemas are ordinary JSON Schema documents with an `x-mosaic-id` naming the type they
describe. They live with the code that understands them, not in `standard/`:

| Namespace | Schemas | Location |
| --- | --- | --- |
| `core::` | `name`, `child`, `inherit`, `transform`, `edges` | [`sdk/ts/src/core/schemas/`](https://github.com/tomvandig/mosaic/tree/main/sdk/ts/src/core/schemas/) |
| `khronos::gltf::` | `buffer`, `bufferView`, `accessor`, `meshPrimitive`, `material`, `image`, `sampler`, `texture` | [`sdk/ts/src/gltf/schemas/`](https://github.com/tomvandig/mosaic/tree/main/sdk/ts/src/gltf/schemas/) |
| `w3c::` | `svg` | [`sdk/ts/src/svg/schemas/`](https://github.com/tomvandig/mosaic/tree/main/sdk/ts/src/svg/schemas/) |
| `ifc4::` | `entity`, `propertySet`, `quantitySet`, `units`, `rel::*` | [`sdk/ifc4/src/schemas/`](https://github.com/tomvandig/mosaic/tree/main/sdk/ifc4/src/schemas/) |

Anyone can define more, such as `acme::geometry::wall`. Since each archive inlines the schema of
every table it carries, a reader can validate a component type it has never seen before.
`mosaic codegen` turns component schemas into typed classes (see
[Code generation](/tools/codegen)).

The second document in `standard/`, `mosaic-api.openapi3.json`, is described in
[API standard](/standard/api).
