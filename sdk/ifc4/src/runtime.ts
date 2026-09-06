import { createRequire } from "node:module";
import path from "node:path";

/**
 * Finds web-ifc at run time rather than at build time.
 *
 * The parser is a WebAssembly module, and the `.wasm` file beside it is located relative
 * to wherever the JavaScript was loaded from. Bundling the JavaScript into the CLI's
 * single-file executable would therefore break it -- the code would arrive but the wasm
 * would not, and the failure would come later and less clearly. So it is left out of the
 * bundle and looked up when a conversion actually needs it, the same way DuckDB is.
 */

/** The slice of the module this package uses. */
export interface WebIfcModule {
    IfcAPI: new () => WebIfcApi;
}

export interface WebIfcApi {
    Init(locateFile?: unknown, forceSingleThread?: boolean): Promise<void>;
    OpenModel(data: Uint8Array, settings?: Record<string, unknown>): number;
    CloseModel(modelID: number): void;
    [method: string]: any;
}

let loaded: WebIfcModule | undefined;

export async function webIfc(): Promise<WebIfcModule> {
    if (loaded) return loaded;

    const attempts: string[] = [];

    // Running from source, or from anywhere the module is on the normal resolution path.
    try {
        loaded = (await import("web-ifc")) as unknown as WebIfcModule;
        return loaded;
    } catch (error) {
        attempts.push(`import: ${message(error)}`);
    }

    // Bundled: nothing resolves relative to the bundle, so try the obvious places. Each
    // root is a directory; createRequire wants a file inside it to resolve from.
    const roots = [
        process.env.MOSAIC_WEBIFC,
        // Beside the bundle itself, which is where an npm install of the CLI puts it.
        process.argv[1] === undefined ? undefined : path.dirname(process.argv[1]),
        process.cwd(),
        path.dirname(process.execPath),
    ]
        .filter((root): root is string => typeof root === "string" && root.length > 0)
        .map(root => path.join(root, "index.js"));

    for (const root of roots) {
        try {
            const require = createRequire(path.resolve(root));
            loaded = require("web-ifc") as WebIfcModule;
            return loaded;
        } catch (error) {
            attempts.push(`${root}: ${message(error)}`);
        }
    }

    throw new Error(
        `Could not load web-ifc, which reading an IFC file needs.\n`
        + `Install it beside where you are running (npm install web-ifc), or point `
        + `MOSAIC_WEBIFC at a directory that has it.\n`
        + attempts.map(line => `  - ${line}`).join("\n"),
    );
}

function message(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    return text.split("\n")[0]!;
}
