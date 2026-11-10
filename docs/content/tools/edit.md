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
| **Esc** | deselect; so does clicking empty space |

Selecting a node in the tree puts the handle on it too. When you let go, the node's new position,
relative to its parent, is written to its `core::transform`. All moves go in one section of the
archive, written by "mosaic edit", so they stay one clear layer on top of the original.

### Editing together

Open the editor's address in a second tab, and the two tabs edit the same model together. A part
moved in one tab moves in the other when you let go. There's no server in between: tabs of one
browser on the same page talk to each other directly.

Try it here: these are two editors on a car. Click a part in one, such as a wheel or a door, drag
the handle, and let go. The same part moves in the other editor, and only that part: the other
editor moves what it already drew instead of drawing the car again.

<MosaicEditTogether example="ferrari" height="400" credit="Model: www.vecarz.com" />

Any viewer link can edit like this: add `&edit` to it, as in
`viewer/?example=ferrari&edit`. Viewers with the same `&channel=<name>` share their moves; without
one, every viewer editing that example in your browser does. Nothing is saved there: reloading starts
from the example again.

- **Each tab has a name**, such as `tab-3f2a`, shown in the status line and the tab's title. Its
  moves go in a section of the archive written by that name, so a saved `.tsr` says who moved what.
- **A tab opened later catches up.** It asks the open tabs for everything done so far and applies it.
  If every tab is closed, the shared moves are gone; save first.
- **If two tabs move the same part, the later move wins**, in every tab. "Later" means made after
  seeing the other one, not by the clock on the wall, so all tabs agree on the result.
- **The header counts what was edited**, such as `12 edits · 3 sections · 2.4 KB`: the edits made by
  every editor, the sections they were written in (a new one each time the editor changes), and how
  big that layer is on top of the original. Hover over it for the details.
- **Only moves are shared.** Typing in the Files drawer stays in the tab where you typed it.

Under the hood, a move is an *edit*: an id, an author, its place in the order of edits, and the
components it sets on which nodes. That's what a Mosaic section holds, so the same edits can later
travel through the [HTTP API](/sdk/http-api) instead, each published as a version, without changing
anything but how they're carried.

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
- **A part placed more than once** (the same node under several parents) is one node with one
  transform, so moving it moves every copy. Clicking such a part in 3D selects the nearest part above
  it that is placed only once, which is usually what you meant by pointing at one copy. To move every
  copy, select the part in the tree.
- **Editing together needs the tabs in one browser**, on the same address. Two machines, or two
  browsers, don't see each other's moves.
- **There's no undo yet.** Move it back, or reload the page to return to what was last written.
- **Imports aren't followed.** A `.tsr` that imports others opens on its own, showing only what it
  holds itself.
- **Large models are fine to view, slow to edit as text.** A converted model keeps its geometry and
  textures in `khronos::gltf::buffer.ndjson` as long base64 lines. Open the smaller tables (materials,
  transforms, names in `index.json`) to make changes.
- `--port` picks the port, otherwise a free one is used. `--no-open` prints the address instead of
  opening a browser.
