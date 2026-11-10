---
layout: home

hero:
  # One tile per letter: each is a solid colour from the gradient, not a blend.
  name: '<span class="tiles"><span>M</span><span>o</span><span>s</span><span>a</span><span>i</span><span>c</span></span>'
  text: Incremental collaboration on geometric, structured data
  actions:
    - theme: brand
      text: Get started
      link: /welcome/
    - theme: alt
      text: Examples
      link: /examples/
    - theme: alt
      text: GitHub
      link: https://github.com/tomvandig/mosaic

features:
  - title: Unopinionated on your data
    details: Any data type, serialized and validated through JSON Schema component schemas.
  - title: Layered, not flattened
    details: A dataset is a history of sections. Later edits set, pass through or delete what came before.
  - title: ECS at heart
    details: Nodes are ids carrying components, so data is decoupled from the use cases that read it.
  - title: Assemblies and types
    details: Parent-child links reuse geometry; native inheritance gives semantic typing.
---

<div class="vp-doc" style="max-width: 960px; margin: 48px auto 0; padding: 0 24px;">

## Edit together

Two editors collaborate on the same glTF file, each its own application with its own copy of the model. Move a part in one
and only that change travels to the other, as a small layer on top of what both started from.
[How it works](/tools/edit#editing-together).

<MosaicEditTogether example="ferrari" height="400" credit="Model: www.vecarz.com" />

## Combine data sources

S1 brings very different sources into one view. It contains an IFC model of a building's eleventh
floor, with more than 9,000 nodes carrying their IFC entities, property sets and quantities. It adds
an SVG underfloor heating plan, and two glTF models: a tree and a helmet. A small archive of ten
nodes imports all four and arranges them into **one scene hierarchy**. The heating plan hangs under
"Eleventh floor", right beside the IFC storey it was drawn for, and the tree is placed three times.

Nothing is flattened into a common format on the way. The IFC elements keep their property sets, and
the plan stays an SVG. Because they all share one tree of nodes, data from one source can point at,
hold or sit beside data from another.

<MosaicViewer example="s1" height="480" caption="S1: an IFC floor, an SVG heating plan and two glTF models, in one scene." />

</div>
