/**
 * Turning the JSON Schema embedded in an archive into DuckDB columns.
 *
 * Nothing here is known up front: an archive says which component types it carries and
 * hands over the schema for each, and these functions decide what a table for it looks
 * like. Anything the mapping cannot express -- a nested object, a union, an array of
 * something odd -- becomes JSON, which DuckDB can still be queried through.
 */

export interface ColumnPlan {
    /** The column name, which is the property name unless it clashes with a fixed one. */
    name: string;
    /** The DuckDB type, e.g. VARCHAR, BIGINT, DOUBLE[]. */
    sqlType: string;
    /** The property this column came from. */
    property: string;
}

/** Columns every component table carries, whatever the component is. */
export const FIXED_COLUMNS = {
    /** Which archive the row came from; rows are only ever appended. */
    fileId: "file_id",
    /** The row's position in its component table, which is what a reference points at. */
    index: "idx",
    /** The component exactly as the archive stored it. */
    value: "value",
} as const;

const RESERVED: ReadonlySet<string> = new Set(Object.values(FIXED_COLUMNS));

type Schema = Record<string, any>;

/** Escapes an identifier for DuckDB, which is how a `khronos::gltf::accessor` table works. */
export function quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
}

/** Escapes a JSON path step, so a property may be called anything at all. */
function quotePathStep(name: string): string {
    return `"${name.replace(/"/g, '\\"')}"`;
}

function itemType(items: Schema | undefined): string | undefined {
    if (!items || typeof items !== "object") return undefined;
    return scalarType(items);
}

/** The DuckDB type for a scalar schema, or undefined when it is not a scalar. */
function scalarType(schema: Schema): string | undefined {
    const type = Array.isArray(schema.type) ? (schema.type.length === 1 ? schema.type[0] : undefined) : schema.type;

    switch (type) {
        case "string": return "VARCHAR";
        case "integer": return "BIGINT";
        case "number": return "DOUBLE";
        case "boolean": return "BOOLEAN";
        default: break;
    }

    // A schema that only lists its allowed values still says what type they are.
    if (type === undefined && Array.isArray(schema.enum) && schema.enum.length > 0) {
        const kinds = new Set(schema.enum.map((value: unknown) => typeof value));
        if (kinds.size === 1) {
            const [kind] = [...kinds];
            if (kind === "string") return "VARCHAR";
            if (kind === "boolean") return "BOOLEAN";
            if (kind === "number") return schema.enum.every(Number.isInteger) ? "BIGINT" : "DOUBLE";
        }
    }

    return undefined;
}

/** The DuckDB type for one property of a component. */
export function columnTypeFor(schema: Schema): string {
    if (!schema || typeof schema !== "object") return "JSON";

    const scalar = scalarType(schema);
    if (scalar) return scalar;

    if (schema.type === "array") {
        const items = itemType(schema.items);
        // A list of scalars is worth a real list column; anything else stays JSON.
        return items ? `${items}[]` : "JSON";
    }

    return "JSON";
}

/**
 * The columns a component type's table needs, in the order the schema declares them.
 * A schema that describes no properties still gets a table -- it just has nothing but the
 * fixed columns, and the whole component remains readable through `value`.
 */
export function planColumns(schema: Schema | undefined, onWarning?: (message: string) => void): ColumnPlan[] {
    const properties = schema && typeof schema === "object" ? schema.properties : undefined;
    if (!properties || typeof properties !== "object") return [];

    return Object.entries(properties as Record<string, Schema>).map(([property, propertySchema]) => {
        let name = property;
        if (RESERVED.has(name)) {
            // A component property may legitimately be called "value"; the fixed column
            // keeps the plain name and the property takes a suffix.
            name = `${property}_`;
            onWarning?.(`property "${property}" collides with a fixed column and was stored as "${name}"`);
        }

        return { name, sqlType: columnTypeFor(propertySchema), property };
    });
}

/** The SQL that reads one column's value out of the bound JSON document. */
export function extractionFor(column: ColumnPlan, jsonAlias: string): string {
    const path = `'$.row.${quotePathStep(column.property)}'`;

    if (column.sqlType === "VARCHAR") return `json_extract_string(${jsonAlias}, ${path})`;
    if (column.sqlType === "JSON") return `json_extract(${jsonAlias}, ${path})`;
    return `json_extract(${jsonAlias}, ${path})::${column.sqlType}`;
}
