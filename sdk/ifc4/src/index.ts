export {
    IFC4_TYPE,
    IFC4_SCHEMAS,
    IFC4_RELATIONSHIP_PREFIX,
    relationshipType,
    relationshipSchema,
    type Ifc4ComponentType,
} from "./schemas.ts";

export {
    ifc4ToMosaic,
    type Ifc4Api,
    type Ifc4ConvertOptions,
    type Ifc4ConvertResult,
    type Ifc4Stats,
    type FlatMesh,
    type IfcGeometryHandle,
} from "./Ifc4ToMosaic.ts";

export {
    openIfcModel,
    convertIfcFile,
    convertIfcToSourceFile,
    convertIfcToArchiveFile,
    sourceOutputPath,
    archiveOutputPath,
    MOSAIC_SOURCE_EXTENSION,
    type Ifc4FileOptions,
    type Ifc4FileResult,
    type OpenIfcModel,
} from "./Ifc4ConvertFs.ts";

export { webIfc, type WebIfcModule, type WebIfcApi } from "./runtime.ts";
export { decodeValue, decodeString, decodeNumber, referenceOf, referencesOf } from "./values.ts";
export { idMinter, type IdMinter } from "./ids.ts";
