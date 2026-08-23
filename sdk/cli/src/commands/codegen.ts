import {
    quicktype,
    InputData,
    JSONSchemaInput,
    FetchingJSONSchemaStore,
    type RendererOptions,
    type SerializedRenderResult
} from "quicktype-core";
import fs from "node:fs";
import path from "node:path";

type Language = "ts" | "cs";

const LANGUAGES: readonly Language[] = ["ts", "cs"];

function isLanguage(value: string | undefined): value is Language {
    return LANGUAGES.includes(value as Language);
}

async function quicktypeJSONSchema(
    targetLanguage: Language,
    typeName: string,
    jsonSchemaString: string,
    options: RendererOptions
): Promise<SerializedRenderResult> {
    const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());

    // We could add multiple schemas for multiple types,
    // but here we're just making one type from JSON schema.
    await schemaInput.addSource({ name: typeName, schema: jsonSchemaString });

    const inputData = new InputData();
    inputData.addInput(schemaInput);

    return await quicktype({
        inputData,
        lang: targetLanguage,
        rendererOptions: {
            ...options
        }
    });
}

function capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function decapitalize(word: string): string {
    return word.charAt(0).toLowerCase() + word.slice(1);
}

// !!! the packaged executable does not support recursive readdirSync !!!
function getAllFiles(dir: string): string[] {
    let results: string[] = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            results = results.concat(getAllFiles(fullPath));
        } else {
            results.push(fullPath);
        }
    }

    return results;
}

async function ConvertFile(input_path: string, output_path: string, language: Language): Promise<void> {
    console.log(`Converting: ${input_path} -> ${output_path}`);

    const schema = fs.readFileSync(input_path).toString();
    const userSpecifiedId: unknown = JSON.parse(schema)["x-mosaic-id"];

    if (typeof userSpecifiedId !== "string" || userSpecifiedId.length === 0) {
        throw new Error(`${input_path} is missing a string "x-mosaic-id"`);
    }

    const className = capitalize(userSpecifiedId.split("::").at(-1)!);

    if (language === "ts") {
        const { lines: code } = await quicktypeJSONSchema("ts", className, schema, {});

        code.push("\t// start insert");
        code.push(`\texport let Identity = {`);
        code.push(`\t\t     typeID: "${userSpecifiedId}",`);
        code.push(`\t\t     originSchemaSrc: ${JSON.stringify(schema)},`);
        code.push(`\t\t     fromJSONString: Convert.to${className},`);
        code.push(`\t\t     toJSONString: Convert.${decapitalize(className)}ToJson`);
        code.push(`\t\t }`);
        code.push("\t// end insert");

        fs.writeFileSync(output_path, code.join("\n"));
    } else {
        const ns = `${userSpecifiedId.replaceAll("::", "_")}`;
        const { lines: code } = await quicktypeJSONSchema("cs", className, schema, {
            namespace: ns,
            framework: "SystemTextJson"
        });

        code.push("// start insert");
        code.push(`namespace ${ns} {`);
        code.push(`\tpartial class ${className} {`);
        code.push(`\t\tpublic static mosaic_sdk.MosaicIdentity<${className}> Identity() {`);
        code.push(`\t\t\treturn new mosaic_sdk.MosaicIdentity<${className}> {`);
        code.push(`\t\t\t     typeID = "${userSpecifiedId}",`);
        code.push(`\t\t\t     originSchemaSrc = ${JSON.stringify(schema)},`);
        code.push(`\t\t\t     fromJSONString = str => ${className}.FromJson(str),`);
        code.push(`\t\t\t     toJSONString = obj => Serialize.ToJson(obj)`);
        code.push(`\t\t\t};`);
        code.push(`\t\t}`);
        code.push(`\t}`);
        code.push(`}`);
        code.push("// end insert");

        fs.writeFileSync(output_path, code.join("\n"));
    }
}

export const CODEGEN_USAGE = "mosaic codegen <input_dir> <output_dir> <ts|cs>";

export async function runCodegen(argv: string[]): Promise<void> {
    const [input_dir, output_dir, language] = argv;

    if (input_dir === undefined || output_dir === undefined || language === undefined) {
        throw new Error(`Usage: ${CODEGEN_USAGE}`);
    }

    if (!fs.existsSync(input_dir)) throw new Error(`Dir ${input_dir} does not exist`);
    if (!isLanguage(language)) throw new Error(`Unknown language ${language}, only support: [${LANGUAGES.join(",")}]`);

    let files = getAllFiles(input_dir);
    files = files.filter(f => f.endsWith(".schema.json"));

    console.log();
    console.log(`Files (looking for .schema.json):`);
    files.forEach(filepath => {
        console.log(` - ${filepath}`);
    });
    console.log();

    if (files.length === 0) {
        throw new Error(`No files found!`);
    }

    for (const filepath of files) {
        const input_path = filepath;
        // path.relative (not a string replace) so the mirrored layout survives
        // mixed separators and relative input paths.
        const relative = path.relative(input_dir, filepath).replace(".schema.json", `.${language}`);
        const output_path = path.join(output_dir, relative);
        fs.mkdirSync(path.dirname(output_path), { recursive: true });
        await ConvertFile(input_path, output_path, language);
    }
}
