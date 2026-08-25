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
