import type { GltfDocument } from "../gltf/GltfDocument.ts";

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

/** Pads to a 4-byte boundary with the filler the GLB spec asks for. */
function pad(bytes: Uint8Array, filler: number): Uint8Array {
    const padding = (4 - (bytes.byteLength % 4)) % 4;
    if (padding === 0) return bytes;

    const padded = new Uint8Array(bytes.byteLength + padding);
    padded.set(bytes);
    padded.fill(filler, bytes.byteLength);
    return padded;
}

/**
 * Writes a binary glTF container: the 12-byte header, then the JSON chunk, then the
 * binary chunk. The JSON chunk is padded with spaces and the binary chunk with zeros,
 * as the spec requires, so every chunk starts on a 4-byte boundary.
 */
export function writeGlb(document: GltfDocument, binary?: Uint8Array): Uint8Array {
    const json = pad(new TextEncoder().encode(JSON.stringify(document)), 0x20);
    const bin = binary && binary.byteLength > 0 ? pad(binary, 0x00) : undefined;

    const total =
        HEADER_BYTES +
        CHUNK_HEADER_BYTES + json.byteLength +
        (bin ? CHUNK_HEADER_BYTES + bin.byteLength : 0);

    const out = new Uint8Array(total);
    const view = new DataView(out.buffer);

    view.setUint32(0, GLB_MAGIC, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, total, true);

    view.setUint32(HEADER_BYTES, json.byteLength, true);
    view.setUint32(HEADER_BYTES + 4, CHUNK_JSON, true);
    out.set(json, HEADER_BYTES + CHUNK_HEADER_BYTES);

    if (bin) {
        const at = HEADER_BYTES + CHUNK_HEADER_BYTES + json.byteLength;
        view.setUint32(at, bin.byteLength, true);
        view.setUint32(at + 4, CHUNK_BIN, true);
        out.set(bin, at + CHUNK_HEADER_BYTES);
    }

    return out;
}
