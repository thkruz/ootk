import { Matrix } from '../operations/Matrix';
import { Vector3D } from '../operations/Vector3D';

export const radecToPosition = (ra: number, dec: number, r: number): Vector3D => {
  const ca = Math.cos(ra);
  const sa = Math.sin(ra);
  const cd = Math.cos(dec);
  const sd = Math.sin(dec);

  return new Vector3D(r * cd * ca, r * cd * sa, r * sd);
};

export const radecToVelocity = (
  ra: number,
  dec: number,
  r: number,
  raDot: number,
  decDot: number,
  rDot: number,
): Vector3D => {
  const ca = Math.cos(ra);
  const sa = Math.sin(ra);
  const cd = Math.cos(dec);
  const sd = Math.sin(dec);

  return new Vector3D(
    rDot * cd * ca - r * sd * ca * decDot - r * cd * sa * raDot,
    rDot * cd * sa - r * sd * sa * decDot + r * cd * ca * raDot,
    rDot * sd + r * cd * decDot,
  );
};

export const normalizeAngle = (a: number, b: number): number => {
  const x = a - b;

  return Math.atan2(Math.sin(x), Math.cos(x));
};

export const observationDerivative = (xh: number, xl: number, step: number, isAngle = false): number =>
  (isAngle ? normalizeAngle(xh, xl) : xh - xl) / step;

export const observationNoiseFromSigmas = (sigmas: number[]): Matrix => {
  const n = sigmas.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0.0));

  for (let i = 0; i < n; i++) {
    const s = sigmas[i];

    result[i][i] = 1 / (s * s);
  }

  return new Matrix(result);
};
