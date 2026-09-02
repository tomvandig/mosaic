import child from "./schemas/child.schema.json" with { type: "json" };
import name from "./schemas/name.schema.json" with { type: "json" };
import transform from "./schemas/transform.schema.json" with { type: "json" };

/** Component types Mosaic itself defines, outside any vendor namespace. */
export const CORE_TYPE = {
    /**
     * A parent-child link. The component has no value; the *name* of the reference is the
     * id of the child node, which lets one node carry many children and lets a later
     * section drop a single link with a DELETE on that name.
     */
    child: "core::child",
    /**
     * A human-readable name for a node, such as the one its source file gave it. Like
     * core::child, the component has no value; the *name* of the reference is the name.
     */
    name: "core::name",
    /**
     * The local transform of a node. Its shape follows the glTF node transform, but a
     * transform is not specific to glTF, so it belongs to the core namespace.
     */
    transform: "core::transform",
} as const;

export type CoreComponentType = (typeof CORE_TYPE)[keyof typeof CORE_TYPE];

export const CORE_SCHEMAS: Record<CoreComponentType, unknown> = {
    [CORE_TYPE.child]: child,
    [CORE_TYPE.name]: name,
    [CORE_TYPE.transform]: transform,
};

/** The value every core::child and core::name component carries: nothing. */
export const CHILD_COMPONENT = {} as const;
export const NAME_COMPONENT = {} as const;
