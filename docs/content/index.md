---
layout: home

hero:
  # One tile per letter: each is a solid colour from the gradient, not a blend.
  name: '<span class="tiles"><span>M</span><span>o</span><span>s</span><span>a</span><span>i</span><span>c</span></span>'
  text: Incremental collaboration on geometric, structured data
  tagline: Many sources composed into one picture — each keeping its identity and lineage.
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

<MosaicViewer example="s1" height="480" caption="S1: two buildings, a tree and a helmet, federated by imports." />

</div>
