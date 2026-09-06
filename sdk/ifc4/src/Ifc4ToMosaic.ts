import { CORE_TYPE, CORE_SCHEMAS, GLTF_TYPE, GLTF_SCHEMAS, Type } from "mosaic-ts";
import type { MosaicSourceDocument, SectionElement } from "mosaic-ts";
import { MosaicBuilder } from "./Builder.ts";
import { GeometryPacker, type PlacedGeometry } from "./Geometry.ts";
import { idMinter } from "./ids.ts";
import { IFC4_TYPE, IFC4_SCHEMAS, relationshipType, relationshipSchema } from "./schemas.ts";
import { decodeNumber, decodeString, decodeValue, referencesOf } from "./values.ts";

/**
 * Turning an IFC model into a Mosaic document.
 *
 * The shape of the result follows the shape of IFC, with one deliberate exception. IFC
 * says everything with a relationship object, including the tree -- a storey holds its
 * walls through an IfcRelContainedInSpatialStructure, a building holds its storeys through
 * an IfcRelAggregates. Mosaic has a parent-child link of its own, and a viewer, a
 * selection and a composition all read it, so the spatial tree becomes `core::child` and
 * every other relationship becomes a component.
 *
 * What ends up on a node:
 *
 *  - `ifc4::entity` -- what the thing is, and every attribute it carries in its own right.
 *  - `core::name` -- its name, so a person can find it.
 *  - `core::transform` and `khronos::gltf::meshPrimitive` -- where it is and what to draw.
 *  - `ifc4::propertySet` and `ifc4::quantitySet` -- one reference per set, pointing at a
 *    row shared with every other element that set defines.
 *  - `ifc4::rel::<IfcRelSomething>` -- one reference per relationship it takes part in,
 *    named for the node at the other end.
 *  - `core::child` -- the spatial and decomposition tree.
 */

/** The part of the web-ifc API this needs, so the module itself is loaded by the caller. */
export interface Ifc4Api {
    GetModelSchema(modelID: number): string;
    GetLine(modelID: number, expressID: number, flatten?: boolean): any;
    GetNameFromTypeCode(type: number): string;
    GetTypeCodeFromName(typeName: string): number;
    GetLineIDsWithType(modelID: number, type: number, includeInherited?: boolean): { get(index: number): number; size(): number };
    StreamAllMeshes(modelID: number, callback: (mesh: FlatMesh, index: number, total: number) => void): void;
    GetGeometry(modelID: number, geometryExpressID: number): IfcGeometryHandle;
    GetVertexArray(pointer: number, size: number): Float32Array;
    GetIndexArray(pointer: number, size: number): Uint32Array;
}

export interface FlatMesh {
    expressID: number;
    geometries: { get(index: number): PlacedGeometry; size(): number };
}

export interface IfcGeometryHandle {
    GetVertexData(): number;
    GetVertexDataSize(): number;
    GetIndexData(): number;
    GetIndexDataSize(): number;
    delete(): void;
}

export interface Ifc4ConvertOptions {
    /** Namespaces the ids of entities that have no IfcGlobalId. Normally the file name. */
    seed?: string;
    /** Leave the geometry out and convert only the structure and the properties. */
    withoutGeometry?: boolean;
    /** Goes into the section header of the produced document. */
    provenance?: Partial<SectionElement["header"]>;
}

export interface Ifc4ConvertResult {
    document: MosaicSourceDocument;
    warnings: string[];
    stats: Ifc4Stats;
}

export interface Ifc4Stats {
    schema: string;
    nodes: number;
    /** Rows written, by component type. */
    components: Record<string, number>;
    /** References across all nodes, which is what a node actually holds. */
    references: number;
    entities: number;
    relationships: number;
    propertySets: number;
    quantitySets: number;
    vertices: number;
    triangles: number;
    /** Bytes of geometry before they were base64'd into the buffer component. */
    geometryBytes: number;
}

/** Attributes that are not a value of the thing, or are already somewhere else. */
const NOT_ATTRIBUTES: ReadonlySet<string> = new Set([
    "expressID", "type",
    // Who touched the file last says nothing about the wall.
    "OwnerHistory",
    // These two are the node's transform and its mesh.
    "ObjectPlacement", "Representation", "Representations", "RepresentationMaps", "RepresentationContexts",
    // These become components of their own.
    "HasPropertySets", "Quantities", "HasProperties", "UnitsInContext",
]);

/** Attributes lifted out of the bag into a column, because they are asked for by name. */
const NAMED_ATTRIBUTES: ReadonlyArray<readonly [string, string]> = [
    ["GlobalId", "globalId"],
    ["Name", "name"],
    ["Description", "description"],
    ["ObjectType", "objectType"],
    ["LongName", "longName"],
    ["Tag", "tag"],
    ["PredefinedType", "predefinedType"],
];

/**
 * Relationships that become the tree rather than a component, and which end of each is
 * the parent. The relationship object itself is still recorded, so its own identity is
 * not lost -- it is just not the thing a viewer walks.
 */
const TREE_RELATIONSHIPS: ReadonlyArray<{ ifcType: string; parent: string; children: string }> = [
    { ifcType: "IFCRELAGGREGATES", parent: "RelatingObject", children: "RelatedObjects" },
    { ifcType: "IFCRELNESTS", parent: "RelatingObject", children: "RelatedObjects" },
    { ifcType: "IFCRELCONTAINEDINSPATIALSTRUCTURE", parent: "RelatingStructure", children: "RelatedElements" },
];

/**
 * A property set reaches its elements through an IfcRelDefinesByProperties, and that
 * relationship is the property set: turning it into a component as well would say the
 * same thing twice, once as a link to a node that exists only to hold the set.
 */
const RELATIONSHIP_AS_PROPERTIES = "IFCRELDEFINESBYPROPERTIES";

const MAX_WARNINGS_PER_KIND = 5;

function round(value: number): number {
    const rounded = Math.round(value * 1e6) / 1e6;
    // -0 serializes as -0 and reads back as a different number than 0 to a diff.
    return Object.is(rounded, -0) ? 0 : rounded;
}

export function ifc4ToMosaic(api: Ifc4Api, modelID: number, options: Ifc4ConvertOptions = {}): Ifc4ConvertResult {
    const builder = new MosaicBuilder();
    const mint = idMinter(options.seed ?? "");

    const seen = new Map<string, number>();
    const warnings: string[] = [];

    /** Warns, but only so often: one broken property should not bury the report. */
    function warn(kind: string, message: string): void {
        const count = (seen.get(kind) ?? 0) + 1;
        seen.set(kind, count);
        if (count <= MAX_WARNINGS_PER_KIND) warnings.push(message);
    }

    const typeCache = new Map<number, string>();
    const nameOfType = (code: number): string => {
        const known = typeCache.get(code);
        if (known !== undefined) return known;

        const name = api.GetNameFromTypeCode(code);
        typeCache.set(code, name);
        return name;
    };

    /** Every express id of a type, including its subtypes. Empty when the schema has no such type. */
    function linesOfType(typeName: string): number[] {
        let code: number;
        try {
            code = api.GetTypeCodeFromName(typeName);
        } catch {
            return [];
        }

        try {
            const ids = api.GetLineIDsWithType(modelID, code, true);
            const out: number[] = [];
            for (let index = 0; index < ids.size(); index++) out.push(ids.get(index));
            return out;
        } catch {
            return [];
        }
    }

    // --- entities ----------------------------------------------------------
    const nodeOfEntity = new Map<number, string>();
    let entityCount = 0;

    /**
     * The node standing for an IFC entity, made the first time anything mentions it.
     *
     * Lazy on purpose: a model names materials, types and groups only from the
     * relationships that reach them, and walking those is how they get here at all.
     */
    function nodeFor(expressId: number): string | undefined {
        const known = nodeOfEntity.get(expressId);
        if (known) return known;

        let line: any;
        try {
            line = api.GetLine(modelID, expressId, false);
        } catch {
            warn("unreadable", `line ${expressId} could not be read and was left out`);
            return undefined;
        }
        if (!line || typeof line !== "object") {
            warn("unreadable", `line ${expressId} could not be read and was left out`);
            return undefined;
        }

        const ifcType = nameOfType(line.type);
        const globalId = decodeString(line.GlobalId);
        const id = mint.entity(expressId, globalId);

        nodeOfEntity.set(expressId, id);
        entityCount++;

        const row: Record<string, unknown> = { ifcType, expressId };
        for (const [attribute, property] of NAMED_ATTRIBUTES) {
            const value = decodeValue(line[attribute]);
            if (typeof value === "string" && value.length > 0) row[property] = value;
        }

        const attributes: Record<string, unknown> = {};
        for (const [attribute, value] of Object.entries(line)) {
            if (NOT_ATTRIBUTES.has(attribute)) continue;
            if (NAMED_ATTRIBUTES.some(([name]) => name === attribute)) continue;

            const decoded = decodeValue(value);
            if (decoded !== undefined) attributes[attribute] = decoded;
        }
        if (Object.keys(attributes).length > 0) row.attributes = attributes;

        const node = builder.node(id);
        node.hold(IFC4_TYPE.entity, "entity", builder.addRow(IFC4_TYPE.entity, row));

        // The name is the handle a person has on a node whose id is a uuid, so it is worth
        // making one up when the file gives none.
        const name = (row.name as string | undefined) ?? (row.longName as string | undefined)
            ?? `${ifcType} ${expressId}`;
        if (!node.hold(CORE_TYPE.name, name)) {
            warn("name-taken", `${ifcType} ${expressId} is called "${name}", which one of its own components already claims; the name was left off`);
        }

        return id;
    }

    // Products and type objects are made up front, so that everything the file describes
    // is in the archive whether or not a relationship happens to reach it.
    for (const expressId of linesOfType("IFCPRODUCT")) nodeFor(expressId);
    for (const expressId of linesOfType("IFCTYPEOBJECT")) nodeFor(expressId);

    // --- geometry ----------------------------------------------------------
    const parked: string[] = [];
    const packer = new GeometryPacker(builder, mint, id => parked.push(id));

    if (!options.withoutGeometry) {
        api.StreamAllMeshes(modelID, mesh => {
            // A product can be placed in several spots at once -- most are placed once,
            // and those keep their mesh and their transform on the node itself. Where the
            // placements genuinely differ, each becomes a node of its own, because a node
            // has one transform.
            const byPlacement = new Map<string, { matrix: number[]; primitives: number[] }>();

            for (let index = 0; index < mesh.geometries.size(); index++) {
                const placed = mesh.geometries.get(index);

                const row = packer.primitive(placed, () => {
                    const geometry = api.GetGeometry(modelID, placed.geometryExpressID);
                    try {
                        return {
                            vertices: api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize()),
                            indices: api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize()),
                        };
                    } finally {
                        geometry.delete();
                    }
                });
                if (row === undefined) continue;

                const matrix = placed.flatTransformation.map(round);
                const key = matrix.join(",");

                const group = byPlacement.get(key);
                if (group) group.primitives.push(row);
                else byPlacement.set(key, { matrix, primitives: [row] });
            }

            if (byPlacement.size === 0) return;

            const owner = nodeFor(mesh.expressID);
            if (owner === undefined) return;

            const placements = [...byPlacement.values()];

            const draw = (nodeId: string, matrix: number[], primitives: number[]) => {
                const node = builder.node(nodeId);
                node.hold(CORE_TYPE.transform, "transform", builder.addRow(CORE_TYPE.transform, { matrix }));
                primitives.forEach((row, index) => {
                    node.hold(GLTF_TYPE.meshPrimitive, primitives.length === 1 ? "mesh" : `mesh.${index}`, row);
                });
            };

            if (placements.length === 1) {
                draw(owner, placements[0]!.matrix, placements[0]!.primitives);
                return;
            }

            placements.forEach((placement, index) => {
                const id = mint.made("placement", mesh.expressID, index);
                draw(id, placement.matrix, placement.primitives);
                builder.node(id).hold(CORE_TYPE.name, `Placement ${index + 1}`);
                builder.node(owner).hold(CORE_TYPE.child, id);
            });
        });
    }

    packer.finish();

    // --- property and quantity sets ----------------------------------------
    const propertySetRows = new Map<number, { type: string; name: string; index: number }>();
    let propertySetCount = 0;
    let quantitySetCount = 0;

    /** Reads one IfcProperty into the name and value it stands for. */
    function readProperty(expressId: number): [string, unknown] | undefined {
        const line = api.GetLine(modelID, expressId, false);
        if (!line) return undefined;

        const ifcType = nameOfType(line.type);
        const name = decodeString(line.Name);
        if (name === undefined) return undefined;

        switch (ifcType.toUpperCase()) {
            case "IFCPROPERTYSINGLEVALUE": {
                const value = decodeValue(line.NominalValue);
                return value === undefined ? undefined : [name, value];
            }
            case "IFCPROPERTYENUMERATEDVALUE": {
                const value = decodeValue(line.EnumerationValues);
                return value === undefined ? undefined : [name, value];
            }
            case "IFCPROPERTYLISTVALUE": {
                const value = decodeValue(line.ListValues);
                return value === undefined ? undefined : [name, value];
            }
            case "IFCPROPERTYBOUNDEDVALUE": {
                const bounds: Record<string, unknown> = {};
                for (const key of ["LowerBoundValue", "UpperBoundValue", "SetPointValue"]) {
                    const value = decodeValue(line[key]);
                    if (value !== undefined) bounds[key[0]!.toLowerCase() + key.slice(1)] = value;
                }
                return Object.keys(bounds).length > 0 ? [name, bounds] : undefined;
            }
            case "IFCCOMPLEXPROPERTY": {
                const nested: Record<string, unknown> = {};
                for (const child of referencesOf(line.HasProperties)) {
                    const property = readProperty(child);
                    if (property) nested[property[0]] = property[1];
                }
                return Object.keys(nested).length > 0 ? [name, nested] : undefined;
            }
            default:
                warn("property-kind", `${ifcType} is a kind of property this does not read; "${name}" was left out`);
                return undefined;
        }
    }

    /** Reads one IfcPhysicalQuantity into its name, its number and what it measures. */
    function readQuantity(expressId: number): [string, number, string] | undefined {
        const line = api.GetLine(modelID, expressId, false);
        if (!line) return undefined;

        const ifcType = nameOfType(line.type);
        const name = decodeString(line.Name);
        if (name === undefined) return undefined;

        // IfcQuantityVolume holds VolumeValue, IfcQuantityArea holds AreaValue, and so on
        // for every kind there is, so the attribute follows from the class.
        const kind = /^IfcQuantity(.+)$/i.exec(ifcType)?.[1];
        if (kind === undefined) {
            warn("quantity-kind", `${ifcType} is a kind of quantity this does not read; "${name}" was left out`);
            return undefined;
        }

        const value = decodeNumber(line[`${kind}Value`]);
        return value === undefined ? undefined : [name, value, kind];
    }

    /** The row for a property or quantity set, made once however many objects share it. */
    function setRowFor(expressId: number): { type: string; name: string; index: number } | undefined {
        const known = propertySetRows.get(expressId);
        if (known) return known;

        const line = api.GetLine(modelID, expressId, false);
        if (!line) return undefined;

        const ifcType = nameOfType(line.type);
        const name = decodeString(line.Name) ?? `${ifcType} ${expressId}`;

        const common: Record<string, unknown> = { expressId, name };
        const globalId = decodeString(line.GlobalId);
        if (globalId) common.globalId = globalId;
        const description = decodeString(line.Description);
        if (description) common.description = description;

        let made: { type: string; name: string; index: number } | undefined;

        if (ifcType.toUpperCase() === "IFCELEMENTQUANTITY") {
            const quantities: Record<string, number> = {};
            const kinds: Record<string, string> = {};
            for (const child of referencesOf(line.Quantities)) {
                const quantity = readQuantity(child);
                if (!quantity) continue;
                quantities[quantity[0]] = quantity[1];
                kinds[quantity[0]] = quantity[2];
            }

            const method = decodeString(line.MethodOfMeasurement);
            if (method) common.methodOfMeasurement = method;

            made = {
                type: IFC4_TYPE.quantitySet,
                name,
                index: builder.addRow(IFC4_TYPE.quantitySet, { ...common, quantities, kinds }),
            };
            quantitySetCount++;
        } else if (ifcType.toUpperCase() === "IFCPROPERTYSET") {
            const properties: Record<string, unknown> = {};
            for (const child of referencesOf(line.HasProperties)) {
                const property = readProperty(child);
                if (property) properties[property[0]] = property[1];
            }

            made = {
                type: IFC4_TYPE.propertySet,
                name,
                index: builder.addRow(IFC4_TYPE.propertySet, { ...common, properties }),
            };
            propertySetCount++;
        } else {
            // IFC also has property sets whose properties are fixed attributes rather than
            // a list -- IfcDoorLiningProperties says LiningDepth outright. They are still
            // properties of the thing, so they are read the same way, off the attributes.
            const properties: Record<string, unknown> = {};
            for (const [attribute, value] of Object.entries(line)) {
                if (NOT_ATTRIBUTES.has(attribute)) continue;
                if (["GlobalId", "Name", "Description"].includes(attribute)) continue;

                const decoded = decodeValue(value);
                if (decoded !== undefined) properties[attribute] = decoded;
            }

            if (Object.keys(properties).length === 0) {
                warn("set-kind", `${ifcType} ${expressId} is a property definition with nothing this could read`);
                return undefined;
            }

            made = {
                type: IFC4_TYPE.propertySet,
                name,
                index: builder.addRow(IFC4_TYPE.propertySet, { ...common, properties }),
            };
            propertySetCount++;
        }

        propertySetRows.set(expressId, made);
        return made;
    }

    /** Puts a set on a node, keeping the reference name unique when a name repeats. */
    function attachSet(nodeId: string, setExpressId: number): void {
        const row = setRowFor(setExpressId);
        if (!row) return;

        const node = builder.node(nodeId);
        // Two sets of the same name on one object is unusual but legal, and a reference
        // name has to be unique, so the second one says which line it came from.
        const name = node.free(row.name) ? row.name : `${row.name}#${setExpressId}`;
        if (!node.hold(row.type, name, row.index)) {
            warn("set-name", `node ${nodeId} already holds a ${row.type} called "${name}"`);
        }
    }

    for (const relId of linesOfType(RELATIONSHIP_AS_PROPERTIES)) {
        const line = api.GetLine(modelID, relId, false);
        if (!line) continue;

        const definitions = referencesOf(line.RelatingPropertyDefinition);
        const objects = referencesOf(line.RelatedObjects);

        for (const object of objects) {
            const nodeId = nodeFor(object);
            if (nodeId === undefined) continue;
            for (const definition of definitions) attachSet(nodeId, definition);
        }
    }

    // A type object carries its property sets directly, with no relationship in between.
    for (const typeId of linesOfType("IFCTYPEOBJECT")) {
        const line = api.GetLine(modelID, typeId, false);
        if (!line) continue;

        const nodeId = nodeFor(typeId);
        if (nodeId === undefined) continue;
        for (const set of referencesOf(line.HasPropertySets)) attachSet(nodeId, set);
    }

    // --- units -------------------------------------------------------------
    const projects = linesOfType("IFCPROJECT");
    for (const projectId of projects) {
        const line = api.GetLine(modelID, projectId, false);
        const assignmentId = referencesOf(line?.UnitsInContext)[0];
        if (assignmentId === undefined) continue;

        const assignment = api.GetLine(modelID, assignmentId, false);
        const assignments: Record<string, string> = {};

        for (const unitId of referencesOf(assignment?.Units)) {
            const unit = api.GetLine(modelID, unitId, false);
            if (!unit) continue;

            const unitType = decodeString(unit.UnitType);
            if (unitType === undefined) continue;

            const prefix = decodeString(unit.Prefix);
            const name = decodeString(unit.Name) ?? decodeString(unit.Currency);

            // A conversion-based unit says what it converts to and by how much, and the
            // factor is worth carrying: "inch x0.0254" is readable, "inch" alone is not.
            const conversionId = referencesOf(unit.ConversionFactor)[0];
            const factor = conversionId === undefined
                ? undefined
                : decodeNumber(api.GetLine(modelID, conversionId, false)?.ValueComponent);

            assignments[unitType] = [prefix, name ?? nameOfType(unit.type), factor === undefined ? undefined : `x${factor}`]
                .filter(part => part !== undefined)
                .join(" ");
        }

        const nodeId = nodeFor(projectId);
        if (nodeId === undefined) continue;

        builder.node(nodeId).hold(
            IFC4_TYPE.units, "units",
            builder.addRow(IFC4_TYPE.units, { expressId: assignmentId, geometryUnit: "METRE", assignments }),
        );
    }

    // --- relationships -----------------------------------------------------
    const relationshipTypes = new Set<string>();
    let relationshipCount = 0;

    for (const relId of linesOfType("IFCRELATIONSHIP")) {
        const line = api.GetLine(modelID, relId, false);
        if (!line) continue;

        const ifcType = nameOfType(line.type);
        if (ifcType.toUpperCase() === RELATIONSHIP_AS_PROPERTIES) continue;

        // The IFC naming convention is the whole of the direction: one side relates, the
        // other is related. Attributes that merely start with "Related" without pointing
        // anywhere -- RelatedObjectsType is an enumeration -- fall out here by themselves.
        const relating: Array<[string, number[]]> = [];
        const related: number[] = [];

        for (const [attribute, value] of Object.entries(line)) {
            const targets = referencesOf(value);
            if (targets.length === 0) continue;

            if (attribute.startsWith("Relating")) relating.push([attribute, targets]);
            else if (attribute.startsWith("Related")) related.push(...targets);
        }

        if (relating.length === 0 && related.length === 0) {
            warn("relationship-shape", `${ifcType} ${relId} points at nothing on either side and was left out`);
            continue;
        }

        const componentType = relationshipType(ifcType);

        const attributes: Record<string, unknown> = {};
        for (const [attribute, value] of Object.entries(line)) {
            if (NOT_ATTRIBUTES.has(attribute)) continue;
            if (attribute.startsWith("Relating") || attribute.startsWith("Related")) continue;
            if (["GlobalId", "Name", "Description"].includes(attribute)) continue;

            const decoded = decodeValue(value);
            if (decoded !== undefined) attributes[attribute] = decoded;
        }

        /** The row for this relationship, written the first time something points at it. */
        const rowFor = (attribute: string | undefined) => {
            const row: Record<string, unknown> = { expressId: relId, ifcType };
            if (attribute !== undefined) row.relating = attribute;

            const globalId = decodeString(line.GlobalId);
            if (globalId) row.globalId = globalId;
            const name = decodeString(line.Name);
            if (name) row.name = name;
            const description = decodeString(line.Description);
            if (description) row.description = description;
            if (Object.keys(attributes).length > 0) row.attributes = attributes;

            return row;
        };

        let counted = false;
        const count = () => {
            relationshipTypes.add(ifcType);
            if (!counted) {
                relationshipCount++;
                counted = true;
            }
        };

        /** Puts the component on a node, keeping it when the pair is already linked. */
        const link = (host: string, referenceName: string, index: number) => {
            if (builder.node(host).hold(componentType, referenceName, index)) return;

            // Two path elements can meet at both ends, which is two relationships between
            // the same pair. A reference name has to be unique, so the second says which
            // relationship it is rather than being dropped.
            if (!builder.node(host).hold(componentType, `${referenceName}#${relId}`, index)) {
                warn("relationship-repeat", `node ${host} already holds ${ifcType} ${relId}`);
            }
        };

        if (related.length === 0 || relating.length === 0) {
            // A relationship with one end -- a virtual space boundary bounds a space and no
            // element -- still says something about the node it is on, so it is kept. Its
            // reference names the relationship rather than a node, and the absent
            // `relating` on the row is how a reader can tell.
            const hosts = related.length === 0 ? relating.flatMap(([, targets]) => targets) : related;
            let index: number | undefined;

            for (const hostId of hosts) {
                const host = nodeFor(hostId);
                if (host === undefined) continue;

                // As in the two-ended case, the row is written only once something points
                // at it -- a table with a row and no reference would have no schema built
                // for it, because nothing would have said the type was used.
                if (index === undefined) index = builder.addRow(componentType, rowFor(undefined));
                link(host, `${ifcType} ${relId}`, index);
            }

            if (index !== undefined) count();
            else warn("relationship-shape", `${ifcType} ${relId} names nothing that could be read and was left out`);
            continue;
        }

        // One row per relating attribute, not per link: an aggregate with four hundred
        // parts is one row that four hundred references point at.
        for (const [attribute, targets] of relating) {
            const row = rowFor(attribute);
            let index: number | undefined;

            for (const relatedId of related) {
                const from = nodeFor(relatedId);
                if (from === undefined) continue;

                for (const targetId of targets) {
                    const to = nodeFor(targetId);
                    if (to === undefined) continue;
                    if (to === from) continue;

                    // The row is only written once something actually points at it.
                    if (index === undefined) index = builder.addRow(componentType, row);
                    link(from, to, index);
                }
            }

            if (index !== undefined) count();
        }
    }

    // --- the tree ----------------------------------------------------------
    const hasParent = new Set<string>();

    for (const { ifcType, parent, children } of TREE_RELATIONSHIPS) {
        for (const relId of linesOfType(ifcType)) {
            const line = api.GetLine(modelID, relId, false);
            if (!line) continue;

            const parentId = referencesOf(line[parent])[0];
            if (parentId === undefined) continue;

            const holder = nodeFor(parentId);
            if (holder === undefined) continue;

            for (const childId of referencesOf(line[children])) {
                const child = nodeFor(childId);
                if (child === undefined || child === holder) continue;

                builder.node(holder).hold(CORE_TYPE.child, child);
                // Held either way: a repeat means it already had this parent.
                hasParent.add(child);
            }
        }
    }

    // --- one root ----------------------------------------------------------
    // Types, materials and groups are not in the spatial tree and never were; nor are the
    // buffers and materials the geometry needs. Left loose they would each be a root of
    // their own, so they are gathered under the project, which is what IFC itself declares
    // them against.
    const projectRoot = projects.length === 1 ? nodeFor(projects[0]!) : undefined;
    const root = builder.node(projectRoot ?? mint.made("root"));

    if (projectRoot === undefined) {
        root.hold(CORE_TYPE.name, "IFC model");
        if (projects.length > 1) warn("projects", `the file declares ${projects.length} projects, so a node was made to hold them all`);
        if (projects.length === 0) warn("projects", `the file declares no IfcProject, so a node was made to be the root`);
    }

    function group(key: string, name: string, members: Iterable<string>): void {
        const ids = [...members].filter(id => id !== root.id && !hasParent.has(id));
        if (ids.length === 0) return;

        const id = mint.made(key);
        const node = builder.node(id);
        node.hold(CORE_TYPE.name, name);

        for (const member of ids) {
            if (node.hold(CORE_TYPE.child, member)) hasParent.add(member);
        }

        root.hold(CORE_TYPE.child, id);
        hasParent.add(id);
    }

    // Named for what it is rather than for what is usually in it: types, materials and
    // groups belong here by nature, and so does the occasional element the file never
    // put anywhere -- an opening, for instance, is related to the wall it voids and to
    // no storey at all.
    group("group/definitions", "Outside the spatial tree", nodeOfEntity.values());
    group("group/geometry", "Geometry and materials", parked);

    // --- assemble ----------------------------------------------------------
    for (const [kind, count] of seen) {
        if (count > MAX_WARNINGS_PER_KIND) warnings.push(`... and ${count - MAX_WARNINGS_PER_KIND} more of the same kind (${kind})`);
    }

    const schemas: Record<string, unknown> = {
        ...CORE_SCHEMAS,
        ...GLTF_SCHEMAS,
        ...IFC4_SCHEMAS,
        ...Object.fromEntries([...relationshipTypes].map(ifcType => [relationshipType(ifcType), relationshipSchema(ifcType)])),
    };

    const used = [...builder.components.keys()];
    const nodes = builder.nodes();

    const ifcSchema = (() => {
        try {
            return api.GetModelSchema(modelID);
        } catch {
            return "IFC4";
        }
    })();

    const header: SectionElement["header"] = {
        id: "ifc4-import",
        message: `Imported from ${ifcSchema}`,
        dataVersion: "1.0.0",
        author: "",
        timestamp: new Date().toISOString(),
        application: "mosaic-ifc4",
        ...options.provenance,
    };

    const document: MosaicSourceDocument = {
        description: `Converted from an ${ifcSchema} model. The spatial tree is core::child; every other IFC relationship is a component.`,
        components: Object.fromEntries(used.map(typeID => [typeID, builder.components.get(typeID)!])),
        index: {
            header: { MosaicVersion: "post-alpha" },
            imports: [],
            componentTables: used.map(typeID => {
                const schema = schemas[typeID];
                if (schema === undefined) throw new Error(`No schema was built for component type ${typeID}`);
                return { filename: `${typeID}.ndjson`, type: Type.Ndjson, schema };
            }),
            sections: [{ header, nodes }],
        },
    };

    return {
        document,
        warnings,
        stats: {
            schema: ifcSchema,
            nodes: nodes.length,
            components: builder.counts(),
            references: nodes.reduce((total, node) => total + (node.components?.length ?? 0), 0),
            entities: entityCount,
            relationships: relationshipCount,
            propertySets: propertySetCount,
            quantitySets: quantitySetCount,
            vertices: packer.vertexCount,
            triangles: packer.triangleCount,
            geometryBytes: packer.byteSize,
        },
    };
}
