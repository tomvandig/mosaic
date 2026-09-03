// Generated from standard/openapi.json by src/schema/scripts/gen-api-sdk.mjs.
// Run "npm run gen-api-sdk" in src/schema after changing mosaic-api.tsp.

/** One operation of the API, as the spec declares it. */
export interface ApiRoute {
    operationId: string;
    method: "GET" | "PUT" | "POST" | "DELETE" | "PATCH";
    /** The path template, with {braces} around each path parameter. */
    path: string;
    pathParameters: string[];
    queryParameters: Array<{ name: string; required: boolean }>;
    hasBody: boolean;
}

/** Every operation in the spec. A server is complete when it handles all of them. */
export const API_ROUTES = [
    {
        "operationId": "download",
        "method": "PUT",
        "path": "/Mosaic-api/download/{blobId}",
        "pathParameters": [
            "blobId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "ModelRoutes_delete_model",
        "method": "DELETE",
        "path": "/Mosaic-api/models/{modelId}",
        "pathParameters": [
            "modelId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "ModelRoutes_get_model",
        "method": "GET",
        "path": "/Mosaic-api/models/{modelId}",
        "pathParameters": [
            "modelId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "ModelRoutes_uploadMosaicBlobUrl",
        "method": "POST",
        "path": "/Mosaic-api/models/{modelId}/upload-Mosaic-blob-url",
        "pathParameters": [
            "modelId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "Models_createModel",
        "method": "POST",
        "path": "/Mosaic-api/models",
        "pathParameters": [],
        "queryParameters": [],
        "hasBody": true
    },
    {
        "operationId": "Models_models",
        "method": "GET",
        "path": "/Mosaic-api/models",
        "pathParameters": [],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "ModelVersionRoutes_get_model_version",
        "method": "GET",
        "path": "/Mosaic-api/models/{modelId}/versions/{versionId}",
        "pathParameters": [
            "modelId",
            "versionId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "ModelVersionRoutes_model_Mosaic",
        "method": "PUT",
        "path": "/Mosaic-api/models/{modelId}/versions/{versionId}/download-Mosaic",
        "pathParameters": [
            "modelId",
            "versionId"
        ],
        "queryParameters": [
            {
                "name": "downloadType",
                "required": true
            }
        ],
        "hasBody": false
    },
    {
        "operationId": "ModelVersionRoutes_query",
        "method": "GET",
        "path": "/Mosaic-api/models/{modelId}/versions/{versionId}/query",
        "pathParameters": [
            "modelId",
            "versionId"
        ],
        "queryParameters": [
            {
                "name": "path",
                "required": true
            },
            {
                "name": "provenance",
                "required": true
            },
            {
                "name": "expandChildren",
                "required": true
            },
            {
                "name": "expandChildrenRecursive",
                "required": true
            }
        ],
        "hasBody": false
    },
    {
        "operationId": "upload",
        "method": "PUT",
        "path": "/Mosaic-api/upload/{blobId}",
        "pathParameters": [
            "blobId"
        ],
        "queryParameters": [],
        "hasBody": true
    },
    {
        "operationId": "VersionsRoutes_createModelVersion",
        "method": "POST",
        "path": "/Mosaic-api/models/{modelId}/versions",
        "pathParameters": [
            "modelId"
        ],
        "queryParameters": [],
        "hasBody": true
    }
] as const satisfies readonly ApiRoute[];

export type OperationId = (typeof API_ROUTES)[number]["operationId"];

/** The route for an operation, or undefined when the spec has no such operation. */
export function routeFor(operationId: string): ApiRoute | undefined {
    return API_ROUTES.find(route => route.operationId === operationId);
}
