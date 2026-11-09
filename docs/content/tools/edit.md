# Editing

`mosaic edit` opens a model in your browser so you can change it, then saves it as a `.tsr` or
composes it into a `.glb`, wherever you choose:

```bash
mosaic edit <model.glb | model.gltf | model.tsr> [--port <n>] [--no-open]
```

A glTF model is converted to Mosaic first, with [stable ids](/tools/gltf), so editing the same model
twice names its nodes the same way. A `.tsr` opens as it is.

## The editor

The page is the [viewer](/examples/), holding just your model: the node tree, the 3D view and the
components of whatever node you select.

### Moving parts in 3D

Click a part of the model to select it. It's tinted, outlined with a box (visible through whatever is
in front of it), highlighted in the tree, and a handle appears at its centre. Drag the handle to move
the part, and everything under it moves along.

| Key | Does |
| --- | --- |
| **W** | move |
| **E** | rotate |
| **R** | scale |
| **↑** | select the part's parent: a click picks the smallest part under the mouse, like one bolt rather than the wheel |
| **Esc** | deselect |

Selecting a node in the tree puts the handle on it too. When you let go, the node's new position,
relative to its parent, is written to its `core::transform`. All moves go in one section of the
archive, written by "mosaic edit", so they stay one clear layer on top of the original.

### Editing the files

The **Files** drawer underneath shows the archive as it really is: an `index.json` naming the nodes
and their components, and one `.ndjson` table per component type, one value per line.

1. Pick a file in the drawer, for example `khronos::gltf::material.ndjson`, and change it.
2. Press **Save** in the drawer. The model is rebuilt from your edit and drawn again.

Moves you make in 3D show up in the drawer straight away. If the drawer has unsaved typing when you
move something, it isn't refreshed; press **Revert** there before saving, or it would put the old
transform back.

### Writing it to disk

When you're happy, press one of the two buttons in the header. Each asks where to save:

| Button | Saves | Suggested name |
| --- | --- | --- |
| **Save .tsr** | the edited archive | `<model>.tsr` |
| **Export .glb** | the edited archive, composed | `<model>.edited.glb` |

In Chrome and Edge this is the browser's save dialog, so you pick the folder and name. Firefox and
Safari don't offer that dialog, so the file is downloaded instead; it asks where only if your browser
is set to ask for downloads.

The buttons save your moves and what you last saved in the drawer. If the drawer still holds unsaved
typing, they say so instead of saving. Reloading the page brings back what was last saved.

::: code-group

```bash [glb]
mosaic edit car.glb
# Save .tsr    -> asks, suggesting car.tsr
# Export .glb  -> asks, suggesting car.edited.glb
```

```bash [tsr]
mosaic edit scene.tsr
# Save .tsr    -> asks, suggesting scene.tsr
# Export .glb  -> asks, suggesting scene.edited.glb
```

```bash [what changed]
mosaic pack car.glb original.tsr --stable-ids
mosaic diff original.tsr car.tsr       # only your edits
```

:::

## Notes

- **The page needs internet** for three.js and the code editor, which load from a CDN. Your model
  never leaves your machine: the server listens on `127.0.0.1` only, and it writes nothing to disk
  itself. Files go only where you save them.
- **A part placed more than once** (the same node under several parents) moves in every place when
  the archive is saved, but only the copy you dragged moves on screen until the model is redrawn.
- **There's no undo yet.** Move it back, or reload the page to return to what was last written.
- **Imports aren't followed.** A `.tsr` that imports others opens on its own, showing only what it
  holds itself.
- **Large models are fine to view, slow to edit as text.** A converted model keeps its geometry and
  textures in `khronos::gltf::buffer.ndjson` as long base64 lines. Open the smaller tables (materials,
  transforms, names in `index.json`) to make changes.
- `--port` picks the port, otherwise a free one is used. `--no-open` prints the address instead of
  opening a browser.
