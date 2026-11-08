# The HTTP API

[`src/mosaic-api.tsp`](https://github.com/tomvandig/mosaic/blob/main/src/mosaic-api.tsp) describes an API for keeping tesserae and their
versions. It emits OpenAPI on its own config, since the file format's emitter has nothing to say
about routes:

```bash
cd src
npm run compile-api-spec     # mosaic-api.tsp -> standard/mosaic-api.openapi3.json
npm run gen-api-sdk          # mosaic-api.openapi3.json -> sdk/ts/src/api/
```

The second step generates three files:

- **`MosaicApiTypes.ts`** — the types, through quicktype, as the file format does it. Object schemas
  are sealed on the way through so each type says exactly what it holds.
- **`MosaicApiRoutes.ts`** — one entry per operation: id, method, path template, path and query
  parameters, whether it takes a body.
- **`MosaicApiClient.ts`** — a `fetch` client with one method per operation, typed from the same
  schemas the server answers with. A non-2xx becomes an `ApiError` carrying the status and the
  server's message; a state the API answers with, such as `OUT_OF_DATE`, comes back as a value.

Client and server are generated from the same document, so a route that moves moves in both at once:

```ts
import { MosaicApiClient } from "mosaic-ts/api";

const client = new MosaicApiClient("http://127.0.0.1:8791");
await client.createTessera({ body: { id, name: "Terrace" } });
const blob = await client.uploadMosaicBlobUrl({ tesseraId: id });
await client.upload({ blobId: blob.blobId, body: archiveBytes });
```

The client is tested against a server that is really listening — a real port, real sockets, real
HTTP — and the server's lifecycle is part of what the tests check: that the port is taken while it
runs, given up when it closes, reusable by the next server, and that a client pointed at a stopped
server fails to connect rather than hanging.

The server routes off that table rather than a hand-written list, so the paths it answers on are the
paths the spec declares, and an operation added to the `.tsp` shows up as a missing handler rather
than as a route nobody noticed. A test asserts every operation has one.

```bash
mosaic serve scene.duckdb --port 8791
```

A **tessera** is one model kept by the API — a tile of the mosaic — and every route is named for it:

```
GET    /Mosaic-api/tesserae
POST   /Mosaic-api/tesserae
GET    /Mosaic-api/tesserae/{tesseraId}
DELETE /Mosaic-api/tesserae/{tesseraId}
POST   /Mosaic-api/tesserae/{tesseraId}/upload-Mosaic-blob-url
POST   /Mosaic-api/tesserae/{tesseraId}/versions
GET    /Mosaic-api/tesserae/{tesseraId}/versions/{versionId}
PUT    /Mosaic-api/tesserae/{tesseraId}/versions/{versionId}/download-Mosaic
PUT    /Mosaic-api/upload/{blobId}
PUT    /Mosaic-api/download/{blobId}
```

Tesserae, versions and blob bookkeeping go in `api_tessera`, `api_tessera_version` and `api_blob`, beside
the tables archives are loaded into — so a version's contents are queryable in the same database it
is served from:

```sql
SELECT file_id, name FROM "acme::geometry::wall";   -- file_id is "<tesseraId>/<versionId>"
```

**Nothing is on disk but the database.** Uploaded bytes are a `BLOB` in `api_blob`, not a file, and
they are the only bytes kept as bytes. `upload-Mosaic-blob-url` hands out an id and a `putURL`, the
client PUTs the archive there, and `POST /versions` reads it *once* — to check it and to unpack it
into the component tables. A version that does not follow the one the tessera is actually on answers
`OUT_OF_DATE`, and a blob that is not a readable archive answers `VALIDATION_ERROR` with the reason,
rather than either being an HTTP error.

**After that, every answer is built from the tables.** A version's content lives in
`mosaic_component_ref` — which node carries which component — and in one table per component type.
Those tables are created when a type is first seen, from the schema the archive carries, since which
components a database will hold is not knowable up front. Downloads and node fetches are assembled
from them and never from the archive a version arrived in, so **dropping every uploaded byte changes
nothing a client can ask for**. One consequence is worth stating plainly: a download is *rebuilt*, so
it equals what was published in content, not byte for byte.

`POST /versions/{versionId}/nodes` fetches **a set of nodes by id**, built when it is asked for and
stored nowhere:

```jsonc
// ?format=glb  or  ?format=tsr
{
  "nodes": ["55555555-…", "66666666-…"],   // the nodes to take
  "componentTypes": ["core::transform"],   // only these; all of them when left out
  "includeChildren": true,                 // and everything beneath them
  "compose": true                          // resolve inheritance, as composing does
}
```

`compose` makes a node that **is-a** something carry that something's components rather than a link
to it. The nodes it inherits from are read for what they hold and then left out of the answer — a
type is a source of components, not a thing to draw beside the thing that is of that type.

**Imports are followed.** A version whose archive imports `bench.tsr` is answered from its own rows
*and* from the tessera published here under the name `bench` — an import names an archive, this server
holds archives as tesserae, and the file name is the link between the two. So a `core::child` that
leaves one tessera and lands on a node in another resolves like any other reference, and the two
datasets stay separately versioned things: the imported tessera is read at its latest version, so
publishing a new bench changes every courtyard that places one, without republishing any of them. The
imported archive layers *underneath* the one that imports it, as an older section would. An import
naming something this server does not have is left out and reported rather than failing the request.

**The subset is taken in the database, not by rebuilding the version and filtering it.** The nodes
asked for, the references they carry and the rows behind those are each queried by name; collapsing —
the last write to a reference wins, a `DELETE` removes it — is done in SQL, and `includeChildren`
walks `core::child` with a recursive CTE that touches nothing else. So the cost follows the request
rather than the size of the version:

| version | rebuild then filter | selected in SQL |
| --- | --- | --- |
| 406 nodes | 26 ms | 19 ms |
| 1606 nodes | 46 ms | 21 ms |
| 6006 nodes | 127 ms | 22 ms |

The answer is a stream of bytes: a `.glb` for a viewer, or a `.tsr` that is a Mosaic archive in its
own right — one that can be published again as another tessera. Either way the subset is made whole
first: anything a kept component points at comes along, so a mesh never names an accessor the answer
does not carry. The component filter applies to the nodes that were asked for, not to what was pulled
in for them. Nodes the version does not have are named in an `x-mosaic-missing` header, and the number
built in `x-mosaic-nodes`, so the body stays nothing but the file.

`download-Mosaic` builds what the `downloadType` asks for and answers with a blob url:
`just_this_version` hands back the archive as uploaded, `whole_tessera_history_intact` federates every
version up to that one keeping all sections, and the condensed forms collapse them to what is still
leading.

## The page it serves

`mosaic serve` also puts a page at `/` for looking at what the server holds:

```bash
mosaic serve scene.duckdb --port 8791     # then open http://127.0.0.1:8791
```

Drop `.tsr` files on it and they are published — a new tessera, or a new version of one with that
name. Then four panels:

- a **tesserae** list of everything the server holds. Tick as many as you like and pick a version of
  each; what is ticked is what is on show, all of it read as one scene;
- a **tree** of the child hierarchy, grouped by the versions on show and drawn from a single
  selection over their root nodes, each node labelled by its `core::name`. It asks for three
  component types and no others — `core::child`, `core::name` and `core::inherit` — because those
  are what it draws. A converted building carries far more: reading the architectural model's tree
  with everything meant loading 387,983 component rows to show a list of names, and with those three
  it loads none;
- a **components** view of whatever node is selected, with each component's type, reference id and
  value, and the tessera the node is written in. Since the tree no longer carries any of that, this
  asks for the one node it is about, when it is selected;
- a **3D** view, drawn with [three.js](https://threejs.org), fed the GLB that
  `POST …/versions/{versionId}/nodes?format=glb` builds for the selected node. Selecting a node
  reloads it; **Show everything** loads every root on show. It asks only for the components a glb has
  somewhere to put — the glTF namespace, plus `core::transform` and `core::child` — because
  everything else rides along as extension data on the node and none of it is drawable: that is the
  architectural model's glb at 62.7 MB rather than 251.4 MB, with the same 20,978 meshes in it. A
  converted building arrives as tens of
  thousands of separate meshes — 79,193 in the electrical model of the sample set — and each one
  would be a draw call, so meshes sharing a material are gathered into a `BatchedMesh`: 79,193 of
  them become seventeen draws. The batch keeps each distinct geometry once rather than baking a copy
  per placement, which matters because these files reuse geometry heavily; merging them instead would
  have turned that model's 28 MB of geometry into 760 MB. The panel also only redraws when something
  moves.

**This is where imports are worth looking at.** Tick a tessera that imports another and the one it
imports is read too, ticked or not — it is listed as *via import*, and any of its nodes drawn in the
tree carries a badge naming it, so a child link crossing from one tessera into another is visible as
exactly that. Being a root is judged across everything on show, so ticking both a courtyard and the
bench it places moves the bench out of its own list of roots and under the spot that holds it, rather
than drawing it twice.

A **compose** checkbox runs both the tree and the 3D view through the flag above, so the difference
between a node that is-a type and a node carrying that type's geometry is one click.

The page's own endpoints — `/app/upload`, `/app/tesserae`, `/app/scene` and `/app/glb` — are
deliberately **not** part of the spec: `mosaic-api.tsp` is the contract, and these exist so the page
can upload in one call, read a whole scene in another, and ask for one view over *several* versions,
which is a question the spec's per-version `nodes` operation does not express. `/app/scene` takes
`components=` to name the component types worth returning, `nodes=` to ask about particular nodes
rather than the roots, and `children=false` to stop it descending; left out, all three keep the whole
scene. `/app/glb` takes the same `componentTypes` the `nodes` operation does. Selecting a single
node still goes through that real endpoint — against the version the node is written in, which for a
node reached across an import is the imported tessera. three.js is loaded from a CDN on first draw,
so the 3D panel wants the machine to have internet; the rest of the page does not.

Everything the server answers with is **gzipped** when the client says it takes gzip and there is
more than about a kilobyte of it. That matters more than it sounds: these answers are mostly
repetition — a scene is the same few keys over a hundred thousand nodes, a glb is long runs of
similar floats — so the architectural model's tree goes from 64.6 MB on the wire to a fraction of
it. Compression is at the fastest level deliberately; on a body this size the slower levels spend
hundreds of milliseconds to find another few percent, which is the wrong trade for something a
browser is waiting on.

Two things to know. **The query API is not implemented** — it answers 501, deliberately, and is the
one operation with no real handler. And DuckDB takes an exclusive lock on the database file, so
`mosaic compose scene.duckdb` will not run while a server is holding it; stop the server first.
