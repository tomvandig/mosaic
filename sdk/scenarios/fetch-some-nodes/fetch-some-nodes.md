# Fetching some nodes out of a published tessera

A published tessera can hold far more than a client needs. Rather than downloading all of it and
throwing most away, a client names the nodes it cares about and gets back only those — as a `.glb` to
put in front of a viewer, or as a `.tsr` to keep working with. The server builds the answer when it is
asked, and stores nothing.

## Background

- **Given** a temporary folder that exists only for this scenario
- **And** a Mosaic server running on a free port, keeping its database in that folder
- **And** a tessera whose first version was published from an archive holding two walls, each with a
  mesh, a transform and a name, and a third node that is the parent of both

## Scenario: one node comes back as a viewable file

- **When** I fetch the front wall, asking for `glb`
- **Then** the answer is a stream of bytes beginning with the glTF magic
- **And** it holds one node with a mesh
- **And** it carries the geometry that mesh needs, even though I did not ask for it by name
- **And** the file I asked for was never written to disk on the server

## Scenario: the same node comes back as an archive I can keep

- **When** I fetch the front wall, asking for `tsr`
- **Then** the answer loads as a Mosaic archive
- **And** every reference in it resolves inside it
- **And** I can publish it again as the first version of another tessera

## Scenario: I ask for only the components I care about

- **When** I fetch the front wall, asking for `tsr` and for `core::transform` only
- **Then** the wall in the answer carries its transform and nothing else
- **And** no mesh comes with it

## Scenario: I ask for everything beneath a node

- **When** I fetch the parent node, asking for `glb`, without asking for children
- **Then** nothing in the answer has a mesh

- **When** I fetch the parent node again, asking for `glb` and for its children
- **Then** both walls are in the answer, each with a mesh
- **And** they hang beneath the parent, as they did in the tessera

## Scenario: asking for a node that is not there says so

- **When** I fetch one wall and one id that the version does not have
- **Then** the wall still comes back
- **And** the answer says which id was not found

## Afterwards

- The server stops and gives up its port
- The temporary folder and everything in it is removed
