# Who Mosaic is for

Mosaic is for anyone whose data is **made by several parties and composed into one picture**, and
who needs to keep track of which part came from whom.

## Building and infrastructure teams

A building is designed as separate models: structural, architectural and services, often per
building and per discipline, each owned and published by a different team. Mosaic keeps each one as
its own file and federates them through a coordination model that imports them all, with no merged
copy to fall out of date.

- IFC models convert in, keeping their `GlobalId`s as node ids, so a re-export from the authoring
  tool doesn't break references into it. See [Importing IFC](/tools/ifc).
- Types are first-class. Geometry, materials, classification and cost can live on a type and reach
  every instance through `core::inherit`.
- Every change carries its author, time and reason.

See [A minimal example](/welcome/minimal-example) and the [S1 example](/examples/#s1).

## 3D and geometry pipelines

For teams moving assets between tools, Mosaic is a layer *above* glTF. A model converts in (the
Damaged Helmet round-trips with identical geometry, materials and textures), scenes place it by
reference instead of copying it, and composing writes a standard `.glb` that any viewer opens. See [Importing glTF](/tools/gltf) and [Composing a GLB](/tools/compose).

## Developers of tools and platforms

If you are building something that reads, writes or serves this kind of data:

- The [standard](/standard/) is two machine-readable documents, a JSON Schema and an OpenAPI
  description, so you can implement it in any language.
- Component types are JSON Schemas, so your own data fits in without changing the format, and
  [code generation](/tools/codegen) gives you typed classes for it.
- The [reference implementation](/sdk/) in TypeScript, the `mosaic`
  CLI and the viewer are there to build on, or to test your implementation against.

## Not a good fit (yet)

- **Production use.** Mosaic is pre-1.0, and both the schema and the tooling will change.
- **A single author working in a single tool.** If one tool owns the whole picture, its own format
  is likely simpler.
- **Real-time collaboration.** Mosaic layers published edits. It does not merge keystrokes live.
