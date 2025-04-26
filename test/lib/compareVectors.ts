/**
 * Helper from satellite.js to compare vectors
 */

import { Vec3 } from '../../src/main';

export const compareVectors = (vector1: Vec3, vector2: Vec3, numDigits: number) => {
  if (!numDigits) {
    expect(vector1.x).toEqual(vector2.x);
    expect(vector1.y).toEqual(vector2.y);
    expect(vector1.z).toEqual(vector2.z);
  } else {
    expect(vector1.x).toBeCloseTo(vector2.x, numDigits);
    expect(vector1.y).toBeCloseTo(vector2.y, numDigits);
    expect(vector1.z).toBeCloseTo(vector2.z, numDigits);
  }
};
