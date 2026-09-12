// Generated from standard/openapi.json by src/scripts/gen-api-sdk.mjs.
// Run "npm run gen-api-sdk" in src after changing mosaic-api.tsp.
//
// Object schemas are sealed on the way through, so these types say exactly what each
// model holds rather than carrying an index signature apiece.

export interface BlobResponse {
    blobId: string;
    putURL: string;
}

export interface CreateTesseraCommand {
    id:   string;
    name: string;
}

export interface CreateTesseraVersionCommand {
    blobId:                   string;
    id:                       string;
    previousTesseraVersionId: string;
}

export interface CreateTesseraVersionResponse {
    state:            CreateTesseraVersionResponseState;
    validationErrors: string[];
}

export enum CreateTesseraVersionResponseState {
    Ok = "OK",
    OutOfDate = "OUT_OF_DATE",
    ValidationError = "VALIDATION_ERROR",
}

export enum MosaicFileDownloadType {
    JustThisVersion = "just_this_version",
    WholeTesseraAndImportsHistoryCondensed = "whole_tessera_and_imports_history_condensed",
    WholeTesseraHistoryCondensed = "whole_tessera_history_condensed",
    WholeTesseraHistoryIntact = "whole_tessera_history_intact",
}

export interface MosaicProvenanceData {
    application: string;
    author:      string;
    message:     string;
    timestamp:   string;
}

export interface MosaicQueryApiNodeComponent {
    name:  string;
    type:  string;
    value: any;
}

export interface MosaicQueryApiNodeResponse {
    components: MosaicQueryApiNodeComponent[];
}

export interface MosaicQueryApiResponse {
    nodes: MosaicQueryApiNodeResponse[];
}

export enum NodeFetchFormat {
    Glb = "glb",
    Tsr = "tsr",
}

export interface NodeFetchRequest {
    componentTypes?:  string[];
    compose?:         boolean;
    includeChildren?: boolean;
    nodes:            string[];
}

export interface TesseraDetails {
    history: TesseraVersion[];
    id:      string;
    name:    string;
}

export interface TesseraVersion {
    previousVersionId: string;
    provenance:        MosaicProvenanceData;
    tesseraId:         string;
    versionId:         string;
}

export interface TesseraStatus {
    id:            string;
    latestVersion: string;
    name:          string;
}

export interface TesseraVersionMosaicFile {
    blobUrl: string;
}
