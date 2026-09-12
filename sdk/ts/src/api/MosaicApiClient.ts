// Generated from standard/mosaic-api.openapi3.json by src/scripts/gen-api-sdk.mjs.
// Run "npm run gen-api-sdk" in src after changing mosaic-api.tsp.

import type {
    BlobResponse,
    CreateTesseraCommand,
    CreateTesseraVersionCommand,
    CreateTesseraVersionResponse,
    MosaicFileDownloadType,
    MosaicQueryApiResponse,
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

    /** POST /Mosaic-api/tesserae (Tesserae_createTessera) */
    async createTessera(params: { body: CreateTesseraCommand }): Promise<void> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/Mosaic-api/tesserae${search}`, { method: "POST", body: JSON.stringify(params.body), headers: { "content-type": "application/json" } });
        await failOnError(response);
        await response.text();
    }

    /** POST /Mosaic-api/tesserae/{tesseraId}/versions (VersionsRoutes_createTesseraVersion) */
    async createTesseraVersion(params: { tesseraId: string; body: CreateTesseraVersionCommand }): Promise<CreateTesseraVersionResponse> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/Mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions${search}`, { method: "POST", body: JSON.stringify(params.body), headers: { "content-type": "application/json" } });
        await failOnError(response);
        return await readJson<CreateTesseraVersionResponse>(response);
    }

    /** DELETE /Mosaic-api/tesserae/{tesseraId} (TesseraRoutes_delete_tessera) */
    async deleteTessera(params: { tesseraId: string }): Promise<void> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/Mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}${search}`, { method: "DELETE" });
        await failOnError(response);
        await response.text();
    }

    /** PUT /Mosaic-api/download/{blobId} (download) */
    async download(params: { blobId: string }): Promise<Uint8Array> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/Mosaic-api/download/${encodeURIComponent(String(params.blobId))}${search}`, { method: "PUT" });
        await failOnError(response);
        return new Uint8Array(await response.arrayBuffer()) as Uint8Array;
    }

    /** POST /Mosaic-api/tesserae/{tesseraId}/versions/{versionId}/nodes (TesseraVersionRoutes_fetchNodes) */
    async fetchNodes(params: { tesseraId: string; versionId: string; format: NodeFetchFormat; body: NodeFetchRequest }): Promise<Uint8Array> {
        const query = new URLSearchParams();
        query.set("format", String(params.format));
        const search = query.size > 0 ? `?${query}` : "";
        const response = await this.fetch(`${this.baseUrl}/Mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions/${encodeURIComponent(String(params.versionId))}/nodes${search}`, { method: "POST", body: JSON.stringify(params.body), headers: { "content-type": "application/json" } });
        await failOnError(response);
        return new Uint8Array(await response.arrayBuffer()) as Uint8Array;
    }

    /** GET /Mosaic-api/tesserae/{tesseraId} (TesseraRoutes_get_tessera) */
    async getTessera(params: { tesseraId: string }): Promise<TesseraDetails> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/Mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}${search}`, { method: "GET" });
        await failOnError(response);
        return await readJson<TesseraDetails>(response);
    }

    /** GET /Mosaic-api/tesserae/{tesseraId}/versions/{versionId} (TesseraVersionRoutes_get_tessera_version) */
    async getTesseraVersion(params: { tesseraId: string; versionId: string }): Promise<TesseraVersion> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/Mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions/${encodeURIComponent(String(params.versionId))}${search}`, { method: "GET" });
        await failOnError(response);
        return await readJson<TesseraVersion>(response);
    }

    /** GET /Mosaic-api/tesserae/{tesseraId}/versions/{versionId}/query (TesseraVersionRoutes_query) */
    async query(params: { tesseraId: string; versionId: string; path: string; provenance: boolean; expandChildren: boolean; expandChildrenRecursive: boolean }): Promise<MosaicQueryApiResponse> {
        const query = new URLSearchParams();
        query.set("path", String(params.path));
        query.set("provenance", String(params.provenance));
        query.set("expandChildren", String(params.expandChildren));
        query.set("expandChildrenRecursive", String(params.expandChildrenRecursive));
        const search = query.size > 0 ? `?${query}` : "";
        const response = await this.fetch(`${this.baseUrl}/Mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions/${encodeURIComponent(String(params.versionId))}/query${search}`, { method: "GET" });
        await failOnError(response);
        return await readJson<MosaicQueryApiResponse>(response);
    }

    /** GET /Mosaic-api/tesserae (Tesserae_tesserae) */
    async tesserae(): Promise<TesseraStatus[]> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/Mosaic-api/tesserae${search}`, { method: "GET" });
        await failOnError(response);
        return await readJson<TesseraStatus[]>(response);
    }

    /** PUT /Mosaic-api/tesserae/{tesseraId}/versions/{versionId}/download-Mosaic (TesseraVersionRoutes_tessera_Mosaic) */
    async tesseraMosaic(params: { tesseraId: string; versionId: string; downloadType: MosaicFileDownloadType }): Promise<TesseraVersionMosaicFile> {
        const query = new URLSearchParams();
        query.set("downloadType", String(params.downloadType));
        const search = query.size > 0 ? `?${query}` : "";
        const response = await this.fetch(`${this.baseUrl}/Mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/versions/${encodeURIComponent(String(params.versionId))}/download-Mosaic${search}`, { method: "PUT" });
        await failOnError(response);
        return await readJson<TesseraVersionMosaicFile>(response);
    }

    /** PUT /Mosaic-api/upload/{blobId} (upload) */
    async upload(params: { blobId: string; body: Uint8Array }): Promise<void> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/Mosaic-api/upload/${encodeURIComponent(String(params.blobId))}${search}`, { method: "PUT", body: params.body });
        await failOnError(response);
        await response.text();
    }

    /** POST /Mosaic-api/tesserae/{tesseraId}/upload-Mosaic-blob-url (TesseraRoutes_uploadMosaicBlobUrl) */
    async uploadMosaicBlobUrl(params: { tesseraId: string }): Promise<BlobResponse> {
        const search = "";
        const response = await this.fetch(`${this.baseUrl}/Mosaic-api/tesserae/${encodeURIComponent(String(params.tesseraId))}/upload-Mosaic-blob-url${search}`, { method: "POST" });
        await failOnError(response);
        return await readJson<BlobResponse>(response);
    }
}
