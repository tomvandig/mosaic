# Importing one tessera into another

A dataset that is worth publishing is worth reusing. Rather than restating a bench in every courtyard
that has one, a tessera **imports** another by name and points into it: the courtyard holds a child
reference that leaves it and lands on a node published in the bench's own tessera.

The server follows those imports when it answers. An import names an archive — `bench.tsr` — and the
server looks for a tessera published under that name, so the two datasets stay separate things that
can be versioned separately, while a question asked of one is answered from both.

## Background

- **Given** a temporary folder that exists only for this scenario
- **And** a Mosaic server running on a free port, keeping its database in that folder
- **And** a tessera named `Bench`, whose first version holds a bench with a seat beneath it
- **And** a tessera named `Courtyard`, whose first version imports `bench.tsr` and holds a plaza with
  two spots, each naming the bench as its child

## Scenario: a reference that leaves one tessera lands in the other

- **When** I fetch the plaza from the courtyard, with its children, asking for `tsr`
- **Then** the plaza and both spots come back
- **And** the bench comes back too, with its seat, though it was published in another tessera
- **And** the bench keeps the id it has there, so both spots point at the same node
- **And** the seat brings its own component row with it, so the archive stands on its own

## Scenario: the same, as something a viewer can open

- **When** I fetch the plaza from the courtyard, with its children, asking for `glb`
- **Then** the answer begins with the glTF magic
- **And** the bench appears once per spot, written from the one bench that was published

## Scenario: publishing a new version of the bench changes what the courtyard shows

- **Given** a second version of `Bench`, which adds an armrest beneath the bench
- **When** I fetch the plaza from the courtyard again, without republishing it
- **Then** the armrest is in the answer
- **And** the courtyard is still on its first version

## Scenario: an import nothing has published is left out rather than failing

- **Given** a server with only the courtyard published to it
- **When** I fetch the plaza from the courtyard, with its children
- **Then** the plaza and both spots still come back
- **And** the seat is nowhere in the answer, because the tessera holding it is not here

## Afterwards

- The server stops and gives up its port
- The temporary folder and everything in it is removed
