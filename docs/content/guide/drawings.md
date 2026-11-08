# Drawings

`mosaic svg-pack drawing.svg` packs an SVG into an archive of one node, named after the file
and given a made-up id the way a converted glTF node is. There is no conversion in the sense the
glTF and IFC readers convert — those take a file apart into the components that describe it, because
a mesh is not one thing but buffers and accessors and primitives. An SVG is already a description of
a drawing, so taking it apart would only lose it. It travels whole, under `w3c::svg`: a W3C format
rather than a Khronos one, so it gets a namespace of its own beside `khronos::gltf`.

A glb has nowhere native to put a drawing, so it rides on its node as `MOSAIC_components` extension
data — and a node carrying one is written into the scene even though it has no mesh, since it is
carrying something. The viewer asks for `w3c::svg` alongside the glTF components and turns the
markup into geometry with three's own SVG reader, at the last moment, which is the only place that
decision belongs. Note that reader draws paths and shapes but not `<text>`.
