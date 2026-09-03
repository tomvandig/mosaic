// Generated from standard/openapi.json by src/schema/scripts/gen-api-sdk.mjs.
// Run "npm run gen-api-sdk" in src/schema after changing mosaic-api.tsp.
//
// Object schemas are sealed on the way through, so these types say exactly what each
// model holds rather than carrying an index signature apiece.

export interface BlobResponse {
    blobId: string;
    putURL: string;
}

export interface CreateModelCommand {
    id:   string;
    name: string;
}

export interface CreateModelVersionCommand {
    blobId:                 string;
    id:                     string;
    previousModelVersionId: string;
}

export interface CreateModelVersionResponse {
    state:            CreateModelVersionResponseState;
    validationErrors: string[];
}

export enum CreateModelVersionResponseState {
    Ok = "OK",
    OutOfDate = "OUT_OF_DATE",
    ValidationError = "VALIDATION_ERROR",
}

export interface ModelDetails {
    history: ModelVersion[];
    id:      string;
    name:    string;
}

export interface ModelVersion {
    modelId:           string;
    previousVersionId: string;
    provenance:        MosaicProvenanceData;
    versionId:         string;
}

export interface MosaicProvenanceData {
    application: string;
    author:      string;
    message:     string;
    timestamp:   string;
}

export interface ModelStatus {
    id:            string;
    latestVersion: string;
    name:          string;
}

export interface ModelVersionMosaicFile {
    blobUrl: string;
}

export enum MosaicFileDownloadType {
    JustThisVersion = "just_this_version",
    WholeModelAndImportsHistoryCondensed = "whole_model_and_imports_history_condensed",
    WholeModelHistoryCondensed = "whole_model_history_condensed",
    WholeModelHistoryIntact = "whole_model_history_intact",
}

export interface MosaicQueryAPINodeComponent {
    name:  string;
    type:  string;
    value: any;
}

export interface MosaicQueryAPINodeResponse {
    components: MosaicQueryAPINodeComponent[];
}

export interface MosaicQueryAPIResponse {
    nodes: MosaicQueryAPINodeResponse[];
}
