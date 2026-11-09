# Packing

`mosaic pack` turns anything Mosaic reads into a `.tsr` archive, or into an editable source document.
It decides what the input is by its extension, and what to write by the output's:

```bash
mosaic pack <input> [output.tsr | output.mosaic.json] [flags]
```

| Input | Packed as | Flags |
| --- | --- | --- |
| `.json`, `.mosaic.json` | A Mosaic source document, packed as written | |
| `.gltf`, `.glb`, or an `http(s)` URL to one | A glTF model, converted. See [Importing glTF](/tools/gltf) | `--stable-ids` |
| `.ifc` | An IFC4 or IFC2X3 model, converted. See [Importing IFC](/tools/ifc) | `--center`, `--no-geometry`, `--seed=<text>` |
| `.svg` | A drawing, carried whole as one node. See [SVG](/tools/svg) | |

The output's extension says what to write:

| Output | Writes |
| --- | --- |
| left out, or `*.tsr` | A `.tsr` archive. Left out, it goes next to the input with the same name: `tower.ifc` becomes `tower.tsr`. A model packed from a URL goes to the working directory |
| `*.mosaic.json` | The converted model as an editable source document, instead of an archive. glTF and IFC only |

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

```bash [edit, then pack]
mosaic pack tower.ifc tower.mosaic.json     # convert to a source document
# … edit tower.mosaic.json …
mosaic pack tower.mosaic.json               # -> tower.tsr
```

```bash [SVG]
mosaic pack drawing.svg                     # -> drawing.tsr
```

:::

Every archive `pack` writes stands alone: the component schemas are inlined, and so are a glTF's
buffers.

To edit a converted model before packing it, name the output `.mosaic.json`, change the JSON, then
`mosaic pack` that. An SVG has no source document, since it is carried whole rather than taken apart,
and a source document can only be packed to an archive.

## Source documents

A Mosaic dataset can be authored as one JSON document, the index plus the component rows. Packing
resolves each `componentTables[].schema` reference (a path relative to the source document) into the
schema document itself, writes one `<type>.ndjson` file per component table, and puts them alongside
`index.json` in the archive.

The source-document format is described in [`sdk/ts/test-data/README.md`](https://github.com/tomvandig/mosaic/blob/main/sdk/ts/test-data/README.md),
and the packing itself lives in the TypeScript SDK (`buildMosaicFile`, `packMosaicSource`,
`packMosaicSourceFile`), which the CLI depends on. The same behaviour is available to any consumer of
the SDK.
