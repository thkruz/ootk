/**
 * Regression tests for the 2026-10 QA fixes in CovarianceSample: TLE aging is measured against the state epoch
 * (never the wall clock) and the R/I/C scale factors are applied in the RIC frame whatever the input frame.
 */
import { J2000, Matrix, RelativeState, Tle, type Seconds, type TleLine1, type TleLine2 } from '../../main';
import { CovarianceSample } from '../CovarianceSample';
import { CovarianceFrame, StateCovariance } from '../StateCovariance';

const LINE1 = '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005' as TleLine1;
const LINE2 = '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000' as TleLine2;

const radialVariance = (state: J2000, tle: Tle, frame = CovarianceFrame.RIC): number => {
  const cov = StateCovariance.fromSigmas([1, 1, 1, 0.001, 0.001, 0.001], frame);

  return new CovarianceSample(state, cov, tle).desampleRIC().matrix.elements[0][0];
};

describe('CovarianceSample TLE aging', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a state 10 days after the TLE epoch gives the same sigmas at two different wall-clock times', () => {
    const tle = new Tle(LINE1, LINE2);
    const state = tle.propagate(tle.epoch.roll((10 * 86400) as Seconds)).toJ2000();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2000-01-01T00:00:00.000Z'));
    const early = radialVariance(state, tle);

    vi.setSystemTime(new Date('2040-06-15T12:34:56.000Z'));
    const late = radialVariance(state, tle);

    expect(late).toBe(early);
  });

  /*
   * With no propagation the desampled RIC radial variance is (quality_R * aging_R)^2 for unit sigma, and for LEO
   * aging_R = 1 + t^1.5 with t the age in days (getRegimeAgingFactor). So the 10-day / 0-day variance ratio is
   * (1 + 10^1.5)^2, independent of the quality factor.
   */
  it('the 10-day / 0-day radial variance ratio equals (1 + 10^1.5)^2 for a LEO TLE', () => {
    const tle = new Tle(LINE1, LINE2);
    const atEpoch = radialVariance(tle.propagate(tle.epoch).toJ2000(), tle);
    const tenDays = radialVariance(tle.propagate(tle.epoch.roll((10 * 86400) as Seconds)).toJ2000(), tle);

    expect(tenDays / atEpoch).toBeCloseTo((1 + 10 ** 1.5) ** 2, 6);
  });

  it('aging is symmetric: 10 days before the TLE epoch inflates the same as 10 days after', () => {
    const tle = new Tle(LINE1, LINE2);
    const after = radialVariance(tle.propagate(tle.epoch.roll((10 * 86400) as Seconds)).toJ2000(), tle);
    const before = radialVariance(tle.propagate(tle.epoch.roll((-10 * 86400) as Seconds)).toJ2000(), tle);

    expect(before / after).toBeCloseTo(1, 9);
  });
});

describe('CovarianceSample R/I/C scaling frame', () => {
  /*
   * Frame invariance: an anisotropic RIC covariance P_ric and the same covariance rotated into ECI,
   * P_eci = blockdiag(Q^T, Q^T) P_ric blockdiag(Q, Q), must desample to the same RIC matrix after TLE scaling.
   */
  it('an RIC covariance and its exact ECI rotation desample to the same RIC covariance', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-19T12:00:00.000Z'));
    const tle = new Tle(LINE1, LINE2);
    const state = tle.propagate(tle.epoch.roll(3600 as Seconds)).toJ2000();
    const pRic = StateCovariance.fromSigmas([0.3, 2.0, 0.5, 0.002, 0.0004, 0.0006], CovarianceFrame.RIC).matrix;
    const q = RelativeState.createMatrix(state.position, state.velocity).elements;
    const t = Matrix.zero(6, 6);

    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        t.elements[a][b] = q[a][b];
        t.elements[a + 3][b + 3] = q[a][b];
      }
    }
    const pEci = t.transpose().multiply(pRic).multiply(t);

    const fromRic = new CovarianceSample(state, new StateCovariance(pRic, CovarianceFrame.RIC), tle).desampleRIC().matrix;
    const fromEci = new CovarianceSample(state, new StateCovariance(pEci, CovarianceFrame.ECI), tle).desampleRIC().matrix;

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        expect(fromEci.elements[i][j]).toBeCloseTo(fromRic.elements[i][j], 9);
      }
    }
    vi.useRealTimers();
  });
});
