# @tomvandig/mosaic

The command line for [Mosaic](https://tomvandig.github.io/mosaic/dist/docs/), a file format for
incremental collaboration on geometric, structured data.

```bash
npx @tomvandig/mosaic help

# convert a glTF model, straight from a URL
npx @tomvandig/mosaic pack https://tomvandig.github.io/mosaic/dist/docs/models/DamagedHelmet.glb
```

Or install it, and the command is `mosaic`:

```bash
npm install -g @tomvandig/mosaic
mosaic help
```

Needs Node.js 24 or later.

## Commands

| Command | |
| --- | --- |
| `mosaic pack <input> [output.tsr] [flags]` | Pack into a `.tsr` archive, by extension: a source document (`.json`), glTF (`.gltf`, `.glb`, or a URL), IFC (`.ifc`) or SVG (`.svg`). Name the output `.mosaic.json` to get an editable source document instead (glTF and IFC) |
| `mosaic compose <input.tsr\|.duckdb> [output.glb]` | Compose an archive and its imports into a `.glb` |
| `mosaic serve <database.duckdb> [--port <n>] [--host <name>]` | Serve the Mosaic API, and a viewer, over a database |
| `mosaic codegen <input_dir> <output_dir> <ts\|cs>` | Generate typed classes from component schemas |

See [the documentation](https://tomvandig.github.io/mosaic/dist/docs/tools/) for each.

## DuckDB

The commands that read or write a database (`compose` given a `.duckdb`, and `serve`) need
[DuckDB](https://duckdb.org). It isn't installed with the CLI, because its native binary is large
and no other command uses it. If it's missing, the CLI says so and gives the exact command, for
example:

```bash
npm install @duckdb/node-api@1.5.5-r.4
```

Run it in the directory you run `mosaic` from, or set `MOSAIC_DUCKDB` to a directory where it is
installed.

## Status

Mosaic is pre-1.0. Expect breaking changes.
