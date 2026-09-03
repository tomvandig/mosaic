/**
 * Generates the TypeScript side of the HTTP API from the emitted OpenAPI document.
 *
 *   - MosaicApiTypes.ts   the models, through quicktype, as the file format does it
 *   - MosaicApiRoutes.ts  one entry per operation, so a server can be checked against
 *                         the spec rather than against a hand-written list
 *
 * Run it after `npm run compile-api-spec`.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const openApiPath = path.resolve(here, "..", "..", "..", "standard", "openapi.json");
const outputDir = path.resolve(here, "..", "..", "..", "sdk", "ts", "src", "api");

const document = JSON.parse(fs.readFileSync(openApiPath, "utf-8"));

// --- models ----------------------------------------------------------------
// quicktype reads draft-07 JSON Schema, where the definitions live under
// "definitions", so the components are rehomed there and the references follow. A root object naming each model makes quicktype
// emit all of them rather than only what one root reaches.
const schemas = JSON.parse(
    JSON.stringify(document.components?.schemas ?? {}).replaceAll("#/components/schemas/", "#/definitions/"),
);

/**
 * The emitted OpenAPI leaves objects open, as JSON Schema does by default, which would
 * give every generated type a catch-all index signature. They are sealed here for the
 * benefit of the TypeScript models only -- standard/openapi.json is left exactly as
 * TypeSpec wrote it.
 */
function seal(node) {
    if (Array.isArray(node)) return node.forEach(seal);
    if (!node || typeof node !== "object") return;

    if (node.type === "object") {
        const extra = node.additionalProperties;
        // `...Record<never>` emits `{ not: {} }`, which says the same thing as false but
        // which a code generator will not act on.
        const sealed = extra === undefined || (extra && typeof extra === "object" && "not" in extra);
        if (sealed) node.additionalProperties = false;
    }
    for (const value of Object.values(node)) seal(value);
}
seal(schemas);

const roots = Object.keys(schemas).sort();
const jsonSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "MosaicApiModels",
    type: "object",
    properties: Object.fromEntries(roots.map(name => [name, { $ref: `#/definitions/${name}` }])),
    definitions: schemas,
};

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mosaic-api-"));
const schemaFile = path.join(scratch, "models.schema.json");
fs.writeFileSync(schemaFile, JSON.stringify(jsonSchema, null, 2));

const generated = path.join(scratch, "MosaicApiTypes.ts");
// quicktype resolves references against the input path, and a Windows drive letter reads
// as a URL scheme to it, so it is run inside the scratch directory on relative names.
execFileSync("npx", ["quicktype", "-s", "schema", path.basename(schemaFile), "-l", "ts", "-o", path.basename(generated), "--just-types"], {
    cwd: scratch,
    stdio: "inherit",
    shell: process.platform === "win32",
});

// The root object only existed to pull every model in; the models themselves are the
// point, so the block that names them all comes back out, whatever quicktype called it.
let types = fs.readFileSync(generated, "utf-8")
    .replace(/export interface \w+ \{[^{}]*?BlobResponse\?:[\s\S]*?\n\}\n\n/, "");

types =
`// Generated from standard/openapi.json by src/schema/scripts/gen-api-sdk.mjs.
// Run "npm run gen-api-sdk" in src/schema after changing mosaic-api.tsp.
//
// Object schemas are sealed on the way through, so these types say exactly what each
// model holds rather than carrying an index signature apiece.

${types.trimStart()}`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "MosaicApiTypes.ts"), types);

// --- routes ----------------------------------------------------------------
const METHODS = ["get", "put", "post", "delete", "patch"];
const routes = [];

for (const [template, operations] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
        const operation = operations[method];
        if (!operation) continue;

        const parameters = [...(operations.parameters ?? []), ...(operation.parameters ?? [])];
        routes.push({
            operationId: operation.operationId,
            method: method.toUpperCase(),
            path: template,
            pathParameters: parameters.filter(p => p.in === "path").map(p => p.name),
            queryParameters: parameters.filter(p => p.in === "query").map(p => ({ name: p.name, required: !!p.required })),
            hasBody: !!operation.requestBody,
        });
    }
}

routes.sort((a, b) => a.operationId.localeCompare(b.operationId));

const routesFile = `// Generated from standard/openapi.json by src/schema/scripts/gen-api-sdk.mjs.
// Run "npm run gen-api-sdk" in src/schema after changing mosaic-api.tsp.

/** One operation of the API, as the spec declares it. */
export interface ApiRoute {
    operationId: string;
    method: "GET" | "PUT" | "POST" | "DELETE" | "PATCH";
    /** The path template, with {braces} around each path parameter. */
    path: string;
    pathParameters: string[];
    queryParameters: Array<{ name: string; required: boolean }>;
    hasBody: boolean;
}

/** Every operation in the spec. A server is complete when it handles all of them. */
export const API_ROUTES = ${JSON.stringify(routes, null, 4)} as const satisfies readonly ApiRoute[];

export type OperationId = (typeof API_ROUTES)[number]["operationId"];

/** The route for an operation, or undefined when the spec has no such operation. */
export function routeFor(operationId: string): ApiRoute | undefined {
    return API_ROUTES.find(route => route.operationId === operationId);
}
`;

fs.writeFileSync(path.join(outputDir, "MosaicApiRoutes.ts"), routesFile);
fs.rmSync(scratch, { recursive: true, force: true });

console.log(`wrote ${routes.length} routes and ${roots.length} models to ${outputDir}`);
