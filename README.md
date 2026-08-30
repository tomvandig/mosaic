![Mosaic](mosaic.png)

# mosaic

Mosaic is a file format supporting **incremental collaboration on geometric and structured data**. Many files may be combined to form a bigger picture, a composed ECS, but in the composition they **retain their identity and lineage**.

This repository holds the format's specification and the tooling used to work with it:

- **`src/schema`** — the format definition, written in [TypeSpec](https://typespec.io), which emits the
  canonical JSON Schema.
- **`standard`** — the emitted JSON Schema, checked in so consumers can use it without running the toolchain.
- **`src/code-gen`** — a CLI that turns Mosaic component schemas into typed TypeScript or C# classes.
- **`sdk`** — runtime libraries (in progress).

## The format

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

A **node** has a `uuid` id and a list of component references. Each reference names a `typeID`, points at a
row via `componentIndex`, and carries an `operation`:

- `PASS_THROUGH` — leave the inherited value alone
- `DELETE` — unset the value
- `VALUE` — set the value

That three-way operation is what lets a later section modify a node introduced by an earlier one without
restating everything about it.

## Generating the schema

```bash
cd src/schema-gen
npm install
npm run compile-json-spec
```

The TypeSpec compiler reads [`mosaic-json-file.tsp`](src/schema-gen/mosaic-json-file.tsp) and writes JSON
Schema to [`standard/`](standard/), as configured in
[`tspconfig.yaml`](src/schema-gen/tspconfig.yaml). Commit the regenerated output alongside the spec change.

## Generating code from component schemas

`mosaic-codegen` walks a directory for `*.schema.json` files and emits a typed class per schema, mirroring
the input directory structure:

```bash
node src/code-gen/mosaic-codegen.js <input_dir> <output_dir> <ts|cs>
```

Every input schema must declare an `x-mosaic-id`, e.g. `"x-mosaic-id": "acme::geometry::wall"`. The
generator uses it to derive the class name (`Wall`), the C# namespace (`acme_geometry_Wall`), and the
`Identity` block it appends to each generated file — which bundles the type ID, the originating schema
source, and the JSON conversion functions so a value can be round-tripped and identified at runtime.

## Packing a dataset

A Mosaic dataset is authored as one JSON document — the index plus the component rows — and packed
into a `.tsr` archive for consumers:

```bash
mosaic pack <input.json> [output.tsr]
```

Packing resolves each `componentTables[].schema` reference (a path relative to the source document)
into the schema document itself, writes one `<typeID>.ndjson` file per component table, and puts them
alongside `index.json` in the archive. Without an output path the archive is written next to the
source document, so `house-v1.mosaic.json` becomes `house-v1.tsr`.

The source-document format is described in [`sdk/ts/test-data/README.md`](sdk/ts/test-data/README.md),
and the packing itself lives in the TypeScript SDK (`buildMosaicFile`, `packMosaicSource`,
`packMosaicSourceFile`), which the CLI depends on — so the same behaviour is available to any
consumer of the SDK.

## Importing glTF

`mosaic` converts a glTF 2.0 model into Mosaic, reading either a `.gltf` document or a `.glb`
container:

```bash
mosaic gltf      <input.gltf|input.glb> [output.mosaic.json]   # to a source document
mosaic gltf-pack <input.gltf|input.glb> [output.tsr]           # straight to an archive
```

Both read the same conversion; the first stops at the editable JSON document, the second packs it in
one step. Buffers are resolved from the GLB binary chunk, from `data:` URIs, or from files beside the
input, and inlined as `data:` URIs so the result stands alone. The component schemas are inlined too,
so a converted `.mosaic.json` packs anywhere without needing the schema files.

Every glTF id becomes the id of the Mosaic node carrying the referenced component, so later edits to
the component tables cannot silently repoint a reference. Each buffer, bufferView, accessor, image,
sampler, texture and material gets a node of its own; each glTF node with a mesh becomes a node
carrying that mesh and its transform. The metallic-roughness surface travels whole — base colour,
metallic-roughness, normal, occlusion and emissive textures, along with `emissiveFactor`,
`alphaMode`, `alphaCutoff` and `doubleSided` — so a textured model keeps its appearance. glTF data
outside the component subset (morph targets, `extensions`, `extras`) is reported as a warning rather
than dropped in silence, and a sparse accessor is refused outright rather than converted into
something wrong.

The conversion lives in the SDK under [`sdk/ts/src/gltf/`](sdk/ts/src/gltf/), which also owns the
glTF-derived component schemas; the CLI commands are a thin wrapper over it.

## Composing a renderable GLB

`mosaic compose` reads an archive together with everything it imports and writes a binary glTF:

```bash
mosaic compose <input.tsr> [output.glb]
```

Imports are resolved relative to the archive that names them, recursively, and merged underneath it
so a later section still wins; an import naming a URI that is not on disk is skipped and reported.
Every Mosaic node in the result becomes a glTF node keeping its id as the node name, and its
components are written one of two ways:

- **Natively**, for the `khronos::gltf` namespace. Meshes and transforms go onto the node itself;
  buffers, bufferViews, accessors, images, samplers, textures and materials are hoisted into the
  document's arrays, and node ids become the array indices glTF expects. Nodes sharing a primitive
  share a mesh.
- **As hierarchy**, for `core::child`. That component carries no value: the *name* of the reference
  is the id of the child node, so one node can hold many children and a later section can drop a
  single link with a `DELETE` on that name. Composing turns those links into glTF `children`, and a
  node that is someone's child is left out of the scene's root list.
- **As an extension**, for everything else. The components ride along under `MOSAIC_components` on
  the node, listed in `extensionsUsed` but never in `extensionsRequired`, so a viewer that does not
  know Mosaic still renders the file.

Buffers are written as a real binary chunk, not data URIs: every buffer is decoded and laid end to
end into the GLB's BIN chunk on 4-byte boundaries, with each bufferView shifted to match. An image
held inline as a data URI is moved into that chunk too, and given a bufferView of its own, so the
textures ship as bytes rather than as base64 text in the JSON.

Round-tripping `DamagedHelmet.glb` through `gltf-pack` and `compose` returns a file whose materials,
textures, images, samplers, accessors, bufferViews and meshes are all identical to the original, with
byte-identical geometry and texture payloads. The output passes the Khronos glTF validator with no
errors, reporting only the tangent-space warning the original itself carries.

The composition lives in the SDK under [`sdk/ts/src/composition/`](sdk/ts/src/composition/); the CLI
command is a thin wrapper over it.

## Tests

The TypeScript SDK is tested end to end: each case builds a real `.mosaic` archive from an example
dataset, reads it back through `LoadMosaicFile`, and asserts on what a reader sees.

```bash
cd sdk/ts
npm install
npm test
```

The runner is Node's built-in `node:test` with native TypeScript execution, so there is no test
framework or build step to configure. Example datasets live in [`sdk/ts/test-data/`](sdk/ts/test-data/)
and are documented in the README there.

## Status

Mosaic is pre-1.0. Expect breaking changes to
both the schema and the generated code layout.
