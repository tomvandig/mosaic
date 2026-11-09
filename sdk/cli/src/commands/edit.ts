import { spawn } from "node:child_process";

const NO_OPEN = "--no-open";

export const EDIT_USAGE = `mosaic edit <model.glb|.gltf|.tsr> [--port <n>] [${NO_OPEN}]`;

/** Opens a url in the default browser, without waiting for it or failing if it cannot. */
function openBrowser(url: string): void {
    const [command, args] =
        process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
        : process.platform === "darwin" ? ["open", [url]]
        : ["xdg-open", [url]];
    try {
        spawn(command, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
    } catch {
        // No browser to open is not an error: the url is printed either way.
    }
}

/**
 * Opens a model in the browser to edit it, and writes it back when asked.
 *
 * The model is converted to a Mosaic archive if it is a glTF, and shown in the viewer with
 * its files open for editing. The page's Save .tsr saves the edited archive and Export .glb
 * composes it into a glb, each asking where in the browser's save dialog.
 */
export async function runEdit(argv: string[]): Promise<void> {
    const positional: string[] = [];
    let port: number | undefined;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === "--port" || arg.startsWith("--port=")) {
            const raw = arg.startsWith("--port=") ? arg.slice("--port=".length) : argv[++i];
            if (raw === undefined || !/^\d+$/.test(raw)) throw new Error(`--port needs a number`);
            port = Number(raw);
        } else if (!arg.startsWith("--")) {
            positional.push(arg);
        }
    }

    const [input] = positional;
    if (input === undefined) throw new Error(`Usage: ${EDIT_USAGE}`);

    const { serveEditor } = await import("mosaic-ts/edit");
    console.log(`Reading ${input}...`);
    const server = await serveEditor({ input, ...(port !== undefined ? { port } : {}) });

    console.log();
    console.log(`Editing at ${server.url}`);
    console.log();
    console.log(`  Save .tsr and Export .glb ask where to save (suggesting ${server.tsr} and ${server.glb}).`);
    console.log();
    console.log(`The page needs internet for three.js and the code editor. Press Ctrl+C to stop.`);

    if (!argv.includes(NO_OPEN)) openBrowser(server.url);

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
