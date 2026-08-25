import { MosaicFile, WriteMosaicFile } from "./MosaicFile.ts";
import { Convert, type MosaicIndexFile } from "./MosaicIndexFile.ts";

/**
 * The authoring form of a Mosaic dataset: one JSON document holding the index plus the
 * component rows, kept readable and diffable. Packing it produces the archive a reader
 * consumes, where the index and one NDJSON file per component table sit side by side.
 */
export interface MosaicSourceDocument {
    /** Free text describing the dataset. Not carried into the archive. */
    description?: string;
    /** typeID -> component rows. A row may be an object or an already-serialized line. */
    components: Record<string, ReadonlyArray<unknown>>;
    /**
     * A literal MosaicIndexFile, except that `componentTables[].schema` may be a reference
     * string (a path, a URI) which `resolveSchema` turns into the schema document itself.
     */
    index: MosaicIndexFile;
}

/** Turns a `componentTables[].schema` reference into the schema document it names. */
export type SchemaResolver = (reference: string) => unknown;

const NO_SCHEMAS: SchemaResolver = reference => {
    throw new Error(`Cannot resolve schema reference "${reference}": no schema resolver was provided`);
};

/** Serializes one component row to the NDJSON line it becomes. */
function toLine(row: unknown, typeID: string, index: number): string {
    if (typeof row === "string") {
        // Already a serialized line; parse it so a malformed row fails here, with a
        // useful location, rather than when something later tries to read it back.
        try {
            JSON.parse(row);
        } catch (cause) {
            throw new Error(`Component ${typeID}[${index}] is not valid JSON`, { cause });
        }
        return row;
    }

    return JSON.stringify(row);
}

/**
 * Builds the in-memory file a source document describes, inlining schema references
 * and serializing component rows. Pure: no file system, no archive.
 */
export function buildMosaicFile(document: MosaicSourceDocument, resolveSchema: SchemaResolver = NO_SCHEMAS): MosaicFile {
    if (document.index === undefined) throw new Error(`Source document has no "index"`);

    const file = new MosaicFile();

    // Round-trip through Convert so a malformed index is rejected up front, where the
    // error can name the offending field, instead of producing a broken archive.
    file.index = Convert.toMosaicIndexFile(JSON.stringify(document.index));

    for (const table of file.index.componentTables) {
        if (typeof table.schema === "string") {
            table.schema = resolveSchema(table.schema);
        }
    }

    for (const [typeID, rows] of Object.entries(document.components ?? {})) {
        rows.forEach((row, index) => file.addSerializedComponent(typeID, toLine(row, typeID, index)));
    }

    return file;
}

/** Builds a source document into the bytes of a Mosaic archive. */
export async function packMosaicSource(document: MosaicSourceDocument, resolveSchema?: SchemaResolver): Promise<Uint8Array> {
    return await WriteMosaicFile(buildMosaicFile(document, resolveSchema));
}
