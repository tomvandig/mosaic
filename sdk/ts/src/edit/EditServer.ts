import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { LoadMosaicFile, MosaicFile, WriteMosaicFile } from "../MosaicFile.ts";
import { Convert } from "../MosaicIndexFile.ts";
import { packMosaicSource } from "../MosaicPack.ts";
import { MOSAIC_ARCHIVE_EXTENSION } from "../MosaicPackFs.ts";
import { convertGltfFile } from "../gltf/GltfConvertFs.ts";
import { mosaicToGltf } from "../composition/MosaicToGltf.ts";
import { writeGlb } from "../composition/GlbWriter.ts";
import { EDIT_PAGE } from "./page.ts";

export interface EditOptions {
    /** The model to edit: a .glb, a .gltf, or a .tsr. */
    input: string;
    /** The name the save dialog suggests for Save .tsr. By default `<stem>.tsr`. */
    tsr?: string;
    /** The name the save dialog suggests for Export .glb. By default `<stem>.edited.glb`. */
    glb?: string;
    port?: number;
    host?: string;
}

export interface EditServer {
    url: string;
    /** The file names the two buttons suggest when they ask where to save. */
    tsr: string;
    glb: string;
    close(): Promise<void>;
}

/** What a model becomes for editing: a .tsr's bytes, converting a glTF first. */
async function archiveOf(input: string): Promise<Uint8Array> {
    if (!fs.existsSync(input)) throw new Error(`File ${input} does not exist`);
    const extension = path.extname(input).toLowerCase();

    if (extension === MOSAIC_ARCHIVE_EXTENSION) return new Uint8Array(fs.readFileSync(input));
    if (extension === ".glb" || extension === ".gltf") {
        // Stable ids, so editing the same model twice names its nodes the same way twice.
        const { document } = convertGltfFile(input, { stableIds: true });
        return packMosaicSource(document);
    }
    throw new Error(`Cannot edit ${input}: "${extension}" is not a .glb, .gltf or ${MOSAIC_ARCHIVE_EXTENSION}`);
}

/** An archive from the files the page sends: `index.json` and one `.ndjson` per type. */
function fileFrom(files: Record<string, string>): MosaicFile {
    const index = files["index.json"];
    if (index === undefined) throw new Error("an archive needs an index.json");

    const file = new MosaicFile();
    file.index = Convert.toMosaicIndexFile(index);
    for (const [name, text] of Object.entries(files)) {
        if (name.endsWith(".ndjson")) file.serializedComponents.set(name.replace(/\.ndjson$/, ""), text.split("\n"));
    }
    return file;
}

function readBody(request: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        request.on("data", chunk => chunks.push(chunk));
        request.on("end", () => resolve(Buffer.concat(chunks)));
        request.on("error", reject);
    });
}

/**
 * Serves one model for editing in the browser.
 *
 * The page is the viewer with its Files drawer open. Edits are made there, against the
 * archive the page holds; the server only hears about them when the page asks for a file
 * to save: `POST /edit/build?format=tsr` packs the archive, `format=glb` composes it, and
 * either way the bytes go back to the page, which asks the user where to save them. What
 * was last built is also what a reload of the page reads, so a refresh does not throw the
 * work away.
 *
 * It listens on the loopback address by default, and writes nothing to disk: where a
 * file goes is the user's choice, made in the browser's save dialog.
 */
export async function serveEditor(options: EditOptions): Promise<EditServer> {
    const input = path.resolve(options.input);
    const stem = path.basename(input).split(".")[0]!;
    const tsr = options.tsr ?? stem + MOSAIC_ARCHIVE_EXTENSION;
    const glb = options.glb ?? `${stem}.edited.glb`;

    let archive = await archiveOf(input);
    const session = JSON.stringify({ name: stem, tsr, glb });

    const server = http.createServer(async (request, response) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        const reply = (status: number, body: string | Uint8Array, type: string) => {
            response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
            response.end(body);
        };
        const json = (status: number, value: unknown) => reply(status, JSON.stringify(value), "application/json");

        try {
            if (request.method === "GET" && url.pathname === "/") return reply(200, EDIT_PAGE, "text/html; charset=utf-8");
            if (request.method === "GET" && url.pathname === "/edit/session") return reply(200, session, "application/json");
            if (request.method === "GET" && url.pathname === "/edit/archive.tsr") return reply(200, archive, "application/zip");

            if (request.method === "POST" && url.pathname === "/edit/build") {
                const format = url.searchParams.get("format");
                if (format !== "tsr" && format !== "glb") return json(400, { error: "format must be tsr or glb" });

                const { files } = JSON.parse((await readBody(request)).toString("utf-8")) as { files: Record<string, string> };
                const file = fileFrom(files);

                // Kept either way, so a reload of the page comes back to these edits.
                archive = await WriteMosaicFile(file);

                if (format === "tsr") return reply(200, archive, "application/zip");

                const composed = mosaicToGltf(file);
                for (const warning of composed.warnings) console.log(`  ! ${warning}`);
                response.writeHead(200, {
                    "content-type": "model/gltf-binary",
                    "cache-control": "no-store",
                    "x-mosaic-warnings": String(composed.warnings.length),
                });
                return response.end(writeGlb(composed.document, composed.binary));
            }

            json(404, { error: "not found" });
        } catch (error) {
            json(500, { error: error instanceof Error ? error.message : String(error) });
        }
    });

    const host = options.host ?? "127.0.0.1";
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(options.port ?? 0, host, () => resolve());
    });

    const address = server.address();
    const port = typeof address === "object" && address ? address.port : options.port;

    return {
        url: `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}/`,
        tsr,
        glb,
        close: () => new Promise<void>(resolve => server.close(() => resolve())),
    };
}
