# The standard and its implementations

Mosaic is three different things kept in one repository. They change at different speeds and
promise different things:

| Layer | What it is | Where it lives | What it promises |
| --- | --- | --- | --- |
| **The standard** | The shape of a Mosaic file and of the HTTP API, as JSON Schema and OpenAPI | [`standard/`](https://github.com/tomvandig/mosaic/tree/main/standard/), generated from [`src/`](https://github.com/tomvandig/mosaic/tree/main/src/) | What any reader or writer, in any language, can rely on |
| **The reference implementation** | The TypeScript SDK, the IFC converter and the viewer | [`sdk/ts`](https://github.com/tomvandig/mosaic/tree/main/sdk/ts/), [`sdk/ifc4`](https://github.com/tomvandig/mosaic/tree/main/sdk/ifc4/) | One working reading of the standard, plus conventions built on top of it |
| **The CLI** | The `mosaic` command | [`sdk/cli`](https://github.com/tomvandig/mosaic/tree/main/sdk/cli/) | A thin wrapper exposing the reference implementation as commands |

```
src/*.tsp ──tsp compile──▶ standard/*.json ──quicktype──▶ sdk/ts (types)
                                                          │
                                       sdk/ts + sdk/ifc4 ─┴─▶ sdk/cli  (mosaic …)
                                                          └─▶ viewer
```

The arrows only go one way. The standard does not know the SDK exists. The SDK's types are
*generated* from the standard, and the CLI adds no behaviour of its own: every command calls a
function in the SDK that you can also call from your own code.

::: warning Pre-1.0
All three layers are still moving, the standard included. Its version string (`MosaicVersion`) is
currently `"post-alpha"`.
:::

## Why the split matters

**If you are writing another implementation**, in C#, Python or Rust, the standard is the contract.
Validate against [`mosaic-index-file.schema.json`](/standard/file/#the-index-file) and you can
read and write Mosaic without any of the TypeScript code.

**If you are using Mosaic from TypeScript**, the SDK gives you a lot more than the standard does:
packing, federating, selecting, composing to glTF, converters and a database. Most of that is
[behaviour the schemas do not define](/sdk/#what-the-implementation-adds),
so another implementation may not do it, or may do it differently.

**If you only want the tools**, the CLI is all you need. It ships as a single executable, and
everything it does is described in [The CLI](/tools/) section of these docs.

## Generating the standard

```bash
cd src
npm install
npm run compile-json-spec
```

The TypeSpec compiler reads [`mosaic-json-file.tsp`](https://github.com/tomvandig/mosaic/blob/main/src/mosaic-json-file.tsp) and writes
[`standard/mosaic-index-file.schema.json`](https://github.com/tomvandig/mosaic/blob/main/standard/mosaic-index-file.schema.json), as configured in
[`tspconfig.yaml`](https://github.com/tomvandig/mosaic/blob/main/src/tspconfig.yaml). Commit the regenerated output alongside the spec change. The [API standard](/standard/api) is
generated the same way, with `npm run compile-api-spec`.

## In this section

- [File standard](/standard/file/): the index file schema, field by field, and how it is
  generated. [The format, by example](/standard/file/format) opens up a real archive.
- [API standard](/standard/api): the OpenAPI description of the HTTP API.

The reference implementation is described in [The SDK](/sdk/) and [The CLI](/tools/): what they
build on top of the standard, and where they currently fall short of it.
