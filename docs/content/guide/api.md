# API

Mosaic can be used from code through the TypeScript SDK (`mosaic-ts`, in
[`sdk/ts`](https://github.com/tomvandig/mosaic/tree/main/sdk/ts/)) and over HTTP. The SDK is what
the `mosaic` CLI is built on, so everything the CLI does is available to your code as well.

| Entry point | For |
| --- | --- |
| `mosaic-ts` | Reading, writing, packing, federating, selecting and composing archives |
| `mosaic-ts/duckdb` | Loading archives into DuckDB and querying them with SQL. See [Querying with DuckDB](/sdk/duckdb) |
| `mosaic-ts/api` | A typed client and server for the HTTP API. See [The HTTP API](/sdk/http-api) |

::: warning
The SDK is in progress and not yet published to npm. Names and signatures may change.
:::

## Reading and writing archives

`LoadMosaicFile` opens the bytes of a `.tsr`, and `WriteMosaicFile` turns a `MosaicFile` back into
bytes. A `MosaicFile` is the index plus the serialized component rows, keyed by type.

```ts
import fs from "node:fs";
import { LoadMosaicFile, WriteMosaicFile } from "mosaic-ts";

const file = await LoadMosaicFile(new Uint8Array(fs.readFileSync("house-v1.tsr")));

for (const section of file.index.sections) {
    console.log(section.header.message, section.nodes.length, "nodes");
}

fs.writeFileSync("copy.tsr", await WriteMosaicFile(file));
```

## Packing source documents

A source document (`.mosaic.json`) becomes an archive with `packMosaicSource`, or straight from disk
with `packMosaicSourceFile`, which is what `mosaic pack` runs. `buildMosaicFile` stops at the
in-memory `MosaicFile`.

```ts
import { packMosaicSourceFile } from "mosaic-ts";

const result = await packMosaicSourceFile("house-v1.mosaic.json");   // writes house-v1.tsr
```

## Combining files

| Function | What it does |
| --- | --- |
| `collapseNodesByPath(file)` | Every node as it stands after all sections, with later writes winning and `DELETE`s applied |
| `federate(a, b, keepHistory)` | Merges `b` over `a`. Tables are laid end to end and references shifted; with `keepHistory` every section is kept |
| `diffFiles(old, new, markMissingAsDelete)` | The section that turns `old` into `new` |

## Selecting nodes

`selectNodes` takes a subset of a file as a file of its own, made whole: anything a kept component
points at comes along. It is the same operation the HTTP API's `nodes` endpoint performs.

```ts
import { selectNodes } from "mosaic-ts";

const { file: subset, missing, pulledIn } = selectNodes(file, {
    nodes: ["70000000-7000-4000-8000-700000000003"],
    componentTypes: ["core::transform", "core::name"],   // all types when left out
    includeChildren: true,                               // and everything beneath
    compose: true,                                       // resolve inheritance first
});
```

## Composing to glTF

`mosaicToGltf` composes a file into a glTF document and its binary chunk, and `writeGlb` writes those
as a `.glb`. `composeArchiveToGlb` does the whole thing from a path, following imports, and is what
`mosaic compose` runs. See [Composing a GLB](/tools/compose) for what the composition does.

```ts
import { composeArchive, writeGlb } from "mosaic-ts";

const { document, binary, warnings, sources } = await composeArchive("helmet-plaza.tsr");
const glb = writeGlb(document, binary);
```

## Converters

| Function | Package | CLI |
| --- | --- | --- |
| `gltfToMosaic` | `mosaic-ts` | [`mosaic gltf`](/tools/gltf) |
| `svgToMosaic` | `mosaic-ts` | [`mosaic svg-pack`](/tools/svg) |
| IFC conversion | [`sdk/ifc4`](https://github.com/tomvandig/mosaic/tree/main/sdk/ifc4/) | [`mosaic ifc`](/tools/ifc) |

## Typed components

The schema constants (`CORE_SCHEMAS`, `GLTF_SCHEMAS`, `SVG_SCHEMAS`) and type ids (`CORE_TYPE`,
`GLTF_TYPE`, `SVG_TYPE`) are exported as well. For your own component schemas,
[code generation](/guide/schema) produces typed TypeScript or C# classes.
