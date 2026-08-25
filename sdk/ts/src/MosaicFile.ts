import JSZip from "jszip";
import { Convert, Type, type MosaicIndexFile, type SectionElement, type ImportElement } from "./MosaicIndexFile.ts";

interface TypeIdentity<T> {
    typeID: string;
    originSchemaSrc: string;
    fromJSONString: (str: string) => T;
    toJSONString: (component: T) => string;
}

export async function LoadMosaicFile(bytes: Uint8Array)
{
    const zip = new JSZip();
    let output = await zip.loadAsync(bytes);
    
    let files: Map<string, Uint8Array> = new Map();
    for (let key in output.files) {
        let file = output.files[key];
        if (!file) continue;
        let arr = await file.async("uint8array");
        let name = key;
        files.set(name, arr);
    }

    let mosaicFile = new MosaicFile();

    let arr = files.get("index.json");
    if (!arr) throw new Error(`No index file`);
    
    const decoder = new TextDecoder("utf-8");
    const str = decoder.decode(arr);

    mosaicFile.index = Convert.toMosaicIndexFile(str);

    for (let [filename, bytes] of files)
    {
        if (filename.endsWith(".ndjson"))
        {
            let type = filename.replace(".ndjson", "");
            
            const decoder = new TextDecoder("utf-8");
            const str = decoder.decode(bytes);
            mosaicFile.serializedComponents.set(type, str.split("\n"));
        }
    }

    return mosaicFile;
}

export async function WriteMosaicFile(file: MosaicFile)
{
    const zip = new JSZip();

    await zip.file("index.json", JSON.stringify(file.index, null, 4));
    for (let [typeID, components] of file.serializedComponents)
    {
        await zip.file(`${typeID}.ndjson`, components.join("\n"));
    }

    return await zip.generateAsync({type: "uint8array"});
}

export class MosaicFile
{
    public index: MosaicIndexFile;
    public serializedComponents: Map<string, string[]>;

    constructor()
    {
        this.serializedComponents = new Map();
        this.index = {
            header: {
                MosaicVersion: "post-alpha"
            },
            sections: [],
            imports: [],
            componentTables: []
        };
    }

    public AddImport(imp: ImportElement)
    {
        this.index.imports.push(imp);
    }

    public AddSection(section: SectionElement)
    {
        this.index.sections.push(section);
    }

    private GetSerializedComponentsArray<T>(identity: TypeIdentity<T>): string[]
    {
        if (!this.serializedComponents.has(identity.typeID))
        {
            this.serializedComponents.set(identity.typeID, []);
            
            // init comp table entry
            this.index.componentTables.push({
                type: Type.Ndjson,
                filename: `${identity.typeID}.ndjson`,
                schema: JSON.parse(identity.originSchemaSrc),
            });
        }
        return this.serializedComponents.get(identity.typeID)!;
    }

    AddComponent<T>(id: TypeIdentity<T>, component: T): number
    {
        let arr = this.GetSerializedComponentsArray(id);
        let index = arr.length;
        let indentedStr = id.toJSONString(component);
        arr.push(JSON.stringify(JSON.parse(indentedStr))); // this dance is due to quicktype pretty printing...
        return index;
    }

    ReadComponent<T>(id: TypeIdentity<T>, index: number)
    {
        let arr = this.GetSerializedComponentsArray(id);
        let component = arr[index];
        if (component === undefined)
        {
            throw new Error(`No component with index ${index}`);
        }
        return id.fromJSONString(component);
    }

    addSerializedComponent(typeID: string, data: string): number
    {
        if (!this.serializedComponents.has(typeID))
        {
            this.serializedComponents.set(typeID, []);
        }
        const arr = this.serializedComponents.get(typeID)!;
        const index = arr.length;
        arr.push(data);
        return index;
    }

    readRawComponent(typeID: string, index: number): string
    {
        const component = this.serializedComponents.get(typeID)?.[index];
        if (component === undefined)
        {
            throw new Error(`No component with index ${index}`);
        }
        return component;
    }
}