import type { MosaicSourceDocument } from "../MosaicPack.ts";
import type { ComponentElement, NodeElement, SectionElement } from "../MosaicIndexFile.ts";
import { Operation, Type } from "../MosaicIndexFile.ts";
import { GLTF_TYPE, GLTF_SCHEMAS, type GltfComponentType } from "./schemas.ts";
import type { GltfDocument, GltfNode } from "./GltfDocument.ts";
import { composeTrs, multiply, IDENTITY } from "./matrix.ts";

export interface ConvertOptions {
    /** Resolves a glTF buffer to its bytes. Called once per buffer, in document order. */
    resolveBuffer: (buffer: { uri?: string; byteLength: number }, index: number) => Uint8Array;
    /** Mints the node ids references are built from. Defaults to random UUIDs. */
    newId?: () => string;
    /** Goes into the section header of the produced document. */
    provenance?: Partial<SectionElement["header"]>;
}

export interface ConvertResult {
    document: MosaicSourceDocument;
    /** What the glTF document contained that the Mosaic component subset cannot carry. */
    warnings: string[];
}

const BASE64_PREFIX = "data:application/octet-stream;base64,";

function encodeBuffer(bytes: Uint8Array): string {
    // btoa is the one base64 encoder both Node and browsers agree on.
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return BASE64_PREFIX + btoa(binary);
}

/** Collects the parent of every node, so a node's world transform can be composed. */
function parentsOf(nodes: GltfNode[]): Map<number, number> {
    const parents = new Map<number, number>();

    nodes.forEach((node, index) => {
        for (const child of node.children ?? []) parents.set(child, index);
    });

    return parents;
}

function localMatrix(node: GltfNode): number[] {
    if (node.matrix) return node.matrix;
    return composeTrs(node.translation, node.rotation, node.scale);
}

/** The transform component for a node, in world space when it sits under a parent. */
function transformOf(index: number, nodes: GltfNode[], parents: Map<number, number>): Record<string, unknown> {
    const node = nodes[index]!;

    if (!parents.has(index)) {
        // A root node keeps whatever form the glTF used, which stays readable.
        if (node.matrix) return { matrix: node.matrix };

        const trs: Record<string, unknown> = {};
        if (node.translation) trs.translation = node.translation;
        if (node.rotation) trs.rotation = node.rotation;
        if (node.scale) trs.scale = node.scale;
        return Object.keys(trs).length > 0 ? trs : { matrix: IDENTITY };
    }

    // Under a parent the local transform alone would misplace the geometry, and the
    // component schema has no parent link, so the chain is composed into world space.
    let matrix = localMatrix(node);
    let current = parents.get(index);
    const seen = new Set<number>([index]);

    while (current !== undefined) {
        if (seen.has(current)) throw new Error(`glTF node hierarchy contains a cycle at node ${current}`);
        seen.add(current);
        matrix = multiply(localMatrix(nodes[current]!), matrix);
        current = parents.get(current);
    }

    return { matrix };
}

/**
 * Converts a glTF document into a Mosaic source document.
 *
 * Every glTF id becomes the id of the Mosaic node carrying the referenced component, so
 * later edits to the component tables cannot silently repoint a reference.
 */
export function gltfToMosaic(gltf: GltfDocument, options: ConvertOptions): ConvertResult {
    const newId = options.newId ?? (() => globalThis.crypto.randomUUID());
    const warnings: string[] = [];

    const components: Record<GltfComponentType, unknown[]> = {
        [GLTF_TYPE.buffer]: [],
        [GLTF_TYPE.bufferView]: [],
        [GLTF_TYPE.accessor]: [],
        [GLTF_TYPE.meshPrimitive]: [],
        [GLTF_TYPE.material]: [],
        [GLTF_TYPE.nodeTransform]: [],
    };
    const nodes: NodeElement[] = [];

    /** Adds a component, puts it on a node of its own, and returns that node's id. */
    function addOwnNode(typeID: GltfComponentType, name: string, component: unknown): string {
        const componentIndex = components[typeID].push(component) - 1;
        const id = newId();
        nodes.push({ id, components: [{ name, typeID, componentIndex, operation: Operation.Value }] });
        return id;
    }

    // --- buffers -----------------------------------------------------------
    const bufferIds = (gltf.buffers ?? []).map((buffer, index) => {
        const bytes = options.resolveBuffer(buffer, index);
        if (bytes.byteLength < buffer.byteLength) {
            throw new Error(`Buffer ${index} declares ${buffer.byteLength} bytes but only ${bytes.byteLength} were resolved`);
        }

        const component: Record<string, unknown> = { byteLength: buffer.byteLength, uri: encodeBuffer(bytes.subarray(0, buffer.byteLength)) };
        if (buffer.name !== undefined) component.name = buffer.name;
        return addOwnNode(GLTF_TYPE.buffer, "buffer", component);
    });

    // --- buffer views ------------------------------------------------------
    const bufferViewIds = (gltf.bufferViews ?? []).map((view, index) => {
        const buffer = bufferIds[view.buffer];
        if (buffer === undefined) throw new Error(`bufferView ${index} references buffer ${view.buffer}, which does not exist`);

        const component: Record<string, unknown> = { buffer, byteLength: view.byteLength };
        if (view.name !== undefined) component.name = view.name;
        if (view.byteOffset !== undefined) component.byteOffset = view.byteOffset;
        if (view.byteStride !== undefined) component.byteStride = view.byteStride;
        if (view.target !== undefined) component.target = view.target;
        return addOwnNode(GLTF_TYPE.bufferView, "bufferView", component);
    });

    // --- accessors ---------------------------------------------------------
    const accessorIds = (gltf.accessors ?? []).map((accessor, index) => {
        if (accessor.sparse !== undefined) {
            throw new Error(`Accessor ${index} uses sparse storage, which the Mosaic accessor component cannot represent`);
        }

        const component: Record<string, unknown> = {
            componentType: accessor.componentType,
            count: accessor.count,
            type: accessor.type,
        };
        if (accessor.name !== undefined) component.name = accessor.name;
        if (accessor.bufferView !== undefined) {
            const bufferView = bufferViewIds[accessor.bufferView];
            if (bufferView === undefined) throw new Error(`Accessor ${index} references bufferView ${accessor.bufferView}, which does not exist`);
            component.bufferView = bufferView;
        }
        if (accessor.byteOffset !== undefined) component.byteOffset = accessor.byteOffset;
        if (accessor.normalized !== undefined) component.normalized = accessor.normalized;
        if (accessor.min !== undefined) component.min = accessor.min;
        if (accessor.max !== undefined) component.max = accessor.max;
        return addOwnNode(GLTF_TYPE.accessor, "accessor", component);
    });

    // --- materials ---------------------------------------------------------
    const materialIds = (gltf.materials ?? []).map((material, index) => {
        const carried = new Set(["name", "doubleSided", "pbrMetallicRoughness"]);
        const dropped = Object.keys(material).filter(key => !carried.has(key));
        if (dropped.length > 0) warnings.push(`material ${index}: dropped ${dropped.join(", ")}`);

        const component: Record<string, unknown> = {};
        if (material.name !== undefined) component.name = material.name;
        if (material.doubleSided !== undefined) component.doubleSided = material.doubleSided;

        const pbr = material.pbrMetallicRoughness;
        if (pbr) {
            const carriedPbr = new Set(["baseColorFactor", "metallicFactor", "roughnessFactor"]);
            const droppedPbr = Object.keys(pbr).filter(key => !carriedPbr.has(key));
            if (droppedPbr.length > 0) warnings.push(`material ${index} pbrMetallicRoughness: dropped ${droppedPbr.join(", ")}`);

            const projected: Record<string, unknown> = {};
            if (pbr.baseColorFactor !== undefined) projected.baseColorFactor = pbr.baseColorFactor;
            if (pbr.metallicFactor !== undefined) projected.metallicFactor = pbr.metallicFactor;
            if (pbr.roughnessFactor !== undefined) projected.roughnessFactor = pbr.roughnessFactor;
            component.pbrMetallicRoughness = projected;
        }

        return addOwnNode(GLTF_TYPE.material, "material", component);
    });

    // --- meshes ------------------------------------------------------------
    // A primitive is shared by every node that uses its mesh, so the component row is
    // created once and referenced by index from each of those nodes.
    const primitiveRows = (gltf.meshes ?? []).map((mesh, meshIndex) =>
        mesh.primitives.map((primitive, primitiveIndex) => {
            if (primitive.targets !== undefined) {
                warnings.push(`mesh ${meshIndex} primitive ${primitiveIndex}: dropped morph targets`);
            }

            const attributes: Record<string, string> = {};
            for (const [semantic, accessor] of Object.entries(primitive.attributes)) {
                const id = accessorIds[accessor];
                if (id === undefined) throw new Error(`mesh ${meshIndex} primitive ${primitiveIndex} references accessor ${accessor}, which does not exist`);
                attributes[semantic] = id;
            }

            const component: Record<string, unknown> = { attributes };
            if (primitive.indices !== undefined) {
                const id = accessorIds[primitive.indices];
                if (id === undefined) throw new Error(`mesh ${meshIndex} primitive ${primitiveIndex} references index accessor ${primitive.indices}, which does not exist`);
                component.indices = id;
            }
            if (primitive.material !== undefined) {
                const id = materialIds[primitive.material];
                if (id === undefined) throw new Error(`mesh ${meshIndex} primitive ${primitiveIndex} references material ${primitive.material}, which does not exist`);
                component.material = id;
            }
            if (primitive.mode !== undefined) component.mode = primitive.mode;

            return components[GLTF_TYPE.meshPrimitive].push(component) - 1;
        }),
    );

    // --- nodes -------------------------------------------------------------
    // Only nodes that carry a mesh become Mosaic nodes: the component subset has no
    // hierarchy, and a group node's transform is folded into its descendants instead.
    const gltfNodes = gltf.nodes ?? [];
    const parents = parentsOf(gltfNodes);
    let skipped = 0;

    gltfNodes.forEach((node, index) => {
        if (node.mesh === undefined) {
            skipped++;
            return;
        }

        const rows = primitiveRows[node.mesh];
        if (rows === undefined) throw new Error(`Node ${index} references mesh ${node.mesh}, which does not exist`);

        const transform = transformOf(index, gltfNodes, parents);
        const transformIndex = components[GLTF_TYPE.nodeTransform].push(transform) - 1;

        const refs: ComponentElement[] = rows.map((componentIndex, primitiveIndex) => ({
            // A mesh with one primitive keeps the plain name; several are numbered, since
            // component names have to be unique within a node.
            name: rows.length === 1 ? "mesh" : `mesh.${primitiveIndex}`,
            typeID: GLTF_TYPE.meshPrimitive,
            componentIndex,
            operation: Operation.Value,
        }));

        refs.push({
            name: "transform",
            typeID: GLTF_TYPE.nodeTransform,
            componentIndex: transformIndex,
            operation: Operation.Value,
        });

        nodes.push({ id: newId(), components: refs });
    });

    if (skipped > 0) {
        warnings.push(`${skipped} node(s) carried no mesh and were folded into their descendants' transforms`);
    }

    // --- assemble ----------------------------------------------------------
    const used = (Object.keys(components) as GltfComponentType[]).filter(typeID => components[typeID].length > 0);

    const header: SectionElement["header"] = {
        id: "gltf-import",
        message: "Imported from glTF",
        dataVersion: "1.0.0",
        author: "",
        timestamp: new Date().toISOString(),
        application: gltf.asset?.generator ?? "mosaic",
        ...options.provenance,
    };

    const document: MosaicSourceDocument = {
        description: `Converted from a glTF ${gltf.asset?.version ?? "2.0"} document.`,
        components: Object.fromEntries(used.map(typeID => [typeID, components[typeID]])),
        index: {
            header: { MosaicVersion: "post-alpha" },
            imports: [],
            componentTables: used.map(typeID => ({
                filename: `${typeID}.ndjson`,
                type: Type.Ndjson,
                schema: GLTF_SCHEMAS[typeID],
            })),
            sections: [{ header, nodes }],
        },
    };

    return { document, warnings };
}
