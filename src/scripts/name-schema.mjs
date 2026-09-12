/**
 * Gives the emitted JSON Schema the name it is published under.
 *
 * `@typespec/json-schema` names each file after the model it came from, and offers no
 * way to say otherwise short of bundling, which changes the shape of the document. So
 * the emitter writes `MosaicIndexFile.json` and this moves it to
 * `mosaic-index-file.schema.json` -- the name the spec already declares as its `$id`, and
 * the name everything downstream reads.
 *
 * Runs as the second half of `npm run compile-json-spec`. A file left under the old name
 * would be a stale copy waiting to be read by mistake, so it does not stay.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const standard = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "standard");

const emitted = path.join(standard, "MosaicIndexFile.json");
const published = path.join(standard, "mosaic-index-file.schema.json");

if (!fs.existsSync(emitted)) {
    throw new Error(`the emitter did not write ${emitted}; was tsp compile run first?`);
}

const schema = JSON.parse(fs.readFileSync(emitted, "utf-8"));
const wanted = path.basename(published);
if (schema.$id !== wanted) {
    throw new Error(`the schema's $id is "${schema.$id}" but it is published as "${wanted}"; `
        + `set @id("${wanted}") on the root model in mosaic-json-file.tsp`);
}

fs.renameSync(emitted, published);
console.log(`${path.basename(emitted)} -> ${wanted}`);
