import { Operation, type ComponentElement } from "./MosaicIndexFile.ts";

/**
 * The index a reference has when it carries no value. A `core::child` or `core::name`
 * reference says everything in its `id`, so there is no row for it to point at and its
 * component type needs no table at all.
 */
export const NO_COMPONENT_INDEX = -1;

/** The row a reference points at, or {@link NO_COMPONENT_INDEX} when it carries no value. */
export function indexOf(reference: ComponentElement): number {
    return reference.index ?? NO_COMPONENT_INDEX;
}

/** The operation a reference performs. Left out, it sets a value. */
export function operationOf(reference: ComponentElement): Operation {
    return reference.operation ?? Operation.Value;
}

/** True when the reference points at a row, rather than saying everything in its id. */
export function hasValue(reference: ComponentElement): boolean {
    return indexOf(reference) >= 0;
}
