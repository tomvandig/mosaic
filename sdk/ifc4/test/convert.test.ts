import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    buildMosaicFile,
    mosaicToGltf,
    writeGlb,
    CORE_TYPE,
    GLTF_TYPE,
    type ComponentElement,
    type NodeElement,
} from "mosaic-ts";
import { convertIfcFile, IFC4_TYPE, relationshipType } from "../src/index.ts";

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "cottage.ifc");

/**
 * The fixture is a cottage: a site holding a building holding one storey, three walls and
 * a room on that storey, a doorway cut out of the first wall, a wall type, a material and
 * a group. Every wall is 4 x 0.2 x 3 metres. Two of them share one solid, so anything the
 * conversion stores per geometry has to be stored once for those two.
 */
const converted = await convertIfcFile(FIXTURE);
const nodes = converted.document.index.sections[0]!.nodes;

function rows(type: string): Array<Record<string, any>> {
    return (converted.document.components[type] ?? []) as Array<Record<string, any>>;
}

function refs(node: NodeElement, type: string): ComponentElement[] {
    return (node.components ?? []).filter(component => component.type === type);
}

function nameOf(node: NodeElement): string | undefined {
    return refs(node, CORE_TYPE.name)[0]?.id;
}

function named(name: string): NodeElement {
    const found = nodes.filter(node => nameOf(node) === name);
    assert.equal(found.length, 1, `expected exactly one node named "${name}", found ${found.length}`);
    return found[0]!;
}

/** The row a reference points at. */
function rowOf(reference: ComponentElement): Record<string, any> {
    assert.notEqual(reference.index, undefined, `${reference.type} "${reference.id}" carries no value`);
    return rows(reference.type)[reference.index!]!;
}

function entityOf(node: NodeElement): Record<string, any> {
    return rowOf(refs(node, IFC4_TYPE.entity)[0]!);
}

const byId = new Map(nodes.map(node => [node.id, node]));

test("the conversion reads the file it was given", () => {
    assert.equal(converted.stats.schema, "IFC4");
    assert.deepEqual(converted.warnings, []);
});

test("every node id is used once", () => {
    assert.equal(byId.size, nodes.length);
});

test("the spatial tree becomes core::child, and only the spatial tree", () => {
    const childrenOf = (name: string) => refs(named(name), CORE_TYPE.child).map(ref => nameOf(byId.get(ref.id)!));

    assert.deepEqual(childrenOf("Meadow"), ["Cottage"]);
    assert.deepEqual(childrenOf("Cottage"), ["Ground floor"]);
    assert.deepEqual(
        childrenOf("Ground floor").sort(),
        ["Living room", "Wall A", "Wall B", "Wall C"],
    );

    // The doorway is related to the wall it voids, which is not containment, so it is not
    // a child of anything in the tree.
    assert.deepEqual(childrenOf("Wall A"), []);
});

test("the project is the only root", () => {
    const held = new Set(nodes.flatMap(node => refs(node, CORE_TYPE.child).map(ref => ref.id)));
    const roots = nodes.filter(node => !held.has(node.id));

    assert.equal(roots.length, 1);
    assert.equal(nameOf(roots[0]!), "Meadowbank");
    assert.equal(entityOf(roots[0]!).ifcType, "IfcProject");
});

test("what is not in the spatial tree is still reachable", () => {
    const outside = refs(named("Outside the spatial tree"), CORE_TYPE.child)
        .map(ref => nameOf(byId.get(ref.id)!))
        .sort();

    assert.deepEqual(outside, ["Concrete C30/37", "Doorway", "External walls", "WT-200 loadbearing"]);
});

test("an entity carries its class, its identifiers and its own attributes", () => {
    assert.deepEqual(entityOf(named("Wall A")), {
        ifcType: "IfcWall",
        expressId: 71,
        globalId: "0WallA00000000000ZZ001",
        name: "Wall A",
        description: "South wall",
        tag: "W-01",
        predefinedType: "SOLIDWALL",
    });

    // Attributes with no column of their own are kept under their IFC names.
    assert.deepEqual(entityOf(named("Meadow")).attributes, { CompositionType: "ELEMENT", RefElevation: 0 });
});

test("a node id follows the GlobalId, so it survives a re-export", async () => {
    // Converting again under a different namespace must not move a rooted entity: its id
    // comes from the GlobalId, which is the same in both files.
    const again = await convertIfcFile(FIXTURE, { seed: "somewhere-else" });
    const there = again.document.index.sections[0]!.nodes;

    const find = (list: NodeElement[], name: string) =>
        list.find(node => (node.components ?? []).some(c => c.type === CORE_TYPE.name && c.id === name))!;

    assert.equal(find(there, "Wall A").id, named("Wall A").id);
    assert.equal(find(there, "Ground floor").id, named("Ground floor").id);
});

test("property sets are written once and shared by everything they define", () => {
    const sets = rows(IFC4_TYPE.propertySet);
    assert.equal(sets.length, 2, "one instance set and one type set");

    const instance = refs(named("Wall A"), IFC4_TYPE.propertySet)[0]!;
    assert.equal(instance.id, "Pset_WallCommon");
    assert.deepEqual(rowOf(instance).properties, { IsExternal: true, LoadBearing: true, Reference: "WA-200" });

    // All three walls point at the same row rather than carrying a copy each.
    for (const wall of ["Wall B", "Wall C"]) {
        assert.equal(refs(named(wall), IFC4_TYPE.propertySet)[0]!.index, instance.index);
    }

    // The type's own set is on the type, which is where IFC puts it.
    assert.deepEqual(
        rowOf(refs(named("WT-200 loadbearing"), IFC4_TYPE.propertySet)[0]!).properties,
        { FireRating: "EI60", ThermalTransmittance: 0.24 },
    );
});

test("quantities keep their numbers and what they measure", () => {
    const quantities = rowOf(refs(named("Wall A"), IFC4_TYPE.quantitySet)[0]!);

    assert.equal(quantities.name, "Qto_WallBaseQuantities");
    assert.equal(quantities.methodOfMeasurement, "BIM");
    assert.deepEqual(quantities.quantities, { Length: 4, NetSideArea: 11.7, NetVolume: 2.34 });
    assert.deepEqual(quantities.kinds, { Length: "Length", NetSideArea: "Area", NetVolume: "Volume" });

    // Only wall A was given quantities.
    assert.deepEqual(refs(named("Wall B"), IFC4_TYPE.quantitySet), []);
});

test("units say what the file used, and what the geometry is in", () => {
    const units = rowOf(refs(named("Meadowbank"), IFC4_TYPE.units)[0]!);

    assert.equal(units.geometryUnit, "METRE");
    assert.equal(units.assignments.LENGTHUNIT, "METRE");
    assert.equal(units.assignments.AREAUNIT, "SQUARE_METRE");
});

test("a relationship is a component on the related node, named for the relating one", () => {
    const type = relationshipType("IfcRelContainedInSpatialStructure");
    const contained = refs(named("Wall A"), type);

    assert.equal(contained.length, 1);
    assert.equal(contained[0]!.id, named("Ground floor").id, "the reference names the node at the other end");
    assert.equal(rowOf(contained[0]!).relating, "RelatingStructure");
    assert.equal(rowOf(contained[0]!).globalId, "0Contain00000000ZZ01");

    // A relationship object is one row however many links it makes.
    assert.equal(rows(type).length, 1);
    for (const wall of ["Wall B", "Wall C"]) {
        assert.equal(refs(named(wall), type)[0]!.index, contained[0]!.index);
    }
});

test("relationships that are not containment come through too", () => {
    const links = (node: string, ifcType: string) =>
        refs(named(node), relationshipType(ifcType)).map(ref => nameOf(byId.get(ref.id)!));

    assert.deepEqual(links("Wall A", "IfcRelDefinesByType"), ["WT-200 loadbearing"]);
    assert.deepEqual(links("Wall A", "IfcRelAssociatesMaterial"), ["Concrete C30/37"]);
    assert.deepEqual(links("Wall A", "IfcRelAssignsToGroup"), ["External walls"]);
    assert.deepEqual(links("Doorway", "IfcRelVoidsElement"), ["Wall A"]);

    // Wall C was left out of the group in the file, so it has no link to it.
    assert.deepEqual(links("Wall C", "IfcRelAssignsToGroup"), []);

    // The tree is core::child, but the relationship that made it is still recorded.
    assert.deepEqual(links("Cottage", "IfcRelAggregates"), ["Meadow"]);
});

test("geometry is stored once for the solid two walls share", () => {
    const meshOf = (name: string) => refs(named(name), GLTF_TYPE.meshPrimitive).map(ref => ref.index);

    assert.deepEqual(meshOf("Wall B"), meshOf("Wall C"), "same solid, same colour, same primitive");
    assert.notDeepEqual(meshOf("Wall A"), meshOf("Wall B"), "wall A has a doorway cut out of it");

    assert.equal(rows(GLTF_TYPE.meshPrimitive).length, 2);
    assert.equal(rows(GLTF_TYPE.buffer).length, 1, "one buffer holds every triangle");
});

test("the mesh is triangles, in metres, the way up glTF wants", () => {
    const primitive = rows(GLTF_TYPE.meshPrimitive)[meshIndexOf("Wall B")]!;

    // No mode means TRIANGLES, which is the only thing the geometry engine produces.
    assert.equal(primitive.mode, undefined);

    const accessors = rows(GLTF_TYPE.accessor);
    const accessorNamed = (id: string) => {
        const node = byId.get(id)!;
        return accessors[refs(node, GLTF_TYPE.accessor)[0]!.index!]!;
    };

    const position = accessorNamed(primitive.attributes.POSITION);
    assert.equal(position.type, "VEC3");
    assert.equal(position.componentType, 5126, "FLOAT");

    // 4 x 0.2 x 3 metres, extruded upward and centred on its own origin. The height is on
    // the second axis because the geometry arrives Y-up, which is glTF's convention and
    // not IFC's.
    const size = [0, 1, 2].map(axis => +(position.max[axis] - position.min[axis]).toFixed(3));
    assert.deepEqual(size, [4, 0.2, 3]);

    const indices = accessorNamed(primitive.indices);
    assert.equal(indices.type, "SCALAR");
    assert.equal(indices.count % 3, 0, "whole triangles");

    // The walls stand 6 metres apart along the third axis, which is where IFC's Y went.
    const transformOf = (name: string) =>
        rows(CORE_TYPE.transform)[refs(named(name), CORE_TYPE.transform)[0]!.index!]!.matrix;
    assert.deepEqual(transformOf("Wall B").slice(12, 15), [0, 1.5, -6]);
    assert.deepEqual(transformOf("Wall C").slice(12, 15), [0, 1.5, -12]);
});

function meshIndexOf(name: string): number {
    return refs(named(name), GLTF_TYPE.meshPrimitive)[0]!.index!;
}

test("the archive composes into a glTF a viewer can open", () => {
    const composed = mosaicToGltf(buildMosaicFile(converted.document));

    assert.deepEqual(composed.warnings, []);
    assert.equal(composed.document.meshes?.length, 2);
    assert.equal(composed.document.materials?.length, 2, "wall A is coloured, the others are not");

    const glb = writeGlb(composed.document, composed.binary);
    assert.equal(new DataView(glb.buffer, glb.byteOffset).getUint32(0, true), 0x46546c67, "glTF magic");

    // The walls are the only things drawn, and each is drawn once.
    const drawn = (composed.document.nodes ?? []).filter(node => node.mesh !== undefined);
    assert.equal(drawn.length, 3);
});

test("the structure alone can be converted, without the geometry", async () => {
    const plain = await convertIfcFile(FIXTURE, { withoutGeometry: true });

    assert.equal(plain.stats.triangles, 0);
    assert.equal(plain.document.components[GLTF_TYPE.buffer], undefined);
    assert.equal(plain.document.components[GLTF_TYPE.meshPrimitive], undefined);

    // Everything that is not geometry is still there, and the walls keep their ids.
    assert.equal(plain.stats.entities, converted.stats.entities);
    assert.equal((plain.document.components[IFC4_TYPE.propertySet] ?? []).length, 2);
});

test("every component table the document uses carries a schema", () => {
    const tables = converted.document.index.componentTables;
    assert.deepEqual(
        tables.map(table => table.filename).sort(),
        Object.keys(converted.document.components).map(type => `${type}.ndjson`).sort(),
    );

    for (const table of tables) {
        assert.equal(typeof table.schema, "object", `${table.filename} has no schema`);
        assert.equal((table.schema as any).additionalProperties, false,
            `${table.filename} does not seal its schema, so a property could go unstored`);
    }
});
