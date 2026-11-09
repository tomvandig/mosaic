# The SDK

The reference implementation is the code that reads and writes Mosaic in this repository. It is one
correct reading of the [standard](/standard/file/), not the standard itself.

| Package | What it is |
| --- | --- |
| [`sdk/ts`](https://github.com/tomvandig/mosaic/tree/main/sdk/ts/) (`mosaic-ts`) | The core library: archives, packing, federation, selection, composition, glTF and SVG conversion, DuckDB, and the HTTP client and server |
| [`sdk/ifc4`](https://github.com/tomvandig/mosaic/tree/main/sdk/ifc4/) (`mosaic-ifc4`) | IFC4 / IFC2X3 conversion, on top of web-ifc |
| [`sdk/cli`](https://github.com/tomvandig/mosaic/tree/main/sdk/cli/) (`mosaic`) | The command line, bundled into a single executable. See [The CLI](/tools/) |
| `sdk/ts/src/viewer` | The browser viewer, built for both `mosaic serve` and the [static examples](/examples/) |

## How it follows the standard

The SDK doesn't define its own file types. `MosaicIndexFile.ts` is **generated** from
`standard/mosaic-index-file.schema.json` with quicktype, and the API client, routes and types in
`sdk/ts/src/api/` are generated from `standard/mosaic-api.openapi3.json`. When the standard changes,
regenerating them is what carries the change through, and a mismatch shows up as a type error.

The server routes off the generated table of operations, so a test can assert that every operation
in the spec has a handler.

## What the implementation adds

Everything below is built *on* the standard. A file produced this way is a valid Mosaic file, but
another implementation is not required to offer these features:

| Feature | Notes | Docs |
| --- | --- | --- |
| **The `.tsr` archive** | A zip with `index.json` and `<type>.ndjson` per table, deflated at level 6 | [The format](/standard/file/format) |
| **Source documents** | `.mosaic.json`, the index plus component rows in one readable file, packed into an archive | [Packing](/tools/pack) |
| **Component namespaces** | `core::`, `khronos::gltf::`, `w3c::`, `ifc4::` and their schemas | [Core components](/standard/core-components) |
| **Composition** | Imports followed, sections collapsed, `core::inherit` expanded, `core::child` turned into a glTF hierarchy | [Composing](/tools/compose) |
| **Converters** | glTF / GLB, IFC and SVG into Mosaic, with stable ids where asked | [glTF](/tools/gltf), [IFC](/tools/ifc), [SVG](/tools/svg) |
| **Federation & diff** | Merging files with shifted references; the changes between two files, by value, as a file of their own (`diffArchives` and `federate`, behind [`mosaic diff`](/tools/diff) and [`mosaic federate`](/tools/federate)) | [source](https://github.com/tomvandig/mosaic/blob/main/sdk/ts/src/MosaicFileOperations.ts) |
| **Selection** | A subset of nodes as a file of its own, made whole | [source](https://github.com/tomvandig/mosaic/blob/main/sdk/ts/src/Selection.ts) |
| **DuckDB storage** | One table per component type, built from each archive's schemas | [DuckDB](/sdk/duckdb) |
| **The server** | The OpenAPI operations over DuckDB, plus the page's own `/app/*` endpoints, which are *not* part of the spec | [HTTP API](/sdk/http-api) |
| **The viewer** | Tree, components and a 3D view, in the browser | [Examples](/examples/) |

## Where it falls short of the standard

The standard declares a few things the implementation does not do yet. If you depend on any of
these, check the code first:

| In the standard | In the reference implementation |
| --- | --- |
| `ComponentTableReference.type` may be `PARQUET` | Archives are read and written as NDJSON only. Parquet is recorded, not read |
| `ImportNode.integrity` pins an import by hash | Stored and carried through, but not verified when an import is resolved |
| The query operation of the API | Answers `501 Not Implemented` |

## In this section

- [Querying with DuckDB](/sdk/duckdb): loading archives into a database and querying them with SQL.
- [The HTTP API](/sdk/http-api): the reference server for the [API standard](/standard/api).
