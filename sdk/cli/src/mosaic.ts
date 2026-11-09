import { runCodegen, CODEGEN_USAGE } from "./commands/codegen.js";
import { runPack, PACK_USAGE, PACK_DETAILS } from "./commands/pack.js";
import { runCompose, COMPOSE_USAGE } from "./commands/compose.js";
import { runDiff, DIFF_USAGE } from "./commands/diff.js";
import { runServe, SERVE_USAGE } from "./commands/serve.js";

/** Stamped in by the build from package.json. */
declare const MOSAIC_CLI_VERSION: string | undefined;
const VERSION = typeof MOSAIC_CLI_VERSION === "string" ? MOSAIC_CLI_VERSION : "dev";

type Command = {
    readonly usage: string;
    /** More lines printed under the usage, when there is more to say. */
    readonly details?: readonly string[];
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
        details: PACK_DETAILS,
        summary: "Pack a source document, glTF, IFC or SVG into a .tsr archive (or a .mosaic.json)",
        run: runPack
    },
    diff: {
        usage: DIFF_USAGE,
        summary: "Write the changes between two archives as an archive of their own",
        run: runDiff
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
        for (const line of command.details ?? []) console.log(`  ${" ".repeat(12)} ${line}`);
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
