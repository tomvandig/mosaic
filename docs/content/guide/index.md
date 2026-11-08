# Introduction

Mosaic is a file format for **incremental collaboration on geometric, structured data**. Many data
sources may be combined to form a bigger composed picture, but in the composition they **retain their
identity and lineage**.

It takes lessons from, and addresses shortcomings of, modern data patterns from *USD*, *ECS*, *JSON*
and *glTF*, and combines them into a single flexible data system. Mosaic:

- is unopinionated on your data
- can serialize & validate any data type with JSON Schema component schemas
- allows people to collaborate on that data through file exchange or API
- takes an ECS approach to decoupling data from use cases
- elevates parent-child relationships to allow for geometric assembly reuse
- supports semantic typing through native inheritance

<MosaicViewer example="helmet" caption="A scene importing a model — two archives, one placing the other." />

::: warning Status
Mosaic is pre-1.0 and in active development. Expect breaking changes to both the schema and the
generated code layout.
:::

## The repository

This repository holds the format's specification and the tooling used to work with it:

- **`src`** — the format definition, written in [TypeSpec](https://typespec.io), which emits the
  canonical JSON Schema.
- **`standard`** — the emitted JSON Schema, checked in so consumers can use it without running the toolchain.
- **`src/code-gen`** — a CLI that turns Mosaic component schemas into typed TypeScript or C# classes.
- **`sdk`** — runtime libraries (in progress), the `mosaic` CLI, and `sdk/scenarios`, where what a
  user actually does is written in prose and the test beside it is generated from that.
