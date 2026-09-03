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
execFileSync("npx", ["quicktype", "-s", "schema", path.basename(schemaFile), "-l", "ts", "-o", path.basename(generated),
     "--just-types", "--acronym-style", "original"], {
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

// --- client ----------------------------------------------------------------
// One method per operation, with the same names, paths and types the spec declares, so
// the client cannot drift from the server: both are generated from this document.

/** `TesseraRoutes_get_tessera` -> `getTessera`; the prefix is the TypeSpec namespace. */
function methodName(operationId) {
    const withoutNamespace = operationId.includes("_") ? operationId.slice(operationId.indexOf("_") + 1) : operationId;
    return withoutNamespace.replace(/_(\w)/g, (_, letter) => letter.toUpperCase());
}

/** The TypeScript type for a schema the spec points at. */
function typeOf(schema) {
    if (!schema) return "void";
    if (schema.$ref) {
        const name = schema.$ref.replace("#/components/schemas/", "");
        // uuid is a scalar, not a model: it is a string wherever it appears.
        return name === "uuid" ? "string" : name;
    }
    if (schema.type === "array") return `${typeOf(schema.items)}[]`;
    if (schema.format === "binary") return "Uint8Array";
    if (schema.type === "integer" || schema.type === "number") return "number";
    if (schema.type === "boolean") return "boolean";
    if (schema.type === "string") return "string";
    return "unknown";
}

function bodyOf(operation) {
    const content = operation.requestBody?.content ?? {};
    const json = content["application/json"];
    if (json) return { type: typeOf(json.schema), binary: false };

    const any = Object.values(content)[0];
    return any ? { type: typeOf(any.schema), binary: true } : undefined;
}

function responseOf(operation) {
    const ok = operation.responses?.["200"] ?? operation.responses?.["204"];
    const content = ok?.content ?? {};
    const json = content["application/json"];
    if (json) return { type: typeOf(json.schema), binary: false };

    const any = Object.values(content)[0];
    if (any) return { type: typeOf(any.schema), binary: true };
    return { type: "void", binary: false };
}

const methods = [];
const usedNames = new Set();

for (const [template, operations] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
        const operation = operations[method];
        if (!operation) continue;

        const name = methodName(operation.operationId);
        if (usedNames.has(name)) throw new Error(`Two operations both generate the method "${name}"`);
        usedNames.add(name);

        const parameters = [...(operations.parameters ?? []), ...(operation.parameters ?? [])];
        const pathParameters = parameters.filter(parameter => parameter.in === "path");
        const queryParameters = parameters.filter(parameter => parameter.in === "query");
        const body = bodyOf(operation);
        const response = responseOf(operation);

        const fields = [
            ...pathParameters.map(parameter => `${parameter.name}: ${typeOf(parameter.schema)}`),
            ...queryParameters.map(parameter => `${parameter.name}${parameter.required ? "" : "?"}: ${typeOf(parameter.schema)}`),
            ...(body ? [`body: ${body.type}`] : []),
        ];

        methods.push({
            name,
            operationId: operation.operationId,
            httpMethod: method.toUpperCase(),
            template,
            fields,
            pathParameters: pathParameters.map(parameter => parameter.name),
            queryParameters: queryParameters.map(parameter => ({ name: parameter.name, required: !!parameter.required })),
            body,
            response,
        });
    }
}

methods.sort((a, b) => a.name.localeCompare(b.name));

const modelImports = [...new Set(methods.flatMap(m => [
    ...m.fields.map(field => field.split(": ").pop().replace("[]", "")),
    m.response.type.replace("[]", ""),
]))]
    .filter(name => roots.includes(name) && name !== "uuid")
    .sort();

function methodSource(method) {
    const argument = method.fields.length > 0 ? `params: { ${method.fields.join("; ")} }` : "";
    const url = method.template.replace(/\{(\w+)\}/g, (_, name) => `\${encodeURIComponent(String(params.${name}))}`);

    const query = method.queryParameters.length > 0
        ? `
        const query = new URLSearchParams();
` +
          method.queryParameters.map(parameter => parameter.required
              ? `        query.set("${parameter.name}", String(params.${parameter.name}));`
              : `        if (params.${parameter.name} !== undefined) query.set("${parameter.name}", String(params.${parameter.name}));`).join("\n") +
          `
        const search = query.size > 0 ? \`?\${query}\` : "";`
        : `
        const search = "";`;

    const init = method.body
        ? (method.body.binary
            ? `, body: params.body`
            : `, body: JSON.stringify(params.body), headers: { "content-type": "application/json" }`)
        : "";

    const read = method.response.binary
        ? "return new Uint8Array(await response.arrayBuffer()) as " + method.response.type + ";"
        : method.response.type === "void"
            ? "await response.text();"
            : `return await readJson<${method.response.type}>(response);`;

    return `    /** ${method.httpMethod} ${method.template} (${method.operationId}) */
    async ${method.name}(${argument}): Promise<${method.response.type}> {${query}
        const response = await this.fetch(\`\${this.baseUrl}${url}\${search}\`, { method: "${method.httpMethod}"${init} });
        await failOnError(response);
        ${read}
    }`;
}

const clientFile = `// Generated from standard/openapi.json by src/schema/scripts/gen-api-sdk.mjs.
// Run "npm run gen-api-sdk" in src/schema after changing mosaic-api.tsp.

import type {
${modelImports.map(name => `    ${name},`).join("\n")}
} from "./MosaicApiTypes.ts";

/** A response the server answered with, that was not a success. */
export class ApiError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
        this.name = "ApiError";
    }
}

async function failOnError(response: Response): Promise<void> {
    if (response.ok) return;

    const text = await response.text();
    let message = text;
    try {
        message = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
        // Not JSON; the body as it came is the best message there is.
    }

    throw new ApiError(response.status, message || \`\${response.status} from the server\`);
}

async function readJson<T>(response: Response): Promise<T> {
    const text = await response.text();
    return (text.length > 0 ? JSON.parse(text) : undefined) as T;
}

/**
 * A client for the Mosaic API, with one method per operation in the spec.
 *
 * Both this and the server are generated from the same document, so a route that moves
 * moves in both at once.
 */
export class MosaicApiClient {
    private readonly fetch: typeof globalThis.fetch;

    constructor(readonly baseUrl: string, options: { fetch?: typeof globalThis.fetch } = {}) {
        this.baseUrl = baseUrl.replace(/\\/$/, "");
        this.fetch = options.fetch ?? globalThis.fetch;
    }

${methods.map(methodSource).join("\n\n")}
}
`;

fs.writeFileSync(path.join(outputDir, "MosaicApiClient.ts"), clientFile);
fs.rmSync(scratch, { recursive: true, force: true });

console.log(`wrote ${routes.length} routes, ${roots.length} models and ${methods.length} client methods to ${outputDir}`);
