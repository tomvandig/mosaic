// Generated from standard/mosaic-api.openapi3.json by src/scripts/gen-api-sdk.mjs.
// Run "npm run gen-api-sdk" in src after changing mosaic-api.tsp.

import type {
    BlobResponse,
    CreateTesseraCommand,
    CreateTesseraVersionCommand,
    CreateTesseraVersionResponse,
    MosaicFileDownloadType,
    NodeFetchFormat,
    NodeFetchRequest,
    TesseraDetails,
    TesseraStatus,
    TesseraVersion,
    TesseraVersionMosaicFile,
} from "./MosaicApiTypes.ts";

/** A response the server answered with, that was not a success. */
export class ApiError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
        this.name = "ApiError";
    }
}

async function failOnError(response: Response): Promise<void> {
    if (response.ok) return;

    const text = await response.text();
    let message = text;
    try {
        message = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
        // Not JSON; the body as it came is the best message there is.
    }

    throw new ApiError(response.status, message || `${response.status} from the server`);
}

/** An answer whose media type was negotiated, with the type the server chose. */
export interface NegotiatedResponse {
    contentType: string;
    bytes: Uint8Array;
}

async function readJson<T>(response: Response): Promise<T> {
    const text = await response.text();
    return (text.length > 0 ? JSON.parse(text) : undefined) as T;
}

/**
 * A client for the Mosaic API, with one method per operation in the spec.
 *
 * Both this and the server are generated from the same document, so a route that moves
 * moves in both at once.
 */
export class MosaicApiClient {
    private readonly fetch: typeof globalThis.fetch;

    constructor(readonly baseUrl: string, options: { fetch?: typeof globalThis.fetch } = {}) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.fetch = options.fetch ?? globalThis.fetch;
    }

    /** POST /mosaic-api/tesserae (Tesserae_createTessera) */
    async createTessera(params: { body: CreateTesseraCommand }): Promise<void> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae${search}`, { method: "POST", body: JSON.stringify(params.body), headers: { "content-type": "application/json" } });
        await failOnError(response);
        await response.text();
    }

    /** POST /mosaic-api/tesserae/{tesseraId}/versions (VersionsRoutes_createTesseraVersion) */
    async createTesseraVersion(params: { tesseraId: string; body: CreateTesseraVersionCommand }): Promise<CreateTesseraVersionResponse> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions${search}`, { method: "POST", body: JSON.stringify(params.body), headers: { "content-type": "application/json" } });
        await failOnError(response);
        return await readJson<CreateTesseraVersionResponse>(response);
    }

    /** DELETE /mosaic-api/tesserae/{tesseraId} (TesseraRoutes_delete_tessera) */
    async deleteTessera(params: { tesseraId: string }): Promise<void> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}${search}`, { method: "DELETE" });
        await failOnError(response);
        await response.text();
    }

    /** PUT /mosaic-api/download/{blobId} (download) */
    async download(params: { blobId: string }): Promise<Uint8Array> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/download/${encodeURIComponent(String(params.blobId))}${search}`, { method: "PUT" });
        await failOnError(response);
        return new Uint8Array(await response.arrayBuffer()) as Uint8Array;
    }

    /** POST /mosaic-api/tesserae/{tesseraId}/versions/{versionId}/nodes (TesseraVersionRoutes_fetchNodes) */
    async fetchNodes(params: { tesseraId: string; versionId: string; format: NodeFetchFormat; body: NodeFetchRequest }): Promise<Uint8Array> {
        const query = new URLSearchParams();
        query.set("format", String(params.format));
        const search = query.size > 0 ? `?${query}` : "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions/${encodeURIComponent(String(params.versionId))}/nodes${search}`, { method: "POST", body: JSON.stringify(params.body), headers: { "content-type": "application/json" } });
        await failOnError(response);
        return new Uint8Array(await response.arrayBuffer()) as Uint8Array;
    }

    /** GET /mosaic-api/tesserae/{tesseraId} (TesseraRoutes_get_tessera) */
    async getTessera(params: { tesseraId: string }): Promise<TesseraDetails> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}${search}`, { method: "GET" });
        await failOnError(response);
        return await readJson<TesseraDetails>(response);
    }

    /** GET /mosaic-api/tesserae/{tesseraId}/versions/{versionId} (TesseraVersionRoutes_get_tessera_version) */
    async getTesseraVersion(params: { tesseraId: string; versionId: string }): Promise<TesseraVersion> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions/${encodeURIComponent(String(params.versionId))}${search}`, { method: "GET" });
        await failOnError(response);
        return await readJson<TesseraVersion>(response);
    }

    /** GET /mosaic-api/tesserae/{tesseraId}/versions/{versionId}/types (TesseraVersionRoutes_get_types) */
    async getTypes(params: { tesseraId: string; versionId: string }): Promise<unknown[]> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions/${encodeURIComponent(String(params.versionId))}/types${search}`, { method: "GET" });
        await failOnError(response);
        return await readJson<unknown[]>(response);
    }

    /** GET /mosaic-api/tesserae/{tesseraId}/versions/{versionId}/node/{path} (TesseraVersionRoutes_nodeAtPath) */
    async nodeAtPath(params: { tesseraId: string; versionId: string; path: string }): Promise<NegotiatedResponse> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions/${encodeURIComponent(String(params.versionId))}/node/${String(params.path).split("/").map(encodeURIComponent).join("/")}${search}`, { method: "GET" });
        await failOnError(response);
        return { contentType: response.headers.get("content-type") ?? "", bytes: new Uint8Array(await response.arrayBuffer()) };
    }

    /** GET /mosaic-api/tesserae/{tesseraId}/versions/{versionId}/sparql (TesseraVersionRoutes_sparqlQuery) */
    async sparqlQuery(params: { tesseraId: string; versionId: string; defaultGraphUri?: string[]; namedGraphUri?: string[]; query: string; accept?: string }): Promise<NegotiatedResponse> {
        const query = new URLSearchParams();
        if (params.defaultGraphUri !== undefined) for (const value of params.defaultGraphUri) query.append("default-graph-uri", String(value));
        if (params.namedGraphUri !== undefined) for (const value of params.namedGraphUri) query.append("named-graph-uri", String(value));
        query.set("query", String(params.query));
        const search = query.size > 0 ? `?${query}` : "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions/${encodeURIComponent(String(params.versionId))}/sparql${search}`, { method: "GET", headers: { ...(params.accept !== undefined ? { "accept": params.accept } : {}) } });
        await failOnError(response);
        return { contentType: response.headers.get("content-type") ?? "", bytes: new Uint8Array(await response.arrayBuffer()) };
    }

    /** POST /mosaic-api/tesserae/{tesseraId}/versions/{versionId}/sparql (TesseraVersionRoutes_sparqlQueryPost) */
    async sparqlQueryPost(params: { tesseraId: string; versionId: string; defaultGraphUri?: string[]; namedGraphUri?: string[]; accept?: string; body: string }): Promise<NegotiatedResponse> {
        const query = new URLSearchParams();
        if (params.defaultGraphUri !== undefined) for (const value of params.defaultGraphUri) query.append("default-graph-uri", String(value));
        if (params.namedGraphUri !== undefined) for (const value of params.namedGraphUri) query.append("named-graph-uri", String(value));
        const search = query.size > 0 ? `?${query}` : "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions/${encodeURIComponent(String(params.versionId))}/sparql${search}`, { method: "POST", body: params.body, headers: { "content-type": "application/sparql-query", ...(params.accept !== undefined ? { "accept": params.accept } : {}) } });
        await failOnError(response);
        return { contentType: response.headers.get("content-type") ?? "", bytes: new Uint8Array(await response.arrayBuffer()) };
    }

    /** GET /mosaic-api/tesserae (Tesserae_tesserae) */
    async tesserae(): Promise<TesseraStatus[]> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae${search}`, { method: "GET" });
        await failOnError(response);
        return await readJson<TesseraStatus[]>(response);
    }

    /** PUT /mosaic-api/tesserae/{tesseraId}/versions/{versionId}/download-mosaic (TesseraVersionRoutes_tessera_Mosaic) */
    async tesseraMosaic(params: { tesseraId: string; versionId: string; downloadType: MosaicFileDownloadType }): Promise<TesseraVersionMosaicFile> {
        const query = new URLSearchParams();
        query.set("downloadType", String(params.downloadType));
        const search = query.size > 0 ? `?${query}` : "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions/${encodeURIComponent(String(params.versionId))}/download-mosaic${search}`, { method: "PUT" });
        await failOnError(response);
        return await readJson<TesseraVersionMosaicFile>(response);
    }

    /** PUT /mosaic-api/upload/{blobId} (upload) */
    async upload(params: { blobId: string; body: Uint8Array }): Promise<void> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/upload/${encodeURIComponent(String(params.blobId))}${search}`, { method: "PUT", body: params.body });
        await failOnError(response);
        await response.text();
    }

    /** POST /mosaic-api/tesserae/{tesseraId}/upload-mosaic-blob-url (TesseraRoutes_uploadMosaicBlobUrl) */
    async uploadMosaicBlobUrl(params: { tesseraId: string }): Promise<BlobResponse> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/upload-mosaic-blob-url${search}`, { method: "POST" });
        await failOnError(response);
        return await readJson<BlobResponse>(response);
    }
}
