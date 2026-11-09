import fs from "node:fs";
import path from "node:path";
import { federate, LoadMosaicFile, WriteMosaicFile, MOSAIC_ARCHIVE_EXTENSION } from "mosaic-ts";

const COLLAPSE = "--collapse";

export const FEDERATE_USAGE =
    `mosaic federate <old${MOSAIC_ARCHIVE_EXTENSION}> <new${MOSAIC_ARCHIVE_EXTENSION}> [output${MOSAIC_ARCHIVE_EXTENSION}] [${COLLAPSE}]`;

async function load(file: string) {
    if (!fs.existsSync(file)) throw new Error(`File ${file} does not exist`);
    return LoadMosaicFile(new Uint8Array(fs.readFileSync(file)));
}

/** `scene/house-v2.tsr` -> `scene/house-v2.federated.tsr` */
function defaultOutput(newPath: string): string {
    const stem = path.basename(newPath).split(".")[0];
    return path.join(path.dirname(path.resolve(newPath)), `${stem}.federated${MOSAIC_ARCHIVE_EXTENSION}`);
}

/**
 * Layers one archive over another, as one archive.
 *
 * The new archive's sections go over the old one's, so where both say something about a
 * component the new archive wins -- which makes this how a diff from `mosaic diff` is
 * applied. Every section of both is kept, unless `--collapse` asks for only what is still
 * leading, with the rows nothing points at any more left behind.
 */
export async function runFederate(argv: string[]): Promise<void> {
    const [oldPath, newPath, outputPath] = argv.filter(arg => !arg.startsWith("--"));
    if (oldPath === undefined || newPath === undefined) throw new Error(`Usage: ${FEDERATE_USAGE}`);

    const collapse = argv.includes(COLLAPSE);
    const merged = federate(await load(oldPath), await load(newPath), !collapse);

    const target = path.resolve(outputPath ?? defaultOutput(newPath));
    const bytes = await WriteMosaicFile(merged);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);

    const sections = merged.index.sections;
    const nodes = new Set(sections.flatMap(section => section.nodes.map(node => node.id)));
    const rows = [...merged.serializedComponents.values()].reduce((sum, list) => sum + list.length, 0);

    console.log(`Federated: ${path.resolve(newPath)} over ${path.resolve(oldPath)}`);
    console.log();
    console.log(`Sections: ${sections.length}${collapse ? " (collapsed)" : ""}`);
    console.log(`Nodes: ${nodes.size}`);
    console.log(`Component rows: ${rows}`);
    if (merged.index.imports.length > 0) {
        console.log(`Imports: ${merged.index.imports.map(entry => entry.uri).join(", ")}`);
    }
    console.log();
    console.log(`Wrote ${bytes.byteLength} bytes to ${target}`);
}
