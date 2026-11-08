# Packing

`mosaic pack` turns anything Mosaic reads into a `.tsr` archive. It decides what the input is by its
extension:

```bash
mosaic pack <input> [output.tsr] [flags]
```

| Input | Packed as | Flags |
| --- | --- | --- |
| `.json`, `.mosaic.json` | A Mosaic source document, packed as written | |
| `.gltf`, `.glb`, or an `http(s)` URL to one | A glTF model, converted. See [Importing glTF](/tools/gltf) | `--stable-ids` |
| `.ifc` | An IFC4 or IFC2X3 model, converted. See [Importing IFC](/tools/ifc) | `--center`, `--no-geometry`, `--seed=<text>` |
| `.svg` | A drawing, carried whole as one node. See [SVG](/tools/svg) | |

Without an output path the archive is written next to the input, with the same name:
`house-v1.mosaic.json` becomes `house-v1.tsr` and `tower.ifc` becomes `tower.tsr`. A model packed from
a URL is written to the working directory.

::: code-group

```bash [source document]
mosaic pack house-v1.mosaic.json            # -> house-v1.tsr
```

```bash [glTF]
mosaic pack DamagedHelmet.glb --stable-ids  # -> DamagedHelmet.tsr
mosaic pack https://tomvandig.github.io/mosaic/dist/docs/models/DamagedHelmet.glb
```

```bash [IFC]
mosaic pack tower.ifc --center              # -> tower.tsr
```

```bash [SVG]
mosaic pack drawing.svg                     # -> drawing.tsr
```

:::

Every archive `pack` writes stands alone: the component schemas are inlined, and so are a glTF's
buffers.

To edit a converted model before packing it, convert it to a source document first with
[`mosaic gltf`](/tools/gltf) or [`mosaic ifc`](/tools/ifc), change the JSON, then `mosaic pack` that.

## Source documents

A Mosaic dataset can be authored as one JSON document, the index plus the component rows. Packing
resolves each `componentTables[].schema` reference (a path relative to the source document) into the
schema document itself, writes one `<type>.ndjson` file per component table, and puts them alongside
`index.json` in the archive.

The source-document format is described in [`sdk/ts/test-data/README.md`](https://github.com/tomvandig/mosaic/blob/main/sdk/ts/test-data/README.md),
and the packing itself lives in the TypeScript SDK (`buildMosaicFile`, `packMosaicSource`,
`packMosaicSourceFile`), which the CLI depends on. The same behaviour is available to any consumer of
the SDK.
