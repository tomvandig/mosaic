import { CORE_TYPE, GLTF_TYPE } from "mosaic-ts";
import type { MosaicBuilder } from "./Builder.ts";
import type { IdMinter } from "./ids.ts";

/**
 * Packing what the geometry engine produces into glTF components.
 *
 * web-ifc hands back triangles: a vertex array of interleaved position and normal, an
 * index array, and a 4x4 placement, already in metres and already Y-up, which is the
 * coordinate system glTF uses. So there is no meshing to do here and no axis to swap --
 * the work is laying the triangles into one buffer and describing them, and not doing it
 * twice for geometry two elements share.
 *
 * Three things are shared and so are written once each:
 *
 *  - a geometry, keyed by the express id of the solid it came from, becomes one set of
 *    accessors however many elements are placed from it;
 *  - a colour becomes one material;
 *  - a geometry and a colour together become one mesh primitive, which every element with
 *    that pairing references by index.
 */

const FLOAT = 5126;
const UNSIGNED_INT = 5125;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

/** Position and normal, interleaved, as web-ifc lays them out. */
const FLOATS_PER_VERTEX = 6;
const VERTEX_STRIDE = FLOATS_PER_VERTEX * 4;

/** What web-ifc reports for one placement of one geometry. */
export interface PlacedGeometry {
    geometryExpressID: number;
    color: { x: number; y: number; z: number; w: number };
    flatTransformation: number[];
}

/** The vertex and index data of one geometry, already copied out of wasm memory. */
export interface GeometryData {
    /** Interleaved position and normal, six floats per vertex. */
    vertices: Float32Array;
    indices: Uint32Array;
}

interface Accessors {
    position: string;
    normal: string;
    indices: string;
    triangles: number;
    vertices: number;
}

function colourKey(colour: PlacedGeometry["color"]): string {
    return [colour.x, colour.y, colour.z, colour.w].map(channel => channel.toFixed(4)).join(",");
}

/** The colour as a person would write it, for the name of the material's node. */
function hex(colour: PlacedGeometry["color"]): string {
    const channel = (value: number) =>
        Math.max(0, Math.min(255, Math.round(value * 255))).toString(16).padStart(2, "0");
    return `#${channel(colour.x)}${channel(colour.y)}${channel(colour.z)}`;
}

export class GeometryPacker {
    private readonly blocks: Uint8Array[] = [];
    private byteLength = 0;

    private readonly bufferNode: string;
    private readonly geometries = new Map<number, Accessors | undefined>();
    private readonly materials = new Map<string, string>();
    private readonly primitives = new Map<string, number>();

    /** Vertices and triangles written, which is what the conversion reports. */
    vertexCount = 0;
    triangleCount = 0;

    /**
     * @param park Called with every node this makes, so the caller can decide where the
     *             buffers and materials live. They are not part of the spatial tree.
     */
    constructor(
        private readonly builder: MosaicBuilder,
        private readonly mint: IdMinter,
        private readonly park: (nodeId: string) => void,
    ) {
        this.bufferNode = this.mint.made("buffer");
    }

    /** Puts a component on a node of its own and parks that node. Returns the node's id. */
    private ownNode(typeID: string, name: string, id: string, component: unknown): string {
        const index = this.builder.addRow(typeID, component);
        this.builder.node(id).hold(typeID, name, index);
        this.park(id);
        return id;
    }

    /** Lays one geometry's triangles into the buffer, or returns what was laid before. */
    private accessorsFor(geometryExpressID: number, read: () => GeometryData | undefined): Accessors | undefined {
        const known = this.geometries.get(geometryExpressID);
        if (known !== undefined || this.geometries.has(geometryExpressID)) return known;

        const data = read();
        const vertices = data?.vertices.length ?? 0;
        const indices = data?.indices.length ?? 0;

        if (!data || vertices === 0 || indices === 0) {
            // Remembered as empty, so a geometry that produced nothing is not read again
            // once per element that places it.
            this.geometries.set(geometryExpressID, undefined);
            return undefined;
        }

        const count = vertices / FLOATS_PER_VERTEX;

        // POSITION carries the bounds of the geometry, and glTF requires them. They are
        // measured on the stored floats rather than on doubles, so what a reader computes
        // from the buffer and what the accessor claims cannot disagree. NORMAL is given
        // them too -- the spec does not ask for it, but a reader that cannot see which
        // accessor is which has no way to tell that it should not.
        const min = [Infinity, Infinity, Infinity, Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity, -Infinity, -Infinity, -Infinity];
        for (let vertex = 0; vertex < vertices; vertex += FLOATS_PER_VERTEX) {
            for (let axis = 0; axis < FLOATS_PER_VERTEX; axis++) {
                const value = data.vertices[vertex + axis]!;
                if (value < min[axis]!) min[axis] = value;
                if (value > max[axis]!) max[axis] = value;
            }
        }

        const vertexOffset = this.append(new Uint8Array(data.vertices.buffer, data.vertices.byteOffset, vertices * 4));
        const indexOffset = this.append(new Uint8Array(data.indices.buffer, data.indices.byteOffset, indices * 4));

        const vertexView = this.ownNode(
            GLTF_TYPE.bufferView, "bufferView", this.mint.made("geo", geometryExpressID, "vertices"),
            {
                buffer: this.bufferNode,
                byteOffset: vertexOffset,
                byteLength: vertices * 4,
                byteStride: VERTEX_STRIDE,
                target: ARRAY_BUFFER,
            });

        const indexView = this.ownNode(
            GLTF_TYPE.bufferView, "bufferView", this.mint.made("geo", geometryExpressID, "indices"),
            {
                buffer: this.bufferNode,
                byteOffset: indexOffset,
                byteLength: indices * 4,
                target: ELEMENT_ARRAY_BUFFER,
            });

        const made: Accessors = {
            position: this.ownNode(
                GLTF_TYPE.accessor, "accessor", this.mint.made("geo", geometryExpressID, "position"),
                {
                    bufferView: vertexView, byteOffset: 0, componentType: FLOAT, count, type: "VEC3",
                    min: min.slice(0, 3), max: max.slice(0, 3),
                }),
            normal: this.ownNode(
                GLTF_TYPE.accessor, "accessor", this.mint.made("geo", geometryExpressID, "normal"),
                {
                    bufferView: vertexView, byteOffset: 12, componentType: FLOAT, count, type: "VEC3",
                    min: min.slice(3), max: max.slice(3),
                }),
            indices: this.ownNode(
                GLTF_TYPE.accessor, "accessor", this.mint.made("geo", geometryExpressID, "index"),
                { bufferView: indexView, byteOffset: 0, componentType: UNSIGNED_INT, count: indices, type: "SCALAR" }),
            triangles: indices / 3,
            vertices: count,
        };

        this.vertexCount += count;
        this.triangleCount += made.triangles;
        this.geometries.set(geometryExpressID, made);
        return made;
    }

    /** The material for a colour, made once per distinct colour. */
    private materialFor(colour: PlacedGeometry["color"]): string {
        const key = colourKey(colour);
        const known = this.materials.get(key);
        if (known) return known;

        const opaque = colour.w >= 1;
        const name = `Colour ${hex(colour)}${opaque ? "" : ` at ${Math.round(colour.w * 100)}%`}`;

        const id = this.ownNode(GLTF_TYPE.material, "material", this.mint.made("material", key), {
            name,
            // IFC solids are routinely modelled with inconsistent winding, and a wall lit
            // from the inside is a worse answer than one drawn from both sides.
            doubleSided: true,
            ...(opaque ? {} : { alphaMode: "BLEND" }),
            pbrMetallicRoughness: {
                baseColorFactor: [colour.x, colour.y, colour.z, colour.w],
                metallicFactor: 0,
                roughnessFactor: 1,
            },
        });

        // Materials are few and a person reading the tree should be able to tell them
        // apart, which is not true of the buffers and accessors around them.
        this.builder.node(id).hold(CORE_TYPE.name, name);

        this.materials.set(key, id);
        return id;
    }

    /**
     * The mesh primitive row for one placed geometry, or undefined when the geometry
     * produced no triangles. The same geometry in the same colour returns the same row.
     */
    primitive(placed: PlacedGeometry, read: () => GeometryData | undefined): number | undefined {
        const accessors = this.accessorsFor(placed.geometryExpressID, read);
        if (!accessors) return undefined;

        const key = `${placed.geometryExpressID}|${colourKey(placed.color)}`;
        const known = this.primitives.get(key);
        if (known !== undefined) return known;

        const index = this.builder.addRow(GLTF_TYPE.meshPrimitive, {
            attributes: { POSITION: accessors.position, NORMAL: accessors.normal },
            indices: accessors.indices,
            material: this.materialFor(placed.color),
        });

        this.primitives.set(key, index);
        return index;
    }

    private append(bytes: Uint8Array): number {
        const offset = this.byteLength;
        // Everything written here is four bytes wide, so the running length stays aligned
        // and no accessor can land on an offset glTF would reject.
        this.blocks.push(bytes);
        this.byteLength += bytes.byteLength;
        return offset;
    }

    /** Writes the single buffer everything was laid into. Call once, after the last placement. */
    finish(): void {
        if (this.byteLength === 0) return;

        const bytes = new Uint8Array(this.byteLength);
        let at = 0;
        for (const block of this.blocks) {
            bytes.set(block, at);
            at += block.byteLength;
        }
        this.blocks.length = 0;

        this.ownNode(GLTF_TYPE.buffer, "buffer", this.bufferNode, {
            name: "IFC geometry",
            byteLength: this.byteLength,
            uri: `data:application/octet-stream;base64,${Buffer.from(bytes).toString("base64")}`,
        });
    }

    get byteSize(): number {
        return this.byteLength;
    }
}
