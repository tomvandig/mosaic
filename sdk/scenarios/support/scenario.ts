import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { serve, MosaicApiClient, type RunningServer } from "mosaic-ts/api";

/**
 * What a scenario is given to work with: a folder of its own, and a server when it needs
 * one. Everything a scenario makes lives under that folder, and the folder goes away when
 * the scenario ends, whether it passed or not.
 */
export interface World {
    /** A folder that exists only for this run of this scenario. */
    readonly folder: string;

    /** A path inside that folder. Parent directories are created. */
    file(...parts: string[]): string;

    /** Writes a file inside the folder and returns its path. */
    write(name: string, contents: string | Uint8Array): string;

    /** Starts a server on a free port, storing its data in this scenario's folder. */
    startServer(): Promise<RunningServer>;

    /** A client for the server this scenario started. */
    client(): MosaicApiClient;
}

/**
 * Runs the body of a scenario.
 *
 * The name is the scenario's folder name, so a failure says which prose it came from. The
 * temporary folder and any server are cleaned up afterwards -- a scenario never leaves a
 * port held or a file behind.
 */
export async function runScenario(name: string, body: (world: World) => Promise<void>): Promise<void> {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), `mosaic-${name}-`));
    let server: RunningServer | undefined;

    const world: World = {
        folder,

        file(...parts) {
            const target = path.join(folder, ...parts);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            return target;
        },

        write(name, contents) {
            const target = world.file(name);
            fs.writeFileSync(target, contents);
            return target;
        },

        async startServer() {
            if (server) throw new Error(`This scenario has already started a server on ${server.url}`);
            server = await serve({ database: world.file("mosaic.duckdb") });
            return server;
        },

        client() {
            if (!server) throw new Error(`This scenario has not started a server yet`);
            return new MosaicApiClient(server.url);
        },
    };

    try {
        await body(world);
    } finally {
        if (server) await server.close();
        fs.rmSync(folder, { recursive: true, force: true });
    }
}
