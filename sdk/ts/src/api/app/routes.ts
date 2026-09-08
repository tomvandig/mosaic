import { randomUUID } from "node:crypto";
import { CreateTesseraVersionResponseState, NodeFetchFormat } from "../MosaicApiTypes.ts";
import { ApiStore, BadRequest, type VersionRef } from "../Store.ts";
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
    bytes?: Buffer;
    contentType?: string;
    headers?: Record<string, string>;
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

/**
 * The versions a request is about: `versions=tessera:version,tessera:version`.
 *
 * A single pair may also be given as `tesseraId` and `versionId`, which is the same
 * request with one version in it.
 */
/** A comma-separated query parameter, as a list; absent and empty both mean "no list". */
function listIn(query: URLSearchParams, name: string): string[] | undefined {
    const raw = query.get(name);
    if (raw === null) return undefined;

    const items = raw.split(",").map(entry => entry.trim()).filter(entry => entry.length > 0);
    return items.length > 0 ? items : undefined;
}

function versionsIn(query: URLSearchParams): VersionRef[] {
    const listed = query.get("versions");
    if (!listed) return [{ tesseraId: required(query, "tesseraId"), versionId: required(query, "versionId") }];

    const refs = listed.split(",").map(entry => entry.trim()).filter(entry => entry.length > 0).map(entry => {
        const [tesseraId, versionId] = entry.split(":");
        if (!tesseraId || !versionId) throw new BadRequest(`"${entry}" is not a tessera:version pair`);
        return { tesseraId, versionId };
    });

    if (refs.length === 0) throw new BadRequest(`versions is empty`);
    return refs;
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
     * A scene as the page needs it: which nodes are roots, and for every node its name,
     * its children and its components.
     *
     * Several versions can be asked for at once, and whatever they import comes with
     * them, so this is one selection over everything on show. A child reference that
     * leaves one tessera and lands in another is therefore an ordinary link here: the
     * node it names is in the answer, marked with the tessera it is written in.
     *
     * Three optional parameters decide how much of it comes back, because "the whole
     * scene" is rarely what is wanted:
     *
     * - `components` names the component types to keep. A tree needs a node's name and
     *   its children and nothing else, and asking for only those is the difference
     *   between reading every property set in the building and reading none of them.
     * - `nodes` asks about particular nodes instead of the roots, which is how one node's
     *   components are fetched when someone selects it.
     * - `children=false` stops the answer descending, for that same one-node case.
     *
     * Left out, all three keep the old behaviour: every root, everything beneath it, and
     * every component those nodes carry.
     */
    async "GET /app/scene"({ store, query }) {
        const refs = versionsIn(query);
        const compose = query.get("compose") === "true";
        const componentTypes = listIn(query, "components");
        const includeChildren = query.get("children") !== "false";

        const scope = await store.resolveScope(refs);
        const asked = listIn(query, "nodes");

        // Roots are only worked out when the answer is about the roots; asking for named
        // nodes skips that query rather than paying for an answer nobody reads.
        const roots = asked ? [] : await store.rootsAcross(refs, scope);
        const seeds = asked ?? roots.flatMap(entry => entry.nodes);

        const versions = roots.map(entry => ({
            tesseraId: entry.tesseraId,
            versionId: entry.versionId,
            name: entry.name,
            roots: entry.nodes,
        }));

        // What is here only because something imports it, said so the page can show that
        // a tessera on screen brought others along.
        const imported = scope.entries
            .filter(entry => entry.imported)
            .map(entry => ({ tesseraId: entry.tesseraId, versionId: entry.versionId, name: entry.name }));

        if (seeds.length === 0) {
            return { json: { versions, imported, roots: [], nodes: {}, warnings: scope.warnings } };
        }

        const selection = await store.selectionAcross(refs, {
            nodes: seeds,
            includeChildren,
            compose,
            ...(componentTypes ? { componentTypes } : {}),
        }, scope);

        const file = selection.file;
        const nodes: Record<string, unknown> = {};

        // Which tessera each node is written in, which is what a link between two of them
        // looks like from here.
        const written = file.index.sections[0]?.nodes.map(node => node.id) ?? [];
        const origins = await store.originsOf(scope.entries.map(entry => entry.fileId), written);
        const ofFile = new Map(scope.entries.map(entry => [entry.fileId, entry]));

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

            const origin = ofFile.get(origins.get(node.id) ?? "");

            nodes[node.id] = {
                id: node.id,
                // A name is a value-less component, so the name is the reference id.
                name: components.find(component => component.type === "core::name")?.id ?? null,
                children: components.filter(component => component.type === "core::child").map(component => component.id),
                components,
                tessera: origin?.name ?? null,
                tesseraId: origin?.tesseraId ?? null,
                versionId: origin?.versionId ?? null,
            };
        }

        return {
            json: {
                versions: versions.map(version => ({
                    ...version,
                    roots: version.roots.filter(id => nodes[id] !== undefined),
                })),
                imported,
                roots: seeds.filter(id => nodes[id] !== undefined),
                nodes,
                warnings: scope.warnings,
            },
        };
    },

    /**
     * A glb of some nodes taken from several versions at once.
     *
     * The single-version case goes through the API's own `nodes` endpoint, which is the
     * thing being looked at and is left to answer for itself. This exists for the case
     * that endpoint cannot express: one view over more than one tessera, which is a
     * question about a set of versions rather than about one of them.
     */
    async "POST /app/glb"({ store, body }) {
        if (body.byteLength === 0) throw new BadRequest(`This request needs a JSON body`);

        let asked: {
            versions?: VersionRef[]; nodes?: string[] | null; compose?: boolean;
            includeChildren?: boolean; componentTypes?: string[];
        };
        try {
            asked = JSON.parse(body.toString("utf-8"));
        } catch (error) {
            throw new BadRequest(`The body is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (!Array.isArray(asked?.versions) || asked.versions.length === 0) {
            throw new BadRequest(`A glb needs a "versions" array with at least one tessera and version`);
        }
        // No nodes named means everything on show. The page asks that way because it has
        // not read the archive yet -- the glb is what tells it where the trees start, so it
        // cannot name the roots in the request that fetches them.
        const scope = await store.resolveScope(asked.versions);
        const nodes = Array.isArray(asked.nodes) && asked.nodes.length > 0
            ? asked.nodes
            : (await store.rootsAcross(asked.versions, scope)).flatMap(entry => entry.nodes);

        if (nodes.length === 0) {
            throw new BadRequest(`Nothing to build a glb from: no nodes were named and the versions have no roots`);
        }

        const built = await store.buildNodes(asked.versions, NodeFetchFormat.Glb, {
            nodes,
            includeChildren: asked.includeChildren ?? true,
            compose: asked.compose ?? false,
            // A glb only has somewhere to put the glTF components and a transform; the
            // rest travels as extension data on the node, which is most of the bytes of a
            // converted building. A caller that only wants to look at it says so here.
            ...(Array.isArray(asked.componentTypes) ? { componentTypes: asked.componentTypes } : {}),
        });

        return {
            bytes: Buffer.from(built.bytes),
            contentType: built.contentType,
            headers: {
                "x-mosaic-nodes": String(built.nodeCount),
                ...(built.meshCount !== undefined ? { "x-mosaic-meshes": String(built.meshCount) } : {}),
            },
        };
    },
};

/** The handler for a request the page made, if this is one. */
export function appHandlerFor(method: string, pathname: string) {
    return APP_HANDLERS[`${method} ${pathname === "/app" ? "/" : pathname}`];
}
