import svg from "./schemas/svg.schema.json" with { type: "json" };

/**
 * The component type an SVG becomes.
 *
 * SVG is a W3C format rather than a Khronos one, so it sits in its own namespace beside
 * `khronos::gltf`: a component type says who defines the shape of the thing, and the
 * answer here is not the same body that defines glTF.
 */
export const SVG_TYPE = {
    svg: "w3c::svg",
} as const;

export type SvgComponentType = (typeof SVG_TYPE)[keyof typeof SVG_TYPE];

export const SVG_SCHEMAS: Record<SvgComponentType, unknown> = {
    [SVG_TYPE.svg]: svg,
};
