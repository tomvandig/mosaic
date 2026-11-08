# Core components

The `core::` namespace holds the components the format itself relies on: naming, placement,
hierarchy and types. Every other component is ordinary data that Mosaic carries without
interpreting.

Their schemas live in [`sdk/ts/src/core/schemas/`](https://github.com/tomvandig/mosaic/tree/main/sdk/ts/src/core/schemas/).

| Type | Has a value | What it does |
| --- | --- | --- |
| `core::name` | no, the name is the reference `id` | A human-readable name for the node |
| `core::child` | no, the child's node id is the reference `id` | Hangs a node beneath this one |
| `core::inherit` | no, the parent type's node id is the reference `id` | Makes this node *be* another |
| `core::transform` | yes, one row in `core::transform.ndjson` | The node's local placement |

## Value-less components

Three of the four carry no row at all. Their reference leaves out `index` (it defaults to `-1`), and
the reference `id`, which every reference has anyway, *is* the data:

```json
{ "type": "core::name",    "id": "Left plinth" }
{ "type": "core::child",   "id": "d6c1d2ba-9376-4461-8c56-27c496c1d2ba" }
{ "type": "core::inherit", "id": "70000000-7000-4000-8000-700000000001" }
```

So a node can carry many of each, one per name, child or type, and a later section can drop exactly
one of them with a `DELETE` on that `id`:

```json
{ "type": "core::child", "id": "d6c1d2ba-9376-4461-8c56-27c496c1d2ba", "operation": "DELETE" }
```

It also means names, hierarchy and types can be read straight off the references, without
touching a single component table. That is what lets the viewer draw a tree of a whole building
without loading its geometry.

## `core::name`

A human-readable name for the node. A converted glTF or IFC node keeps the name a person would
recognise this way, next to the uuid the node is identified by. A node may carry several names.

## `core::child`

A parent-child link. The reference `id` is the id of the child node.

- One node can hold many children.
- A node that is someone's child is not a root of the scene.
- Naming the same node from several parents places it several times. The copies share their mesh,
  so the geometry is stored once however often it appears, and a placed node brings its whole
  subtree along.
- A link may cross an [import](/guide/definitions#import): a scene can place a node that lives in
  another archive.
- Links that would expand forever are refused. A cycle is reported with the path that closes it.

## `core::inherit`

An is-a link. The reference `id` is the id of the node to inherit from.

When composing, the node receives every component of the node it inherits from, except where it
carries one under the same reference `id`. Its own always wins. So a type node can hold the mesh
once, and every node that is-a that type picks it up while overriding only its transform.

- A node may inherit from several nodes. Where two offer the same `id`, the one named first wins.
- Chains are allowed: a node that inherits from a node that inherits from a third gets all three,
  with the nearest winning.
- The is-a links themselves come along, so a node two steps down a chain still answers to the type
  at the top. "Everything that is a Chair" is a question about nodes, not a graph walk.
- Unlike `core::child`, this changes the node itself, not what hangs beneath it.
- Inheritance is expanded only when composing. The file always records what was written.

See [The format](/guide/format#example-boxes-by-type) for a worked example.

## `core::transform`

The local transform of a node, either as `translation` / `rotation` / `scale` or as a 4×4
column-major `matrix`. The field names and defaults follow the glTF 2.0 node, but a transform is not
specific to glTF, which is why it lives in `core`.

| Field | Type | Default |
| --- | --- | --- |
| `translation` | `[x, y, z]` | `[0, 0, 0]` |
| `rotation` | unit quaternion `[x, y, z, w]` | `[0, 0, 0, 1]` |
| `scale` | `[x, y, z]` | `[1, 1, 1]` |
| `matrix` | 16 numbers, column-major | identity |

```json [core::transform.ndjson]
{"translation":[0,2,0],"scale":[0.5,0.5,0.5]}
{"translation":[-1,0,0]}
```

Composing writes it straight onto the glTF node, as a `matrix` or as TRS.
