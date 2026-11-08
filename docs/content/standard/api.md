# API standard

The API standard describes an HTTP service for **keeping tesserae and their versions**: publishing
Mosaic files, reading them back and fetching parts of them. Like the file standard, it is written in
TypeSpec, in [`src/mosaic-api.tsp`](https://github.com/tomvandig/mosaic/blob/main/src/mosaic-api.tsp),
and emitted as OpenAPI 3 to
[`standard/mosaic-api.openapi3.json`](https://github.com/tomvandig/mosaic/blob/main/standard/mosaic-api.openapi3.json):

```bash
cd src
npm run compile-api-spec     # mosaic-api.tsp -> standard/mosaic-api.openapi3.json
```

The OpenAPI document is the contract. Any server that answers it is a Mosaic API, and any client
generated from it can talk to one. The reference server, `mosaic serve`, is described in
[The HTTP API](/sdk/http-api).

## Concepts

Tessera
: One model kept by the service, a tile of the mosaic. It has an id, a name and a history of
  versions.

Version
: One published state of a tessera. Each version names the version it follows
  (`previousVersionId`), so a tessera's history is a chain.

Blob
: Uploaded or downloadable bytes, addressed by id. Archives travel as blobs: they are uploaded to a
  blob first and then turned into a version, and downloads come back as a blob URL.

## Operations

Every route is under `/mosaic-api`.

| Method | Path | Operation | |
| --- | --- | --- | --- |
| `GET` | `/tesserae` | `tesserae` | List every tessera, with its latest version |
| `POST` | `/tesserae` | `createTessera` | Create a tessera (`CreateTesseraCommand`) |
| `GET` | `/tesserae/{tesseraId}` | `get_tessera` | A tessera with its full history |
| `DELETE` | `/tesserae/{tesseraId}` | `delete_tessera` | Remove a tessera |
| `POST` | `/tesserae/{tesseraId}/upload-mosaic-blob-url` | `uploadMosaicBlobUrl` | Reserve a blob to upload an archive into |
| `PUT` | `/upload/{blobId}` | `upload` | Upload the archive's bytes |
| `POST` | `/tesserae/{tesseraId}/versions` | `createTesseraVersion` | Turn an uploaded blob into a new version |
| `GET` | `/tesserae/{tesseraId}/versions/{versionId}` | `get_tessera_version` | One version and its provenance |
| `PUT` | `/tesserae/{tesseraId}/versions/{versionId}/download-mosaic` | `tessera_Mosaic` | Build a download, answered with a blob URL |
| `PUT` | `/download/{blobId}` | `download` | Fetch a blob's bytes |
| `POST` | `/tesserae/{tesseraId}/versions/{versionId}/nodes` | `fetchNodes` | A subset of nodes, as `.glb` or `.tsr` |
| `GET` | `/tesserae/{tesseraId}/versions/{versionId}/query` | `query` | Query nodes by path |
| `GET` | `/tesserae/{tesseraId}/versions/{versionId}/types` | `get_types` | The component types in a version |

## Publishing a version

Publishing takes three calls. The bytes go to a blob, and the version is then created *from* the
blob. That keeps the upload a plain `PUT` of a file, separate from the JSON request that describes
it.

::: code-group

```http [1. reserve a blob]
POST /mosaic-api/tesserae/{tesseraId}/upload-mosaic-blob-url

→ 200  { "blobId": "…", "putURL": "…" }
```

```http [2. upload]
PUT /mosaic-api/upload/{blobId}
Content-Type: application/octet-stream

<the .tsr bytes>

→ 200
```

```http [3. create the version]
POST /mosaic-api/tesserae/{tesseraId}/versions
Content-Type: application/json

{ "id": "…", "previousTesseraVersionId": "…", "blobId": "…" }

→ 200  { "state": "OK", "validationErrors": [] }
```

:::

`createTesseraVersion` answers with a **state**, not an HTTP error:

| `state` | Meaning |
| --- | --- |
| `OK` | The version was created |
| `OUT_OF_DATE` | `previousTesseraVersionId` is not the version the tessera is currently on. Someone else published first |
| `VALIDATION_ERROR` | The blob is not a valid Mosaic file. `validationErrors` says why |

This is optimistic concurrency. A client always says which version it built on, and a stale one is
refused rather than silently layered over someone else's work.

## Downloading

`download-mosaic` takes a `downloadType` query parameter, which says how much history to include:

| `downloadType` | Answers with |
| --- | --- |
| `just_this_version` | The archive as it was published |
| `whole_tessera_history_intact` | Every version up to this one, with every section kept |
| `whole_tessera_history_condensed` | The same history, collapsed to what is still in effect |
| `whole_tessera_and_imports_history_condensed` | As above, with the tessera's imports included |

The answer is a `TesseraVersionMosaicFile`: `{ "blobUrl": "…" }`, to be fetched with `download`.

## Fetching nodes

`fetchNodes` takes part of a version rather than the whole of it. `format` is `glb` (for a
viewer) or `tsr` (a Mosaic archive in its own right), and the body is a `NodeFetchRequest`:

```json
{
  "nodes": ["55555555-…", "66666666-…"],
  "componentTypes": ["core::transform"],
  "includeChildren": true,
  "compose": true
}
```

| Field | |
| --- | --- |
| `nodes` | The node ids to fetch |
| `componentTypes` | Only these component types. All of them when left out |
| `includeChildren` | Take everything beneath them as well, following `core::child` |
| `compose` | Resolve `core::inherit` first, as composing does |

## Querying

`query` answers with nodes as JSON, each a list of `{ name, type, value }` components, rather than
as a file. It takes:

| Parameter | |
| --- | --- |
| `path` | Which nodes to answer about |
| `provenance` | Include provenance |
| `expandChildren` | Include each node's direct children |
| `expandChildrenRecursive` | Include everything beneath them |

::: warning
The query operation is specified but not implemented by the reference server, which answers
`501 Not Implemented`.
:::

## Models

| Model | Fields |
| --- | --- |
| `TesseraStatus` | `id`, `name`, `latestVersion` |
| `TesseraDetails` | `id`, `name`, `history: TesseraVersion[]` |
| `TesseraVersion` | `tesseraId`, `versionId`, `previousVersionId`, `provenance` |
| `MosaicProvenanceData` | `author`, `timestamp`, `application`, `message` |
| `CreateTesseraCommand` | `id`, `name` |
| `UpdateTesseraCommand` | `name` |
| `CreateTesseraVersionCommand` | `id`, `previousTesseraVersionId`, `blobId` |
| `CreateTesseraVersionResponse` | `state`, `validationErrors` |
| `BlobResponse` | `blobId`, `putURL` |
| `TesseraVersionMosaicFile` | `blobUrl` |
| `NodeFetchRequest` | `nodes`, `componentTypes?`, `includeChildren?`, `compose?` |
| `MosaicQueryApiResponse` | `nodes: { components: { name, type, value }[] }[]` |

All ids are UUIDs.

## Clients

Because the API is an OpenAPI document, a client can be generated for any language with standard
OpenAPI tooling. The repository generates a TypeScript one into `sdk/ts/src/api/`:

```bash
cd src
npm run gen-api-sdk          # mosaic-api.openapi3.json -> sdk/ts/src/api/
```
