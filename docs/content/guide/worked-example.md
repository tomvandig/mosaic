# A worked example

[`examples/`](https://github.com/tomvandig/mosaic/tree/main/examples/) holds the **Meadowbank campus**: three buildings and a site as fourteen
archives, **9,138 nodes and 56,298 components drawn with 4,109 vertices**. It is shaped like a real
BIM project — a structural, an architectural and a services model per building, each owned and
published separately, federated by a coordination model that names their roots across the imports.

```bash
cd examples
npm run build                              # regenerates every archive, deterministically
mosaic compose campus/campus.tsr           # 9,205 glTF nodes sharing 31 meshes
```

It is the format's own argument, at size. Parts hold a name, a placement, an is-a link, what they are
on the project and how much of them there is; geometry, material, classification, fire rating and
unit rate all arrive through `core::inherit`, three links deep — family, type, variant. So the whole
campus runs on **59 type property sets and 163 quantity rows**, and a change to a type is a change to
every part that is one. See [examples/README.md](https://github.com/tomvandig/mosaic/blob/main/examples/README.md) for the queries that fall out
of that.
