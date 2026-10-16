/**
 * Regression tests for the 2D Pc quadrature stall (KeepTrack Debris Screening, 2026-10). One pair
 * (NORAD 60651 vs 31128, Pc about 7e-110) took 75.8 s in `ProbabilityOfCollision.calculate`, and
 * single-primary screens went from 30 s to 5 to 7 minutes.
 *
 * Two causes, both fixed:
 * - normalIntervalProbability_ cancelled catastrophically for chords much narrower than sigma
 *   (relative noise about 1e-16 / width), which the 1e-12 relative tolerance could never meet, so
 *   the adaptive Gauss-Kronrod bisected towards depth 30. This hit ordinary Pc values too (the
 *   2.9e-7 case below took 258 s).
 * - Pc far below anything operational was still integrated to full precision. An analytic upper
 *   bound now returns 0 below PC_NEGLIGIBLE, and the quadrature has an absolute error floor.
 *
 * The geometries are synthetic, in the same regime as the reported pair (km-scale in-track sigma
 * against metre-scale radial sigma, misses of tens of sigma). Expected values for the ordinary
 * cases are what the old implementation returned after its full (slow) run, and agree with
 * independent references (Chan series, small hard-body closed form).
 */

import { CovarianceFrame, Kilometers, Matrix, PC_NEGLIGIBLE, ProbabilityOfCollision, StateCovariance, Vector3D } from '@src/main';

/**
 * Library Pc with the relative velocity along in-track, so the encounter plane is the R-C plane
 * and a diagonal R-C covariance is already in principal axes.
 */
function pcRc(missR: number, missC: number, sigmaR: number, sigmaC: number, hbr: number): number {
  const m = new Matrix([
    [sigmaR * sigmaR, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 0],
    [0, 0, sigmaC * sigmaC, 0, 0, 0],
    [0, 0, 0, 1e-6, 0, 0],
    [0, 0, 0, 0, 1e-6, 0],
    [0, 0, 0, 0, 0, 1e-6],
  ]);

  return ProbabilityOfCollision.calculate(
    new Vector3D(missR as Kilometers, 0 as Kilometers, missC as Kilometers),
    new Vector3D(0, 14, 0),
    new StateCovariance(m, CovarianceFrame.RIC),
    hbr as Kilometers,
  );
}

function timed(fn: () => number): { value: number; ms: number } {
  const t0 = performance.now();
  const value = fn();

  return { value, ms: performance.now() - t0 };
}

/** Chan (2008) eq. 4.38, isotropic covariance: 1 - Q1(d / sigma, R / sigma). */
function chanIsotropicPc(d: number, r: number, sigma: number): number {
  const v = (d / sigma) ** 2;
  const u = (r / sigma) ** 2;
  const poissonTail = (m: number): number => {
    let term = Math.exp(-u / 2);

    for (let k = 1; k <= m; k++) {
      term *= u / 2 / k;
    }
    let sum = 0;

    for (let k = m + 1; k < m + 400; k++) {
      term *= u / 2 / k;
      sum += term;
      if (term < sum * 1e-18) {
        break;
      }
    }

    return sum;
  };
  let outer = Math.exp(-v / 2);
  let pc = 0;

  for (let m = 0; m < 2000; m++) {
    if (m > 0) {
      outer *= v / 2 / m;
    }
    pc += outer * poissonTail(m);
    if (m > v && outer < 1e-40) {
      break;
    }
  }

  return pc;
}

describe('ProbabilityOfCollision quadrature stall (Debris Screening 2026-10)', () => {
  it('exports PC_NEGLIGIBLE = 1e-30', () => {
    expect(PC_NEGLIGIBLE).toBe(1e-30);
  });

  it('negligible-Pc geometry (km in-track sigma, ~23 sigma miss) returns below 1e-30 in under 50 ms', () => {
    // The old code did not finish this call in 500 s
    const { value, ms } = timed(() => pcRc(151.3, 0.03737, 6.603, 0.001505, 0.0138));

    expect(value).toBeLessThan(PC_NEGLIGIBLE);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThan(50);
  });

  it('20 km miss with 100 m sigmas returns 0 in under 50 ms', () => {
    const { value, ms } = timed(() => pcRc(12, 16, 0.1, 0.1, 0.02));

    expect(value).toBe(0);
    expect(ms).toBeLessThan(50);
  });

  it.each([
    // [missR, missC, sigmaR, sigmaC, HBR, old full-run result, old runtime]
    [2.211, 0.03372, 0.8083, 0.03267, 0.001047, 2.8911187552924757e-7, '258.6 s'],
    [3.596e-7, -0.076, 0.0001183, 1.676, 0.05913, 0.028114906445442733, '0.67 s'],
  ])('ordinary Pc with sigma >> chord (miss %f, %f) is unchanged to 1e-6 and fast', (mr, mc, sr, sc, hbr, expected, _old) => {
    const { value, ms } = timed(() => pcRc(mr, mc, sr, sc, hbr));

    expect(Math.abs(value - expected) / expected).toBeLessThan(1e-6);
    expect(ms).toBeLessThan(50);
  });

  it('the 2.9e-7 case also matches the small hard-body closed form (Foster and Estes) to 1e-3', () => {
    const hbr = 0.001047;
    const q = (2.211 / 0.8083) ** 2 + (0.03372 / 0.03267) ** 2;
    const ref = ((hbr * hbr) / (2 * 0.8083 * 0.03267)) * Math.exp(-q / 2);

    expect(Math.abs(pcRc(2.211, 0.03372, 0.8083, 0.03267, hbr) - ref) / ref).toBeLessThan(1e-3);
  });

  it.each([
    // [miss km, HBR km, sigma km]: deep tails down to just above PC_NEGLIGIBLE
    [0.3, 0.02, 0.1],
    [1.0, 0.02, 0.1],
    [1.1, 0.02, 0.1],
    [8.0, 0.05, 1.0],
    [0.5, 0.001, 0.05],
  ])('isotropic miss %f km HBR %f sigma %f matches Chan series to 1e-6 relative', (miss, hbr, sigma) => {
    const ref = chanIsotropicPc(miss, hbr, sigma);
    const pc = pcRc(miss * 0.6, miss * 0.8, sigma, sigma, hbr);

    expect(ref).toBeGreaterThan(PC_NEGLIGIBLE);
    expect(Math.abs(pc - ref) / ref).toBeLessThan(1e-6);
  });

  it('the analytic upper bound is never below the integrated Pc (fixed-seed sweep)', () => {
    const pcAxes = (ProbabilityOfCollision as unknown as Record<string, (...a: number[]) => number>).pcPrincipalAxes_
      .bind(ProbabilityOfCollision);
    const bound = (ProbabilityOfCollision as unknown as Record<string, (...a: number[]) => number>).pcUpperBound_
      .bind(ProbabilityOfCollision);
    let seed = 20261016;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;

      return seed / 2147483648;
    };
    const logUniform = (a: number, b: number): number => Math.exp(Math.log(a) + rnd() * (Math.log(b) - Math.log(a)));

    for (let i = 0; i < 400; i++) {
      const sx = logUniform(1e-3, 10);
      const sy = logUniform(1e-4, 10);
      const r = logUniform(1e-3, 0.5);
      const xm = logUniform(1e-3, 12) * sx * (rnd() < 0.5 ? -1 : 1);
      const ym = logUniform(1e-3, 12) * sy * (rnd() < 0.5 ? -1 : 1);
      const pc = pcAxes(xm, ym, sx, sy, r);

      expect(bound(xm, ym, sx, sy, r)).toBeGreaterThanOrEqual(pc * (1 - 1e-9));
    }
  });
});
