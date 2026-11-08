# Definitions

The words these docs use, and what each one means in Mosaic.

Archive
: A `.tsr` file. A zip holding `index.json` and one `<type>.ndjson` table per component type. It is
  what gets exchanged, published and imported.

Source document
: A `.mosaic.json` file. One readable, diffable JSON document holding the index plus the component
  rows. `mosaic pack` turns it into an archive. See [Packing a dataset](/tools/pack).

Index file
: `index.json` inside an archive (`MosaicIndexFile`). It holds a `header`, the `imports`, the
  `componentTables` and the `sections`. See [The format](/guide/format).

Section
: One layer of edits. It has a provenance header (author, timestamp, application and a message) and
  the nodes it contributes. The sections of a file are a list, so a dataset is a history of edits
  rather than a single snapshot. A later section wins over an earlier one.

Node
: Something with an id (a `uuid`) and a list of component references. A node has no value of its
  own: everything it is comes from its components.

Component
: A typed piece of data, such as a transform, a mesh or a property set. Its type is named by an
  `x-mosaic-id` like `core::transform` or `khronos::gltf::accessor`, and it is described by a JSON
  Schema.

Component reference
: How a node carries a component: `{ "type", "id", "index"?, "operation"? }`. `type` names the
  component type. `id` names this reference within the node. `index` is the row in that type's
  table, and `operation` is `VALUE`, `DELETE` or `PASS_THROUGH`.

Component table
: All the values of one component type in an archive, one row per line of NDJSON (or a Parquet
  file), with the schema of its rows beside it. A reference's `index` points into it.

Value-less component
: A component whose reference carries no row (`index` is `-1`, the default). Everything it says is
  in the reference `id`. `core::child`, `core::name` and `core::inherit` work this way. See
  [Core components](/guide/core-components).

Operation
: What a reference does to the value a node already has: `VALUE` sets it (the default), `DELETE`
  unsets it, and `PASS_THROUGH` leaves the inherited value alone.

Import
: A reference from one archive to another, by URI, optionally pinned with an `integrity` hash. An
  imported archive layers *underneath* the one that imports it, as an older section would.

Federation
: Merging archives into one. Their component tables are laid end to end, references are shifted to
  match, and nodes that share an id merge rather than duplicate.

Composition
: Reading a dataset the way a consumer sees it: imports merged, sections collapsed, inheritance
  expanded and child links followed. `mosaic compose` writes the result as a GLB. See
  [Composing a GLB](/tools/compose).

Inheritance (is-a)
: A `core::inherit` link. Composing gives the node every component of the node it names, except
  the ones it carries itself under the same reference `id`.

Hierarchy (child)
: A `core::child` link. It hangs another node beneath this one. Naming a node from several parents
  places it several times, and the copies share their geometry.

Tessera
: One model kept by the [HTTP API](/sdk/http-api), a tile of the mosaic, with a history of
  versions. An archive published to the API becomes a version of a tessera.

Version
: One published state of a tessera. A new version must follow the one the tessera is on, or it is
  answered with `OUT_OF_DATE`.

Namespace
: The prefix of a component type: `core::` for the format's own components, `khronos::gltf::` for
  geometry derived from glTF, `w3c::` for SVG and `ifc4::` for IFC. Anyone can define their own,
  such as `acme::geometry::wall`.
