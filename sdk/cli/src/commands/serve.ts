import path from "node:path";

export const SERVE_USAGE = `mosaic serve <database.duckdb> [--port <n>] [--host <name>]`;

/** Reads the options serve takes, leaving the database path as the one positional. */
function readArgs(argv: string[]): { positional: string[]; port?: number; host?: string } {
    const positional: string[] = [];
    let port: number | undefined;
    let host: string | undefined;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        const value = (inline: string) => (arg.startsWith(inline) ? arg.slice(inline.length) : argv[++i]);

        if (arg === "--port" || arg.startsWith("--port=")) {
            const raw = value("--port=");
            if (raw === undefined || !/^\d+$/.test(raw)) throw new Error(`--port needs a number`);
            port = Number(raw);
        } else if (arg === "--host" || arg.startsWith("--host=")) {
            const raw = value("--host=");
            if (raw === undefined) throw new Error(`--host needs a name`);
            host = raw;
        } else if (!arg.startsWith("--")) {
            positional.push(arg);
        }
    }

    return { positional, ...(port !== undefined ? { port } : {}), ...(host !== undefined ? { host } : {}) };
}

/**
 * Serving needs DuckDB, which is a native module and so cannot be bundled into this
 * executable; it is loaded when the command runs, like composing a database.
 */
export async function runServe(argv: string[]): Promise<void> {
    const { positional, port, host } = readArgs(argv);
    const [database] = positional;
    if (database === undefined) throw new Error(`Usage: ${SERVE_USAGE}`);

    const { serve, unimplementedOperations, API_ROUTES } = await import("mosaic-ts/api");
    const server = await serve({ database: path.resolve(database), ...(port !== undefined ? { port } : {}), ...(host !== undefined ? { host } : {}) });

    console.log(`Serving the Mosaic API from ${path.resolve(database)}`);
    console.log(`Everything it holds, uploads included, is in that database.`);
    console.log();
    console.log(`Listening on ${server.url}`);
    console.log(`Open that in a browser to upload archives and look at them.`);
    console.log();
    console.log(`Routes (${API_ROUTES.length} in the spec):`);
    for (const route of API_ROUTES) {
        console.log(`  ${route.method.padEnd(6)} ${route.path}`);
    }

    const missing = unimplementedOperations();
    if (missing.length > 0) {
        console.log();
        console.log(`Not implemented: ${missing.join(", ")}`);
    }
    console.log();
    console.log(`The query API answers 501 for now.`);
    console.log(`Press Ctrl+C to stop.`);

    // Serving is the one command that does not finish on its own.
    await new Promise<void>(resolve => {
        const stop = () => {
            console.log();
            console.log(`Stopping...`);
            void server.close().then(resolve);
        };
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
    });
}
