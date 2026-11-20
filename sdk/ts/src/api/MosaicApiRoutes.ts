// Generated from standard/mosaic-api.openapi3.json by src/scripts/gen-api-sdk.mjs.
// Run "npm run gen-api-sdk" in src after changing mosaic-api.tsp.

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
        "path": "/mosaic-api/download/{blobId}",
        "pathParameters": [
            "blobId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "Tesserae_createTessera",
        "method": "POST",
        "path": "/mosaic-api/tesserae",
        "pathParameters": [],
        "queryParameters": [],
        "hasBody": true
    },
    {
        "operationId": "Tesserae_tesserae",
        "method": "GET",
        "path": "/mosaic-api/tesserae",
        "pathParameters": [],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "TesseraRoutes_delete_tessera",
        "method": "DELETE",
        "path": "/mosaic-api/tesserae/{tesseraId}",
        "pathParameters": [
            "tesseraId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "TesseraRoutes_get_tessera",
        "method": "GET",
        "path": "/mosaic-api/tesserae/{tesseraId}",
        "pathParameters": [
            "tesseraId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "TesseraRoutes_uploadMosaicBlobUrl",
        "method": "POST",
        "path": "/mosaic-api/tesserae/{tesseraId}/upload-mosaic-blob-url",
        "pathParameters": [
            "tesseraId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "TesseraVersionRoutes_fetchNodes",
        "method": "POST",
        "path": "/mosaic-api/tesserae/{tesseraId}/versions/{versionId}/nodes",
        "pathParameters": [
            "tesseraId",
            "versionId"
        ],
        "queryParameters": [
            {
                "name": "format",
                "required": true
            }
        ],
        "hasBody": true
    },
    {
        "operationId": "TesseraVersionRoutes_get_tessera_version",
        "method": "GET",
        "path": "/mosaic-api/tesserae/{tesseraId}/versions/{versionId}",
        "pathParameters": [
            "tesseraId",
            "versionId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "TesseraVersionRoutes_get_types",
        "method": "GET",
        "path": "/mosaic-api/tesserae/{tesseraId}/versions/{versionId}/types",
        "pathParameters": [
            "tesseraId",
            "versionId"
        ],
        "queryParameters": [],
        "hasBody": false
    },
    {
        "operationId": "TesseraVersionRoutes_sparqlQuery",
        "method": "GET",
        "path": "/mosaic-api/tesserae/{tesseraId}/versions/{versionId}/sparql",
        "pathParameters": [
            "tesseraId",
            "versionId"
        ],
        "queryParameters": [
            {
                "name": "default-graph-uri",
                "required": false
            },
            {
                "name": "named-graph-uri",
                "required": false
            },
            {
                "name": "query",
                "required": true
            }
        ],
        "hasBody": false
    },
    {
        "operationId": "TesseraVersionRoutes_sparqlQueryPost",
        "method": "POST",
        "path": "/mosaic-api/tesserae/{tesseraId}/versions/{versionId}/sparql",
        "pathParameters": [
            "tesseraId",
            "versionId"
        ],
        "queryParameters": [
            {
                "name": "default-graph-uri",
                "required": false
            },
            {
                "name": "named-graph-uri",
                "required": false
            }
        ],
        "hasBody": true
    },
    {
        "operationId": "TesseraVersionRoutes_tessera_Mosaic",
        "method": "PUT",
        "path": "/mosaic-api/tesserae/{tesseraId}/versions/{versionId}/download-mosaic",
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
        "path": "/mosaic-api/upload/{blobId}",
        "pathParameters": [
            "blobId"
        ],
        "queryParameters": [],
        "hasBody": true
    },
    {
        "operationId": "VersionsRoutes_createTesseraVersion",
        "method": "POST",
        "path": "/mosaic-api/tesserae/{tesseraId}/versions",
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
