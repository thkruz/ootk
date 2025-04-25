import { EcfVec3, Kilometers, KilometersPerSecond, linearDistance, RADIUS_OF_EARTH, Vec3 } from '../../src/main';
import { dopplerFactor, getDayOfYear } from '../../src/utils/functions';

const sincos45deg = Math.sqrt(2) / 2;

describe('Doppler factor', () => {
  it('works without observer movement and object moving away', () => {
    // North Pole
    const observerEcf = {
      x: 0,
      y: 0,
      z: RADIUS_OF_EARTH,
    } as EcfVec3;
    const positionEcf = {
      x: 0,
      y: 0,
      z: RADIUS_OF_EARTH + 500,
    } as EcfVec3;
    const velocityEcf = {
      x: 0,
      y: 0,
      z: 1,
    } as EcfVec3<KilometersPerSecond>;
    const dopFactor = dopplerFactor(observerEcf, positionEcf, velocityEcf);

    expect(dopFactor).toBeLessThan(1);
  });

  it('works without observer movement and object moving towards', () => {
    // North Pole
    const observerEcf = {
      x: 0,
      y: 0,
      z: RADIUS_OF_EARTH,
    } as EcfVec3;
    const positionEcf = {
      x: 0,
      y: 0,
      z: RADIUS_OF_EARTH + 500,
    } as EcfVec3;
    const velocityEcf = {
      x: 0,
      y: 0,
      z: -1,
    } as EcfVec3<KilometersPerSecond>;
    const dopFactor = dopplerFactor(observerEcf, positionEcf, velocityEcf);

    expect(dopFactor).toBeGreaterThan(1);
  });

  it('calculates earth rotation the same as before #1', () => {
    const observerEcf = {
      x: RADIUS_OF_EARTH,
      y: 0,
      z: 0,
    } as EcfVec3;
    const positionEcf = {
      x: (RADIUS_OF_EARTH + 500) * sincos45deg, // z*sin(45)
      y: (RADIUS_OF_EARTH + 500) * sincos45deg, // z*cos(45)
      z: 0,
    } as EcfVec3;
    const velocityEcf = {
      x: 0,
      y: 0,
      z: 0,
    } as EcfVec3<KilometersPerSecond>;
    const dopFactor = dopplerFactor(observerEcf, positionEcf, velocityEcf);

    expect(dopFactor).toMatchSnapshot();
  });

  it('works without observer movement and a stationary object', () => {
    // North Pole
    const observerEcf = {
      x: 0,
      y: 0,
      z: RADIUS_OF_EARTH,
    } as EcfVec3;
    const positionEcf = {
      x: 0,
      y: 0,
      z: RADIUS_OF_EARTH + 500,
    } as EcfVec3;
    const velocityEcf = {
      x: 0,
      y: 0,
      z: 0,
    } as EcfVec3<KilometersPerSecond>;
    const dopFactor = dopplerFactor(observerEcf, positionEcf, velocityEcf);

    expect(dopFactor).toEqual(1);
  });

  it('calculates earth rotation the same as before #2', () => {
    // North Pole
    const observerEcf = {
      x: RADIUS_OF_EARTH,
      y: 0,
      z: 0,
    } as EcfVec3;
    const positionEcf = {
      x: RADIUS_OF_EARTH + 500,
      y: 0,
      z: 0,
    } as EcfVec3;
    const velocityEcf = {
      x: 0,
      y: 0,
      z: 1,
    } as EcfVec3<KilometersPerSecond>;
    const dopFactor = dopplerFactor(observerEcf, positionEcf, velocityEcf);

    expect(dopFactor).toMatchSnapshot();
  });
});

describe('Distance function', () => {
  test('if distance calculation is correct', () => {
    expect(
      linearDistance(
        { x: 1000, y: 1000, z: 1000 } as Vec3<Kilometers>,
        { x: 1000, y: 1000, z: 1000 } as Vec3<Kilometers>,
      ),
    ).toEqual(0);
    expect(
      linearDistance(
        { x: 1000, y: 1000, z: 1000 } as Vec3<Kilometers>,
        { x: 1000, y: 1000, z: 1100 } as Vec3<Kilometers>,
      ),
    ).toEqual(100);
  });
});

describe('doy Functions', () => {
  test('if doy is correct', () => {
    expect(getDayOfYear(new Date(2022, 0, 1))).toEqual(1);
    expect(getDayOfYear(new Date(2022, 1, 1))).toEqual(32);
    expect(getDayOfYear(new Date(2022, 2, 1))).toEqual(60);
    expect(getDayOfYear(new Date(2022, 3, 1))).toEqual(91);
    expect(getDayOfYear(new Date(2022, 4, 1))).toEqual(121);
    expect(getDayOfYear(new Date(2022, 5, 1))).toEqual(152);
    expect(getDayOfYear(new Date(2022, 6, 1))).toEqual(182);
    expect(getDayOfYear(new Date(2022, 7, 1))).toEqual(213);
    expect(getDayOfYear(new Date(2022, 8, 1))).toEqual(244);
    expect(getDayOfYear(new Date(2022, 9, 1))).toEqual(274);
    expect(getDayOfYear(new Date(2022, 10, 1))).toEqual(305);
    expect(getDayOfYear(new Date(2022, 11, 1))).toEqual(335);
  });

  test('if getDayOfYear is correct in leap year', () => {
    expect(getDayOfYear(new Date(2020, 0, 1, 0))).toEqual(1);
    expect(getDayOfYear(new Date(2020, 1, 1, 0))).toEqual(32);
    expect(getDayOfYear(new Date(2020, 2, 1, 0))).toEqual(61);
    expect(getDayOfYear(new Date(2020, 3, 1, 0))).toEqual(92);
    expect(getDayOfYear(new Date(2020, 4, 1, 0))).toEqual(122);
    expect(getDayOfYear(new Date(2020, 5, 1, 0))).toEqual(153);
    expect(getDayOfYear(new Date(2020, 6, 1, 0))).toEqual(183);
    expect(getDayOfYear(new Date(2020, 7, 1, 0))).toEqual(214);
    expect(getDayOfYear(new Date(2020, 8, 1, 0))).toEqual(245);
    expect(getDayOfYear(new Date(2020, 9, 1, 0))).toEqual(275);
    expect(getDayOfYear(new Date(2020, 10, 1, 0))).toEqual(306);
    expect(getDayOfYear(new Date(2020, 11, 1, 0))).toEqual(336);
  });
});
