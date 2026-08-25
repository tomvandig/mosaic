# Example data

Each `*.mosaic.json` file describes one Mosaic dataset in a form that is easy to read and diff — a
Mosaic *source document*, the input format of `mosaic pack` and of the SDK's `packMosaicSource`.
The tests pack these examples into real archives and load them back, so they exercise the same
zip/NDJSON path a real file takes.

```jsonc
{
  "description": "what this dataset is for",
  "components": {
    // typeID -> component rows, one object per NDJSON line
    "acme::geometry::wall": [ { "name": "North wall", "height": 2.4 } ]
  },
  "index": { /* a literal MosaicIndexFile */ }
}
```

Two conveniences packing applies, so the files stay readable:

- `componentTables[].schema` is written as a path relative to the source document (e.g.
  `schemas/wall.schema.json`); packing inlines the schema document in its place.
- Component rows are written as objects; packing serializes them to NDJSON lines. A row that is
  already a serialized string is kept verbatim.

To build an archive from one of these by hand:

```bash
mosaic pack sdk/ts/test-data/house-v1.mosaic.json
```

Component tables are not stored as `.ndjson` files on disk because a Mosaic `typeID` contains `::`,
which is not a legal character in a Windows filename. Inside the zip archive it is fine.

| File | What it is |
| --- | --- |
| `house-v1.mosaic.json` | Two walls in one section; the north wall is painted. |
| `house-v2.mosaic.json` | The same dataset with a second section layered on top: the north wall is raised, its paint deleted, and an east wall added. |
| `linked-house.mosaic.json` | A dataset that references other datasets through `imports` rather than restating them. Packing carries imports through untouched and never pulls the referenced data in. |
| `schemas/*.schema.json` | Component schemas, referenced by the fixtures and used as `originSchemaSrc` in the typed round-trip test. |
