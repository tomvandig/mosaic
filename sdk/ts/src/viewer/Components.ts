import { CORE_TYPE } from "../core/schemas.ts";
import { GLTF_TYPE } from "../gltf/schemas.ts";
import { SVG_TYPE } from "../svg/schemas.ts";

/**
 * What the viewer asks for when it wants to draw something.
 *
 * A converted building carries far more than geometry -- property sets, quantities,
 * classifications, the whole of an IFC model -- and none of it is drawable. Naming the
 * drawable types is the difference between an answer of tens of megabytes and one of
 * hundreds, so the viewer names them.
 */
export const GEOMETRY_COMPONENTS: readonly string[] = [
    GLTF_TYPE.buffer,
    GLTF_TYPE.bufferView,
    GLTF_TYPE.accessor,
    GLTF_TYPE.meshPrimitive,
    GLTF_TYPE.image,
    GLTF_TYPE.sampler,
    GLTF_TYPE.texture,
    GLTF_TYPE.material,
    CORE_TYPE.transform,
    CORE_TYPE.child,
    // An SVG is drawable too, though a glb has nowhere native to put one: it rides on its
    // node as extension data and is turned into geometry by the renderer.
    SVG_TYPE.svg,
    // Not geometry, but about how geometry is drawn, so it comes with it.
    CORE_TYPE.edges,
];

/**
 * The same, plus the names -- which is what the tree is built from.
 *
 * The tree and the picture are read from one answer, so the request that fetches the
 * geometry is also the request that fetches the hierarchy.
 */
export const TREE_COMPONENTS: readonly string[] = [...GEOMETRY_COMPONENTS, CORE_TYPE.name];
