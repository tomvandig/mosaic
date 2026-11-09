import fs from "node:fs";
import path from "node:path";
import {
    diffArchives,
    LoadMosaicFile,
    WriteMosaicFile,
    MOSAIC_ARCHIVE_EXTENSION,
    Operation,
    operationOf,
} from "mosaic-ts";

const NO_DELETES = "--no-deletes";
const MESSAGE = "--message=";

export const DIFF_USAGE =
    `mosaic diff <old${MOSAIC_ARCHIVE_EXTENSION}> <new${MOSAIC_ARCHIVE_EXTENSION}> [output${MOSAIC_ARCHIVE_EXTENSION}] [${NO_DELETES}] [${MESSAGE}<text>]`;

async function load(file: string) {
    if (!fs.existsSync(file)) throw new Error(`File ${file} does not exist`);
    return LoadMosaicFile(new Uint8Array(fs.readFileSync(file)));
}

/** `scene/house-v2.tsr` -> `scene/house-v2.diff.tsr` */
function defaultOutput(newPath: string): string {
    const stem = path.basename(newPath).split(".")[0];
    return path.join(path.dirname(path.resolve(newPath)), `${stem}.diff${MOSAIC_ARCHIVE_EXTENSION}`);
}

/**
 * Writes the changes between two archives as an archive of its own.
 *
 * Components are compared by what they hold, not by where in their tables they sit, so two
 * archives packed separately compare properly. The result is one section: every component
 * that is new or different in the new archive, and a DELETE for everything it no longer
 * has. Layered over the old archive, it reads the same as the new one.
 */
export async function runDiff(argv: string[]): Promise<void> {
    const [oldPath, newPath, outputPath] = argv.filter(arg => !arg.startsWith("--"));
    if (oldPath === undefined || newPath === undefined) throw new Error(`Usage: ${DIFF_USAGE}`);

    const deletes = !argv.includes(NO_DELETES);
    const message = argv.find(arg => arg.startsWith(MESSAGE))?.slice(MESSAGE.length)
        ?? `Changes from ${path.basename(oldPath)} to ${path.basename(newPath)}`;

    const diff = diffArchives(await load(oldPath), await load(newPath), { deletes, header: { message } });

    const target = path.resolve(outputPath ?? defaultOutput(newPath));
    const bytes = await WriteMosaicFile(diff);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);

    const nodes = diff.index.sections[0]?.nodes ?? [];
    const references = nodes.flatMap(node => node.components ?? []);
    const removed = references.filter(ref => operationOf(ref) === Operation.Delete).length;

    console.log(`Diffed: ${path.resolve(oldPath)} -> ${path.resolve(newPath)}`);
    console.log();
    if (nodes.length === 0) {
        console.log(`No changes.`);
    } else {
        console.log(`Nodes changed: ${nodes.length}`);
        console.log(`Components set: ${references.length - removed}`);
        if (deletes) console.log(`Components deleted: ${removed}`);
    }
    console.log();
    console.log(`Wrote ${bytes.byteLength} bytes to ${target}`);
}
