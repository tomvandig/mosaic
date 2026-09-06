import entity from "./schemas/entity.schema.json" with { type: "json" };
import propertySet from "./schemas/propertySet.schema.json" with { type: "json" };
import quantitySet from "./schemas/quantitySet.schema.json" with { type: "json" };
import units from "./schemas/units.schema.json" with { type: "json" };
import relationship from "./schemas/relationship.schema.json" with { type: "json" };

/** The component type each part of an IFC model becomes. */
export const IFC4_TYPE = {
    /** The entity itself: its class, its identifiers, and its own attributes. */
    entity: "ifc4::entity",
    /** An IfcPropertySet, flattened to name/value pairs. */
    propertySet: "ifc4::propertySet",
    /** An IfcElementQuantity, flattened to name/number pairs. */
    quantitySet: "ifc4::quantitySet",
    /** What the file's numbers are written in, on the project node. */
    units: "ifc4::units",
} as const;

export type Ifc4ComponentType = (typeof IFC4_TYPE)[keyof typeof IFC4_TYPE];

export const IFC4_SCHEMAS: Record<Ifc4ComponentType, unknown> = {
    [IFC4_TYPE.entity]: entity,
    [IFC4_TYPE.propertySet]: propertySet,
    [IFC4_TYPE.quantitySet]: quantitySet,
    [IFC4_TYPE.units]: units,
};

/**
 * Relationships get a component type each, rather than one shared table with a column
 * saying which kind it is.
 *
 * They are all the same shape, so one table would work. Separate ones are better to live
 * with: the archive says which relationships a model actually uses without reading a row,
 * every kind gets its own table in a database, and asking for every wall an opening was
 * cut into is a table rather than a filter.
 */
export const IFC4_RELATIONSHIP_PREFIX = "ifc4::rel::";

/** `IfcRelAggregates` -> `ifc4::rel::IfcRelAggregates` */
export function relationshipType(ifcType: string): string {
    return `${IFC4_RELATIONSHIP_PREFIX}${ifcType}`;
}

/** The schema for one relationship type, which is the shared shape under its own id. */
export function relationshipSchema(ifcType: string): unknown {
    return { ...relationship, "x-mosaic-id": relationshipType(ifcType), title: ifcType };
}
