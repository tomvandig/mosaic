# mosaic-ifc4

Converts an IFC model into a Mosaic archive: the spatial tree becomes the node hierarchy,
the geometry becomes triangulated glTF meshes, and everything else IFC says — properties,
quantities, units, and every relationship — becomes components.

```
mosaic ifc-pack tower.ifc              # -> tower.tsr
mosaic ifc      tower.ifc              # -> tower.mosaic.json, the readable form
mosaic compose  tower.tsr tower.glb    # -> something a viewer opens
```

## What it uses

Parsing and meshing are [web-ifc](https://github.com/ThatOpen/engine_web-ifc)'s job, not
this package's. It reads the STEP file, resolves placements, subtracts openings and
tessellates, and hands back triangles. Everything here is the mapping from what it returns
onto Mosaic components.

Two things web-ifc does are worth knowing, because they are why there is no unit conversion
and no axis swap in this code: it reports geometry **in metres** whatever the file's length
unit is, and it reports it **Y-up**, which is the convention glTF uses rather than the
Z-up one IFC uses. The file's own units are still recorded, on the project node.

Despite the name it reads IFC2X3 as happily as IFC4 — web-ifc handles both, and the
mapping is the same. The name says which schema the component namespace is written against.

## The shape of the result

### The tree is the spatial tree

IFC says everything with a relationship object, the hierarchy included: a storey holds its
walls through an `IfcRelContainedInSpatialStructure`, a building holds its storeys through
an `IfcRelAggregates`. Mosaic has a parent-child link of its own, and a viewer, a selection
and a composition all read it, so three relationships become `core::child`:

| IFC | becomes |
| --- | --- |
| `IfcRelAggregates` | parent -> part |
| `IfcRelNests` | parent -> part |
| `IfcRelContainedInSpatialStructure` | storey -> element |

Nothing is lost by this: the relationship object itself is still written as a component, so
its GlobalId and its name survive. The tree is an addition, not a replacement.

### Everything else is a component

| Component | On | Holds |
| --- | --- | --- |
| `ifc4::entity` | every node from an IFC line | the class, the GlobalId, the express id, and every direct attribute that carries a value |
| `core::name` | every node | the entity's name, so a person can find it |
| `core::transform` | anything placed | the placement, as a 4x4 matrix |
| `khronos::gltf::meshPrimitive` | anything drawn | the triangles, shared with every element placed from the same solid |
| `ifc4::propertySet` | whatever it defines | one row per property set in the file, however many elements share it |
| `ifc4::quantitySet` | whatever it measures | the numbers, and what each one measures |
| `ifc4::units` | the project | what the file's numbers are in |
| `ifc4::rel::IfcRelSomething` | the related node | one component type per relationship class |

### How a relationship is written

The link is the reference, not the row. A component of type `ifc4::rel::IfcRelDefinesByType`
sits on the wall, and **the name of that reference is the id of the node at the other end**
— the wall type. The row it points at is the relationship object itself: its express id,
its GlobalId, its name, and which attribute the reference followed.

The direction comes from IFC's own naming. A relationship has a `Relating*` side and a
`Related*` side, and the component goes on each **related** node pointing at the
**relating** one. So an element points at the storey that contains it, at the type that
defines it, at the material associated with it, and at the group it is assigned to — which
is the direction questions are usually asked in.

One row serves every link a single relationship makes. An `IfcRelAggregates` with four
hundred parts is one row and four hundred references, not four hundred rows.

A relationship with only one end — a virtual space boundary bounds a space and no element —
is still kept. Its reference names the relationship rather than a node, and the row has no
`relating` field, which is how a reader tells the two apart.

### Node ids survive a re-export

A node standing for a rooted entity takes its id from `IfcRoot.GlobalId` and nothing else.
Re-export the model from the authoring tool, where every express id moves, convert it
again, and the wall keeps the id another archive was pointing at.

Entities with no GlobalId — materials, the solids geometry came from — have only their line
number, which is a fact about one file. Those are keyed within a namespace that defaults to
the file name, so two models converted separately do not claim each other's ids. Pass
`--seed=<text>` to set it yourself.

## Geometry

One buffer holds every triangle. Per distinct solid there are two bufferViews (interleaved
position and normal, then the indices) and three accessors. A solid placed by twenty
elements is stored once and referenced twenty times; so is a colour, and so is the mesh
primitive that pairs the two.

An element placed once carries its transform and its mesh on its own node. Where an element
genuinely has several placements at different transforms, each becomes a child node called
`Placement N`, because a node has one transform.

Openings are cut out by web-ifc before the triangles arrive, and `IfcOpeningElement` itself
is not drawn — but it is still a node, with its properties and its `IfcRelVoidsElement`
link to the wall it voids.

## Not in the spatial tree

Types, materials and groups are not in the spatial tree and never were, and neither are the
buffers and accessors the geometry needs. Loose, each would be a root of its own, so they
are gathered under two nodes hanging off the project — `Outside the spatial tree` and
`Geometry and materials` — leaving the project as the single root. The occasional element
the file never placed anywhere ends up in the first of those too.

## Options

| Flag | Does |
| --- | --- |
| `--center` | shifts the model to the origin as it is read. A georeferenced model can sit tens of kilometres from zero, where single-precision vertices visibly wobble. Off by default: the coordinates are what the file said |
| `--no-geometry` | converts the structure and the properties and skips the meshing, which is most of the time |
| `--seed=<text>` | namespaces the ids of entities that have no GlobalId |

## Using it as a library

```ts
import { convertIfcToArchiveFile, convertIfcFile, openIfcModel, ifc4ToMosaic } from "mosaic-ifc4";

// The whole thing, to a .tsr on disk.
const result = await convertIfcToArchiveFile("tower.ifc");
console.log(result.stats.triangles, result.warnings);

// Or the document, without writing anything.
const { document } = await convertIfcFile("tower.ifc");

// Or drive it over a model you opened yourself.
const model = await openIfcModel(bytes);
try {
    const converted = ifc4ToMosaic(model.api, model.modelID, { seed: "tower.ifc" });
} finally {
    model.close();
}
```

`ifc4ToMosaic` takes the parser as an argument and asks only for the dozen methods it uses,
so it can be driven over a model opened with whatever settings you like.

## What it costs

Measured on six models from the S1 open dataset, a published Dutch residential tower, on
one machine. Every one of them converted with no warnings, and every composed `.glb` passed
the Khronos glTF validator with no errors and no warnings.

| Model | IFC | Convert | Nodes | References | Triangles | Archive | Compose |
| --- | --: | --: | --: | --: | --: | --: | --: |
| Dycore hollow-core floors | 0.8 MB | 1.9 s | 2,358 | 11,162 | 54,338 | 8.8 MB | 0.6 s |
| Prefab facade | 5.8 MB | 1.4 s | 1,452 | 15,237 | 9,036 | 6.2 MB | 0.6 s |
| Structural engineering | 7.1 MB | 3.7 s | 11,519 | 43,782 | 125,186 | 24.8 MB | 2.1 s |
| Occupied space | 7.5 MB | 8.0 s | 46,261 | 187,490 | 41,940 | 53.0 MB | 6.1 s |
| Electrical services | 92.6 MB | 48.6 s | 170,182 | 807,970 | 470,259 | 270.9 MB | 45.3 s |
| Architectural | 326.8 MB | 61.9 s | 153,549 | 590,184 | 609,244 | 356.5 MB | 1,061 s |

Converting is roughly linear in the size of the file. Composing is not: the architectural
model takes seventeen minutes to compose, which is `mosaic compose` rather than anything
here, and worth knowing before you wait for it.

The archives are larger than the IFC they came from, for three reasons that are all the
archive format rather than this converter: a `.tsr` is a zip with **no compression**, its
index is written with four-space indentation, and geometry is base64 in a data URI, which
is a third larger than the bytes it encodes. Zipping a `.tsr` gets most of it back.

Everything is held in memory, so a large model wants a large heap
(`node --max-old-space-size=...`). The `--no-geometry` flag avoids most of it when the
question is about properties rather than pictures.

## Known gaps

- **Presentation beyond a single colour.** web-ifc reports one colour per placed geometry,
  and that is what becomes the material. Textures, layer assignments and full surface
  styles are not read.
- **`IfcRelDefinesByProperties` is not written as a relationship**, because the property
  set it points at is already a component on the element. Writing it too would say the same
  thing twice, through a node that exists only to hold the set.
- **Property kinds this does not read** are warned about rather than guessed at:
  `IfcPropertyTableValue` and `IfcPropertyReferenceValue`. Single, enumerated, list,
  bounded and complex properties are all read, as are property sets whose properties are
  fixed attributes, such as `IfcDoorLiningProperties`.
- **Reference-valued attributes are not values.** An attribute pointing at another line
  becomes a link between nodes where a relationship makes one, and is otherwise left out:
  a pointer to line 4711 means nothing once the file is gone.

## Tests

`npm test` runs against `test/fixtures/cottage.ifc`, a hand-written IFC4 file small enough
to read: a site, a building, a storey, three walls of known size, a doorway cut out of one
of them, a wall type, a property set shared by all three walls, quantities on one, a
material, a group and a room. Two of the walls share a solid, so anything that ought to be
stored once can be checked. The tests assert the tree, the ids, the properties, the
relationships, the sharing, the dimensions of the mesh in metres, and that the result
composes into a glTF with no warnings.
