# Diffing

`mosaic diff` compares two archives and writes only what changed, as an archive of its own:

```bash
mosaic diff <old.tsr> <new.tsr> [output.tsr] [--no-deletes] [--message=<text>]
```

Without an output path, the diff is written next to the new archive as `<new>.diff.tsr`.

The result holds **one section** with:

- every component that is new in the new archive, or holds a different value there;
- a `DELETE` for every component, and every node, the new archive no longer has. Leave these out
  with `--no-deletes`. The diff can then add and change, but never remove.

It carries only the rows those changes need, plus the schemas of their types, so it stands alone like
any other archive. `--message` sets the section's message. By default it says which two files were
compared.

## Applying a diff

A diff is an ordinary layer. Federated over the old archive, it reads the same as the new one: node
for node, component for component.

::: code-group

```bash [diff]
mosaic diff house-v1.tsr house-v2.tsr          # -> house-v2.diff.tsr
```

```txt [output]
Nodes changed: 2
Components set: 2
Components deleted: 1
```

```ts [apply, in code]
import { federate, diffArchives } from "mosaic-ts";

const diff = diffArchives(v1, v2);             // what mosaic diff writes
const again = federate(v1, diff, true);        // reads the same as v2
```

:::

## Compared by value

Two archives packed separately each number their own component rows, so the same value can sit in
different rows, and different values in the same row. `mosaic diff` compares what the rows *hold*,
ignoring key order and spacing, not where they sit. Converting the same model twice with
`--stable-ids` gives two archives with **no changes** between them, even though they were written
separately.

Nodes are matched by id. For a diff to be small, the two archives must use the same ids for the same
things: [`--stable-ids`](/tools/gltf) for glTF, and `GlobalId` for IFC, which converts that way
already. Two conversions with random ids share no nodes, so the diff would replace everything.

## What isn't diffed

- **Imports.** The diff takes the new archive's import list as it is.
- **History.** Both archives are compared as they read now, with their sections collapsed. Edits that
  were made and undone within one archive don't show up.

The comparison is `diffArchives` in the SDK
([source](https://github.com/tomvandig/mosaic/blob/main/sdk/ts/src/MosaicFileOperations.ts)).
