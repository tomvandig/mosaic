import buffer from "./schemas/buffer.schema.json" with { type: "json" };
import bufferView from "./schemas/bufferView.schema.json" with { type: "json" };
import accessor from "./schemas/accessor.schema.json" with { type: "json" };
import meshPrimitive from "./schemas/meshPrimitive.schema.json" with { type: "json" };
import material from "./schemas/material.schema.json" with { type: "json" };
import nodeTransform from "./schemas/nodeTransform.schema.json" with { type: "json" };

/** The component type each glTF element becomes. */
export const GLTF_TYPE = {
    buffer: "khronos::gltf::buffer",
    bufferView: "khronos::gltf::bufferView",
    accessor: "khronos::gltf::accessor",
    meshPrimitive: "khronos::gltf::meshPrimitive",
    material: "khronos::gltf::material",
    nodeTransform: "khronos::gltf::nodeTransform",
} as const;

export type GltfComponentType = (typeof GLTF_TYPE)[keyof typeof GLTF_TYPE];

/**
 * The schema for each glTF component type, derived from the glTF 2.0 schemas. Conversion
 * inlines these into the document it produces, so the result is self-contained.
 */
export const GLTF_SCHEMAS: Record<GltfComponentType, unknown> = {
    [GLTF_TYPE.buffer]: buffer,
    [GLTF_TYPE.bufferView]: bufferView,
    [GLTF_TYPE.accessor]: accessor,
    [GLTF_TYPE.meshPrimitive]: meshPrimitive,
    [GLTF_TYPE.material]: material,
    [GLTF_TYPE.nodeTransform]: nodeTransform,
};
