import http from "node:http";
import { randomUUID } from "node:crypto";
import { API_ROUTES, type ApiRoute } from "./MosaicApiRoutes.ts";
import { MosaicFileDownloadType, type CreateModelCommand, type CreateModelVersionCommand } from "./MosaicApiTypes.ts";
import { ApiStore, BadRequest, NotFound, blobResponse } from "./Store.ts";

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
        return { bytes: store.readBlob(params.blobId!), contentType: "application/octet-stream" };
    },

    // --- models -------------------------------------------------------------
    async Models_models({ store }) {
        return json(await store.listModels());
    },

    async Models_createModel(request) {
        await request.store.createModel(await readJson<CreateModelCommand>(request));
        return json({});
    },

    async ModelRoutes_get_model({ store, params }) {
        return json(await store.getModel(params.modelId!));
    },

    async ModelRoutes_delete_model({ store, params }) {
        await store.deleteModel(params.modelId!);
        return json({});
    },

    async ModelRoutes_uploadMosaicBlobUrl({ store, params, baseUrl }) {
        // The model has to exist, so that a client cannot reserve blobs against nothing.
        await store.getModel(params.modelId!);

        const blobId = randomUUID();
        await store.reserveBlob(blobId, params.modelId!);
        return json(blobResponse(blobId, baseUrl));
    },

    // --- versions -----------------------------------------------------------
    async VersionsRoutes_createModelVersion(request) {
        const command = await readJson<CreateModelVersionCommand>(request);
        return json(await request.store.createVersion(request.params.modelId!, command));
    },

    async ModelVersionRoutes_get_model_version({ store, params }) {
        return json(await store.getVersion(params.modelId!, params.versionId!));
    },

    async ModelVersionRoutes_model_Mosaic({ store, params, query, baseUrl }) {
        const asked = query.get("downloadType") ?? MosaicFileDownloadType.JustThisVersion;
        const known = Object.values(MosaicFileDownloadType) as string[];
        if (!known.includes(asked)) throw new BadRequest(`Unknown downloadType "${asked}"; expected one of ${known.join(", ")}`);

        const blobId = await store.materialiseDownload(params.modelId!, params.versionId!, asked as MosaicFileDownloadType);
        return json({ blobUrl: `${baseUrl}/Mosaic-api/download/${blobId}` });
    },

    // --- not yet ------------------------------------------------------------
    async ModelVersionRoutes_query() {
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
