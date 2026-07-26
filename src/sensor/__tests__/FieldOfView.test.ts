/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import { Degrees, Kilometers, Radians } from '../../main';
import { FieldOfView } from '../FieldOfView';

const RAD2DEG = 180 / Math.PI;

/** Converts an ENU unit vector to azimuth/elevation in degrees. */
const enuToAzEl = (dir: { x: number; y: number; z: number }) => {
  let az = Math.atan2(dir.x, dir.y) * RAD2DEG;

  if (az < 0) {
    az += 360;
  }

  return { az: az as Degrees, el: (Math.asin(dir.z) * RAD2DEG) as Degrees };
};

describe('FieldOfView.directionAt', () => {
  /**
   * Space Fence style fan: boresight at zenith, 80° half-angle along the
   * east-west major axis (roll 90°), 1° half-angle across it.
   */
  const fenceFov = new FieldOfView({
    boresightAz: 270 as Degrees,
    boresightEl: 90 as Degrees,
    halfAngle: 80 as Degrees,
    minorHalfAngle: 1 as Degrees,
    rollAngle: 90 as Degrees,
    minRange: 50 as Kilometers,
    maxRange: 3000 as Kilometers,
    minElevation: 10 as Degrees,
  });

  it('returns the boresight at radialFraction 0', () => {
    const dir = fenceFov.directionAt(0 as Radians, 0);
    const { el } = enuToAzEl(dir);

    expect(el).toBeCloseTo(90, 6);
  });

  it('places the fan tips 10° above the horizon at east and west', () => {
    const east = enuToAzEl(fenceFov.directionAt(0 as Radians));
    const west = enuToAzEl(fenceFov.directionAt(Math.PI as Radians));

    expect(east.el).toBeCloseTo(10, 6);
    expect(east.az).toBeCloseTo(90, 6);
    expect(west.el).toBeCloseTo(10, 6);
    expect(west.az).toBeCloseTo(270, 6);
  });

  it('places the minor axis 1° from zenith', () => {
    const north = enuToAzEl(fenceFov.directionAt((Math.PI / 2) as Radians));

    expect(north.el).toBeCloseTo(89, 6);
  });

  it('produces unit vectors', () => {
    for (let i = 0; i < 16; i++) {
      const t = ((i / 16) * 2 * Math.PI) as Radians;
      const dir = fenceFov.directionAt(t, 0.5);

      expect(dir.magnitude()).toBeCloseTo(1, 10);
    }
  });

  it('round-trips through contains() for interior samples', () => {
    const rng = 1000 as Kilometers;

    for (let i = 0; i < 64; i++) {
      const t = ((i / 64) * 2 * Math.PI) as Radians;

      for (const frac of [0.1, 0.5, 0.999]) {
        const rae = { rng, ...enuToAzEl(fenceFov.directionAt(t, frac)) };

        // Skip samples masked by minElevation (fan tips sit exactly at 10°)
        if (rae.el < fenceFov.minElevation) {
          continue;
        }

        expect(fenceFov.contains(rae)).toBe(true);
      }
    }
  });

  it('rejects samples just outside the boundary', () => {
    const rng = 1000 as Kilometers;

    // Along the minor axis (t = π/2) a 5% overshoot leaves the 1° half-angle
    const rae = { rng, ...enuToAzEl(fenceFov.directionAt((Math.PI / 2) as Radians, 1.05)) };

    expect(fenceFov.contains(rae)).toBe(false);
  });

  it('handles a tilted circular cone', () => {
    const coneFov = new FieldOfView({
      boresightAz: 45 as Degrees,
      boresightEl: 40 as Degrees,
      halfAngle: 30 as Degrees,
      minRange: 100 as Kilometers,
      maxRange: 40000 as Kilometers,
      minElevation: 0 as Degrees,
    });

    for (let i = 0; i < 32; i++) {
      const t = ((i / 32) * 2 * Math.PI) as Radians;
      const { az, el } = enuToAzEl(coneFov.directionAt(t));

      expect(coneFov.angularOffset(az, el)).toBeCloseTo(30, 6);
    }
  });
});
