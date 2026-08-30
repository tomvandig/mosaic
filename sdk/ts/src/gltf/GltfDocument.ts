/**
 * The parts of a glTF 2.0 document this converter reads. Fields outside this subset are
 * ignored; `GltfToMosaic` reports what it dropped.
 */
export interface GltfDocument {
    asset?: { version?: string; generator?: string };
    scene?: number;
    scenes?: Array<{ nodes?: number[]; name?: string }>;
    nodes?: GltfNode[];
    meshes?: GltfMesh[];
    accessors?: GltfAccessor[];
    bufferViews?: GltfBufferView[];
    buffers?: GltfBuffer[];
    materials?: GltfMaterial[];
}

export interface GltfNode {
    name?: string;
    mesh?: number;
    children?: number[];
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
}

export interface GltfMesh {
    name?: string;
    primitives: GltfPrimitive[];
}

export interface GltfPrimitive {
    attributes: Record<string, number>;
    indices?: number;
    material?: number;
    mode?: number;
    targets?: Array<Record<string, number>>;
}

export interface GltfAccessor {
    name?: string;
    bufferView?: number;
    byteOffset?: number;
    componentType: number;
    normalized?: boolean;
    count: number;
    type: string;
    max?: number[];
    min?: number[];
    sparse?: unknown;
}

export interface GltfBufferView {
    name?: string;
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
    target?: number;
}

export interface GltfBuffer {
    name?: string;
    uri?: string;
    byteLength: number;
}

export interface GltfMaterial {
    name?: string;
    doubleSided?: boolean;
    pbrMetallicRoughness?: {
        baseColorFactor?: number[];
        metallicFactor?: number;
        roughnessFactor?: number;
    };
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"

export interface ParsedGltf {
    document: GltfDocument;
    /** The GLB binary chunk, for buffers declared without a uri. Absent for .gltf input. */
    binaryChunk?: Uint8Array;
}

/** True when the bytes start with the GLB container magic. */
export function isGlb(bytes: Uint8Array): boolean {
    return bytes.byteLength >= 4 && view(bytes).getUint32(0, true) === GLB_MAGIC;
}

function view(bytes: Uint8Array): DataView {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Reads a binary glTF container: a 12-byte header followed by length-prefixed chunks. */
export function parseGlb(bytes: Uint8Array): ParsedGltf {
    if (!isGlb(bytes)) throw new Error(`Not a GLB file: expected the magic "glTF"`);

    const data = view(bytes);
    const version = data.getUint32(4, true);
    if (version !== 2) throw new Error(`Unsupported GLB version ${version}, expected 2`);

    const declaredLength = data.getUint32(8, true);
    if (declaredLength > bytes.byteLength) {
        throw new Error(`GLB header declares ${declaredLength} bytes but the file has ${bytes.byteLength}`);
    }

    let json: GltfDocument | undefined;
    let binaryChunk: Uint8Array | undefined;

    let offset = 12;
    while (offset + 8 <= declaredLength) {
        const chunkLength = data.getUint32(offset, true);
        const chunkType = data.getUint32(offset + 4, true);
        const start = offset + 8;
        const end = start + chunkLength;

        if (end > bytes.byteLength) throw new Error(`GLB chunk at ${offset} runs past the end of the file`);

        if (chunkType === CHUNK_JSON) {
            json = JSON.parse(new TextDecoder().decode(bytes.subarray(start, end))) as GltfDocument;
        } else if (chunkType === CHUNK_BIN) {
            binaryChunk = bytes.subarray(start, end);
        }
        // Any other chunk type is, per the spec, to be ignored.

        offset = end;
    }

    if (!json) throw new Error(`GLB file contains no JSON chunk`);

    return binaryChunk ? { document: json, binaryChunk } : { document: json };
}

/** Reads either a .glb container or a .gltf JSON document. */
export function parseGltf(bytes: Uint8Array): ParsedGltf {
    if (isGlb(bytes)) return parseGlb(bytes);

    let document: GltfDocument;
    try {
        document = JSON.parse(new TextDecoder().decode(bytes)) as GltfDocument;
    } catch (cause) {
        throw new Error(`Input is neither a GLB container nor a JSON glTF document`, { cause });
    }

    return { document };
}
