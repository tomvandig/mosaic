import http from "node:http";
import { randomUUID } from "node:crypto";
import { API_ROUTES, type ApiRoute } from "./MosaicApiRoutes.ts";
import {
    MosaicFileDownloadType, NodeFetchFormat,
    type CreateTesseraCommand, type CreateTesseraVersionCommand, type NodeFetchRequest,
} from "./MosaicApiTypes.ts";
import { ApiStore, BadRequest, NotFound, blobResponse } from "./Store.ts";
import { appHandlerFor } from "./app/routes.ts";

export interface ServeOptions {
    /** Where the database lives. Created if it is not there. */
    database: string;
    port?: number;
    host?: string;
}

export interface RunningServer {
    url: string;
    port: number;
    store: ApiStore;
    close(): Promise<void>;
}

/** What a handler is given, once the path has been matched and the body read. */
interface Request {
    store: ApiStore;
    params: Record<string, string>;
    query: URLSearchParams;
    body: Buffer;
    baseUrl: string;
}

/** What a handler answers with. A Buffer body is sent as it is. */
interface Reply {
    status?: number;
    json?: unknown;
    bytes?: Buffer;
    contentType?: string;
    headers?: Record<string, string>;
}

type Handler = (request: Request) => Promise<Reply>;

function json(body: unknown, status = 200): Reply {
    return { status, json: body };
}

async function readJson<T>(request: Request): Promise<T> {
    if (request.body.byteLength === 0) throw new BadRequest(`This request needs a JSON body`);
    try {
        return JSON.parse(request.body.toString("utf-8")) as T;
    } catch (error) {
        throw new BadRequest(`The body is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * One handler per operation in the spec.
 *
 * The keys are operation ids from the generated route table, so an operation that is added
 * to mosaic-api.tsp and regenerated shows up here as a missing key rather than as a route
 * nobody noticed. The query operation is the exception, and answers 501 on purpose.
 */
const HANDLERS: Record<string, Handler> = {
    // --- blobs --------------------------------------------------------------
    async upload({ store, params, body }) {
        if (body.byteLength === 0) throw new BadRequest(`An upload needs a body`);
        await store.writeBlob(params.blobId!, body);
        return json({});
    },

    async download({ store, params }) {
        return { bytes: await store.readBlob(params.blobId!), contentType: "application/octet-stream" };
    },

    // --- tesserae -------------------------------------------------------------
    async Tesserae_tesserae({ store }) {
        return json(await store.listTesserae());
    },

    async Tesserae_createTessera(request) {
        await request.store.createTessera(await readJson<CreateTesseraCommand>(request));
        return json({});
    },

    async TesseraRoutes_get_tessera({ store, params }) {
        return json(await store.getTessera(params.tesseraId!));
    },

    async TesseraRoutes_delete_tessera({ store, params }) {
        await store.deleteTessera(params.tesseraId!);
        return json({});
    },

    async TesseraRoutes_uploadMosaicBlobUrl({ store, params, baseUrl }) {
        // The tessera has to exist, so that a client cannot reserve blobs against nothing.
        await store.getTessera(params.tesseraId!);

        const blobId = randomUUID();
        await store.reserveBlob(blobId, params.tesseraId!);
        return json(blobResponse(blobId, baseUrl));
    },

    // --- versions -----------------------------------------------------------
    async VersionsRoutes_createTesseraVersion(request) {
        const command = await readJson<CreateTesseraVersionCommand>(request);
        return json(await request.store.createVersion(request.params.tesseraId!, command));
    },

    async TesseraVersionRoutes_get_tessera_version({ store, params }) {
        return json(await store.getVersion(params.tesseraId!, params.versionId!));
    },

    async TesseraVersionRoutes_tessera_Mosaic({ store, params, query, baseUrl }) {
        const asked = query.get("downloadType") ?? MosaicFileDownloadType.JustThisVersion;
        const known = Object.values(MosaicFileDownloadType) as string[];
        if (!known.includes(asked)) throw new BadRequest(`Unknown downloadType "${asked}"; expected one of ${known.join(", ")}`);

        const blobId = await store.materialiseDownload(params.tesseraId!, params.versionId!, asked as MosaicFileDownloadType);
        return json({ blobUrl: `${baseUrl}/Mosaic-api/download/${blobId}` });
    },

    async TesseraVersionRoutes_fetchNodes(request) {
        const asked = request.query.get("format") ?? NodeFetchFormat.Glb;
        const known = Object.values(NodeFetchFormat) as string[];
        if (!known.includes(asked)) throw new BadRequest(`Unknown format "${asked}"; expected one of ${known.join(", ")}`);

        const body = await readJson<NodeFetchRequest>(request);
        if (!Array.isArray(body?.nodes) || body.nodes.length === 0) {
            throw new BadRequest(`Fetching nodes needs a "nodes" array with at least one id`);
        }

        const built = await request.store.fetchNodes(
            request.params.tesseraId!, request.params.versionId!, asked as NodeFetchFormat,
            {
                nodes: body.nodes,
                ...(body.componentTypes ? { componentTypes: body.componentTypes } : {}),
                ...(body.includeChildren !== undefined ? { includeChildren: body.includeChildren } : {}),
                ...(body.compose !== undefined ? { compose: body.compose } : {}),
            });

        // The bytes are the answer; what was left out is said in a header, so a client
        // that asked for a node the version does not have can tell.
        return {
            bytes: Buffer.from(built.bytes),
            contentType: built.contentType,
            headers: {
                "x-mosaic-nodes": String(built.nodeCount),
                ...(built.meshCount !== undefined ? { "x-mosaic-meshes": String(built.meshCount) } : {}),
                ...(built.missing.length > 0 ? { "x-mosaic-missing": built.missing.join(",") } : {}),
            },
        };
    },

    // --- not yet ------------------------------------------------------------
    async TesseraVersionRoutes_query() {
        return json({ error: "The query API is not implemented yet" }, 501);
    },
};

/** The operations in the spec that nothing here answers. */
export function unimplementedOperations(): string[] {
    return API_ROUTES.filter(route => HANDLERS[route.operationId] === undefined).map(route => route.operationId);
}

/** Turns a path template into something that can be matched, keeping the parameter names. */
function matcher(route: ApiRoute): { pattern: RegExp; names: string[] } {
    const names: string[] = [];
    const pattern = route.path.replace(/\{(\w+)\}/g, (_, name: string) => {
        names.push(name);
        return "([^/]+)";
    });

    return { pattern: new RegExp(`^${pattern}$`), names };
}

const MATCHERS = API_ROUTES.map(route => ({ route, ...matcher(route) }));

function statusFor(error: unknown): number {
    if (error instanceof NotFound) return 404;
    if (error instanceof BadRequest) return 400;
    return 500;
}

async function readBody(message: http.IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of message) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
}

/**
 * Serves the Mosaic API out of a DuckDB database.
 *
 * Routing is driven by the generated table rather than written out here, so the paths the
 * server answers on are the paths the spec declares, down to the braces.
 */
export async function serve(options: ServeOptions): Promise<RunningServer> {
    const store = await ApiStore.open(options.database);
    const host = options.host ?? "127.0.0.1";

    const server = http.createServer((incoming, response) => {
        void (async () => {
            const url = new URL(incoming.url ?? "/", `http://${incoming.headers.host ?? `${host}:${options.port ?? 0}`}`);
            const baseUrl = `http://${incoming.headers.host ?? `${host}:${options.port ?? 0}`}`;

            const app = appHandlerFor(incoming.method ?? "GET", url.pathname);
            if (app) {
                try {
                    const reply = await app({ store, query: url.searchParams, body: await readBody(incoming), baseUrl });

                    if (reply.bytes) {
                        response.writeHead(reply.status ?? 200, {
                            "content-type": reply.contentType ?? "application/octet-stream",
                            "content-length": String(reply.bytes.byteLength),
                            ...reply.headers,
                        });
                        return response.end(reply.bytes);
                    }

                    if (reply.html !== undefined) {
                        response.writeHead(reply.status ?? 200, {
                            "content-type": "text/html; charset=utf-8",
                            "content-length": String(Buffer.byteLength(reply.html)),
                        });
                        return response.end(reply.html);
                    }

                    return send(response, reply.status ?? 200, reply.json ?? {});
                } catch (error) {
                    return send(response, statusFor(error), { error: error instanceof Error ? error.message : String(error) });
                }
            }

            const found = MATCHERS
                .map(entry => ({ entry, match: entry.pattern.exec(url.pathname) }))
                .find(candidate => candidate.match !== null && candidate.entry.route.method === incoming.method);

            if (!found) {
                const pathExists = MATCHERS.some(entry => entry.pattern.test(url.pathname));
                return send(response, pathExists ? 405 : 404, {
                    error: pathExists ? `${incoming.method} is not allowed on ${url.pathname}` : `No route for ${url.pathname}`,
                });
            }

            const handler = HANDLERS[found.entry.route.operationId];
            if (!handler) return send(response, 501, { error: `${found.entry.route.operationId} is not implemented` });

            const params = Object.fromEntries(
                found.entry.names.map((name, index) => [name, decodeURIComponent(found.match![index + 1]!)]));

            try {
                const reply = await handler({ store, params, query: url.searchParams, body: await readBody(incoming), baseUrl });

                if (reply.bytes) {
                    response.writeHead(reply.status ?? 200, {
                        "content-type": reply.contentType ?? "application/octet-stream",
                        "content-length": String(reply.bytes.byteLength),
                        ...reply.headers,
                    });
                    return response.end(reply.bytes);
                }

                return send(response, reply.status ?? 200, reply.json ?? {});
            } catch (error) {
                return send(response, statusFor(error), { error: error instanceof Error ? error.message : String(error) });
            }
        })();
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(options.port ?? 0, host, resolve);
    });

    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : (options.port ?? 0);

    return {
        url: `http://${host}:${port}`,
        port,
        store,
        async close() {
            await new Promise<void>(resolve => server.close(() => resolve()));
            await store.close();
        },
    };
}

function send(response: http.ServerResponse, status: number, body: unknown): void {
    const text = JSON.stringify(body);
    response.writeHead(status, { "content-type": "application/json", "content-length": String(Buffer.byteLength(text)) });
    response.end(text);
}
