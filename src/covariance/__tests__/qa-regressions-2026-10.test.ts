/**
 * QA 2026-10 regression tests for src/covariance.
 *
 * Source: hq/reports/ootk-qa-deep-dive-2026-10-13.md, section 1 item 13 and section 2.2.
 * Moved from test/qa/coordinate-covariance.qa.test.ts. These are permanent regression tests for the v8 fixes.
 */
import {
  CovarianceFrame,
  CovarianceSample,
  J2000,
  StateCovariance,
  Tle,
  Vector3D,
  earthGravityParam,
  type Kilometers,
  type KilometersPerSecond,
  type TleLine1,
  type TleLine2,
} from '@src/main';

// Library mu (398600.4415), so circular test states are exactly circular to the library.
const MU = earthGravityParam;
const ISS_LINE1 = '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005' as TleLine1;
const ISS_LINE2 = '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000' as TleLine2;
const ISS_EPOCH = new Date('2025-01-19T12:00:00.000Z');

const km = (v: number) => v as Kilometers;
const kms = (v: number) => v as KilometersPerSecond;

describe('CovarianceSample (QA 2026-10 regressions)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const buildSample = (frame: CovarianceFrame, state: J2000, tle: Tle): CovarianceSample => {
    const cov = StateCovariance.fromSigmas([1, 1, 1, 0.001, 0.001, 0.001], frame);

    return new CovarianceSample(state, cov, tle);
  };

  // Report section 1 item 13, src/covariance/CovarianceSample.ts:57-61. TLE age is measured against
  // new Date() instead of the state epoch, so identical inputs produce different covariances depending
  // on the wall clock. State at TLE epoch: expected age 0 both times; actual age 0 vs 365 days
  // (LEO radial sigma factor 1 + 365^1.5, about 7,000x).
  it('CovarianceSample sigmas do not depend on the wall clock when the inputs are identical', () => {
    vi.useFakeTimers();
    const tle = new Tle(ISS_LINE1, ISS_LINE2);
    const state = tle.propagate(tle.epoch).toJ2000();

    vi.setSystemTime(ISS_EPOCH);
    const atEpoch = buildSample(CovarianceFrame.RIC, state, tle).desampleRIC().matrix.elements[0][0];

    vi.setSystemTime(new Date(ISS_EPOCH.getTime() + 365 * 86400000));
    const yearLater = buildSample(CovarianceFrame.RIC, state, tle).desampleRIC().matrix.elements[0][0];

    expect(yearLater / atEpoch).toBeCloseTo(1, 6);
  });

  // Report section 2.2 (L), src/covariance/CovarianceSample.ts:69-79. R/I/C scale factors are applied by row
  // index even for ECI input. An isotropic covariance is frame-invariant, so ECI and RIC input must desample to
  // the same RIC radial variance. With position on +Y, ECI y is radial but gets the in-track factor
  // (1.92 vs 1.56 for this TLE), so the variances differ by about (1.92/1.56)^2 = 1.51.
  it('CovarianceSample applies TLE R/I/C scaling in RIC even when the covariance is given in ECI', () => {
    vi.useFakeTimers();
    vi.setSystemTime(ISS_EPOCH);
    const tle = new Tle(ISS_LINE1, ISS_LINE2);
    const v = Math.sqrt(MU / 6778);
    const state = new J2000(tle.epoch, new Vector3D(km(0), km(6778), km(0)), new Vector3D(kms(-v), kms(0), kms(0)));

    const fromRic = buildSample(CovarianceFrame.RIC, state, tle).desampleRIC().matrix.elements[0][0];
    const fromEci = buildSample(CovarianceFrame.ECI, state, tle).desampleRIC().matrix.elements[0][0];

    expect(fromEci / fromRic).toBeCloseTo(1, 4);
  });
});
