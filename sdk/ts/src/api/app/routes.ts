import { randomUUID } from "node:crypto";
import { CreateTesseraVersionResponseState } from "../MosaicApiTypes.ts";
import { ApiStore, BadRequest } from "../Store.ts";
import { APP_PAGE } from "./page.ts";

/**
 * The endpoints the bundled page uses, which are not part of the API the spec describes.
 *
 * They are kept apart from it deliberately: `mosaic-api.tsp` is the contract, and the
 * routes generated from it are what the server answers on. These exist so the page can be
 * one page -- upload a file in a single call, and read a whole scene in another -- rather
 * than to add anything the API cannot already do. The 3D view goes through the real
 * `nodes` endpoint, since that is the thing being looked at.
 */

export interface AppReply {
    status?: number;
    json?: unknown;
    html?: string;
}

interface AppRequest {
    store: ApiStore;
    query: URLSearchParams;
    body: Buffer;
    baseUrl: string;
}

function required(query: URLSearchParams, name: string): string {
    const value = query.get(name);
    if (!value) throw new BadRequest(`${name} is required`);
    return value;
}

export const APP_HANDLERS: Record<string, (request: AppRequest) => Promise<AppReply>> = {
    /** The page itself. */
    async "GET /"() {
        return { html: APP_PAGE };
    },

    /** Everything on the server, with each tessera's versions, for the two pickers. */
    async "GET /app/tesserae"({ store }) {
        const tesserae = await store.listTesserae();

        return {
            json: await Promise.all(tesserae.map(async tessera => ({
                ...tessera,
                versions: (await store.versionsOf(tessera.id)).map(version => ({
                    versionId: version.versionId,
                    message: version.provenance.message,
                    author: version.provenance.author,
                })),
            }))),
        };
    },

    /**
     * Takes an uploaded archive and publishes it in one call: a tessera named after the
     * file, or a new version of one that already has that name.
     */
    async "POST /app/upload"({ store, query, body }) {
        if (body.byteLength === 0) throw new BadRequest(`Nothing was uploaded`);

        const name = (query.get("name") ?? "upload").replace(/\.tsr$/i, "");
        const existing = (await store.listTesserae()).find(tessera => tessera.name === name);

        const tesseraId = existing?.id ?? randomUUID();
        if (!existing) await store.createTessera({ id: tesseraId, name });

        const blobId = randomUUID();
        await store.reserveBlob(blobId, tesseraId);
        await store.writeBlob(blobId, body);

        const versionId = randomUUID();
        const created = await store.createVersion(tesseraId, {
            id: versionId,
            previousTesseraVersionId: await store.latestVersionId(tesseraId),
            blobId,
        });

        return {
            status: created.state === CreateTesseraVersionResponseState.Ok ? 200 : 400,
            json: { ...created, tesseraId, versionId, name },
        };
    },

    /**
     * A whole version as the page needs it: which nodes are roots, and for every node its
     * name, its children and its components.
     *
     * This is one selection over the roots with everything beneath them, so what the tree
     * shows is exactly what a fetch of those nodes would give -- the same call the 3D view
     * makes, read as data instead of as a file.
     */
    async "GET /app/scene"({ store, query }) {
        const tesseraId = required(query, "tesseraId");
        const versionId = required(query, "versionId");
        const compose = query.get("compose") === "true";

        const roots = await store.rootNodeIds(tesseraId, versionId);
        if (roots.length === 0) return { json: { roots: [], nodes: {} } };

        const selection = await store.selection(tesseraId, versionId, {
            nodes: roots,
            includeChildren: true,
            compose,
        });

        const file = selection.file;
        const nodes: Record<string, unknown> = {};

        for (const node of file.index.sections[0]?.nodes ?? []) {
            const components = (node.components ?? []).map(reference => {
                const index = reference.index ?? -1;
                return {
                    type: reference.type,
                    id: reference.id,
                    index,
                    value: index >= 0 ? JSON.parse(file.readRawComponent(reference.type, index)) : null,
                };
            });

            nodes[node.id] = {
                id: node.id,
                // A name is a value-less component, so the name is the reference id.
                name: components.find(component => component.type === "core::name")?.id ?? null,
                children: components.filter(component => component.type === "core::child").map(component => component.id),
                components,
            };
        }

        return { json: { roots: roots.filter(id => nodes[id] !== undefined), nodes } };
    },
};

/** The handler for a request the page made, if this is one. */
export function appHandlerFor(method: string, pathname: string) {
    return APP_HANDLERS[`${method} ${pathname === "/app" ? "/" : pathname}`];
}
