import type {
    MosaicSource, Scene, SelectionAcross, TesseraSummary,
} from "./MosaicSource.ts";

/**
 * The viewer's questions, asked of a running `mosaic serve`.
 *
 * Every method here is one request to the endpoints the server already answers, so this
 * is a translation rather than an implementation: the work happens over there, against a
 * database, which is what lets the served viewer open an archive far larger than a browser
 * would care to hold.
 */
export class HttpSource implements MosaicSource {
    readonly kind = "server";

    private readonly fetch: typeof globalThis.fetch;

    constructor(readonly baseUrl = "", options: { fetch?: typeof globalThis.fetch } = {}) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    }

    private async call(path: string, init?: RequestInit): Promise<Response> {
        const response = await this.fetch(this.baseUrl + path, init);
        if (!response.ok) {
            const text = await response.text();
            let message = text;
            try {
                message = (JSON.parse(text) as { error?: string }).error ?? text;
            } catch {
                // Not JSON; what came back is the best message there is.
            }
            throw new Error(message || `${response.status} from the server`);
        }
        return response;
    }

    async tesserae(): Promise<TesseraSummary[]> {
        return await (await this.call("/app/tesserae")).json() as TesseraSummary[];
    }

    async glb(request: SelectionAcross): Promise<Uint8Array> {
        const response = await this.call("/app/glb", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                versions: request.versions,
                nodes: request.nodes ?? null,
                includeChildren: request.includeChildren ?? true,
                compose: request.compose ?? false,
                ...(request.componentTypes ? { componentTypes: request.componentTypes } : {}),
            }),
        });

        return new Uint8Array(await response.arrayBuffer());
    }

    async scene(request: SelectionAcross): Promise<Scene> {
        const query = new URLSearchParams({
            versions: request.versions.map(ref => ref.tesseraId + ":" + ref.versionId).join(","),
            compose: String(request.compose ?? false),
        });

        if (request.nodes && request.nodes.length > 0) query.set("nodes", request.nodes.join(","));
        if (request.includeChildren === false) query.set("children", "false");
        if (request.componentTypes) query.set("components", request.componentTypes.join(","));

        return await (await this.call("/app/scene?" + query)).json() as Scene;
    }

    async add(name: string, bytes: Uint8Array): Promise<TesseraSummary> {
        const response = await this.call("/app/upload?name=" + encodeURIComponent(name), {
            method: "POST",
            headers: { "content-type": "application/octet-stream" },
            // Copied rather than passed: a view onto a larger or shared buffer is not
            // something every fetch implementation will take, and a copy of it is.
            body: new Uint8Array(bytes),
        });

        const created = await response.json() as { tesseraId: string; versionId: string; name: string };
        return {
            id: created.tesseraId,
            name: created.name,
            versions: [{ versionId: created.versionId }],
        };
    }
}
