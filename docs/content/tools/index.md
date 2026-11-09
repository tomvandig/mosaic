# The CLI

`mosaic` is the command line for the [SDK](/sdk/). It ships as a single executable.

It is a thin layer: each command parses arguments and calls one SDK function. It adds
convenience only (file paths, default output names, console reporting), never behaviour.

| Command | Calls | |
| --- | --- | --- |
| `mosaic pack` | by extension: `packMosaicSourceFile`, `gltfToMosaic`, `mosaic-ifc4` or `svgToMosaic`; to a `.tsr`, or to a `.mosaic.json` | [Packing](/tools/pack) |
| `mosaic diff` | `diffArchives` | [Diffing](/tools/diff) |
| `mosaic federate` | `federate` | [Federating](/tools/federate) |
| `mosaic compose` | `composeArchiveToGlb`, or the DuckDB reader for a `.duckdb` | [Composing](/tools/compose) |
| `mosaic serve` | the API server and viewer page | [HTTP API](/sdk/http-api) |
| `mosaic codegen` | quicktype over `*.schema.json` | [Code generation](/tools/codegen) |

## Building it

```bash
cd sdk/cli
npm install
npm run build        # -> dist/mosaic.cjs
npm run build:exe    # a single-file executable, via Node's SEA
```

DuckDB is a native module, so it can't be bundled into the executable. It is loaded only when a
command is given a database: from the working directory, from beside the executable, or from
wherever `MOSAIC_DUCKDB` points. Every other command runs with nothing installed.
