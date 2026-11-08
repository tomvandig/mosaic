# Edges

Composing draws a building by its edges: the line where two faces meet at more than about thirty
degrees — a corner, a reveal, the lip of a slab — which is what makes a plan or an elevation
readable. Some geometry is not like that. A tree's faces meet at an angle everywhere, so edging one
draws a black smudge where a tree should be.

`core::edges` says so. `{"draw": false}` on a node leaves it and everything beneath it unedged, so
one component covers a whole model, and the nearest answer up the tree wins — a model can say no and
one part of it say yes again. Left off entirely, edges are drawn.

It is worth saying where the component goes. A file that imports a tree can write `core::edges` onto
the tree's own node, by id, without touching the archive that owns it: layering means the importing
file has the last word. `examples/` aside, `sdk/cli/build/s1-together.mosaic.json` does exactly that
for a tree, its trunk and a helmet.
