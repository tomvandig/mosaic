import { CORE_TYPE, CORE_SCHEMAS, NAME_COMPONENT } from "../core/schemas.ts";
import { SVG_TYPE, SVG_SCHEMAS } from "./schemas.ts";
import { Type, type MosaicIndexFile } from "../MosaicIndexFile.ts";
import type { MosaicSourceDocument } from "../MosaicPack.ts";

export interface SvgConvertOptions {
    /** What to call the node. The file's own name, normally. */
    name?: string;
    /** Where the markup came from, recorded on the component. */
    source?: string;
    /** Mints the node id. A random uuid unless something needs it to repeat. */
    newId?: () => string;
    provenance?: Partial<MosaicIndexFile["sections"][number]["header"]>;
}

export interface SvgConvertResult {
    document: MosaicSourceDocument;
    nodeId: string;
    componentCounts: Record<string, number>;
}

/**
 * Wraps a piece of SVG in an archive of its own: one node, carrying the markup and a name.
 *
 * There is no conversion here in the sense that the glTF and IFC readers convert -- those
 * take a file apart into the components that describe it, because a mesh is not one thing
 * but buffers and accessors and primitives. An SVG is already a description, so taking it
 * apart would only lose it. The archive says: here is a node, it is called this, and it
 * carries this drawing.
 */
export function svgToMosaic(svg: string, options: SvgConvertOptions = {}): SvgConvertResult {
    const trimmed = svg.trim();
    if (trimmed.length === 0) throw new Error(`There is no SVG in that: the markup is empty`);
    if (!/<svg[\s>]/i.test(trimmed)) throw new Error(`That does not look like SVG: no <svg> element in it`);

    const newId = options.newId ?? (() => globalThis.crypto.randomUUID());
    const nodeId = newId();
    const name = options.name ?? "svg";

    const document: MosaicSourceDocument = {
        components: {
            [SVG_TYPE.svg]: [{ svg: trimmed, ...(options.source ? { source: options.source } : {}) }],
            [CORE_TYPE.name]: [NAME_COMPONENT],
        },
        index: {
            header: { MosaicVersion: "post-alpha" },
            imports: [],
            componentTables: [
                {
                    filename: `${SVG_TYPE.svg}.ndjson`,
                    type: Type.Ndjson,
                    schema: SVG_SCHEMAS[SVG_TYPE.svg],
                },
                {
                    filename: `${CORE_TYPE.name}.ndjson`,
                    type: Type.Ndjson,
                    schema: CORE_SCHEMAS[CORE_TYPE.name],
                },
            ],
            sections: [{
                header: {
                    id: options.provenance?.id ?? name,
                    message: options.provenance?.message ?? `Imported from ${name}`,
                    dataVersion: options.provenance?.dataVersion ?? "1.0.0",
                    author: options.provenance?.author ?? "",
                    timestamp: options.provenance?.timestamp ?? new Date().toISOString(),
                    application: options.provenance?.application ?? "mosaic svg-pack",
                },
                nodes: [{
                    id: nodeId,
                    components: [
                        // A name carries no value: the name of the reference is the name.
                        { type: CORE_TYPE.name, id: name },
                        { type: SVG_TYPE.svg, id: "svg", index: 0 },
                    ],
                }],
            }],
        },
    };

    return {
        document,
        nodeId,
        componentCounts: { [SVG_TYPE.svg]: 1, [CORE_TYPE.name]: 1 },
    };
}
