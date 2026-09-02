import buffer from "./schemas/buffer.schema.json" with { type: "json" };
import bufferView from "./schemas/bufferView.schema.json" with { type: "json" };
import accessor from "./schemas/accessor.schema.json" with { type: "json" };
import meshPrimitive from "./schemas/meshPrimitive.schema.json" with { type: "json" };
import material from "./schemas/material.schema.json" with { type: "json" };
import image from "./schemas/image.schema.json" with { type: "json" };
import sampler from "./schemas/sampler.schema.json" with { type: "json" };
import texture from "./schemas/texture.schema.json" with { type: "json" };

/** The component type each glTF element becomes. */
export const GLTF_TYPE = {
    buffer: "khronos::gltf::buffer",
    bufferView: "khronos::gltf::bufferView",
    accessor: "khronos::gltf::accessor",
    meshPrimitive: "khronos::gltf::meshPrimitive",
    image: "khronos::gltf::image",
    sampler: "khronos::gltf::sampler",
    texture: "khronos::gltf::texture",
    material: "khronos::gltf::material",
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
    [GLTF_TYPE.image]: image,
    [GLTF_TYPE.sampler]: sampler,
    [GLTF_TYPE.texture]: texture,
    [GLTF_TYPE.material]: material,
};
