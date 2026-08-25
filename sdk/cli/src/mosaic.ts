import { runCodegen, CODEGEN_USAGE } from "./commands/codegen.js";
import { runPack, PACK_USAGE } from "./commands/pack.js";

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
