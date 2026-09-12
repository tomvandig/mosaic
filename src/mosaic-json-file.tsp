
import "@typespec/json-schema";

using JsonSchema;

@format("uuid")
@pattern("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
scalar uuid extends string;

@pattern("</[A-Za-z0-9.]+")
scalar component_file_name extends string;

enum OperationType
{
    PASS_THROUGH, // I neither want to set nor unset this value
    DELETE, // I want to unset this value
    VALUE // I want to set this value
}

model ComponentReference
{
    type: string;               // the component type, e.g. "khronos::gltf::meshPrimitive"
    id: string;                 // names this reference within the node
    index?: int32 = -1;         // the row in the type's table; -1, the default, means the
                                // reference carries no value and the type has no table
    operation?: OperationType = OperationType.VALUE;
}

model MosaicNode {
    id: uuid;
    components?: ComponentReference[];
}

model MosaicProvenanceHeader
{
    id: string;             // identifier of the full dataset; name or path
    message: string;        // user specified description of the change
    dataVersion: string;    // "1.0.0"
    author: string;         // who created the dataset, e.g. "John.Doe@mail.com"
    timestamp: string;      // ISO 8601 datetime e.g. "2025-06-25"
    application: string;
}

model MosaicFileHeader {
    MosaicVersion: string;
}

model ImportNode
{
    uri: string;
    integrity?: string;
}

enum ComponentFileType
{
    NDJSON,
    PARQUET
}

model ComponentTableReference
{
    filename: component_file_name;
    type: ComponentFileType;
    schema: unknown;
}

model MosaicDataSection
{
    header: MosaicProvenanceHeader;
    nodes: MosaicNode[];
}

// The $id is the file name the schema is published under, so a $ref to it from anywhere
// else resolves to the file that is actually there.
@jsonSchema
@id("mosaic-index-file.schema.json")
model MosaicIndexFile {
    header: MosaicFileHeader;
    "imports": ImportNode[];
    componentTables: ComponentTableReference[];
    sections: MosaicDataSection[];
}

// Seal every object schema. Without this, JSON Schema treats unlisted properties
// as allowed, and code generators emit a catch-all index signature on every type.
// (`seal-object-schemas` in tspconfig emits `unevaluatedProperties`, which
// quicktype does not understand -- `additionalProperties` is the portable form.)
@@extension(ComponentReference, "additionalProperties", Json<false>);
@@extension(MosaicNode, "additionalProperties", Json<false>);
@@extension(MosaicProvenanceHeader, "additionalProperties", Json<false>);
@@extension(MosaicFileHeader, "additionalProperties", Json<false>);
@@extension(ImportNode, "additionalProperties", Json<false>);
@@extension(ComponentTableReference, "additionalProperties", Json<false>);
@@extension(MosaicDataSection, "additionalProperties", Json<false>);
@@extension(MosaicIndexFile, "additionalProperties", Json<false>);
