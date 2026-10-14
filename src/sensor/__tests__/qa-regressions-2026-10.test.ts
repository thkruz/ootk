/**
 * Permanent regression tests for the ootk v8 fixes to sensor field-of-view, swath and radar geometry, from the QA deep dive
 * (hq/reports/ootk-qa-deep-dive-2026-10-13.md, section 2.6 (Conjunction, sensors, scheduling)
 * plus section 1 items 7, 8 and 14).
 *
 * Each test asserts the corrected behavior. Comments keep the report item and the original
 * src file:line of the defect as an audit trail.
 * Moved from test/qa/conjunction-sensor-scheduling.qa.test.ts.
 */

import {
  Degrees,
  FieldOfView,
  Kilometers,
  MechanicalRadar,
  Radians,
  SensorType,
  Vector3D,
  boresightFrameFromAzElRoll,
  fovFromSwathWidth,
  swathWidthFromFov,
} from '@src/main';

const DEG = Math.PI / 180;

describe('FieldOfView (QA 2026-10 regressions)', () => {
  /*
   * Report section 2.6, FieldOfView.ts:717-722. validate() accepts a missing halfAngle (every
   * sensor class JSDoc example builds a FOV like this). Expected: constructor throws.
   */
  it('FieldOfView without halfAngle throws', () => {
    const params = { minRange: 0 as Kilometers, maxRange: 1000 as Kilometers };

    expect(() => new FieldOfView(params as unknown as ConstructorParameters<typeof FieldOfView>[0])).toThrow();
  });

  /*
   * Report section 2.6, FieldOfView.ts:486-488. A zero direction vector normalizes to the origin
   * and is treated as "on boresight". Expected false.
   */
  it('containsDirection rejects a zero direction vector', () => {
    const fov = FieldOfView.circularCone(0 as Degrees, 45 as Degrees, 10 as Degrees, 0 as Kilometers, 1000 as Kilometers);

    expect(fov.containsDirection(new Vector3D(0, 0, 0), 500 as Kilometers)).toBe(false);
  });

  /*
   * Report section 2.6, FieldOfView.ts:370-372. Step-mode masks keep a reference to the caller's
   * array, so mutating it after construction changes the FOV. Expected min elevation at az 100
   * stays 0; code picks up the new 40 deg mask.
   */
  it('step-mode elevation mask is copied, not aliased to the caller array', () => {
    const masks = [{ startAz: 0 as Degrees, stopAz: 10 as Degrees, minEl: 5 as Degrees }];
    const fov = new FieldOfView({
      halfAngle: 90 as Degrees,
      minRange: 0 as Kilometers,
      maxRange: 1000 as Kilometers,
      elevationMasks: masks,
    });

    masks.push({ startAz: 90 as Degrees, stopAz: 110 as Degrees, minEl: 40 as Degrees });

    expect(fov.getMinElevation(100 as Degrees)).toBe(0);
  });

  /*
   * Report section 2.6, FieldOfView.ts:234-241. DECISION (2026-10-13, option 1): the zenith frame
   * is the limit of the general branch, so roll is measured from the boresight azimuth line.
   * boresightAz 90, roll 0: the general branch gives u = (-1, 0, 0) (west) as el -> 90, but the
   * zenith branch returns (0, 1, 0) (north), a 90 deg jump. Expected at el = 90 exactly:
   * u = cos(roll) * (-sin az, -cos az, 0) + sin(roll) * (-cos az, sin az, 0), here (-1, 0, 0).
   * Migration for v7 zenith configs: newRoll = oldRoll - boresightAz - 180 (mod 360).
   */
  it('boresight frame at the zenith is the limit of the general branch (option 1: roll from the boresight azimuth)', () => {
    const near = boresightFrameFromAzElRoll((90 * DEG) as Radians, (89.99999 * DEG) as Radians, 0 as Radians);
    const at = boresightFrameFromAzElRoll((90 * DEG) as Radians, (90 * DEG) as Radians, 0 as Radians);
    const diff = Math.hypot(near.u.x - at.u.x, near.u.y - at.u.y, near.u.z - at.u.z);

    // Continuity through the zenith.
    expect(diff).toBeLessThan(1e-3);
    // The specific option-1 vector, so a different continuous convention cannot pass.
    expect(at.u.x).toBeCloseTo(-1, 6);
    expect(at.u.y).toBeCloseTo(0, 6);
    expect(at.u.z).toBeCloseTo(0, 6);
  });

  // Same decision, with roll: az 45, roll 30 at the zenith must equal the general branch limit.
  it('zenith frame with non-zero roll matches the general branch limit (option 1)', () => {
    const az = (45 * DEG) as Radians;
    const roll = (30 * DEG) as Radians;
    const near = boresightFrameFromAzElRoll(az, (89.99999 * DEG) as Radians, roll);
    const at = boresightFrameFromAzElRoll(az, (90 * DEG) as Radians, roll);
    const ux = Math.cos(roll) * -Math.sin(az) + Math.sin(roll) * -Math.cos(az);
    const uy = Math.cos(roll) * -Math.cos(az) + Math.sin(roll) * Math.sin(az);

    expect(Math.hypot(near.u.x - at.u.x, near.u.y - at.u.y, near.u.z - at.u.z)).toBeLessThan(1e-3);
    expect(at.u.x).toBeCloseTo(ux, 6);
    expect(at.u.y).toBeCloseTo(uy, 6);
  });
});

describe('SwathGeometry (QA 2026-10 regressions)', () => {
  /*
   * Report section 2.6, SwathGeometry.ts:178-183. fovFromSwathWidth accepts widths beyond the
   * horizon limit. 6000 km at 500 km altitude: expected NaN; code returns 135.13 deg.
   */
  it('fovFromSwathWidth returns NaN for a 6000 km swath beyond the horizon', () => {
    expect(fovFromSwathWidth(6000, 500)).toBeNaN();
  });

  /*
   * Same item: the 135.13 deg FOV returned for 6000 km maps back to 3978.5 km, so the pair does
   * not round-trip. Expected: either NaN (rejected) or 6000 km back.
   */
  it('swathWidthFromFov(fovFromSwathWidth(6000 km)) rejects or round-trips at 500 km altitude', () => {
    const fov = fovFromSwathWidth(6000, 500);
    const back = swathWidthFromFov(fov, 500);

    expect(Number.isNaN(fov) || Math.abs(back - 6000) < 1).toBe(true);
  });
});

describe('MechanicalRadar (QA 2026-10 regressions)', () => {
  /*
   * Report section 2.6, MechanicalRadar.ts:86-94. scanPeriod uses angularCoverage (2 * halfAngle
   * = 180 deg for a hemisphere) instead of the 360 deg azimuth range. At 6 deg/s expected
   * 60 s; code returns 30 s.
   */
  it('scanPeriod for a hemisphere FOV is the full 360 deg azimuth scan period', () => {
    const radar = new MechanicalRadar({
      id: 1,
      name: 'QA radar',
      sensorType: SensorType.MECHANICAL_RADAR,
      beamwidth: 1 as Degrees,
      scanRate: 6 as never,
      fieldOfView: {
        halfAngle: 90 as Degrees,
        minRange: 0 as Kilometers,
        maxRange: 5000 as Kilometers,
      },
    });

    expect(radar.scanPeriod).toBeCloseTo(360 / 6, 6);
  });
});
