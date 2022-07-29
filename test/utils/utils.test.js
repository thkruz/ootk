/**
 * @file   Tests from Utils Module to ensure compatibility
 * @since  1.0.0-alpha3
 */

import { Utils } from '@lib/ootk'; // eslint-disable-line

const numDigits = 8;

const earthRadius = 6378.137;
const sincos45deg = Math.sqrt(2) / 2;

describe('Doppler factor', () => {
  it('without observer movement', () => {
    // North Pole
    const observerEcf = {
      x: 0,
      y: 0,
      z: earthRadius,
    };
    const positionEcf = {
      x: 0,
      y: 0,
      z: earthRadius + 500,
    };
    // Escape velocity
    const velocityEcf = {
      x: 7.91,
      y: 0,
      z: 0,
    };
    const dopFactor = Utils.dopplerFactor(observerEcf, positionEcf, velocityEcf);

    expect(dopFactor).toBeCloseTo(1, numDigits);
  });

  it('movement of observer is not affected', () => {
    const observerEcf = {
      x: earthRadius,
      y: 0,
      z: 0,
    };
    const positionEcf = {
      x: earthRadius + 500,
      y: 0,
      z: 0,
    };
    const velocityEcf = {
      x: 0,
      y: 7.91,
      z: 0,
    };
    const dopFactor = Utils.dopplerFactor(observerEcf, positionEcf, velocityEcf);

    expect(dopFactor).toBeCloseTo(1, numDigits);
  });

  it('special case', () => {
    const observerEcf = {
      x: earthRadius,
      y: 0,
      z: 0,
    };
    const positionEcf = {
      x: (earthRadius + 500) * sincos45deg, // z*sin(45)
      y: (earthRadius + 500) * sincos45deg, // z*cos(45)
      z: 0,
    };
    const velocityEcf = {
      x: 7.91 * sincos45deg,
      y: 7.91 * sincos45deg,
      z: 0,
    };
    const dopFactor = Utils.dopplerFactor(observerEcf, positionEcf, velocityEcf);

    expect(dopFactor).toBeCloseTo(1.0000107847789212, numDigits);
  });

  test('if negative range rate works', () => {
    const observerEcf = {
      x: earthRadius,
      y: 0,
      z: 0,
    };
    const positionEcf = {
      x: (earthRadius + 500) * sincos45deg, // z*sin(45)
      y: (earthRadius + 500) * sincos45deg, // z*cos(45)
      z: 0,
    };
    const velocityEcf = {
      x: -7.91 * sincos45deg,
      y: -7.91 * sincos45deg,
      z: 0,
    };
    const dopFactor = Utils.dopplerFactor(observerEcf, positionEcf, velocityEcf);

    expect(dopFactor).toBeCloseTo(1.000013747277977, numDigits);
  });
});

describe('Distance function', () => {
  test('if distance calculation is correct', () => {
    expect(Utils.distance({ x: 1000, y: 1000, z: 1000 }, { x: 1000, y: 1000, z: 1000 })).toEqual(0);
    expect(Utils.distance({ x: 1000, y: 1000, z: 1000 }, { x: 1000, y: 1000, z: 1100 })).toEqual(100);
  });
});

describe('Create Vector Function', () => {
  test('if vector creation is correct', () => {
    expect(Utils.createVec(1, 10, 2)).toEqual([1, 3, 5, 7, 9]);
  });
});
