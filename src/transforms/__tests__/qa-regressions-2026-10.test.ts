/**
 * Permanent regression tests for the v8 fixes from the 2026-10-13 deep-dive audit, section 2.1
 * (transforms) plus item 16 (eci2lla polar axis). Report: hq/reports/ootk-qa-deep-dive-2026-10-13.md
 *
 * Moved from test/qa/time-transforms-body.qa.test.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { azel2uv, calcInertAz, Degrees, eci2lla, jday, Radians, TemeVec3 } from '@src/main';

describe('Transforms (QA 2026-10 regressions)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Report item 16. src/transforms/transforms.ts:122 alt = R / cos(lat) - a*C with R = 0 on the polar axis.
  // Expected: (0, 0, 6856.75) is 500 km above the north pole. Actual: about -6399.6 km.
  it('eci2lla returns +500 km altitude above the north pole', () => {
    const lla = eci2lla({ x: 0, y: 0, z: 6356.7523142 + 500 } as TemeVec3, 0);

    expect(lla.lat).toBeCloseTo(90, 6);
    expect(lla.alt).toBeCloseTo(500, 3);
  });

  // Report item 16. src/transforms/transforms.ts:122 same R / cos(lat) singularity at the south pole.
  // Expected: (0, 0, -6856.75) is 500 km above the south pole. Actual: about -6399.6 km.
  it('eci2lla returns +500 km altitude above the south pole', () => {
    const lla = eci2lla({ x: 0, y: 0, z: -(6356.7523142 + 500) } as TemeVec3, 0);

    expect(lla.lat).toBeCloseTo(-90, 6);
    expect(lla.alt).toBeCloseTo(500, 3);
  });

  // Report 2.1. src/transforms/transforms.ts:371-378 jday() with no args divides a day-of-month
  // difference by MILLISECONDS_TO_DAYS. Contract pinned here: the no-argument branch returns the
  // same quantity as the with-arguments branch, the Julian date of "now". 2026-10-13T12:00:00Z is
  // JD 2461327.0 (unix ms / 86400000 + 2440587.5). Actual: (13 - 31) / 1.15741e-8, about -1.56e9.
  it('jday() with no arguments returns the Julian date of now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
    const result = jday();

    expect(result).toBeCloseTo(Date.UTC(2026, 9, 13, 12) / 86400000 + 2440587.5, 6);
  });

  // Report 2.1. src/transforms/transforms.ts:456-471 calcInertAz only checks inc < lat (signed).
  // Expected: lat -60, inc 30 is unreachable (|lat| > inc) and must throw. Actual: returns NaN.
  it('calcInertAz throws for lat -60 / inc 30 (unreachable)', () => {
    expect(() => calcInertAz(-60 as Degrees, 30 as Degrees)).toThrow();
  });

  // Report 2.1. src/transforms/transforms.ts:456-471 retrograde case ignored.
  // Expected: lat 28, inc 170 violates inc <= 180 - |lat| (152) and must throw. Actual: returns NaN.
  it('calcInertAz throws for lat 28 / inc 170 (retrograde, unreachable)', () => {
    expect(() => calcInertAz(28 as Degrees, 170 as Degrees)).toThrow();
  });

  // Report 2.1. src/transforms/transforms.ts:504-510 bounds check `az > c && az < c` is always false.
  // Expected: az = 0.5 rad outside a 0.1 rad cone throws. Actual: returns a u/v pair.
  it('azel2uv throws when azimuth is outside the cone half angle', () => {
    expect(() => azel2uv(0.5 as Radians, 0 as Radians, 0.1 as Radians)).toThrow();
  });

  // Report 2.1. src/transforms/transforms.ts:508 same dead check for elevation.
  it('azel2uv throws when elevation is outside the cone half angle', () => {
    expect(() => azel2uv(0 as Radians, 0.5 as Radians, 0.1 as Radians)).toThrow();
  });
});
