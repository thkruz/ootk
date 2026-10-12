/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import {
  crossTrackEdges,
  crossTrackEdgesInto,
  fovFromSwathWidth,
  horizonHalfAngleRad,
  localRadiusKm,
  rayEllipsoidHit,
  splitRuns,
  subpointLit,
  swathFrame,
  swathWidthFromFov,
  SwathVec3,
} from '../SwathGeometry';

const DEG = Math.PI / 180;
const A = 6378.137;
// b = a (1 - f) = 6378.137 * (1 - 1/298.257223563) = 6356.752314245
const B = 6356.752314245;

/** (x/a)^2 + (y/a)^2 + (z/b)^2, which is 1 on the WGS84 surface. */
const ellipsoidResidual = (p: SwathVec3): number => (p.x / A) ** 2 + (p.y / A) ** 2 + (p.z / B) ** 2 - 1;

const SAT_R = { x: A + 500, y: 0, z: 0 };
const SAT_V = { x: 0, y: 7.6, z: 0 };

describe('localRadiusKm', () => {
  it('is the semi-major axis on the equator', () => {
    // R(0) = sqrt((a^2)^2 / a^2) = a
    expect(localRadiusKm(0)).toBeCloseTo(6378.137, 3);
  });

  it('is the semi-minor axis at the pole', () => {
    // R(pi/2) = sqrt((b^2)^2 / b^2) = b = 6356.7523 km
    expect(localRadiusKm(Math.PI / 2)).toBeCloseTo(6356.7523, 3);
  });
});

describe('swathFrame', () => {
  it('builds up/along/right for an equatorial satellite moving east', () => {
    const f = swathFrame(SAT_R, SAT_V);

    // up is the geodetic normal at (0,0): +x. along is +y. right = along x up = (0,1,0) x (1,0,0) = (0,0,-1).
    expect(f.up.x).toBeCloseTo(1, 12);
    expect(f.nadir.x).toBeCloseTo(-1, 12);
    expect(f.along.y).toBeCloseTo(1, 12);
    expect(f.right.z).toBeCloseTo(-1, 12);
  });

  it('throws when the velocity is purely vertical', () => {
    expect(() => swathFrame(SAT_R, { x: 1, y: 0, z: 0 })).toThrow();
  });
});

describe('crossTrackEdges', () => {
  it('returns symmetric points on the ellipsoid with the spherical half-width', () => {
    const { left, right, clamped } = crossTrackEdges(SAT_R, SAT_V, 10 * DEG);

    expect(clamped).toBe(false);
    expect(Math.abs(ellipsoidResidual(left))).toBeLessThan(1e-9);
    expect(Math.abs(ellipsoidResidual(right))).toBeLessThan(1e-9);
    // Mirror images across the equatorial plane.
    expect(left.x).toBeCloseTo(right.x, 9);
    expect(left.z).toBeCloseTo(-right.z, 9);
    expect(left.y).toBeCloseTo(0, 9);

    /*
     * Spherical half-width R (asin((R+h)/R sin theta) - theta) with R = a, h = 500, theta = 10 deg:
     * 6378.137 * (asin(1.0783929 * 0.1736482) - 0.1745329) = 88.274 km (Python check).
     * Measured here as the chord from the sub-satellite point (a, 0, 0) to the edge.
     */
    const halfWidth = Math.hypot(right.x - A, right.y, right.z);

    expect(Math.abs(halfWidth - 88.274)).toBeLessThan(0.5);
  });

  it('clamps an angle beyond the horizon and stays on the ellipsoid', () => {
    // Horizon from 500 km over the equator: asin(a / (a + 500)) = 68.02 deg; 80 deg is past it.
    const { left, right, clamped } = crossTrackEdges(SAT_R, SAT_V, 80 * DEG);

    expect(clamped).toBe(true);
    expect(Math.abs(ellipsoidResidual(left))).toBeLessThan(1e-9);
    expect(Math.abs(ellipsoidResidual(right))).toBeLessThan(1e-9);
  });

  it('the allocation-free variant writes the same points into the caller buffer', () => {
    const out = new Float64Array(6);
    const res = crossTrackEdgesInto(SAT_R.x, SAT_R.y, SAT_R.z, SAT_V.x, SAT_V.y, SAT_V.z, 10 * DEG, out);
    const ref = crossTrackEdges(SAT_R, SAT_V, 10 * DEG);

    expect(res).toBe(0);
    expect(out[0]).toBe(ref.left.x);
    expect(out[5]).toBe(ref.right.z);
  });
});

describe('horizonHalfAngleRad', () => {
  it('matches asin(a / |r|) over the equator', () => {
    // asin(6378.137 / 6878.137) = 68.0187 deg
    expect(horizonHalfAngleRad(SAT_R) / DEG).toBeCloseTo(68.0187, 3);
  });
});

describe('rayEllipsoidHit', () => {
  it('returns null for a ray pointing away from Earth', () => {
    expect(rayEllipsoidHit(SAT_R, { x: 1, y: 0, z: 0 })).toBeNull();
  });

  it('returns null for a ray that passes beside Earth', () => {
    expect(rayEllipsoidHit(SAT_R, { x: 0, y: 1, z: 0 })).toBeNull();
  });

  it('hits the sub-satellite point straight down', () => {
    const hit = rayEllipsoidHit(SAT_R, { x: -1, y: 0, z: 0 });

    // Origin a + 500 along -x by t = 500 lands on (a, 0, 0).
    expect(hit?.x).toBeCloseTo(6378.137, 9);
  });
});

describe('subpointLit', () => {
  it('is lit at local noon even with a high minimum elevation', () => {
    // Sun overhead: up . s = 1 >= sin(89 deg) = 0.99985
    expect(subpointLit(SAT_R, { x: 1, y: 0, z: 0 }, 89 * DEG)).toBe(true);
  });

  it('is dark at local midnight', () => {
    // up . s = -1 < sin(0) = 0
    expect(subpointLit(SAT_R, { x: -1, y: 0, z: 0 }, 0)).toBe(false);
  });
});

describe('splitRuns', () => {
  it('shares boundary samples between adjacent runs', () => {
    expect(splitRuns([true, true, false, false, true])).toEqual([
      { lit: true, i0: 0, i1: 1 },
      { lit: false, i0: 1, i1: 3 },
      { lit: true, i0: 3, i1: 4 },
    ]);
  });

  it('breaks runs at nulls without sharing across them', () => {
    expect(splitRuns([true, true, null, false, false])).toEqual([
      { lit: true, i0: 0, i1: 1 },
      { lit: false, i0: 3, i1: 4 },
    ]);
  });

  it('drops runs shorter than two samples', () => {
    expect(splitRuns([true, null, false])).toEqual([]);
    expect(splitRuns([])).toEqual([]);
  });
});

describe('fovFromSwathWidth', () => {
  it('matches the hr-eo preset (12 km from 500 km)', () => {
    /*
     * lam = 12 / (2 * 6371.0088) = 9.41767e-4 rad;
     * fov = 2 atan2(sin lam, 6871.0088/6371.0088 - cos lam) = 2 atan(0.0120000) = 1.3750 deg.
     */
    expect(Math.abs(fovFromSwathWidth(12, 500) / DEG - 1.375)).toBeLessThan(0.01);
  });

  it('round-trips through swathWidthFromFov', () => {
    // Landsat 9: 185 km from 705 km needs 14.935 deg (Python check).
    expect(fovFromSwathWidth(185, 705) / DEG).toBeCloseTo(14.935, 2);
    expect(swathWidthFromFov(14.935 * DEG, 705)).toBeCloseTo(185, 0);
  });
});
