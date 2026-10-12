/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import { Degrees, Kilometers } from '../../main';
import { ValidationError } from '../../errors';
import { ElevationMask, FieldOfView } from '../FieldOfView';

const TOL = 1e-9;

/**
 * Four-vertex test mask. In interpolated mode only startAz/minEl matter; in step mode each
 * entry covers the sector up to the next vertex minus one degree.
 */
const VERTICES: ElevationMask[] = [
  { startAz: 0 as Degrees, stopAz: 89 as Degrees, minEl: 5 as Degrees },
  { startAz: 90 as Degrees, stopAz: 179 as Degrees, minEl: 25 as Degrees },
  { startAz: 180 as Degrees, stopAz: 269 as Degrees, minEl: 5 as Degrees },
  { startAz: 270 as Degrees, stopAz: 359 as Degrees, minEl: 25 as Degrees },
];

const makeFov = (masks: ElevationMask[], interpolate?: boolean, minElevation = 0) =>
  new FieldOfView({
    halfAngle: 90 as Degrees,
    minRange: 0 as Kilometers,
    maxRange: 50000 as Kilometers,
    minElevation: minElevation as Degrees,
    elevationMasks: masks,
    interpolate,
  });

describe('FieldOfView step elevation mask (interpolate off)', () => {
  /*
   * Recorded from the unmodified implementation before the interpolate flag existed.
   * Step semantics: the sector containing az sets the floor; 45 is in [0,89] -> 5,
   * 135 in [90,179] -> 25, 315 and 359 in [270,359] -> 25, 0 in [0,89] -> 5.
   */
  const fov = makeFov(VERTICES);

  it.each([
    [45, 5],
    [135, 25],
    [315, 25],
    [359, 25],
    [0, 5],
  ])('az %d -> %d', (az, expected) => {
    expect(fov.getMinElevation(az as Degrees)).toBe(expected);
  });

  it('defaults interpolateMask to false', () => {
    expect(fov.interpolateMask).toBe(false);
  });
});

describe('FieldOfView interpolated elevation mask', () => {
  const fov = makeFov(VERTICES, true);

  /*
   * Hand derivation, el(az) = el0 + (el1 - el0) * (az - az0) / (az1 - az0):
   *   45:  between (0,5) and (90,25):    5 + 20 * 45/90 = 15
   *   135: between (90,25) and (180,5):  25 - 20 * 45/90 = 15
   *   315: between (270,25) and (360,5): 25 - 20 * 45/90 = 15 (wraps to the az 0 vertex)
   *   359: between (270,25) and (360,5): 25 - 20 * 89/90 = 5.2222...
   *   0:   on the (0,5) vertex           = 5
   */
  it.each([
    [45, 15],
    [135, 15],
    [315, 15],
    [359, 5.222222222222222],
    [0, 5],
  ])('az %d -> %d', (az, expected) => {
    expect(Math.abs(fov.getMinElevation(az as Degrees) - expected)).toBeLessThan(TOL);
  });

  it('sorts unsorted vertices once in the constructor', () => {
    const shuffled = [VERTICES[2], VERTICES[0], VERTICES[3], VERTICES[1]];
    const sortedFov = makeFov(shuffled, true);

    expect(sortedFov.elevationMasks.map((m) => m.startAz)).toEqual([0, 90, 180, 270]);
    // Same hand value as above: 5 + 20 * 45/90
    expect(Math.abs(sortedFov.getMinElevation(45 as Degrees) - 15)).toBeLessThan(TOL);
  });

  it('wraps below the first vertex when no vertex sits at az 0', () => {
    // Vertices (10,20) and (190,0): az 5 lies between (190,0) and (370,20), offset 175 of 180
    // -> 0 + 20 * 175/180 = 19.4444...
    const offsetFov = makeFov(
      [
        { startAz: 10 as Degrees, stopAz: 10 as Degrees, minEl: 20 as Degrees },
        { startAz: 190 as Degrees, stopAz: 190 as Degrees, minEl: 0 as Degrees },
      ],
      true,
    );

    expect(Math.abs(offsetFov.getMinElevation(5 as Degrees) - 19.444444444444443)).toBeLessThan(TOL);
  });

  it('never returns below the global minimum elevation', () => {
    // Sensor minEl 10 beats the 5 deg vertex at az 0 -> max(10, 5) = 10
    const floored = makeFov(VERTICES, true, 10);

    expect(floored.getMinElevation(0 as Degrees)).toBe(10);
    // ...but the 25 deg vertex at az 90 still wins -> max(10, 25) = 25
    expect(floored.getMinElevation(90 as Degrees)).toBe(25);
  });

  it('rejects targets under the interpolated horizon in contains()', () => {
    // Floor at az 45 is 15 (see above)
    expect(fov.contains({ rng: 1000 as Kilometers, az: 45 as Degrees, el: 14 as Degrees })).toBe(false);
    expect(fov.contains({ rng: 1000 as Kilometers, az: 45 as Degrees, el: 16 as Degrees })).toBe(true);
  });

  it('serialises the interpolate flag and round-trips', () => {
    const params = fov.serialize();

    expect(params.interpolate).toBe(true);
    expect(new FieldOfView(params).getMinElevation(45 as Degrees)).toBeCloseTo(15, 9);
    expect(makeFov(VERTICES).serialize().interpolate).toBeUndefined();
    expect(fov.toString()).toContain('4 interpolated vertices');
  });

  describe('contains() on a masked cone (mask tested after the cone)', () => {
    /*
     * Cone: boresight az 90, el 15, half-angle 20; global floor 10; interpolated VERTICES mask,
     * whose floor at az 90 is the 25 deg vertex. Every point sits on the az 90 (or az 270)
     * vertical great circle, so its off-boresight angle is simply |el - 15| (or 180 - el - 15
     * through the zenith for az 270). Inside the cone means off-boresight <= 20.
     */
    const coneFov = new FieldOfView({
      boresightAz: 90 as Degrees,
      boresightEl: 15 as Degrees,
      halfAngle: 20 as Degrees,
      minRange: 0 as Kilometers,
      maxRange: 50000 as Kilometers,
      minElevation: 10 as Degrees,
      elevationMasks: VERTICES,
      interpolate: true,
    });
    const unmasked = new FieldOfView({
      boresightAz: 90 as Degrees,
      boresightEl: 15 as Degrees,
      halfAngle: 20 as Degrees,
      minRange: 0 as Kilometers,
      maxRange: 50000 as Kilometers,
      minElevation: 10 as Degrees,
    });

    it.each([
      // [label, rng, az, el, masked, unmasked]
      ['in cone (15 off), above mask 25', 1000, 90, 30, true, true],
      ['in cone (10 off), exactly on mask 25', 1000, 90, 25, true, true],
      ['in cone (5 off), below mask 25', 1000, 90, 20, false, true],
      ['in cone (10 off), below global floor 10', 1000, 90, 5, false, false],
      ['outside cone (25 off), above mask 25', 1000, 90, 40, false, false],
      ['behind (180 - 30 - 15 = 135 off), above mask 25 at az 270', 1000, 270, 30, false, false],
      ['in cone, above mask, beyond max range', 60000, 90, 30, false, false],
    ])('%s', (_label, rng, az, el, masked, open) => {
      const rae = { rng: rng as Kilometers, az: az as Degrees, el: el as Degrees };

      expect(coneFov.contains(rae)).toBe(masked);
      expect(unmasked.contains(rae)).toBe(open);
    });
  });

  describe('validation', () => {
    const v = (startAz: number, minEl: number): ElevationMask => ({
      startAz: startAz as Degrees,
      stopAz: startAz as Degrees,
      minEl: minEl as Degrees,
    });

    it('throws for a single vertex', () => {
      expect(() => makeFov([v(0, 5)], true)).toThrow(ValidationError);
    });

    it('throws for more than 72 vertices', () => {
      const many = Array.from({ length: 73 }, (_, i) => v(i * 4.9, 5));

      expect(() => makeFov(many, true)).toThrow(ValidationError);
    });

    it('accepts exactly 72 vertices', () => {
      const many = Array.from({ length: 72 }, (_, i) => v(i * 5, 5));

      expect(() => makeFov(many, true)).not.toThrow();
    });

    it('throws for azimuth 360', () => {
      expect(() => makeFov([v(0, 5), v(360, 5)], true)).toThrow(ValidationError);
    });

    it('throws for duplicate azimuths', () => {
      expect(() => makeFov([v(0, 5), v(90, 5), v(90, 10)], true)).toThrow(ValidationError);
    });

    it('throws for elevation 90', () => {
      expect(() => makeFov([v(0, 5), v(90, 90)], true)).toThrow(ValidationError);
    });

    it('throws for negative elevation', () => {
      expect(() => makeFov([v(0, -1), v(90, 5)], true)).toThrow(ValidationError);
    });
  });
});
