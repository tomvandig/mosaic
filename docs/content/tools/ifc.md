# Importing IFC

`mosaic` converts an IFC model the same way, reading `.ifc` files of either IFC4 or IFC2X3:

```bash
mosaic ifc  <input.ifc> [output.mosaic.json] [--center] [--no-geometry] [--seed=<text>]   # to a source document
mosaic pack <input.ifc> [output.tsr]         [--center] [--no-geometry] [--seed=<text>]   # straight to an archive
```

Parsing and meshing are [web-ifc](https://github.com/ThatOpen/engine_web-ifc)'s job: it resolves
placements, subtracts openings and tessellates, and reports the result in metres and Y-up, which is
already glTF's convention. What the converter does is decide what all of it becomes in Mosaic.

The spatial tree becomes the node tree. IFC says the hierarchy with relationship objects like every
other fact — a storey holds its walls through an `IfcRelContainedInSpatialStructure` — but Mosaic has
a parent-child link that a viewer, a selection and a composition all read, so `IfcRelAggregates`,
`IfcRelNests` and `IfcRelContainedInSpatialStructure` become `core::child`.

Everything else becomes a component. `ifc4::entity` carries the class, the `GlobalId` and every
direct attribute; `ifc4::propertySet` and `ifc4::quantitySet` carry the properties and the measured
numbers; `ifc4::units` says what the file's numbers are in. Every remaining relationship gets a
component type of its own — `ifc4::rel::IfcRelDefinesByType`, `ifc4::rel::IfcRelVoidsElement`, one
table per class — and the link is the *reference*: the component sits on the related node and its
reference name is the id of the node at the other end. One row serves every link a relationship
makes, so an aggregate with four hundred parts is one row and four hundred references.

A node's id comes from `IfcRoot.GlobalId`, so re-exporting the model from the authoring tool and
converting it again leaves every id another archive was pointing at exactly where it was.

The conversion lives in its own package, [`sdk/ifc4/`](https://github.com/tomvandig/mosaic/tree/main/sdk/ifc4/), which
[documents the mapping in full](https://github.com/tomvandig/mosaic/blob/main/sdk/ifc4/README.md).
