import { createHash } from "node:crypto";

/**
 * Node ids that survive a re-export.
 *
 * IFC already has an identifier meant to be unique everywhere -- IfcRoot.GlobalId -- so a
 * node standing for a rooted entity takes its id from that and nothing else. Re-export the
 * model from the authoring tool, convert it again, and the wall keeps the id another
 * archive was pointing at, even though every express id in the file has moved.
 *
 * Entities without a GlobalId (IfcMaterial, IfcPropertySingleValue, the geometry a mesh
 * came from) have only their line number, which is a fact about one file. Those are keyed
 * within a namespace, which defaults to the file name, so two models converted separately
 * do not quietly claim each other's ids.
 */

/** A uuid shaped like a v5 name-based one, derived from `text`. */
function uuidFrom(text: string): string {
    const hash = createHash("sha1").update(text, "utf8").digest();

    const bytes = Uint8Array.prototype.slice.call(hash, 0, 16);
    bytes[6] = (bytes[6]! & 0x0f) | 0x50;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;

    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface IdMinter {
    /** The id for an entity, from its GlobalId when it has one and its line number otherwise. */
    entity(expressId: number, globalId?: string): string;
    /** The id for something with no identity in the file at all, such as a packed buffer. */
    made(...parts: Array<string | number>): string;
}

/** Builds the id minter for one conversion. `seed` namespaces everything but GlobalIds. */
export function idMinter(seed: string): IdMinter {
    return {
        entity: (expressId, globalId) =>
            globalId ? uuidFrom(`ifc4::guid/${globalId}`) : uuidFrom(`ifc4::line/${seed}/${expressId}`),
        made: (...parts) => uuidFrom(`ifc4::made/${seed}/${parts.join("/")}`),
    };
}
