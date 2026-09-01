/**
 * Node ids that are the same every time the same file is converted.
 *
 * Conversion normally mints a random uuid per node, which is right for a one-off import
 * but means re-converting a model breaks anything that referenced it by id. Seeding the
 * ids from the source file name and the order elements are visited makes a conversion
 * reproducible, so another document can name a node and keep naming it.
 *
 * These are not globally unique: converting the same file twice is meant to collide, and
 * two different files collide only if their seeds do. Use them when a conversion has to be
 * referenced from elsewhere, and the random default otherwise.
 */

function fnv1a(text: string): number {
    let hash = 0x811c9dc5;

    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }

    return hash >>> 0;
}

function hex8(value: number): string {
    return value.toString(16).padStart(8, "0");
}

/** Builds a generator of reproducible, v4-shaped ids for one conversion. */
export function stableIds(seed: string): () => string {
    let counter = 0;

    return () => {
        const n = ++counter;
        const a = hex8(fnv1a(`${seed}/${n}`));
        const b = hex8(fnv1a(`${seed}#${n}`));
        const c = hex8(fnv1a(`${seed}~${n}`));

        // Shaped like a v4 uuid -- version 4, variant 8 -- so it passes anything that
        // checks the format, while being a function of the seed rather than of chance.
        return `${a}-${b.slice(0, 4)}-4${b.slice(4, 7)}-8${c.slice(0, 3)}-${c.slice(3, 8)}${a.slice(1, 8)}`;
    };
}
