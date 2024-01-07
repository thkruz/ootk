import { Matrix } from 'ootk-core';

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
