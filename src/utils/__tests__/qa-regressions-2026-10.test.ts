/**
 * QA 2026-10 regression tests: utils (create-covariance-from-tle, photometry, functions).
 * Moved from test/qa/comm-parsers-utils.qa.test.ts (deep dive slice 2.7: comm, parsers, utils).
 *
 * Report: hq/reports/ootk-qa-deep-dive-2026-10-13.md
 *
 * Permanent regression tests for the v8 fixes of the defects cited in each
 * comment below. Do not loosen an assertion to make a test pass.
 */

import { vi } from 'vitest';
import * as ootk from '@src/main';
import {
  CovarianceFrame,
  estimateRcs,
  estimateVmagFromRcs,
  factorial,
  gamma,
} from '@src/main';
import {
  cappedScreeningCovarianceFromTle,
  createCovarianceFromTle,
  createSampleCovarianceFromTle,
} from '@src/utils/create-covariance-from-tle';

// ---------------------------------------------------------------------------
// utils: covariance from TLE (section 2.7)
// ---------------------------------------------------------------------------

describe('create-covariance-from-tle (QA 2026-10 regressions)', () => {
  const tle1 = '1 25544U 98067A   21001.00000000  .00002182  00000-0  41420-4 0  9990';
  const tle2 = '2 25544  51.6461 339.8014 0002571  34.5857 120.4689 15.48919393265019';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /*
   * Report 2.7 (C). create-covariance-from-tle.ts:37 leaves console.log in library
   * code. Expected 0 calls; actual 1 ("J2000 State: ...").
   */
  it('createCovarianceFromTle runs silently with no console.log output', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    createCovarianceFromTle(tle1, tle2);

    expect(spy).not.toHaveBeenCalled();
  });

  /*
   * Report 2.7 (C). create-covariance-from-tle.ts:132-145 writes 1-sigma values
   * (km) onto the diagonal of a covariance whose other terms are variances, and
   * swaps the in-track / cross-track slots. With caps that are never hit, the
   * RIC diagonal must stay variances: C_kk = sourceVar_kk * confidence^2, in the
   * source R, I, C order. Expected ratio 1 for each axis; actual
   * sqrt(var) * 3 / (var * 9), about 2e-5 (and the I/C slots exchanged).
   */
  it('cappedScreeningCovarianceFromTle keeps variances (km^2) on the diagonal in R, I, C order', () => {
    const src = createSampleCovarianceFromTle(tle1, tle2).matrix.elements;
    const m = cappedScreeningCovarianceFromTle(tle1, tle2, 3, [1e12, 1e12, 1e12]).matrix.elements;

    expect(m[0][0] / (src[0][0] * 9)).toBeCloseTo(1, 3);
    expect(m[1][1] / (src[1][1] * 9)).toBeCloseTo(1, 3);
    expect(m[2][2] / (src[2][2] * 9)).toBeCloseTo(1, 3);
  });

  /*
   * Report 2.7 (C). create-covariance-from-tle.ts:145 labels the result ECI
   * although the source (createSampleCovarianceFromTle default) is RIC.
   * Expected frame RIC; actual ECI.
   */
  it('cappedScreeningCovarianceFromTle keeps the source RIC frame', () => {
    const cov = cappedScreeningCovarianceFromTle(tle1, tle2, 3);

    expect(cov.frame).toBe(CovarianceFrame.RIC);
  });
});

// ---------------------------------------------------------------------------
// utils: photometry and functions (section 2.7)
// ---------------------------------------------------------------------------

describe('photometry (QA 2026-10 regressions)', () => {
  /*
   * Report 2.7 (L). photometry.ts:46-62 uses vmag = -1.3 - 2.5 log10(rcs).
   * Standard magnitude is defined at 1000 km range and 90 deg phase. For a
   * Lambertian sphere of cross-section A = pi r^2 = 1 m^2, albedo rho = 0.2:
   *   F(phi) = (2 / (3 pi)) [ (pi - phi) cos(phi) + sin(phi) ]  -> 0.2122 at 90 deg
   *   m = -26.74 - 2.5 log10( rho r^2 F(phi) / R^2 )
   *     = -26.74 - 2.5 log10( 0.2 * 0.3183 * 0.2122 / 1e12 ) = +7.93
   * Expected within 1 mag of +7.9; actual -1.3.
   */
  it('estimateVmagFromRcs(1 m^2) is about +7.9 (diffuse sphere, 1000 km, 90 deg)', () => {
    const r2 = 1 / Math.PI;
    const f = 2 / (3 * Math.PI);
    const expected = -26.74 - 2.5 * Math.log10((0.2 * r2 * f) / 1e12);

    expect(Math.abs(estimateVmagFromRcs(1)! - expected)).toBeLessThan(1);
  });
});

describe('functions (QA 2026-10 regressions)', () => {
  /*
   * Report 2.7 (C). functions.ts:58-95 estimateRcs returns 1.5 sqrt(area) (m, not
   * m^2). Optical-region RCS of a conducting sphere is pi r^2. Diameter 2 m:
   * expected 3.1416 m^2; actual 2.659.
   */
  it('estimateRcs of a 2 m diameter sphere is pi m^2', () => {
    expect(estimateRcs(2, 2, 2, 'sphere')).toBeCloseTo(Math.PI, 3);
  });

  /*
   * Report 2.7 (C). functions.ts:409 gamma(n) = factorial(n - 1), wrong for
   * non-integers. Gamma(0.5) = sqrt(pi) = 1.77245; actual factorial(-0.5) = 1.
   */
  it('gamma(0.5) is sqrt(pi)', () => {
    expect(gamma(0.5)).toBeCloseTo(Math.sqrt(Math.PI), 6);
  });

  /*
   * Report 2.7 (C). functions.ts:111 factorial uses |n|, so factorial(-1) = 1.
   * Factorial is undefined for negative integers: expected NaN or a throw; actual 1.
   */
  it('factorial(-1) is NaN or throws', () => {
    let result: number;

    try {
      result = factorial(-1);
    } catch {
      result = Number.NaN;
    }

    expect(result).toBeNaN();
  });

  /*
   * Report 2.7 (L). functions.ts:18 mag2db is 10 log10 (a power ratio, MATLAB's
   * pow2db); MATLAB mag2db(10) = 20. The JSDoc examples agree with the current
   * 10 log10 behavior. Decision 2026-10-13 (Ted): rename to pow2db, no alias,
   * so the misleading name disappears from the public API in v8.
   */
  it('pow2db(100) is 20 and mag2db is no longer exported', () => {
    const utils = ootk as unknown as Record<string, unknown>;

    expect(typeof utils.pow2db).toBe('function');
    expect((utils.pow2db as (x: number) => number)(100)).toBeCloseTo(20, 12);
    expect(utils.mag2db).toBeUndefined();
  });
});
