/**
 * The 4x4 column-major matrix maths glTF node transforms need. Only what conversion
 * uses: composing a TRS into a matrix, and multiplying two matrices.
 */

export const IDENTITY: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function isIdentity(matrix: readonly number[]): boolean {
    return IDENTITY.every((value, i) => matrix[i] === value);
}

/** `a * b`, both column-major, as glTF stores them. */
export function multiply(a: readonly number[], b: readonly number[]): number[] {
    const out = new Array<number>(16).fill(0);

    for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) {
                sum += a[k * 4 + row]! * b[column * 4 + k]!;
            }
            out[column * 4 + row] = sum;
        }
    }

    return out;
}

/**
 * Builds the matrix for a translation, a unit quaternion `(x, y, z, w)` and a scale,
 * in glTF's order: `M = T * R * S`.
 */
export function composeTrs(
    translation: readonly number[] = [0, 0, 0],
    rotation: readonly number[] = [0, 0, 0, 1],
    scale: readonly number[] = [1, 1, 1],
): number[] {
    const [x, y, z, w] = [rotation[0] ?? 0, rotation[1] ?? 0, rotation[2] ?? 0, rotation[3] ?? 1];
    const [sx, sy, sz] = [scale[0] ?? 1, scale[1] ?? 1, scale[2] ?? 1];

    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    return [
        (1 - (yy + zz)) * sx, (xy + wz) * sx,       (xz - wy) * sx,       0,
        (xy - wz) * sy,       (1 - (xx + zz)) * sy, (yz + wx) * sy,       0,
        (xz + wy) * sz,       (yz - wx) * sz,       (1 - (xx + yy)) * sz, 0,
        translation[0] ?? 0,  translation[1] ?? 0,  translation[2] ?? 0,  1,
    ];
}
