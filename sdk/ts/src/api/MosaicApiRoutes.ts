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
        "operationId": "Tesserae_createTessera",
        "method": "POST",
        "path": "/Mosaic-api/tesserae",
        "pathParameters": [],
        "queryParameters": [],
        "hasBody": true
    },
    {
        "operationId": "Tesserae_tesserae",
        "method": "GET",
        "path": "/Mosaic-api/tesserae",
        "pathParameters": [],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "TesseraRoutes_delete_tessera",
        "method": "DELETE",
        "path": "/Mosaic-api/tesserae/{tesseraId}",
        "pathParameters": [
            "tesseraId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "TesseraRoutes_get_tessera",
        "method": "GET",
        "path": "/Mosaic-api/tesserae/{tesseraId}",
        "pathParameters": [
            "tesseraId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "TesseraRoutes_uploadMosaicBlobUrl",
        "method": "POST",
        "path": "/Mosaic-api/tesserae/{tesseraId}/upload-Mosaic-blob-url",
        "pathParameters": [
            "tesseraId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "TesseraVersionRoutes_get_tessera_version",
        "method": "GET",
        "path": "/Mosaic-api/tesserae/{tesseraId}/versions/{versionId}",
        "pathParameters": [
            "tesseraId",
            "versionId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "TesseraVersionRoutes_query",
        "method": "GET",
        "path": "/Mosaic-api/tesserae/{tesseraId}/versions/{versionId}/query",
        "pathParameters": [
            "tesseraId",
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
        "operationId": "TesseraVersionRoutes_tessera_Mosaic",
        "method": "PUT",
        "path": "/Mosaic-api/tesserae/{tesseraId}/versions/{versionId}/download-Mosaic",
        "pathParameters": [
            "tesseraId",
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
        "operationId": "VersionsRoutes_createTesseraVersion",
        "method": "POST",
        "path": "/Mosaic-api/tesserae/{tesseraId}/versions",
        "pathParameters": [
            "tesseraId"
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
