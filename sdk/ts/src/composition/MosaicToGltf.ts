import type { MosaicFile } from "../MosaicFile.ts";
import type { ComponentElement, NodeElement } from "../MosaicIndexFile.ts";
import { collapseNodesByPath } from "../MosaicFileOperations.ts";
import { GLTF_TYPE } from "../gltf/schemas.ts";
import { CORE_TYPE } from "../core/schemas.ts";
import { hasValue, indexOf } from "../ComponentReference.ts";
import { resolveInheritance } from "./Inheritance.ts";
import type { GltfDocument } from "../gltf/GltfDocument.ts";

/** Carries the Mosaic components that have no native glTF form. */
export const MOSAIC_COMPONENTS_EXTENSION = "MOSAIC_components";
/** Records which glTF array entry a Mosaic node was hoisted into. */
export const MOSAIC_ELEMENT_EXTENSION = "MOSAIC_element";

export interface ComposeResult {
    document: GltfDocument;
    /** The GLB binary chunk every bufferView addresses. */
    binary: Uint8Array;
    warnings: string[];
}

type Row = Record<string, any>;

const DATA_URI_BASE64 = /^data:[^;,]*;base64,/;

const GLTF_TYPES: ReadonlySet<string> = new Set(Object.values(GLTF_TYPE));

/**
 * Component types this writes into the glTF itself rather than into the extension: the
 * glTF namespace, plus the core types that have a native counterpart -- a transform on
 * the node, and a child link in its hierarchy.
 */
const NATIVE_TYPES: ReadonlySet<string> = new Set([...GLTF_TYPES, CORE_TYPE.transform, CORE_TYPE.child]);

/** Expansion is bounded, so a runaway set of links fails loudly instead of hanging. */
const MAX_NODES = 100_000;

function decodeDataUri(uri: unknown, what: string): Uint8Array {
    if (typeof uri !== "string") throw new Error(`${what} has no uri to read its bytes from`);
    if (!DATA_URI_BASE64.test(uri)) throw new Error(`${what} uri is not a base64 data URI`);

    const base64 = uri.slice(uri.indexOf(",") + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function align4(value: number): number {
    return (value + 3) & ~3;
}

/** The media type named by a data URI, if it names one. */
function mediaTypeOf(uri: string): string | undefined {
    const media = uri.slice("data:".length, uri.indexOf(";"));
    return media.length > 0 ? media : undefined;
}

/** glTF requires a mimeType on an image stored in a bufferView, so sniff for one. */
function sniffImageType(bytes: Uint8Array, at: number): string {
    if (bytes[at] === 0xff && bytes[at + 1] === 0xd8 && bytes[at + 2] === 0xff) return "image/jpeg";
    if (bytes[at] === 0x89 && bytes[at + 1] === 0x50 && bytes[at + 2] === 0x4e && bytes[at + 3] === 0x47) return "image/png";
    return "image/png";
}

interface Carried {
    node: NodeElement;
    ref: ComponentElement;
    row: Row;
}

/**
 * Composes a Mosaic file into a glTF document plus the binary chunk a GLB carries.
 *
 * Every Mosaic node becomes a glTF node. Components in the `khronos::gltf` namespace are
 * written natively -- meshes and transforms onto the node itself, buffers, bufferViews,
 * accessors, images, samplers, textures and materials hoisted into the document's arrays --
 * and `core::child` becomes the glTF node hierarchy. Everything else rides along in a
 * `MOSAIC_components` extension, which a viewer is free to ignore.
 *
 * `core::inherit` is expanded first, so a node that is-a something carries that thing's
 * components by the time any of this runs.
 *
 * Each child relation produces its own glTF node, so naming one node from two places puts
 * it in both. The copies share a mesh, so the geometry is stored once.
 */
export function mosaicToGltf(file: MosaicFile): ComposeResult {
    const warnings: string[] = [];
    // Inheritance is expanded here, when composing, rather than in the file itself: a
    // node that is-a something gets that something's components before anything is read.
    const nodes = [...resolveInheritance(collapseNodesByPath(file), warnings).values()];

    // --- gather every component, grouped by the node carrying it -----------
    const byType = new Map<string, Carried[]>();
    const carriedBy = new Map<string, Carried[]>();

    for (const node of nodes) {
        const carried: Carried[] = [];

        for (const ref of node.components ?? []) {
            let row: Row = {};

            // A reference with no index carries no value -- a child link or a name says
            // everything in its id -- so there is nothing to read.
            if (hasValue(ref)) {
                try {
                    row = JSON.parse(file.readRawComponent(ref.type, indexOf(ref))) as Row;
                } catch (cause) {
                    throw new Error(`Node ${node.id} references ${ref.type}[${indexOf(ref)}], which cannot be read`, { cause });
                }
            }

            const entry: Carried = { node, ref, row };
            carried.push(entry);

            const group = byType.get(ref.type);
            if (group) group.push(entry);
            else byType.set(ref.type, [entry]);
        }

        carriedBy.set(node.id, carried);
    }

    const of = (typeID: string): Carried[] => byType.get(typeID) ?? [];

    // --- buffers: concatenated into the single GLB binary chunk ------------
    // A GLB carries its bytes in one chunk, so every Mosaic buffer is laid end to end and
    // the bufferViews are shifted to match. Each buffer starts on a 4-byte boundary, which
    // keeps every accessor offset legal for 1, 2 and 4-byte component types.
    const bufferBase = new Map<string, number>();
    const blocks: Uint8Array[] = [];
    let binaryLength = 0;

    for (const { node, row } of of(GLTF_TYPE.buffer)) {
        const bytes = decodeDataUri(row.uri, `Buffer on node ${node.id}`);
        const declared = typeof row.byteLength === "number" ? row.byteLength : bytes.byteLength;
        if (bytes.byteLength < declared) {
            throw new Error(`Buffer on node ${node.id} declares ${declared} bytes but its uri holds ${bytes.byteLength}`);
        }

        const padding = align4(binaryLength) - binaryLength;
        if (padding > 0) blocks.push(new Uint8Array(padding));
        binaryLength += padding;

        bufferBase.set(node.id, binaryLength);
        blocks.push(bytes.subarray(0, declared));
        binaryLength += declared;
    }

    const bufferBytes = new Uint8Array(align4(binaryLength));
    {
        let cursor = 0;
        for (const block of blocks) {
            bufferBytes.set(block, cursor);
            cursor += block.byteLength;
        }
    }
    // Anything appended past here (image bytes) starts after the padded buffer region.
    binaryLength = bufferBytes.byteLength;

    // --- bufferViews ------------------------------------------------------
    const bufferViewIndex = new Map<string, number>();
    const bufferViews: NonNullable<GltfDocument["bufferViews"]> = [];

    for (const { node, row } of of(GLTF_TYPE.bufferView)) {
        const base = bufferBase.get(row.buffer);
        if (base === undefined) {
            throw new Error(`bufferView on node ${node.id} references node ${row.buffer}, which carries no buffer component`);
        }

        bufferViewIndex.set(node.id, bufferViews.length);
        bufferViews.push({
            ...(row.name !== undefined ? { name: row.name } : {}),
            buffer: 0,
            byteOffset: base + (row.byteOffset ?? 0),
            byteLength: row.byteLength,
            ...(row.byteStride !== undefined ? { byteStride: row.byteStride } : {}),
            ...(row.target !== undefined ? { target: row.target } : {}),
        });
    }

    // --- accessors --------------------------------------------------------
    const accessorIndex = new Map<string, number>();
    const accessors: NonNullable<GltfDocument["accessors"]> = [];

    for (const { node, row } of of(GLTF_TYPE.accessor)) {
        const accessor: Row = {
            ...(row.name !== undefined ? { name: row.name } : {}),
            componentType: row.componentType,
            count: row.count,
            type: row.type,
        };

        if (row.bufferView !== undefined) {
            const index = bufferViewIndex.get(row.bufferView);
            if (index === undefined) {
                throw new Error(`accessor on node ${node.id} references node ${row.bufferView}, which carries no bufferView component`);
            }
            accessor.bufferView = index;
            if (row.byteOffset) accessor.byteOffset = row.byteOffset;
        }
        if (row.normalized !== undefined) accessor.normalized = row.normalized;
        if (row.min !== undefined) accessor.min = row.min;
        if (row.max !== undefined) accessor.max = row.max;

        accessorIndex.set(node.id, accessors.length);
        accessors.push(accessor as NonNullable<GltfDocument["accessors"]>[number]);
    }

    // --- images -----------------------------------------------------------
    // An image held inline as a data URI is moved into the binary chunk, so the GLB
    // carries its textures as bytes rather than as base64 text in the JSON.
    const imageIndex = new Map<string, number>();
    const images: NonNullable<GltfDocument["images"]> = [];
    const imageBlocks: Uint8Array[] = [];

    for (const { node, row } of of(GLTF_TYPE.image)) {
        const image: Row = {};
        if (row.name !== undefined) image.name = row.name;

        if (row.bufferView !== undefined) {
            const index = bufferViewIndex.get(row.bufferView);
            if (index === undefined) {
                throw new Error(`image on node ${node.id} references node ${row.bufferView}, which carries no bufferView component`);
            }
            image.bufferView = index;
            image.mimeType = row.mimeType ?? sniffImageType(bufferBytes, bufferViews[index]!.byteOffset ?? 0);
        } else if (typeof row.uri === "string" && DATA_URI_BASE64.test(row.uri)) {
            const bytes = decodeDataUri(row.uri, `Image on node ${node.id}`);

            const padding = align4(binaryLength) - binaryLength;
            if (padding > 0) imageBlocks.push(new Uint8Array(padding));
            binaryLength += padding;

            image.bufferView = bufferViews.length;
            image.mimeType = row.mimeType ?? mediaTypeOf(row.uri) ?? sniffImageType(bytes, 0);
            bufferViews.push({ buffer: 0, byteOffset: binaryLength, byteLength: bytes.byteLength });

            imageBlocks.push(bytes);
            binaryLength += bytes.byteLength;
        } else if (typeof row.uri === "string") {
            // A plain uri stays a uri: an image may legitimately live outside the file.
            image.uri = row.uri;
        } else {
            throw new Error(`image on node ${node.id} has neither a uri nor a bufferView`);
        }

        imageIndex.set(node.id, images.length);
        images.push(image as NonNullable<GltfDocument["images"]>[number]);
    }

    // --- samplers ---------------------------------------------------------
    const samplerIndex = new Map<string, number>();
    const samplers: NonNullable<GltfDocument["samplers"]> = [];

    for (const { node, row } of of(GLTF_TYPE.sampler)) {
        const sampler: Row = {};
        for (const key of ["name", "magFilter", "minFilter", "wrapS", "wrapT"]) {
            if (row[key] !== undefined) sampler[key] = row[key];
        }
        samplerIndex.set(node.id, samplers.length);
        samplers.push(sampler as NonNullable<GltfDocument["samplers"]>[number]);
    }

    // --- textures ---------------------------------------------------------
    const textureIndex = new Map<string, number>();
    const textures: NonNullable<GltfDocument["textures"]> = [];

    for (const { node, row } of of(GLTF_TYPE.texture)) {
        const texture: Row = {};
        if (row.name !== undefined) texture.name = row.name;

        if (row.source !== undefined) {
            const index = imageIndex.get(row.source);
            if (index === undefined) {
                throw new Error(`texture on node ${node.id} references node ${row.source}, which carries no image component`);
            }
            texture.source = index;
        }
        if (row.sampler !== undefined) {
            const index = samplerIndex.get(row.sampler);
            if (index === undefined) {
                throw new Error(`texture on node ${node.id} references node ${row.sampler}, which carries no sampler component`);
            }
            texture.sampler = index;
        }

        textureIndex.set(node.id, textures.length);
        textures.push(texture as NonNullable<GltfDocument["textures"]>[number]);
    }

    /** A Mosaic textureInfo, with its node id swapped back for a glTF texture index. */
    function textureInfo(info: Row | undefined, where: string): Row | undefined {
        if (info === undefined) return undefined;

        const index = textureIndex.get(info.index);
        if (index === undefined) {
            throw new Error(`${where} references node ${info.index}, which carries no texture component`);
        }

        const out: Row = { index };
        if (info.texCoord !== undefined) out.texCoord = info.texCoord;
        if (info.scale !== undefined) out.scale = info.scale;
        if (info.strength !== undefined) out.strength = info.strength;
        return out;
    }

    // --- materials --------------------------------------------------------
    const materialIndex = new Map<string, number>();
    const materials: NonNullable<GltfDocument["materials"]> = [];

    for (const { node, row } of of(GLTF_TYPE.material)) {
        const material: Row = {};
        for (const key of ["name", "doubleSided", "emissiveFactor", "alphaMode", "alphaCutoff"]) {
            if (row[key] !== undefined) material[key] = row[key];
        }

        const where = `material on node ${node.id}`;
        const normal = textureInfo(row.normalTexture, `${where} normalTexture`);
        if (normal) material.normalTexture = normal;
        const occlusion = textureInfo(row.occlusionTexture, `${where} occlusionTexture`);
        if (occlusion) material.occlusionTexture = occlusion;
        const emissive = textureInfo(row.emissiveTexture, `${where} emissiveTexture`);
        if (emissive) material.emissiveTexture = emissive;

        const pbr = row.pbrMetallicRoughness;
        if (pbr !== undefined) {
            const projected: Row = {};
            for (const key of ["baseColorFactor", "metallicFactor", "roughnessFactor"]) {
                if (pbr[key] !== undefined) projected[key] = pbr[key];
            }

            const baseColor = textureInfo(pbr.baseColorTexture, `${where} baseColorTexture`);
            if (baseColor) projected.baseColorTexture = baseColor;
            const metallicRoughness = textureInfo(pbr.metallicRoughnessTexture, `${where} metallicRoughnessTexture`);
            if (metallicRoughness) projected.metallicRoughnessTexture = metallicRoughness;

            material.pbrMetallicRoughness = projected;
        }

        materialIndex.set(node.id, materials.length);
        materials.push(material as NonNullable<GltfDocument["materials"]>[number]);
    }

    // --- meshes -----------------------------------------------------------
    // A node's primitives become one mesh; nodes whose primitives are identical share it,
    // which is how a Mosaic file that reuses a component row round-trips back to glTF.
    const meshes: NonNullable<GltfDocument["meshes"]> = [];
    const meshByKey = new Map<string, number>();

    function meshFor(primitives: Carried[]): number {
        const built = primitives.map(({ node, row }) => {
            const attributes: Record<string, number> = {};
            for (const [semantic, reference] of Object.entries(row.attributes ?? {})) {
                const index = accessorIndex.get(reference as string);
                if (index === undefined) {
                    throw new Error(`mesh on node ${node.id} references node ${reference} for ${semantic}, which carries no accessor component`);
                }
                attributes[semantic] = index;
            }

            const primitive: Row = { attributes };

            if (row.indices !== undefined) {
                const index = accessorIndex.get(row.indices);
                if (index === undefined) {
                    throw new Error(`mesh on node ${node.id} references node ${row.indices} for its indices, which carries no accessor component`);
                }
                primitive.indices = index;
            }
            if (row.material !== undefined) {
                const index = materialIndex.get(row.material);
                if (index === undefined) {
                    throw new Error(`mesh on node ${node.id} references node ${row.material} for its material, which carries no material component`);
                }
                primitive.material = index;
            }
            if (row.mode !== undefined) primitive.mode = row.mode;

            return primitive;
        });

        // The mesh name travels on the primitives, since glTF has nowhere else to put it.
        const name = primitives.map(p => p.row.name).find(n => typeof n === "string");

        const key = JSON.stringify([name, built]);
        const existing = meshByKey.get(key);
        if (existing !== undefined) return existing;

        const index = meshes.length;
        meshes.push({
            ...(name !== undefined ? { name } : {}),
            primitives: built as NonNullable<GltfDocument["meshes"]>[number]["primitives"],
        });
        meshByKey.set(key, index);
        return index;
    }

    // --- hierarchy ---------------------------------------------------------
    // A core::child component carries no value: the name of the reference is the id of
    // the child node. A node may be named by several parents; each relation becomes its
    // own glTF node further down, which is how one thing gets placed in several spots.
    const known = new Set(nodes.map(node => node.id));
    const childIds = new Map<string, string[]>();
    const referenced = new Set<string>();

    for (const node of nodes) {
        const links: string[] = [];

        for (const { ref } of (carriedBy.get(node.id) ?? []).filter(c => c.ref.type === CORE_TYPE.child)) {
            const childId = ref.id;

            if (!known.has(childId)) {
                warnings.push(`node ${node.id} names ${childId} as a child, but no such node is present`);
                continue;
            }
            if (childId === node.id) {
                warnings.push(`node ${node.id} names itself as a child; the link was dropped`);
                continue;
            }

            links.push(childId);
            referenced.add(childId);
        }

        if (links.length > 0) childIds.set(node.id, links);
    }

    // --- nodes ------------------------------------------------------------
    /** Where a component of each type ended up, for the MOSAIC_element pointer. */
    const hoistedInto: Record<string, Map<string, number> | undefined> = {
        [GLTF_TYPE.buffer]: undefined,
        [GLTF_TYPE.bufferView]: bufferViewIndex,
        [GLTF_TYPE.accessor]: accessorIndex,
        [GLTF_TYPE.material]: materialIndex,
        [GLTF_TYPE.image]: imageIndex,
        [GLTF_TYPE.sampler]: samplerIndex,
        [GLTF_TYPE.texture]: textureIndex,
    };

    const gltfNodes: NonNullable<GltfDocument["nodes"]> = [];
    const extensionsUsed = new Set<string>();

    /** Everything about a node except its children, which differ from one placement to the next. */
    function templateFor(node: NodeElement): Row {
        const carried = carriedBy.get(node.id) ?? [];
        const gltfNode: Row = { name: node.id };

        const primitives = carried.filter(c => c.ref.type === GLTF_TYPE.meshPrimitive);
        if (primitives.length > 0) gltfNode.mesh = meshFor(primitives);

        const transforms = carried.filter(c => c.ref.type === CORE_TYPE.transform);
        if (transforms.length > 1) warnings.push(`node ${node.id} carries ${transforms.length} transforms; using "${transforms[0]!.ref.id}"`);
        const transform = transforms[0]?.row;
        if (transform) {
            if (transform.matrix !== undefined) gltfNode.matrix = transform.matrix;
            else {
                if (transform.translation !== undefined) gltfNode.translation = transform.translation;
                if (transform.rotation !== undefined) gltfNode.rotation = transform.rotation;
                if (transform.scale !== undefined) gltfNode.scale = transform.scale;
            }
        }

        // A node that was hoisted into one of the glTF arrays keeps a pointer to where it went.
        const hoisted = carried.find(c => c.ref.type in hoistedInto);
        if (hoisted) {
            // Every buffer folds into the one GLB chunk, so it has no array of its own.
            const index = hoistedInto[hoisted.ref.type]?.get(node.id) ?? 0;
            gltfNode.extensions = { [MOSAIC_ELEMENT_EXTENSION]: { type: hoisted.ref.type, index } };
            extensionsUsed.add(MOSAIC_ELEMENT_EXTENSION);
        }

        // Anything outside the glTF namespace travels as extension data.
        const foreign = carried.filter(c => !NATIVE_TYPES.has(c.ref.type));
        if (foreign.length > 0) {
            gltfNode.extensions = {
                ...(gltfNode.extensions as object | undefined),
                [MOSAIC_COMPONENTS_EXTENSION]: {
                    components: foreign.map(({ ref, row }) => ({ name: ref.id, type: ref.type, value: row })),
                },
            };
            extensionsUsed.add(MOSAIC_COMPONENTS_EXTENSION);
        }

        return gltfNode;
    }

    const templates = new Map(nodes.map(node => [node.id, templateFor(node)]));
    const emitted = new Set<string>();

    /**
     * Writes a node, and beneath it a fresh node for every child relation. A node named by
     * two parents is written twice: glTF gives a node one parent, so the way to place one
     * thing in two places is two nodes sharing a mesh, which costs no extra geometry.
     */
    function emit(id: string, ancestors: string[]): number {
        const loop = ancestors.indexOf(id);
        if (loop !== -1) {
            throw new Error(`Child links form a cycle: ${[...ancestors.slice(loop), id].join(" -> ")}`);
        }
        if (gltfNodes.length >= MAX_NODES) {
            throw new Error(`Child links expand past ${MAX_NODES} nodes; check for a reference that repeats without end`);
        }

        const gltfNode: Row = { ...templates.get(id)! };
        const index = gltfNodes.length;
        gltfNodes.push(gltfNode as NonNullable<GltfDocument["nodes"]>[number]);
        emitted.add(id);

        const children = childIds.get(id);
        if (children) {
            const beneath = [...ancestors, id];
            gltfNode.children = children.map(child => emit(child, beneath));
        }

        return index;
    }

    // A node nobody names is a root; every other node appears beneath its parent.
    const roots = nodes.filter(node => !referenced.has(node.id)).map(node => emit(node.id, []));

    const unreachable = nodes.filter(node => !emitted.has(node.id));
    if (unreachable.length > 0) {
        throw new Error(`Child links form a cycle among nodes nothing else names: ${unreachable.map(n => n.id).join(", ")}`);
    }

    // Buffers first, then the image bytes appended after them.
    const binary = new Uint8Array(align4(binaryLength));
    binary.set(bufferBytes, 0);
    {
        let cursor = bufferBytes.byteLength;
        for (const block of imageBlocks) {
            binary.set(block, cursor);
            cursor += block.byteLength;
        }
    }

    for (const accessor of accessors) {
        if (accessor.type === "VEC3" && (accessor.min === undefined || accessor.max === undefined)) {
            warnings.push(`accessor "${accessor.name ?? "?"}" has no min/max; glTF requires them for POSITION`);
        }
    }

    const document: GltfDocument = {
        asset: { version: "2.0", generator: "mosaic compose" },
        scene: 0,
        scenes: [{ nodes: roots }],
        nodes: gltfNodes,
        ...(meshes.length > 0 ? { meshes } : {}),
        ...(accessors.length > 0 ? { accessors } : {}),
        ...(bufferViews.length > 0 ? { bufferViews } : {}),
        ...(binaryLength > 0 ? { buffers: [{ byteLength: binary.byteLength }] } : {}),
        ...(materials.length > 0 ? { materials } : {}),
        ...(textures.length > 0 ? { textures } : {}),
        ...(images.length > 0 ? { images } : {}),
        ...(samplers.length > 0 ? { samplers } : {}),
        ...(extensionsUsed.size > 0 ? { extensionsUsed: [...extensionsUsed] } : {}),
    } as GltfDocument;

    return { document, binary, warnings };
}
