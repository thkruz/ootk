/**
 * Property and reference-value regression tests for the optimize fixes from the
 * 2026-10-13 QA deep dive (report section 2.8 and section 1 item 4).
 */
import {
  DownhillSimplex,
  EpochUTC,
  EpochWindow,
  GoldenSection,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Seconds,
  SimpleLinearRegression,
  Vector3D,
} from '../../main';
import { StateInterpolator } from '../../interpolator/StateInterpolator';
import { ChebyshevCompressor } from '../ChebyshevCompressor';

describe('SimpleLinearRegression', () => {
  // Anscombe (1973) quartet, data set I. Published OLS fit: y = 3.0001 + 0.5001 x, residual standard
  // error 1.237 on 9 degrees of freedom (R `summary(lm(y1 ~ x1, anscombe))`).
  const xs = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
  const ys = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68];

  it('reproduces the published Anscombe I fit (slope, intercept, residual standard error)', () => {
    const fit = new SimpleLinearRegression(xs, ys);

    expect(fit.slope).toBeCloseTo(0.5001, 4);
    expect(fit.intercept).toBeCloseTo(3.0001, 4);
    expect(fit.error).toBeCloseTo(1.237, 3);
  });

  it('error^2 * (n - 2) equals the sum of squared residuals', () => {
    const fit = new SimpleLinearRegression(xs, ys);
    let sse = 0;

    for (let i = 0; i < xs.length; i++) {
      sse += (ys[i] - fit.evaluate(xs[i])) ** 2;
    }

    expect(fit.error ** 2 * (xs.length - 2)).toBeCloseTo(sse, 10);
  });

  it('constant y fits a flat line through the data with zero error', () => {
    const fit = new SimpleLinearRegression([1, 5, 9], [-2, -2, -2]);

    expect(fit.slope).toBe(0);
    expect(fit.intercept).toBe(-2);
    expect(fit.error).toBe(0);
  });

  it('filterOutliers on a perfect fit keeps every point and the same line', () => {
    const fit = new SimpleLinearRegression([0, 1, 2, 3, 4], [2, -1, -4, -7, -10]).filterOutliers(2);

    expect(fit.length).toBe(5);
    expect(fit.slope).toBe(-3);
    expect(fit.intercept).toBe(2);
  });
});

describe('DownhillSimplex', () => {
  it('converges on the Rosenbrock function to (1, 1) with default options (no options object)', () => {
    // Rosenbrock (1960): f = (1 - x)^2 + 100 (y - x^2)^2, global minimum f(1, 1) = 0. Classic start (-1.2, 1).
    const rosenbrock = (x: Float64Array) => (1 - x[0]) ** 2 + 100 * (x[1] - x[0] ** 2) ** 2;
    const simplex = DownhillSimplex.generateSimplex(new Float64Array([-1.2, 1]), 0.1);
    const solve = DownhillSimplex.solveSimplex as unknown as (f: (x: Float64Array) => number, xs: Float64Array[]) => Float64Array;
    const result = solve(rosenbrock, simplex);

    expect(Math.abs(result[0] - 1)).toBeLessThan(1e-5);
    expect(Math.abs(result[1] - 1)).toBeLessThan(1e-5);
  });
});

describe('GoldenSection', () => {
  it('iteration count follows ln(W/tol)/ln(phi): W/tol = 1e9 takes 44 iterations, not ~19', () => {
    // Interval shrinks by 1/phi per iteration: k = ceil(ln(1e9) / ln(phi)) = ceil(43.06) = 44.
    let evaluations = 0;
    const f = (x: number) => {
      evaluations++;

      return (x - 0.3) ** 2;
    };
    const x = GoldenSection.search(f, 0, 1, { tolerance: 1e-9 });
    const phi = (1 + Math.sqrt(5)) / 2;

    // This implementation evaluates both probe points every iteration.
    expect(evaluations / 2).toBe(Math.ceil(Math.log(1e9) / Math.log(phi)));
    expect(x).toBeCloseTo(0.3, 8);
  });

  it('searchMin and a 3-argument search agree', () => {
    const f = (x: number) => Math.cos(x);
    const search = GoldenSection.search as unknown as (f: (x: number) => number, lower: number, upper: number) => number;

    expect(search(f, 2, 4)).toBeCloseTo(GoldenSection.searchMin(f, 2, 4), 12);
    expect(search(f, 2, 4)).toBeCloseTo(Math.PI, 4);
  });
});

describe('ChebyshevCompressor', () => {
  const MU = 398600.4415;
  const RADIUS = 6778;
  const meanMotion = Math.sqrt(MU / RADIUS ** 3);
  const speed = Math.sqrt(MU / RADIUS);

  /** Analytic circular equatorial orbit; period 2 pi / n is about 5553 s (92.6 min). */
  class CircularOrbit extends StateInterpolator {
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
      const theta = meanMotion * (epoch.posix - this.start_.posix);

      return new J2000(
        epoch,
        new Vector3D(RADIUS * Math.cos(theta) as Kilometers, RADIUS * Math.sin(theta) as Kilometers, 0 as Kilometers),
        new Vector3D(-speed * Math.sin(theta) as KilometersPerSecond, speed * Math.cos(theta) as KilometersPerSecond, 0 as KilometersPerSecond),
      );
    }

    get sizeBytes(): number {
      return 0;
    }
  }

  const start = new EpochUTC(1_700_000_000 as Seconds);
  const end = start.roll(86400 as Seconds);
  const orbit = new CircularOrbit(start, end);
  const periodSeconds = 2 * Math.PI / meanMotion;

  it('default segmentation equals an explicit one-period (seconds) segment length', () => {
    const cpr = 21;
    const segBytes = (64 * 2 + 64 * 3 * cpr) / 8;
    const byDefault = new ChebyshevCompressor(orbit).compress(cpr);
    const explicit = new ChebyshevCompressor(orbit).compress(cpr, periodSeconds as Seconds);

    expect(byDefault.sizeBytes / segBytes).toBe(Math.ceil(86400 / periodSeconds));
    expect(byDefault.sizeBytes / segBytes).toBeCloseTo(explicit.sizeBytes / segBytes, 0);
  });

  it('one-period segments with 21 coefficients reproduce the orbit to better than 1 m', () => {
    const compressed = new ChebyshevCompressor(orbit).compress(21);
    let maxErr = 0;

    for (let t = 37; t < 86400; t += 997) {
      const epoch = start.roll(t as Seconds);
      const truth = orbit.interpolate(epoch)!.position;
      const approx = compressed.interpolate(epoch)!.position;

      maxErr = Math.max(maxErr, truth.distance(approx));
    }

    expect(maxErr).toBeLessThan(1e-3);
  });
});
