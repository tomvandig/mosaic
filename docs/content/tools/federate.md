# Federating

`mosaic federate` layers one archive over another and writes the result as one archive:

```bash
mosaic federate <old.tsr> <new.tsr> [output.tsr] [--collapse]
```

Without an output path, the result is written next to the new archive as `<new>.federated.tsr`.

The new archive's sections go **over** the old one's. Where both say something about the same
component of the same node, the new archive wins: its values replace the old ones, and its
`DELETE`s remove them. Everything only one of them mentions comes through as it is.

| | Keeps |
| --- | --- |
| default | **Every section of both**, in order: the full history, with every row either of them had |
| `--collapse` | Only what is **still leading**: each component's current value, under the section that wrote it. Superseded rows, and tables left empty, are dropped |

Both archives' imports are kept, the old archive's first and each one once. A component type both
carry gets one table, described by the newer archive's schema.

## Applying a diff

Federating is how a diff from [`mosaic diff`](/tools/diff) is applied. The result reads the same as
the archive the diff was made from:

::: code-group

```bash [round trip]
mosaic diff     house-v1.tsr house-v2.tsr                 # -> house-v2.diff.tsr
mosaic federate house-v1.tsr house-v2.diff.tsr house.tsr  # house.tsr reads as house-v2.tsr
mosaic diff     house-v2.tsr house.tsr                    # No changes.
```

```txt [output]
Sections: 2
Nodes: 3
Component rows: 5
```

:::

With `--collapse`, the same round trip gives a smaller archive with the same contents: here 3
component rows instead of 5.

## Federating versus importing

An [import](/welcome/definitions#import) keeps two archives separate: each is still published,
versioned and owned on its own, and they're layered only when they're read. Federating merges them
into one file for good. Use it to apply changes, or to hand someone a single file, not to build a
scene from parts other people own.

The merge is `federate` in the SDK
([source](https://github.com/tomvandig/mosaic/blob/main/sdk/ts/src/MosaicFileOperations.ts)). `mosaic
compose` uses it too, to layer an archive over its imports before drawing them.
