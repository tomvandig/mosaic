# Querying a dataset with DuckDB

The TypeScript SDK can load archives into a [DuckDB](https://duckdb.org) database, which turns a set
of Mosaic files into something SQL can be pointed at:

```ts
import { MosaicDatabase } from "mosaic-ts/duckdb";

const db = await MosaicDatabase.open("scene.duckdb");   // creates it if it is not there
await db.insertArchive("house-v2.tsr");
await db.insertArchive("gltf-box.tsr");                  // appends; nothing is overwritten
const rows = await db.all(`SELECT * FROM "khronos::gltf::accessor"`);
await db.close();
```

A fixed set of tables holds the index — `mosaic_file`, `mosaic_import`, `mosaic_section`,
`mosaic_node`, `mosaic_component_ref` and `mosaic_component_table` — and **each component type gets a
table named after it**, built at load time from the schema the archive carries, since which components
a file holds is not known up front:

```sql
SELECT name, count, min FROM "khronos::gltf::accessor" WHERE type = 'VEC3';
```

Columns follow the schema: a string becomes `VARCHAR`, an integer `BIGINT`, an array of numbers
`DOUBLE[]`, and anything with no scalar equivalent — a nested object, a union — stays `JSON`, which
`json_extract` still reaches into. Beyond those a table keeps only `file_id` and `idx`, the row a
reference points at. A type whose schema has grown by the time a later archive arrives gains the new
columns; the rows already there read `NULL` for them.

**The columns are the component.** Nothing keeps a copy of the document beside them — a row is read
back by putting its columns together again, which is what a download, a compose or a node fetch is
built from. (Storing it twice cost about a third of the file: the DamagedHelmet database went from
15.2 MB to 10.0 MB when the copy went.) Two things follow:

- **A schema that does not seal itself is warned about.** A property no schema declares has no column
  to go in, so inserting one warns that `the schema does not set "additionalProperties": false` —
  every schema Mosaic ships does set it. A type carrying rows that its archive never declared at all
  has its columns taken from the rows themselves, and says so.
- **Null is not a value a component can carry.** A column reads `NULL` both for a property that was
  absent and for one written as `null`, and absent is what comes back. Properties also come back in
  the order the schema declares them rather than the order they were written in — a row makes the
  round trip as data, not as text.

Loading is **pre-composition**: sections are appended as written, so no `DELETE` or `PASS_THROUGH` is
ever applied and inserting the same archive twice keeps both copies, under `name` and `name#2`. A
reference resolves against its own archive, so joins carry `file_id`:

```sql
SELECT w.name
FROM mosaic_component_ref r
JOIN "acme::geometry::wall" w ON w.file_id = r.file_id AND w.idx = r.idx
WHERE r.type = 'acme::geometry::wall';
```

Because a value-less component keeps its data in the reference `id`, names, child links and is-a
links are all queried straight off `mosaic_component_ref` — `WHERE type = 'core::inherit'` answers
"everything that is a Chair" without touching the geometry at all.

[`examples/duckdb-queries.ts`](https://github.com/tomvandig/mosaic/blob/main/sdk/ts/examples/duckdb-queries.ts) builds a database from the example
archives and runs ten such queries — the scene tree, is-a links, transforms, following a mesh to its
vertex data, geometry totals per file, and the sections that touched a given node:

```bash
cd sdk/ts && npm run example:duckdb
```

The exporter is a subpath import (`mosaic-ts/duckdb`) rather than part of the main entry point, so
the CLI, which bundles the SDK into a single executable, never pulls DuckDB's native module in.

## Composing a database

`mosaic compose` takes a database wherever it takes an archive:

```bash
mosaic compose scene.duckdb                     # everything in it
mosaic compose scene.duckdb out.glb --file gltf-box --file typed-boxes
```

Reading a database back is the reverse of loading one: each archive kept its own component tables, so
the rows of each type are laid end to end and every reference is shifted to where its archive's rows
begin — the same thing federating two files does. Sections keep the order the archives were inserted
in, so a later archive layers over an earlier one, and nodes that share an id across archives merge
rather than duplicate. What a database has no notion of is an import graph: imports were resolved
into rows on the way in, so insertion order is the layering.

Because DuckDB is a native module and cannot live inside a single-file executable, it is left out of
the build and loaded only when a database is actually named — from the working directory, from beside
the executable, or from wherever `MOSAIC_DUCKDB` points. Every other command runs with nothing
installed, and a database command with nothing to load says exactly what it looked for.
