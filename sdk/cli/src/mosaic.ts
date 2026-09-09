import { runCodegen, CODEGEN_USAGE } from "./commands/codegen.js";
import { runPack, PACK_USAGE } from "./commands/pack.js";
import { runGltf, runGltfPack, GLTF_USAGE, GLTF_PACK_USAGE } from "./commands/gltf.js";
import { runIfc, runIfcPack, IFC_USAGE, IFC_PACK_USAGE } from "./commands/ifc.js";
import { runSvgPack, SVG_PACK_USAGE } from "./commands/svg.js";
import { runCompose, COMPOSE_USAGE } from "./commands/compose.js";
import { runServe, SERVE_USAGE } from "./commands/serve.js";

const VERSION = "0.1.0";

type Command = {
    readonly usage: string;
    readonly summary: string;
    readonly run: (argv: string[]) => Promise<void>;
};

const COMMANDS: Record<string, Command> = {
    codegen: {
        usage: CODEGEN_USAGE,
        summary: "Generate typed TypeScript or C# classes from *.schema.json files",
        run: runCodegen
    },
    pack: {
        usage: PACK_USAGE,
        summary: "Pack a Mosaic source document into a .tsr archive",
        run: runPack
    },
    gltf: {
        usage: GLTF_USAGE,
        summary: "Convert a glTF or GLB file into a Mosaic source document",
        run: runGltf
    },
    "gltf-pack": {
        usage: GLTF_PACK_USAGE,
        summary: "Convert a glTF or GLB file straight into a .tsr archive",
        run: runGltfPack
    },
    ifc: {
        usage: IFC_USAGE,
        summary: "Convert an IFC model into a Mosaic source document",
        run: runIfc
    },
    "ifc-pack": {
        usage: IFC_PACK_USAGE,
        summary: "Convert an IFC model straight into a .tsr archive",
        run: runIfcPack
    },
    "svg-pack": {
        usage: SVG_PACK_USAGE,
        summary: "Pack an SVG into a .tsr archive of one node",
        run: runSvgPack
    },
    compose: {
        usage: COMPOSE_USAGE,
        summary: "Compose an archive and its imports into a renderable .glb",
        run: runCompose
    },
    serve: {
        usage: SERVE_USAGE,
        summary: "Serve the Mosaic API over a database",
        run: runServe
    }
};

function printUsage(): void {
    console.log(`mosaic ${VERSION}`);
    console.log();
    console.log(`Usage: mosaic <command> [args...]`);
    console.log();
    console.log(`Commands:`);
    for (const [name, command] of Object.entries(COMMANDS)) {
        console.log(`  ${name.padEnd(10)} ${command.summary}`);
        console.log(`  ${" ".repeat(10)} ${command.usage}`);
    }
    console.log();
    console.log(`  help       Show this message`);
    console.log(`  version    Print the version`);
}

async function main(argv: string[]): Promise<void> {
    const [name, ...rest] = argv;

    if (name === undefined || name === "help" || name === "--help" || name === "-h") {
        printUsage();
        return;
    }

    if (name === "version" || name === "--version" || name === "-v") {
        console.log(VERSION);
        return;
    }

    const command = COMMANDS[name];

    if (command === undefined) {
        printUsage();
        console.log();
        throw new Error(`Unknown command "${name}"`);
    }

    await command.run(rest);
}

main(process.argv.slice(2)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
