import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MosaicFile, WriteMosaicFile, LoadMosaicFile } from "../src/MosaicFile.ts";
import { Convert, type MosaicIndexFile } from "../src/MosaicIndexFile.ts";

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "test-data");

interface Fixture {
    description: string;
    components: Record<string, unknown[]>;
    index: MosaicIndexFile;
}

/** Reads a *.mosaic.json example and inlines the schema documents it points at. */
function readFixture(name: string): Fixture {
    const fixture = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.mosaic.json`), "utf-8")) as Fixture;

    for (const table of fixture.index.componentTables) {
        if (typeof table.schema === "string") {
            table.schema = JSON.parse(fs.readFileSync(path.join(DATA_DIR, table.schema), "utf-8"));
        }
    }

    return fixture;
}

export function readSchema(name: string): string {
    return fs.readFileSync(path.join(DATA_DIR, "schemas", `${name}.schema.json`), "utf-8");
}

/**
 * Builds the in-memory MosaicFile an example describes, then runs it through the real
 * write/read path so every test starts from a file that was actually parsed off bytes.
 */
export async function loadExample(name: string): Promise<MosaicFile> {
    const fixture = readFixture(name);

    const staged = new MosaicFile();
    // Round-trip the index through Convert so a malformed example fails loudly here
    // rather than as a confusing assertion further down.
    staged.index = Convert.toMosaicIndexFile(JSON.stringify(fixture.index));

    for (const [typeID, rows] of Object.entries(fixture.components)) {
        for (const row of rows) {
            staged.addSerializedComponent(typeID, JSON.stringify(row));
        }
    }

    return await LoadMosaicFile(await WriteMosaicFile(staged));
}

/** Resolves a component reference to the parsed row it points at. */
export function resolve(file: MosaicFile, typeID: string, componentIndex: number): unknown {
    return JSON.parse(file.readRawComponent(typeID, componentIndex));
}
