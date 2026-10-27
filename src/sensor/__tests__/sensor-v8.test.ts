/**
 * ootk v8 regression tests for the sensor module (QA deep dive 2026-10-13, report section 2.6;
 * plan section 2, zenith frame option 1). Each test checks a property or an independently
 * derived value rather than re-asserting the single number the qa test pins.
 */

import {
  Degrees,
  FieldOfView,
  FovShape,
  Kilometers,
  MechanicalRadar,
  Radians,
  SensorType,
  SWATH_MEAN_EARTH_RADIUS_KM,
  Vector3D,
  boresightFrameFromAzElRoll,
  fovFromSwathWidth,
  swathWidthFromFov,
} from '../../main';

const DEG = Math.PI / 180;

/** Rotates `v` about unit axis `k` by angle `a` (Rodrigues' formula). */
function rotate(v: Vector3D, k: Vector3D, a: number): Vector3D {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const kxv = k.cross(v);
  const kdv = k.dot(v);

  return new Vector3D(
    v.x * c + kxv.x * s + k.x * kdv * (1 - c),
    v.y * c + kxv.y * s + k.y * kdv * (1 - c),
    v.z * c + kxv.z * s + k.z * kdv * (1 - c),
  );
}

describe('boresightFrameFromAzElRoll at the zenith (v8 option 1)', () => {
  it('matches the general branch at el 89.99999 deg to 1e-6 over an az/roll grid', () => {
    for (let az = 0; az < 360; az += 15) {
      for (let roll = -180; roll < 180; roll += 30) {
        const near = boresightFrameFromAzElRoll((az * DEG) as Radians, (89.99999 * DEG) as Radians, (roll * DEG) as Radians);
        const at = boresightFrameFromAzElRoll((az * DEG) as Radians, (90 * DEG) as Radians, (roll * DEG) as Radians);

        expect(Math.hypot(near.u.x - at.u.x, near.u.y - at.u.y, near.u.z - at.u.z)).toBeLessThan(1e-6);
        expect(Math.hypot(near.v.x - at.v.x, near.v.y - at.v.y, near.v.z - at.v.z)).toBeLessThan(1e-6);
      }
    }
  });

  it('is right-handed the same way as the general branch: u x v = -b', () => {
    for (const [az, el, roll] of [[0, 90, 0], [123, 90, 47], [123, 45, 47], [300, 10, -80]]) {
      const f = boresightFrameFromAzElRoll((az * DEG) as Radians, (el * DEG) as Radians, (roll * DEG) as Radians);
      const uxv = f.u.cross(f.v);

      expect(uxv.x + f.b.x).toBeCloseTo(0, 12);
      expect(uxv.y + f.b.y).toBeCloseTo(0, 12);
      expect(uxv.z + f.b.z).toBeCloseTo(0, 12);
    }
  });
});

describe('FieldOfView.migrateZenithRollFromV7', () => {
  const fan = (az: number, roll: number): ConstructorParameters<typeof FieldOfView>[0] => ({
    boresightAz: az as Degrees,
    boresightEl: 90 as Degrees,
    halfAngle: 80 as Degrees,
    minorHalfAngle: 1 as Degrees,
    rollAngle: roll as Degrees,
    minRange: 0 as Kilometers,
    maxRange: 5000 as Kilometers,
  });

  it.each([
    [270, 90],
    [71, 71],
    [120, 120],
  ])('KeepTrack zenith fence az %d roll %d migrates to roll 0 (mod 180)', (az, roll) => {
    const migrated = FieldOfView.migrateZenithRollFromV7(fan(az, roll));
    const r = migrated.rollAngle! % 180;

    expect(Math.min(r, 180 - r)).toBeLessThan(1e-9);
  });

  it('reproduces the v7 major axis (sin roll, cos roll, 0) exactly', () => {
    for (let az = 0; az < 360; az += 37) {
      for (let roll = 0; roll < 360; roll += 41) {
        const v8 = new FieldOfView(FieldOfView.migrateZenithRollFromV7(fan(az, roll)));
        // v7 zenith branch: major axis u7 = (sin roll, cos roll, 0); the fan tip is b rotated 80 deg toward u7
        const tip = v8.directionAt(0 as Radians, 1);
        const c = Math.cos(80 * DEG);
        const s = Math.sin(80 * DEG);
        const expected = new Vector3D(s * Math.sin(roll * DEG), s * Math.cos(roll * DEG), c);

        expect(tip.x).toBeCloseTo(expected.x, 12);
        expect(tip.y).toBeCloseTo(expected.y, 12);
        expect(tip.z).toBeCloseTo(expected.z, 12);
      }
    }
  });

  /*
   * Verifier fix M.9: the migration used a 1e-10 DEGREE test while the frame builder uses 1e-10
   * RADIANS, so el = 90 - 1e-9 deg (1.7e-11 rad off zenith) took the zenith frame but was not
   * migrated. Both now use the radian test.
   */
  it('migrates el = 90 - 1e-9 deg, which the frame builder treats as zenith, and reproduces the v7 axis', () => {
    const el = 90 - 1e-9;

    for (const [az, roll] of [[270, 90], [33, 140]]) {
      const params = { ...fan(az, roll), boresightEl: el as Degrees };
      const migrated = FieldOfView.migrateZenithRollFromV7(params);

      expect(migrated.rollAngle).not.toBe(roll);
      const tip = new FieldOfView(migrated).directionAt(0 as Radians, 1);
      const c = Math.cos(80 * DEG);
      const s = Math.sin(80 * DEG);

      expect(tip.x).toBeCloseTo(s * Math.sin(roll * DEG), 8);
      expect(tip.y).toBeCloseTo(s * Math.cos(roll * DEG), 8);
      expect(tip.z).toBeCloseTo(c, 8);
    }
    // 1e-6 deg (1.7e-8 rad) is outside the zenith branch of both, so it is left alone
    expect(FieldOfView.migrateZenithRollFromV7({ ...fan(270, 90), boresightEl: (90 - 1e-6) as Degrees }).rollAngle).toBe(90);
  });

  it('leaves non-zenith and circular configs unchanged', () => {
    const offZenith = { ...fan(270, 90), boresightEl: 80 as Degrees };
    const circular = { ...fan(270, 90), minorHalfAngle: 80 as Degrees };
    const cone = { ...fan(270, 90), shape: FovShape.CIRCULAR_CONE };

    expect(FieldOfView.migrateZenithRollFromV7(offZenith).rollAngle).toBe(90);
    expect(FieldOfView.migrateZenithRollFromV7(circular).rollAngle).toBe(90);
    expect(FieldOfView.migrateZenithRollFromV7(cone).rollAngle).toBe(90);
  });
});

describe('FieldOfView containment at the cone boundary', () => {
  const cases = [
    [0, 90, 0, 20, 20],
    [45, 30, 0, 15, 15],
    [200, 60, 35, 30, 5],
    [310, 10, -70, 40, 2],
    [90, 90, 25, 60, 3],
  ];

  it.each(cases)('az %d el %d roll %d (%d x %d deg): on the boundary is inside, 1e-6 rad beyond is outside', (az, el, roll, major, minor) => {
    const fov = new FieldOfView({
      boresightAz: az as Degrees,
      boresightEl: el as Degrees,
      rollAngle: roll as Degrees,
      halfAngle: major as Degrees,
      minorHalfAngle: minor as Degrees,
      minRange: 0 as Kilometers,
      maxRange: 1000 as Kilometers,
    });
    const { b, u, v } = boresightFrameFromAzElRoll((az * DEG) as Radians, (el * DEG) as Radians, (roll * DEG) as Radians);

    // Along the major and the minor axis, rotate the boresight by exactly the half-angle
    for (const [axis, half] of [[v, major], [u, minor]] as [Vector3D, number][]) {
      const onEdge = rotate(b, axis, half * DEG);
      const beyond = rotate(b, axis, half * DEG + 1e-6);

      expect(fov.containsDirection(onEdge, 500 as Kilometers)).toBe(true);
      expect(fov.containsDirection(beyond, 500 as Kilometers)).toBe(false);
    }
  });

  it('a zero direction vector is never contained', () => {
    const fov = FieldOfView.hemisphere(0 as Kilometers, 1000 as Kilometers);

    expect(fov.containsDirection(new Vector3D(0, 0, 0), 500 as Kilometers)).toBe(false);
  });

  it('missing or NaN halfAngle throws', () => {
    const base = { minRange: 0 as Kilometers, maxRange: 1 as Kilometers };

    expect(() => new FieldOfView({ ...base, halfAngle: Number.NaN as Degrees })).toThrow();
    expect(() => new FieldOfView({ ...base, halfAngle: 10 as Degrees, minorHalfAngle: Number.NaN as Degrees })).toThrow();
  });

  it('step-mode masks treat az 360 and -10 like az 0 and 350', () => {
    const fov = new FieldOfView({
      halfAngle: 90 as Degrees,
      minRange: 0 as Kilometers,
      maxRange: 1000 as Kilometers,
      elevationMasks: [{ startAz: 340 as Degrees, stopAz: 20 as Degrees, minEl: 30 as Degrees }],
    });

    expect(fov.getMinElevation(360 as Degrees)).toBe(fov.getMinElevation(0 as Degrees));
    expect(fov.getMinElevation(-10 as Degrees)).toBe(fov.getMinElevation(350 as Degrees));
    expect(fov.getMinElevation(-10 as Degrees)).toBe(30);
  });
});

describe('fovFromSwathWidth (spherical Earth)', () => {
  const R = SWATH_MEAN_EARTH_RADIUS_KM;

  /**
   * Independent check: cast a ray from (0, 0, R + h) at off-nadir angle alpha and intersect it
   * with the sphere |x| = R (near root of the quadratic); return the Earth central angle of the hit.
   */
  function centralAngleOfRay(alpha: number, h: number): number {
    const z0 = R + h;
    const dx = Math.sin(alpha);
    const dz = -Math.cos(alpha);
    // |(t dx, z0 + t dz)|^2 = R^2  ->  t^2 + 2 t z0 dz + z0^2 - R^2 = 0
    const bq = z0 * dz;
    const t = -bq - Math.sqrt(bq * bq - (z0 * z0 - R * R));

    return Math.atan2(t * dx, z0 + t * dz);
  }

  it('a 100 km swath at 500 km altitude maps to a ray that lands 50 km off the ground track', () => {
    const fov = fovFromSwathWidth(100, 500);
    const lambda = centralAngleOfRay(fov / 2, 500);

    expect(lambda * R).toBeCloseTo(50, 9);
    // Flat-Earth sanity: 2 atan(50 / 500) = 11.42 deg; curvature makes it slightly smaller
    expect(fov).toBeLessThan(2 * Math.atan(50 / 500));
    expect(fov).toBeGreaterThan(2 * Math.atan(50 / 500) * 0.98);
  });

  it('is finite exactly at the horizon and NaN just beyond it', () => {
    const h = 500;
    const horizonWidth = 2 * R * Math.acos(R / (R + h));
    const atHorizon = fovFromSwathWidth(horizonWidth * (1 - 1e-12), h);

    expect(atHorizon).toBeCloseTo(2 * Math.asin(R / (R + h)), 6);
    expect(fovFromSwathWidth(horizonWidth + 1, h)).toBeNaN();
    expect(fovFromSwathWidth(-1, h)).toBeNaN();
  });

  it('round-trips with swathWidthFromFov below the horizon', () => {
    for (const w of [10, 100, 1000, 3000, 4000]) {
      expect(swathWidthFromFov(fovFromSwathWidth(w, 500), 500)).toBeCloseTo(w, 6);
    }
  });
});

describe('MechanicalRadar.scanPeriod', () => {
  const radar = (fieldOfView: ConstructorParameters<typeof FieldOfView>[0]): MechanicalRadar => new MechanicalRadar({
    id: 1,
    name: 'scan',
    sensorType: SensorType.MECHANICAL_RADAR,
    beamwidth: 1 as Degrees,
    scanRate: 10 as never,
    fieldOfView,
  });

  /** Brute-force azimuth extent of a FOV: scan az/el on a fine grid and keep contained azimuths. */
  function bruteForceAzSpan(fov: FieldOfView): number {
    let count = 0;

    for (let az = 0; az < 360; az += 0.05) {
      for (let el = 0; el <= 90; el += 0.05) {
        if (fov.contains({ rng: 500 as Kilometers, az: az as Degrees, el: el as Degrees })) {
          count++;
          break;
        }
      }
    }

    return count * 0.05;
  }

  it('a circular cone off the zenith scans its spherical azimuth span', () => {
    const params = { boresightAz: 100 as Degrees, boresightEl: 45 as Degrees, halfAngle: 10 as Degrees, minRange: 0 as Kilometers, maxRange: 1000 as Kilometers };
    const period = radar(params).scanPeriod!;

    expect(period * 10).toBeCloseTo(bruteForceAzSpan(new FieldOfView(params)), 0);
  });

  it('an elliptical fan off the zenith scans its sampled azimuth span', () => {
    const params = {
      boresightAz: 30 as Degrees, boresightEl: 20 as Degrees, halfAngle: 40 as Degrees, minorHalfAngle: 5 as Degrees,
      rollAngle: 90 as Degrees, minRange: 0 as Kilometers, maxRange: 1000 as Kilometers,
    };
    const period = radar(params).scanPeriod!;

    expect(Math.abs(period * 10 - bruteForceAzSpan(new FieldOfView(params)))).toBeLessThan(0.3);
  });

  it('a cone containing the zenith scans 360 deg', () => {
    const params = { boresightAz: 0 as Degrees, boresightEl: 70 as Degrees, halfAngle: 25 as Degrees, minRange: 0 as Kilometers, maxRange: 1000 as Kilometers };

    expect(radar(params).scanPeriod).toBeCloseTo(36, 12);
  });
});
