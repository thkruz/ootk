/**
 * Permanent regression tests for the v8 optimize fixes from the 2026-10-13 ootk QA deep dive,
 * slice "2.8 Operations and optimize" plus section 1 item 4. Report:
 * hq/reports/ootk-qa-deep-dive-2026-10-13.md
 *
 * Moved from test/qa/operations-optimize.qa.test.ts. Each test asserts the corrected behavior.
 */
import {
  ChebyshevCompressor,
  DownhillSimplex,
  EpochUTC,
  EpochWindow,
  GoldenSection,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Seconds,
  SimpleLinearRegression,
  StateInterpolator,
  Vector3D,
} from '@src/main';

const MU = 398600.4415;

/** Analytic circular equatorial LEO orbit exposed as a StateInterpolator. */
class CircularOrbitInterpolator extends StateInterpolator {
  private readonly radius_ = 6778;
  private readonly speed_ = Math.sqrt(MU / 6778);
  private readonly meanMotion_ = Math.sqrt(MU / 6778 ** 3);

  constructor(
    private readonly start_: EpochUTC,
    private readonly end_: EpochUTC,
  ) {
    super();
  }

  window(): EpochWindow {
    return new EpochWindow(this.start_, this.end_);
  }

  interpolate(epoch: EpochUTC): J2000 | null {
    const theta = this.meanMotion_ * (epoch.posix - this.start_.posix);
    const r = this.radius_;
    const v = this.speed_;

    return new J2000(
      epoch,
      new Vector3D(r * Math.cos(theta) as Kilometers, r * Math.sin(theta) as Kilometers, 0 as Kilometers),
      new Vector3D(
        -v * Math.sin(theta) as KilometersPerSecond,
        v * Math.cos(theta) as KilometersPerSecond,
        0 as KilometersPerSecond,
      ),
    );
  }

  get sizeBytes(): number {
    return 0;
  }
}

describe('SimpleLinearRegression (QA 2026-10 regressions)', () => {
  // Report 2.8, optimize/SimpleLinearRegression.ts:168. Slope via the correlation coefficient is 0/0
  // for constant y. Expected slope 0 and intercept 4; actual NaN and NaN.
  it('constant y gives slope 0 and a finite intercept', () => {
    const fit = new SimpleLinearRegression([0, 1, 2, 3], [4, 4, 4, 4]);

    expect({ slope: fit.slope, intercept: fit.intercept }).toEqual({ slope: 0, intercept: 4 });
  });

  // Report 2.8, SimpleLinearRegression.ts:129. Residual standard error must divide by n - 2.
  // xs [0,1,2], ys [0,2,1]: slope 0.5, intercept 0.5, SSE 1.5. Expected sqrt(1.5/1) = 1.2247,
  // actual sqrt(1.5/2) = 0.8660.
  it('residual standard error divides by n - 2 (3-point dataset gives sqrt(1.5))', () => {
    const fit = new SimpleLinearRegression([0, 1, 2], [0, 2, 1]);

    expect(fit.slope).toBeCloseTo(0.5, 12);
    expect(fit.error).toBeCloseTo(Math.sqrt(1.5), 12);
  });

  // Report 2.8, SimpleLinearRegression.ts:219. Strict < with limit 0 on a perfect fit drops points.
  // Expected all 4 points kept.
  it('filterOutliers on a perfect fit keeps every point', () => {
    const fit = new SimpleLinearRegression([0, 1, 2, 3], [1, 3, 5, 7]);

    expect(fit.filterOutliers(1).length).toBe(4);
  });
});

describe('DownhillSimplex (QA 2026-10 regressions)', () => {
  // Report 2.8 (likely), optimize/DownhillSimplex.ts:191. Exit on xTol OR fTol, so xTol is never
  // enforced. JSDoc example stops at y = 5.0000045. Expected error < 1e-6 with tolerances 1e-10.
  it('JSDoc example converges to [3, 5] within 1e-6 when xTolerance = fTolerance = 1e-10', () => {
    const costFn = (x: Float64Array) => (x[0] - 3) ** 2 + (x[1] - 5) ** 2;
    const simplex = DownhillSimplex.generateSimplex(new Float64Array([0, 0]), 0.1);
    const result = DownhillSimplex.solveSimplex(costFn, simplex, {
      xTolerance: 1e-10,
      fTolerance: 1e-10,
      maxIter: 1000,
    });
    const err = Math.max(Math.abs(result[0] - 3), Math.abs(result[1] - 5));

    expect(err, `solution = [${result[0]}, ${result[1]}]`).toBeLessThan(1e-6);
  });
});

describe('GoldenSection (QA 2026-10 regressions)', () => {
  // Report 2.8, optimize/GoldenSection.ts:161-172. The options object has no `= {}` default, so a
  // 3-argument call destructures undefined and throws.
  it('search(f, lower, upper) without an options object does not throw', () => {
    const search = GoldenSection.search as unknown as (f: (x: number) => number, lower: number, upper: number) => number;

    expect(() => search((x) => (x - 2) ** 2, 0, 5)).not.toThrow();
  });
});

describe('ChebyshevCompressor (QA 2026-10 regressions)', () => {
  // Report 1.4, optimize/ChebyshevCompressor.ts:129. Default segment length is StateVector.period
  // (minutes) used as seconds. For a 6778 km circular orbit (period 92.6 min) one day should be
  // about 16 segments; actual about 933 (86400 / 92.6).
  it('default segment length is one orbit: one day of LEO compresses to 10-20 segments', () => {
    const start = new EpochUTC(1_700_000_000 as Seconds);
    const end = start.roll(86400 as Seconds);
    const cpr = 21;
    const compressed = new ChebyshevCompressor(new CircularOrbitInterpolator(start, end)).compress(cpr);
    // ChebyshevCoefficients.sizeBytes = (64 * 2 + 64 * 3 * cpr) / 8 per segment.
    const segments = compressed.sizeBytes / ((64 * 2 + 64 * 3 * cpr) / 8);

    expect(segments).toBeGreaterThanOrEqual(10);
    expect(segments).toBeLessThanOrEqual(20);
  });
});
