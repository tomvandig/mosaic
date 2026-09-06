/**
 * Asks the published S1 database questions, to see the component schemas as columns.
 *
 * Every component type carries its own JSON Schema, and the database builds a column per
 * declared property from it. If a schema were wrong, or left itself open, this is where it
 * would show -- as a property with nowhere to go.
 */
import { pathToFileURL } from "node:url";

process.env.MOSAIC_DUCKDB ??= "D:/mosaic/sdk/ts";

const { MosaicDatabase } = await import(pathToFileURL("D:/mosaic/sdk/ts/src/duckdb/Export.ts").href);

const db = await MosaicDatabase.open("D:/s1/mosaic/s1.duckdb");

const ask = async (label, sql) => {
    console.log(`\n--- ${label}`);
    try {
        for (const row of (await db.all(sql)).slice(0, 12)) console.log("   ", JSON.stringify(row));
    } catch (error) {
        console.log("    failed:", String(error).split("\n")[0]);
    }
};

try {
    await ask("what a component reference looks like", `
        SELECT node_id, type, ref_id, idx FROM mosaic_component_ref
        WHERE type LIKE 'ifc4::rel::%' LIMIT 4`);

    await ask("property sets, and how many elements each defines", `
        SELECT p.name, count(*) AS defines
        FROM "ifc4::propertySet" p
        JOIN mosaic_component_ref r ON r.type = 'ifc4::propertySet' AND r.idx = p.idx AND r.file_id = p.file_id
        GROUP BY 1 ORDER BY defines DESC LIMIT 8`);

    await ask("a property set, read back whole", `
        SELECT name, description, properties FROM "ifc4::propertySet"
        WHERE length(properties) > 200 LIMIT 2`);

    await ask("concrete volume from the quantities (file units, not metres)", `
        SELECT count(*) AS sets_with_a_net_volume,
               round(sum(CAST(json_extract(quantities, '$.NetVolume') AS DOUBLE)), 1) AS total
        FROM "ifc4::quantitySet"
        WHERE json_extract(quantities, '$.NetVolume') IS NOT NULL`);

    await ask("what the numbers are in", `SELECT assignments, "geometryUnit" FROM "ifc4::units"`);

    await ask("relationship links, by class", `
        SELECT type, count(*) AS links FROM mosaic_component_ref
        WHERE type LIKE 'ifc4::rel::%' GROUP BY 1 ORDER BY links DESC`);

    await ask("how many elements had an opening cut into them", `
        SELECT count(DISTINCT ref_id) AS elements_voided, count(*) AS openings
        FROM mosaic_component_ref WHERE type = 'ifc4::rel::IfcRelVoidsElement'`);

    await ask("every column the entity table got from its schema", `
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'ifc4::entity' ORDER BY ordinal_position`);

    await ask("beams and columns, by storey, through the containment relationship", `
        SELECT s.name AS storey, e."ifcType", count(*) AS n
        FROM "ifc4::entity" e
        JOIN mosaic_component_ref r
          ON r.node_id = (SELECT node_id FROM mosaic_component_ref x
                          WHERE x.type = 'ifc4::entity' AND x.idx = e.idx AND x.file_id = e.file_id LIMIT 1)
         AND r.type = 'ifc4::rel::IfcRelContainedInSpatialStructure'
        JOIN mosaic_component_ref sr ON sr.node_id = r.ref_id AND sr.type = 'ifc4::entity'
        JOIN "ifc4::entity" s ON s.idx = sr.idx AND s.file_id = sr.file_id
        WHERE e."ifcType" IN ('IfcBeam', 'IfcColumn')
        GROUP BY 1, 2 ORDER BY 1, 2 LIMIT 10`);
} finally {
    await db.close();
}
