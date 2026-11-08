# Why Mosaic exists

Most geometric and structured data is exchanged as **whole files**. One party exports a model and
another imports it. When something changes, the whole model is exported again. Every exchange is a
snapshot, and a snapshot forgets things:

- **Who changed what.** The new export holds the result, not the edit, so the history of a model
  lives in people's heads and in email.
- **Where a piece came from.** Once two sources are merged into one file, the seams are gone. A
  wall from the architect and a duct from the engineer are just two objects.
- **What another file was pointing at.** Ids are often regenerated on export, so a reference from
  one model into another breaks every time the other is re-exported.

That works while one tool owns the whole picture. It stops working when many people, in many tools,
each own a part of it, which is the normal case on a building, a site or a product.

## Lessons from existing formats

Mosaic borrows from formats that each solve part of this:

| From | Mosaic takes | What it addresses |
| --- | --- | --- |
| **USD** | Layering: later opinions over earlier ones, composed when read | USD's composition is powerful but complex, and its tooling is heavy |
| **ECS** | Entities are ids, and data lives in components | Data stays decoupled from the use cases that read it, so a new use case doesn't need a new format |
| **JSON / JSON Schema** | Every component type is a schema, carried in the file | Any data can be validated, and generated into typed code, without a central registry |
| **glTF** | Geometry, materials and textures as compact, renderable components | Geometry composes straight into a file every viewer already reads |

## What it does instead

- **Edits are layers, not overwrites.** A file is a list of sections, each with an author, a time,
  an application and a message. A later section sets, deletes or passes through what came before,
  without restating the rest.
- **Sources keep their identity.** A file imports others rather than copying them in. Composing
  merges everything into one picture, but each node is still written in the file that owns it,
  and a viewer can show which one that is.
- **Ids are stable.** Nodes are uuids, and converters can derive them from the source (an IFC
  `GlobalId`, or a seed from the file name), so re-converting a model leaves every reference into
  it intact.
- **It's unopinionated about data.** Mosaic has a handful of [core components](/standard/core-components)
  for naming, placement, hierarchy and types. Everything else is whatever schema you bring.
- **Assemblies and types are built in.** `core::child` places one node under many parents, sharing
  its geometry. `core::inherit` makes a node *be* a type and take that type's components, so a
  change to the type is a change to every instance.
- **Files and APIs say the same thing.** The same data can move as a `.tsr` archive or through the
  [API](/standard/api), which adds versioning and fetching just the nodes you need.
