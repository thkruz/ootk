/**
 * Regression tests for the v8 utils fixes, pinned against independent references.
 */
import { CovarianceFrame } from '../../covariance/StateCovariance';
import { MILLISECONDS_PER_DAY, MILLISECONDS_TO_DAYS } from '../constants';
import { cappedScreeningCovarianceFromTle, createSampleCovarianceFromTle } from '../create-covariance-from-tle';
import { copySign, estimateRcs, gamma, newtonM, newtonNu, pow2db } from '../functions';

const DEG = Math.PI / 180;

describe('pow2db', () => {
  it('pow2db(1000) is 30 dB (10 log10 of a power ratio)', () => {
    expect(pow2db(1000)).toBeCloseTo(30, 12);
  });

  it('turns a product of power ratios into a sum of decibels', () => {
    expect(pow2db(2 * 50)).toBeCloseTo(pow2db(2) + pow2db(50), 12);
    // Half power is -3.0103 dB
    expect(pow2db(0.5)).toBeCloseTo(-3.0103, 4);
  });

  it('throws for a non-positive ratio', () => {
    expect(() => pow2db(0)).toThrow();
  });
});

describe('gamma', () => {
  it('matches closed forms at half-integers: Gamma(1.5) = sqrt(pi)/2, Gamma(-0.5) = -2 sqrt(pi)', () => {
    expect(gamma(1.5)).toBeCloseTo(Math.sqrt(Math.PI) / 2, 12);
    expect(gamma(-0.5)).toBeCloseTo(-2 * Math.sqrt(Math.PI), 12);
  });

  it('satisfies the recurrence Gamma(x + 1) = x Gamma(x)', () => {
    for (const x of [0.3, 2.7, 7.25]) {
      expect(gamma(x + 1) / (x * gamma(x))).toBeCloseTo(1, 12);
    }
  });

  it('is (n - 1)! at positive integers and NaN at the poles', () => {
    expect(gamma(5)).toBe(24);
    expect(gamma(0)).toBeNaN();
    expect(gamma(-3)).toBeNaN();
  });
});

describe('copySign', () => {
  it('follows C copysign for signed zero instead of returning 0', () => {
    expect(copySign(3, 0)).toBe(3);
    expect(copySign(3, -0)).toBe(-3);
    expect(copySign(-3, 2)).toBe(3);
  });
});

describe('estimateRcs (m^2)', () => {
  it('gives pi r^2 = 0.7854 m^2 for a 1 m diameter sphere (optical-region sphere RCS)', () => {
    expect(estimateRcs(1, 1, 1, 'sphere')).toBeCloseTo(Math.PI / 4, 12);
  });

  it('gives A / 2 = 0.5 m^2 for a 1 m^2 flat plate (Cauchy mean projected area of a plate)', () => {
    expect(estimateRcs(1, 1, 0, 'cube')).toBeCloseTo(0.5, 12);
  });

  it('scales as length squared for every shape (an area, not a length)', () => {
    for (const shape of ['sphere', 'cylinder', 'cone', 'hexagon', 'cube'] as const) {
      expect(estimateRcs(4, 2, 1, shape) / estimateRcs(2, 1, 0.5, shape)).toBeCloseTo(4, 12);
    }
  });

  it('gives S / 4 = 1.5 m^2 for a 1 m cube', () => {
    expect(estimateRcs(1, 1, 1, 'cube')).toBeCloseTo(1.5, 12);
  });
});

describe('newtonM / newtonNu', () => {
  it('reproduces Vallado Example 2-1 (M = 235.4 deg, e = 0.4: E = 220.512074767522 deg)', () => {
    expect(newtonM(0.4, 235.4 * DEG).e0 / DEG).toBeCloseTo(220.512074767522, 6);
  });

  it('reproduces Vallado Example 2-3 (M = 235.4 deg, e = 2.4: H = 1.601376144)', () => {
    expect(newtonM(2.4, 235.4 * DEG).e0).toBeCloseTo(1.601376144, 6);
  });

  it('round-trips nu -> M -> nu for elliptic, parabolic and hyperbolic orbits', () => {
    for (const [ecc, nu] of [[0.5, 1.2], [1.0, 1.2], [1.8, 1.2], [3.0, -0.9]]) {
      const m = newtonNu(ecc, nu).m;

      expect(newtonM(ecc, m).nu).toBeCloseTo(nu, 8);
    }
  });
});

describe('time constants', () => {
  it('MILLISECONDS_TO_DAYS is the exact reciprocal of MILLISECONDS_PER_DAY', () => {
    expect(MILLISECONDS_PER_DAY).toBe(86400000);
    expect(MILLISECONDS_PER_DAY * MILLISECONDS_TO_DAYS).toBe(1);
    // 999 ms is 1.15625e-5 day; the old truncated 1.15741e-8 gave 1.1562526e-5 (2.2 microseconds off)
    expect(999 * MILLISECONDS_TO_DAYS).toBeCloseTo(999 / 86400000, 18);
  });
});

describe('cappedScreeningCovarianceFromTle', () => {
  const tle1 = '1 25544U 98067A   21001.00000000  .00002182  00000-0  41420-4 0  9990';
  const tle2 = '2 25544  51.6461 339.8014 0002571  34.5857 120.4689 15.48919393265019';

  it('caps a position sigma so the variance is exactly cap^2 (km^2) and keeps correlations', () => {
    const src = createSampleCovarianceFromTle(tle1, tle2).matrix.elements;
    const capR = 0.01;
    const m = cappedScreeningCovarianceFromTle(tle1, tle2, 3, [capR, 1e12, 1e12]).matrix.elements;

    expect(m[0][0]).toBeCloseTo(capR * capR, 15);
    // In-track and cross-track are not capped: 3^2 times the source variance
    expect(m[1][1]).toBeCloseTo(9 * src[1][1], 12);
    expect(m[2][2]).toBeCloseTo(9 * src[2][2], 12);

    // Correlation coefficients are invariant under D C D scaling
    const corr = (c: number[][], i: number, j: number): number => c[i][j] / Math.sqrt(c[i][i] * c[j][j]);

    expect(corr(m, 0, 1)).toBeCloseTo(corr(src, 0, 1), 10);
    expect(corr(m, 0, 4)).toBeCloseTo(corr(src, 0, 4), 10);
  });

  it('is symmetric and in the RIC frame', () => {
    const cov = cappedScreeningCovarianceFromTle(tle1, tle2, 2);
    const m = cov.matrix.elements;

    expect(cov.frame).toBe(CovarianceFrame.RIC);
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        expect(m[i][j]).toBeCloseTo(m[j][i], 15);
      }
    }
  });

  it('falls back to a diagonal of cap^2 variances for an unparsable TLE', () => {
    const cov = cappedScreeningCovarianceFromTle('garbage', 'garbage', 3, [2, 3, 4]);

    expect(cov.frame).toBe(CovarianceFrame.RIC);
    expect(cov.matrix.elements[0][0]).toBe(4);
    expect(cov.matrix.elements[1][1]).toBe(9);
    expect(cov.matrix.elements[2][2]).toBe(16);
    // Velocity variances (cap / 1000 s)^2, so the 6x6 is non-singular
    expect(cov.matrix.elements[3][3]).toBeCloseTo(4e-6, 18);
    expect(cov.matrix.elements[4][4]).toBeCloseTo(9e-6, 18);
    expect(cov.matrix.elements[5][5]).toBeCloseTo(16e-6, 18);
  });

  /*
   * Verifier fix M.2: v7's effective caps were sqrt(1200, 5000, 1000) = 34.6 / 70.7 / 31.6 km of
   * 1-sigma (it stored sigmas where variances belong). v8 defaults to [35, 71, 32] km sigma, so
   * the caps still bind when the TLE covariance is scaled up.
   */
  it('default caps are [35, 71, 32] km sigma and bind for a large confidence multiplier', () => {
    const src = createSampleCovarianceFromTle(tle1, tle2).matrix.elements;
    const k = 1000;
    const m = cappedScreeningCovarianceFromTle(tle1, tle2, k).matrix.elements;
    const caps = [35, 71, 32];

    for (let i = 0; i < 3; i++) {
      // Every source sigma times k exceeds the cap here, so the variance is exactly cap^2
      expect(Math.sqrt(src[i][i]) * k).toBeGreaterThan(caps[i]);
      expect(m[i][i]).toBeCloseTo(caps[i] * caps[i], 8);
    }

    // The v7-equivalent caps sit within 1 km of sqrt(1200), sqrt(5000), sqrt(1000)
    expect(Math.abs(35 - Math.sqrt(1200))).toBeLessThan(1);
    expect(Math.abs(71 - Math.sqrt(5000))).toBeLessThan(1);
    expect(Math.abs(32 - Math.sqrt(1000))).toBeLessThan(1);
  });

  it('default fallback is a non-singular 6x6 with the default caps', () => {
    const m = cappedScreeningCovarianceFromTle('garbage', 'garbage', 3).matrix.elements;
    const diag = [35 * 35, 71 * 71, 32 * 32, 0.035 ** 2, 0.071 ** 2, 0.032 ** 2];

    for (let i = 0; i < 6; i++) {
      expect(m[i][i]).toBeCloseTo(diag[i], 12);
      expect(m[i][i]).toBeGreaterThan(0);
    }
    // Diagonal matrix: determinant is the product of the diagonal, strictly positive
    expect(diag.reduce((a, x) => a * x, 1)).toBeGreaterThan(0);
    expect(m[0][1]).toBe(0);
  });
});
