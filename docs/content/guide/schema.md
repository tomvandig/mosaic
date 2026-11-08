# Generating the schema

```bash
cd src
npm install
npm run compile-json-spec
```

The TypeSpec compiler reads [`mosaic-json-file.tsp`](https://github.com/tomvandig/mosaic/blob/main/src/mosaic-json-file.tsp) and writes
[`standard/mosaic-index-file.schema.json`](https://github.com/tomvandig/mosaic/blob/main/standard/mosaic-index-file.schema.json), as configured in
[`tspconfig.yaml`](https://github.com/tomvandig/mosaic/blob/main/src/tspconfig.yaml). Commit the regenerated output alongside the spec change.

# Generating code from component schemas

`mosaic-codegen` walks a directory for `*.schema.json` files and emits a typed class per schema, mirroring
the input directory structure:

```bash
node src/code-gen/mosaic-codegen.js <input_dir> <output_dir> <ts|cs>
```

Every input schema must declare an `x-mosaic-id`, e.g. `"x-mosaic-id": "acme::geometry::wall"`. The
generator uses it to derive the class name (`Wall`), the C# namespace (`acme_geometry_Wall`), and the
`Identity` block it appends to each generated file — which bundles the type ID, the originating schema
source, and the JSON conversion functions so a value can be round-tripped and identified at runtime.
