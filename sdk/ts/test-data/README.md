# Example data

Each `*.mosaic.json` file describes one Mosaic dataset in a form that is easy to read and diff.
`test/fixtures.ts` turns it into a real `.mosaic` archive (via `WriteMosaicFile`) before the tests
load it back, so the tests exercise the same zip/NDJSON path a real file takes.

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

Two conveniences the loader applies, so the files stay readable:

- `componentTables[].schema` is written as a path relative to this folder (e.g.
  `schemas/wall.schema.json`); the loader inlines the schema document in its place.
- Component rows are written as objects; the loader serializes them to NDJSON lines.

Component tables are not stored as `.ndjson` files on disk because a Mosaic `typeID` contains `::`,
which is not a legal character in a Windows filename. Inside the zip archive it is fine.

| File | What it is |
| --- | --- |
| `house-v1.mosaic.json` | Two walls in one section; the north wall is painted. |
| `house-v2.mosaic.json` | The same dataset with a second section layered on top: the north wall is raised, its paint deleted, and an east wall added. |
| `schemas/*.schema.json` | Component schemas, referenced by the fixtures and used as `originSchemaSrc` in the typed round-trip test. |
