# Publishing a tessera and getting it back

A dataset is authored as a file, packed into an archive, published through the API as the first
version of a tessera, and then fetched back and turned into something a viewer can open. This is the
path a client takes end to end, so it touches real files on disk and a server really listening.

## Background

- **Given** a temporary folder that exists only for this scenario
- **And** a Mosaic server running on a free port, keeping its database in that folder

## Scenario: a first version is published and read back unchanged

- **Given** a source document `terrace.mosaic.json` in the folder, describing two walls in one section
  authored by `ada@example.com` with the message `Initial two walls`
- **And** that document packed into an archive `terrace.tsr` in the same folder

- **When** I create a tessera named `Terrace`
- **Then** it is listed with no version yet

- **When** I ask the tessera for an upload url
- **Then** the url points at this server and names a blob id

- **When** I upload the bytes of `terrace.tsr` to that url
- **And** I create the first version from that blob, following no previous version
- **Then** the version is accepted
- **And** the tessera lists it as the latest version
- **And** the version carries the provenance the archive was authored with

## Scenario: the published version comes back byte for byte

- **Given** a tessera whose first version was published from `terrace.tsr`

- **When** I ask to download just that version
- **Then** the server answers with a blob url
- **And** the bytes behind it are identical to the bytes I uploaded
- **And** those bytes load as an archive with one section holding two walls

## Scenario: what was published can be composed into a viewable file

- **Given** a tessera whose first version was published from `terrace.tsr`

- **When** I download that version to `downloaded.tsr` in the folder
- **And** I compose that archive into `terrace.glb`
- **Then** `terrace.glb` exists on disk and begins with the glTF magic bytes
- **And** it holds one node for each wall

## Scenario: a version that does not follow the latest one is refused

- **Given** a tessera whose first version was published from `terrace.tsr`

- **When** I try to create another version that also claims to follow no previous version
- **Then** the answer is `OUT_OF_DATE` rather than an error
- **And** it says which version the tessera is actually on
- **And** the tessera still lists only the first version

## Afterwards

- The server stops and gives up its port
- The temporary folder and everything in it is removed
