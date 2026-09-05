/**
 * Turning the JSON Schema embedded in an archive into DuckDB columns, and a stored row
 * back into the component it was.
 *
 * Nothing here is known up front: an archive says which component types it carries and
 * hands over the schema for each, and these functions decide what a table for it looks
 * like. Anything the mapping cannot express -- a nested object, a union, an array of
 * something odd -- becomes JSON, which DuckDB can still be queried through.
 *
 * The columns are all there is: a component is stored as its properties and read back
 * from them, with no copy of the original document beside them. Two consequences are
 * worth knowing. A property the schema does not declare has nowhere to go, which is why a
 * schema that does not seal itself is warned about. And a column is null both when a
 * property was absent and when it was written as null, so a row read back has the
 * property absent -- null is not a value a component can carry.
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
} as const;

/**
 * Names a property cannot have.
 *
 * The fixed columns, and `value` -- which no table is given any more, but which earlier
 * builds used for a copy of the whole component. Keeping the name reserved means a
 * database written by one of those still reads correctly: the leftover column is passed
 * over rather than handed back as a property nobody wrote.
 */
const RESERVED: ReadonlySet<string> = new Set([...Object.values(FIXED_COLUMNS), "value"]);

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

/** The column a property is stored in, which is its own name unless that is taken. */
function columnNameFor(property: string, onWarning?: (message: string) => void): string {
    if (!RESERVED.has(property)) return property;

    // A component property may legitimately be called "idx"; the fixed column keeps the
    // plain name and the property takes a suffix, which reading undoes.
    const name = `${property}_`;
    onWarning?.(`property "${property}" collides with a fixed column and was stored as "${name}"`);

    return name;
}

/**
 * The columns a component type's table needs, in the order the schema declares them.
 *
 * A schema that lets a row carry more than it declares is warned about: the columns are
 * the whole of what is stored, so anything the schema leaves undeclared is dropped.
 */
export function planColumns(schema: Schema | undefined, onWarning?: (message: string) => void): ColumnPlan[] {
    if (schema && typeof schema === "object" && schema.additionalProperties !== false) {
        onWarning?.(`the schema does not set "additionalProperties": false, so a row may carry properties `
            + `that have no column and are not stored`);
    }

    const properties = schema && typeof schema === "object" ? schema.properties : undefined;
    if (!properties || typeof properties !== "object") return [];

    return Object.entries(properties as Record<string, Schema>).map(([property, propertySchema]) => ({
        name: columnNameFor(property, onWarning),
        sqlType: columnTypeFor(propertySchema),
        property,
    }));
}

/** The DuckDB type for a value that is in a row rather than in a schema. */
function typeOfValue(value: unknown): string | undefined {
    if (typeof value === "string") return "VARCHAR";
    if (typeof value === "boolean") return "BOOLEAN";
    if (typeof value === "number") return Number.isInteger(value) ? "BIGINT" : "DOUBLE";

    if (Array.isArray(value)) {
        const kinds = new Set(value.map(entry => typeOfValue(entry)));
        if (kinds.size !== 1) return undefined;

        const [kind] = [...kinds];
        return kind && !kind.endsWith("[]") ? `${kind}[]` : undefined;
    }

    return undefined;
}

/** One type widened to hold another, or JSON when nothing holds both. */
function widen(left: string | undefined, right: string | undefined): string | undefined {
    if (left === right) return left;
    if (!left || !right) return undefined;

    // Whole numbers turning up beside fractional ones are all just numbers.
    if (left === "BIGINT" && right === "DOUBLE") return "DOUBLE";
    if (left === "DOUBLE" && right === "BIGINT") return "DOUBLE";
    if (left === "BIGINT[]" && right === "DOUBLE[]") return "DOUBLE[]";
    if (left === "DOUBLE[]" && right === "BIGINT[]") return "DOUBLE[]";

    return undefined;
}

/**
 * The columns a component type needs when nothing declared it.
 *
 * An archive can carry rows of a type its own index never mentions. There is no schema to
 * follow, so the rows are read instead: every property any of them has becomes a column,
 * typed by what is actually in it, and anything that does not settle on one type is JSON.
 */
export function planColumnsFromRows(rows: unknown[], onWarning?: (message: string) => void): ColumnPlan[] {
    const found = new Map<string, string | undefined>();

    for (const row of rows) {
        if (!row || typeof row !== "object" || Array.isArray(row)) continue;

        for (const [property, value] of Object.entries(row as Record<string, unknown>)) {
            if (value === null) continue;
            const seen = typeOfValue(value);
            found.set(property, found.has(property) ? widen(found.get(property), seen) : seen);
        }
    }

    return [...found].map(([property, sqlType]) => ({
        name: columnNameFor(property, onWarning),
        sqlType: sqlType ?? "JSON",
        property,
    }));
}

/** A property of a component, as it is stored. */
export interface StoredColumn {
    /** The column in the table. */
    name: string;
    /** The property it stands for, which is the column name unless that was taken. */
    property: string;
    /** A JSON column holds a document; every other column holds a value of its own type. */
    json: boolean;
}

/** What a component table holds, worked out from the table itself. */
export function storedColumns(columns: Array<Record<string, unknown>>): StoredColumn[] {
    return columns
        .map(column => ({ name: String(column.column_name), type: String(column.data_type) }))
        .filter(column => !RESERVED.has(column.name))
        .map(column => ({
            name: column.name,
            property: RESERVED.has(column.name.replace(/_$/, "")) ? column.name.replace(/_$/, "") : column.name,
            json: column.type === "JSON",
        }));
}

/**
 * Reads a stored row back as the component it came from.
 *
 * A null column is left out rather than written as null: a property that was absent and
 * one that was written as null are the same row here, and absent is the one that comes
 * back. The order is the order the columns were declared in, which is the order the
 * schema declared the properties in.
 */
export function componentFromRow(columns: StoredColumn[], row: Record<string, unknown>): Record<string, unknown> {
    const component: Record<string, unknown> = {};

    for (const column of columns) {
        const value = row[column.name];
        if (value === null || value === undefined) continue;

        component[column.property] = column.json && typeof value === "string" ? JSON.parse(value) : value;
    }

    return component;
}

/** The SQL that reads one column's value out of the bound JSON document. */
export function extractionFor(column: ColumnPlan, jsonAlias: string): string {
    const path = `'$.row.${quotePathStep(column.property)}'`;

    if (column.sqlType === "VARCHAR") return `json_extract_string(${jsonAlias}, ${path})`;
    if (column.sqlType === "JSON") return `json_extract(${jsonAlias}, ${path})`;
    return `json_extract(${jsonAlias}, ${path})::${column.sqlType}`;
}
