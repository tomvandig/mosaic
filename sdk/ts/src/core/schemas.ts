import child from "./schemas/child.schema.json" with { type: "json" };

/** Component types Mosaic itself defines, outside any vendor namespace. */
export const CORE_TYPE = {
    /**
     * A parent-child link. The component has no value; the *name* of the reference is the
     * id of the child node, which lets one node carry many children and lets a later
     * section drop a single link with a DELETE on that name.
     */
    child: "core::child",
} as const;

export type CoreComponentType = (typeof CORE_TYPE)[keyof typeof CORE_TYPE];

export const CORE_SCHEMAS: Record<CoreComponentType, unknown> = {
    [CORE_TYPE.child]: child,
};

/** The value every core::child component carries: nothing. */
export const CHILD_COMPONENT = {} as const;
