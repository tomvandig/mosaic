/**
 * Reading the values web-ifc hands back.
 *
 * `GetLine` does not return plain JSON. Every attribute arrives wrapped: a string is an
 * `IfcLabel`, a number an `IfcLengthMeasure`, an enum a bare `{ type, value }`, and a
 * pointer to another line a `Handle` -- which looks exactly like a wrapped number until
 * you check its `type`. An absent attribute is `null`, which in IFC means "not given"
 * rather than "the value null", so nothing here ever produces a null.
 */

/** web-ifc's type tag for a reference to another line. */
const REF = 5;

/** An attribute that points at another IFC line. */
export interface Reference {
    expressId: number;
}

type Wrapped = { type?: number; value?: unknown };

function isWrapped(value: unknown): value is Wrapped {
    return typeof value === "object" && value !== null && "type" in (value as object);
}

/** The express id an attribute points at, when it points at anything. */
export function referenceOf(value: unknown): number | undefined {
    if (!isWrapped(value)) return undefined;
    if (value.type !== REF) return undefined;
    return typeof value.value === "number" ? value.value : undefined;
}

/** Every express id an attribute names, whether it holds one reference or a list. */
export function referencesOf(value: unknown): number[] {
    if (Array.isArray(value)) return value.flatMap(item => referencesOf(item));

    const single = referenceOf(value);
    return single === undefined ? [] : [single];
}

/**
 * The plain JSON an attribute carries, or undefined when it carries nothing a component
 * can hold -- an absent attribute, a reference, or a list with a reference in it.
 *
 * References are left out on purpose: a pointer to line 4711 means nothing once the file
 * is gone, so those become links between Mosaic nodes instead of values on one.
 */
export function decodeValue(value: unknown): unknown {
    if (value === null || value === undefined) return undefined;

    if (Array.isArray(value)) {
        const items = value.map(item => decodeValue(item));
        // All or nothing: a half-decoded list would quietly change its own length.
        return items.some(item => item === undefined) ? undefined : items;
    }

    if (isWrapped(value)) {
        if (value.type === REF) return undefined;

        // Measures store their number under a private field and expose it through a
        // getter, so read the property rather than the object's own keys.
        const inner = (value as { value?: unknown }).value;
        return typeof inner === "string" || typeof inner === "number" || typeof inner === "boolean"
            ? inner
            : undefined;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;

    return undefined;
}

/** The same, but only when the result is a string -- names, tags, enum labels. */
export function decodeString(value: unknown): string | undefined {
    const decoded = decodeValue(value);
    return typeof decoded === "string" ? decoded : undefined;
}

/** The same, but only when the result is a number. */
export function decodeNumber(value: unknown): number | undefined {
    const decoded = decodeValue(value);
    return typeof decoded === "number" && Number.isFinite(decoded) ? decoded : undefined;
}
