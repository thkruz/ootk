/**
 * Permanent regression tests for the ootk v8 fixes to conjunction screening and assessment, from the QA deep dive
 * (hq/reports/ootk-qa-deep-dive-2026-10-13.md, section 2.6 (Conjunction, sensors, scheduling)
 * plus section 1 items 7, 8 and 14).
 *
 * Each test asserts the corrected behavior. Comments keep the report item and the original
 * src file:line of the defect as an audit trail.
 * Moved from test/qa/conjunction-sensor-scheduling.qa.test.ts.
 */

import {
  ConjunctionAssessment,
  ConjunctionEvent,
  CovarianceFrame,
  CovarianceRealism,
  EpochUTC,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Matrix,
  ProbabilityOfCollision,
  Radians,
  RIC,
  ScreeningFilter,
  Seconds,
  StateCovariance,
  Tle,
  Vector3D,
} from '@src/main';
import { Propagator } from '@src/propagator/Propagator';

const DEG = Math.PI / 180;
const MU = 398600.4418;

/**
 * Reference 2D Pc: integrate an isotropic 2D Gaussian (sigma, centered at the origin) over a
 * hard-body disk of radius hbr centered at (miss, 0). Midpoint rule on a polar grid centered on
 * the disk; 400 x 720 cells is accurate to well under 1% for the cases below.
 */
function referencePc2D(miss: number, hbr: number, sigma: number): number {
  const nr = 400;
  const nt = 720;
  const dr = hbr / nr;
  const dt = (2 * Math.PI) / nt;
  const norm = 1 / (2 * Math.PI * sigma * sigma);
  let sum = 0;

  for (let i = 0; i < nr; i++) {
    const r = (i + 0.5) * dr;

    for (let j = 0; j < nt; j++) {
      const t = (j + 0.5) * dt;
      const x = miss + r * Math.cos(t);
      const y = r * Math.sin(t);

      sum += Math.exp(-(x * x + y * y) / (2 * sigma * sigma)) * r;
    }
  }

  return norm * sum * dr * dt;
}

/** Library 2D Pc via the public entry point, isotropic sigma (km), miss along radial (km). */
function libraryPc(missKm: number, hbrKm: number, sigmaKm: number): number {
  const cov = StateCovariance.fromSigmas([sigmaKm, sigmaKm, sigmaKm, 1e-4, 1e-4, 1e-4], CovarianceFrame.RIC);

  return ProbabilityOfCollision.calculate(
    new Vector3D(missKm as Kilometers, 0 as Kilometers, 0 as Kilometers),
    new Vector3D(0, 10, 0),
    cov,
    hbrKm as Kilometers,
  );
}

/** Rows are the R, I, C unit vectors of the state, expressed in ECI. */
function ricRows(state: J2000): number[][] {
  const r = state.position.normalize();
  const c = state.position.cross(state.velocity).normalize();
  const i = c.cross(r).normalize();

  return [
    [r.x, r.y, r.z],
    [i.x, i.y, i.z],
    [c.x, c.y, c.z],
  ];
}

function mul3(a: number[][], b: number[][]): number[][] {
  return a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
}

function transpose3(a: number[][]): number[][] {
  return [0, 1, 2].map((i) => [a[0][i], a[1][i], a[2][i]]);
}

function circularState(epoch: EpochUTC, rKm: number, vDir: [number, number, number]): J2000 {
  const v = Math.sqrt(MU / 7000);

  return new J2000(
    epoch,
    new Vector3D(rKm as Kilometers, 0 as Kilometers, 0 as Kilometers),
    new Vector3D(
      (v * vDir[0]) as KilometersPerSecond,
      (v * vDir[1]) as KilometersPerSecond,
      (v * vDir[2]) as KilometersPerSecond,
    ),
  );
}

/**
 * Synthetic propagator: returns `base` position plus an arbitrary offset function of time
 * (seconds from t0). Used to place encounters exactly where the 60 s TCA grid misses them.
 */
class OffsetPropagator extends Propagator {
  private last_: J2000;

  constructor(
    private readonly t0_: number,
    private readonly base_: J2000,
    private readonly offset_: (dt: number) => [number, number, number],
  ) {
    super();
    this.last_ = base_;
  }

  propagate(epoch: EpochUTC): J2000 {
    const [dx, dy, dz] = this.offset_(epoch.posix - this.t0_);

    this.last_ = new J2000(
      epoch,
      new Vector3D(
        (this.base_.position.x + dx) as Kilometers,
        (this.base_.position.y + dy) as Kilometers,
        (this.base_.position.z + dz) as Kilometers,
      ),
      this.base_.velocity,
    );

    return this.last_;
  }

  reset(): void {
    // Stateless
  }

  checkpoint(): number {
    return 0;
  }

  restore(_index: number): void {
    // Stateless
  }

  clearCheckpoints(): void {
    // Stateless
  }

  get state(): J2000 {
    return this.last_;
  }
}

function makeEvent(missKm: number, combinedCovariance: StateCovariance): ConjunctionEvent {
  const epoch = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
  const p = circularState(epoch, 7000, [0, 1, 0]);
  const s = circularState(epoch, 7000 + missKm, [0, 1, 0]);
  const rel = RIC.fromJ2000(s, p);

  return new ConjunctionEvent({
    tca: epoch,
    primaryState: p,
    secondaryState: s,
    relativeState: rel,
    missDistance: missKm as Kilometers,
    radialDistance: missKm as Kilometers,
    intrackDistance: 0 as Kilometers,
    crosstrackDistance: 0 as Kilometers,
    relativeVelocity: 0 as KilometersPerSecond,
    combinedCovariance,
  });
}

describe('ProbabilityOfCollision chanPc2D (QA 2026-10 regressions)', () => {
  /*
   * Report section 1 item 7 and the 2.6 table. ProbabilityOfCollision.ts:182-194.
   * Isotropic sigma 100 m, HBR 20 m. Exact Pc: miss 0 -> 1.98e-2, 30 m -> 1.89e-2,
   * 200 m -> 2.7e-3, 300 m -> 2.3e-4. Code returns 7.9e-2, 0.147, 6.7e-4, 2.5e-5 (4x to 9x off).
   */
  it.each([
    [0, 0.02],
    [0.03, 0.02],
    [0.2, 0.02],
    [0.3, 0.02],
  ])('chanPc2D Pc for miss %f km (HBR %f km, sigma 0.1 km) is within 10 percent of exact integration', (missKm, hbrKm) => {
    const exact = referencePc2D(missKm, hbrKm, 0.1);
    const pc = libraryPc(missKm, hbrKm, 0.1);

    expect(Math.abs(pc - exact) / exact).toBeLessThan(0.1);
  });

  /*
   * Report section 1 item 7. ProbabilityOfCollision.ts:182-187 overlap branch divides by 2.
   * Miss 0 with HBR = 10 sigma: exact Pc = 1 - exp(-50) = 1.0; code returns 0.5 (capped).
   */
  it('chanPc2D returns about 1.0 (not capped at 0.5) for a zero miss with HBR = 10 sigma', () => {
    const pc = libraryPc(0, 1.0, 0.1);

    expect(pc).toBeGreaterThan(0.99);
  });
});

describe('ConjunctionAssessment (QA 2026-10 regressions)', () => {
  /*
   * Report section 1 item 8. ConjunctionAssessment.ts:204-214 (provided-covariance path) and
   * 184-188 (propagated path). The secondary covariance is in the SECONDARY's RIC frame but is
   * summed with the primary's RIC covariance with no rotation.
   * Setup: primary equatorial, secondary polar, crossing at the same point (90 deg crossing).
   * Secondary sigma in-track 1 km, radial/cross 10 m. In the primary RIC frame the secondary's
   * in-track axis is the primary's cross-track axis, so combined C[2][2] should be about 1.0 km^2
   * and C[1][1] about 2e-4 km^2. Code puts the 1.0 km^2 into C[1][1].
   */
  it('secondary RIC covariance is rotated into the primary RIC frame before summing', () => {
    const epoch = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
    const primaryState = circularState(epoch, 7000, [0, 1, 0]);
    const secondaryState = circularState(epoch, 7000.05, [0, 0, 1]);
    const primaryCov = StateCovariance.fromSigmas([0.01, 0.01, 0.01, 1e-5, 1e-5, 1e-5], CovarianceFrame.RIC);
    const secondaryCov = StateCovariance.fromSigmas([0.01, 1.0, 0.01, 1e-5, 1e-5, 1e-5], CovarianceFrame.RIC);

    const assessment = new ConjunctionAssessment(
      { state: primaryState, covariance: primaryCov, radius: 0.01 as Kilometers },
      { state: secondaryState, covariance: secondaryCov, radius: 0.01 as Kilometers },
    );
    const event = assessment.assess({
      startTime: epoch,
      endTime: epoch.roll(60 as Seconds),
      searchStepSize: 30 as Seconds,
    });

    // Reference: rotate the secondary covariance from its RIC frame into the primary RIC frame
    const rp = ricRows(event.primaryState);
    const rs = ricRows(event.secondaryState);
    const csRic = [0, 1, 2].map((i) => [0, 1, 2].map((j) => secondaryCov.matrix.elements[i][j]));
    const cpRic = [0, 1, 2].map((i) => [0, 1, 2].map((j) => primaryCov.matrix.elements[i][j]));
    const sToP = mul3(rp, transpose3(rs));
    const csInP = mul3(mul3(sToP, csRic), transpose3(sToP));
    const reference = cpRic.map((row, i) => row.map((v, j) => v + csInP[i][j]));

    const lib = event.combinedCovariance!.matrix.elements;
    let maxDiff = 0;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        maxDiff = Math.max(maxDiff, Math.abs(lib[i][j] - reference[i][j]));
      }
    }

    // Reference has ~1.0 km^2 on cross-track; a frame mismatch shows up as ~1.0 km^2 difference
    expect(reference[2][2]).toBeGreaterThan(0.9);
    expect(maxDiff).toBeLessThan(1e-3);
  });

  /*
   * Report section 2.6, ConjunctionEvent.ts / ConjunctionAssessment.ts:226-240. assess() never
   * passes names (or designators, per-object covariances) to ConjunctionEvent, so CDM export
   * fields are always undefined. Expected 'PRIMARY-SAT' / 'SECONDARY-SAT', actual undefined.
   */
  it('assess() passes provided primaryName and secondaryName through to the event', () => {
    const epoch = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
    const assessment = new ConjunctionAssessment(
      { name: 'PRIMARY-SAT', state: circularState(epoch, 7000, [0, 1, 0]), radius: 0.01 as Kilometers },
      { name: 'SECONDARY-SAT', state: circularState(epoch, 7000.1, [0, 1, 0]), radius: 0.01 as Kilometers },
    );
    const event = assessment.assess({
      startTime: epoch,
      endTime: epoch.roll(60 as Seconds),
      searchStepSize: 30 as Seconds,
    });

    expect(event.primaryName).toBe('PRIMARY-SAT');
    expect(event.secondaryName).toBe('SECONDARY-SAT');
  });

  /*
   * Report section 2.6, ConjunctionAssessment.ts:252-291 (likely). findTCA takes the global
   * minimum of a 60 s grid and refines only +-2 steps around it. Synthetic two-encounter case:
   * encounter 1 at t = 1050 s (mid-way between grid points 1020 and 1080), 10 km/s, true miss
   * 0.1 km, but about 300 km at the nearest samples. Encounter 2 at t = 3000 s (on a grid point),
   * 0.01 km/s, miss 5 km. Expected miss 0.1 km; code locks on encounter 2 and returns 5 km.
   */
  it('findTCA finds a close fast encounter that falls between 60 s grid samples', () => {
    const epoch = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
    const base = circularState(epoch, 7000, [0, 1, 0]);
    const t0 = epoch.posix;
    const encounter1 = (dt: number): [number, number, number] => [0.1, 10 * (dt - 1050), 0];
    const encounter2 = (dt: number): [number, number, number] => [5, 0.01 * (dt - 3000), 0];
    const offset = (dt: number): [number, number, number] => {
      const a = encounter1(dt);
      const b = encounter2(dt);

      return Math.hypot(...a) < Math.hypot(...b) ? a : b;
    };

    const assessment = new ConjunctionAssessment(
      { state: base, propagator: new OffsetPropagator(t0, base, () => [0, 0, 0]) },
      { state: base, propagator: new OffsetPropagator(t0, base, offset) },
    );
    const event = assessment.assess({
      startTime: epoch,
      endTime: epoch.roll(4000 as Seconds),
    });

    expect(event.missDistance).toBeLessThan(0.11);
  });

  /*
   * Report section 1 item 14. ConjunctionAssessment.ts:306 seeds RK89 from
   * tle.propagate(Date.now()). The same TLE and window must give the same answer regardless of
   * wall-clock time. Two fake system times (1 h and 6 h before the window) give different TCA /
   * miss distance today.
   */
  describe('high-fidelity seeding', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('high-fidelity assess() result is independent of the wall-clock time (no Date.now seeding)', { timeout: 60000 }, () => {
      const l1p = '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005';
      const l2p = '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000';
      const l1s = '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9006';
      const l2s = '2 25544  51.6400 339.8100 0002571  90.5100 269.6100 15.50000000000000';
      const run = (now: string): { tca: number; miss: number } => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(now));
        const assessment = new ConjunctionAssessment(
          { tle: new Tle(l1p, l2p), radius: 0.01 as Kilometers },
          { tle: new Tle(l1s, l2s), radius: 0.01 as Kilometers },
        );
        const event = assessment.assess({
          startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
          endTime: EpochUTC.fromDateTimeString('2025-01-19T12:10:00.000Z'),
          useHighFidelity: true,
          searchStepSize: 120 as Seconds,
        });

        vi.useRealTimers();

        return { tca: event.tca.posix, miss: event.missDistance };
      };

      const a = run('2025-01-19T11:00:00.000Z');
      const b = run('2025-01-19T06:00:00.000Z');

      expect(b.miss).toBe(a.miss);
      expect(b.tca).toBe(a.tca);
    });
  });
});

describe('CovarianceRealism (QA 2026-10 regressions)', () => {
  /*
   * Report section 2.6, CovarianceRealism.ts:450-468. Cardano solver: diag(1,1,1) (the library's
   * own default covariance) gives acos(0/0) = NaN for all eigenvalues. Expected [1, 1, 1].
   */
  it('Cardano eigen-solver returns finite unit eigenvalues for the identity covariance', () => {
    const result = CovarianceRealism.analyzeEigenvalues(
      StateCovariance.fromSigmas([1, 1, 1, 0.001, 0.001, 0.001], CovarianceFrame.RIC),
    );

    for (const ev of result.eigenvalues) {
      expect(Number.isFinite(ev)).toBe(true);
      expect(ev).toBeCloseTo(1, 9);
    }
  });

  /*
   * Report section 2.6, CovarianceRealism.ts:450-468. Repeated eigenvalue: whether the
   * discriminant rounds positive depends on the values. diag(2,2,1) happens to round to the
   * correct branch; diag(0.04, 0.04, 0.01) km^2 (200 m, 200 m, 100 m sigmas) rounds to +1.3e-26
   * and the "one real root" branch returns [lambda, 0, 0]. Expected {0.04, 0.04, 0.01}, none
   * zero; code returns two zeros (flagged singular).
   */
  it('Cardano eigen-solver returns non-zero eigenvalues for repeated-root diag(0.04, 0.04, 0.01)', () => {
    const m = new Matrix([
      [0.04, 0, 0],
      [0, 0.04, 0],
      [0, 0, 0.01],
    ]);
    const result = CovarianceRealism.analyzeEigenvalues(new StateCovariance(m, CovarianceFrame.RIC));

    expect(result.eigenvalues.some((ev) => Math.abs(ev) < 1e-9)).toBe(false);
    expect(result.isSingular).toBe(false);
  });

  /*
   * Report section 2.6, CovarianceRealism.ts:270-276. ratio = miss / sigma. A ratio of 0.2 means
   * the actual miss is far inside the predicted 1-sigma: the covariance is too LARGE, which is
   * PESSIMISTIC. Code labels it 'optimistic'.
   */
  it('consistency ratio 0.2 (covariance too large) is labelled pessimistic', () => {
    const cov = StateCovariance.fromSigmas([1, 1, 1, 0.001, 0.001, 0.001], CovarianceFrame.RIC);
    const result = CovarianceRealism.computeConsistencyRatio(makeEvent(0.2, cov))!;

    expect(result.ratio).toBeCloseTo(0.2, 6);
    expect(result.assessment).toBe('pessimistic');
  });

  /*
   * Report section 2.6, CovarianceRealism.ts:270-276. A ratio of 5 means the miss is 5 sigma
   * out: the covariance is too SMALL, which is OPTIMISTIC. Code labels it 'pessimistic'.
   */
  it('consistency ratio 5 (covariance too small) is labelled optimistic', () => {
    const cov = StateCovariance.fromSigmas([1, 1, 1, 0.001, 0.001, 0.001], CovarianceFrame.RIC);
    const result = CovarianceRealism.computeConsistencyRatio(makeEvent(5, cov))!;

    expect(result.ratio).toBeCloseTo(5, 6);
    expect(result.assessment).toBe('optimistic');
  });
});

describe('ScreeningFilter (QA 2026-10 regressions)', () => {
  /*
   * Report section 2.6 (likely), ScreeningFilter.ts:76-83 (report cites 398-405). No pad on the
   * apogee/perigee filter; mean-element shells 0.5 km apart can still meet once J2 short-period
   * variation (several km) is included. Expected overlap = true; code returns false.
   */
  it('apogee/perigee filter pads shells only 0.5 km apart so they overlap', () => {
    const inc = (51.6 * DEG) as Radians;
    const lower = { perigee: 6900 as Kilometers, apogee: 6950 as Kilometers, inclination: inc };
    const upper = { perigee: 6950.5 as Kilometers, apogee: 7000 as Kilometers, inclination: inc };

    expect(ScreeningFilter.shellsOverlap(lower, upper)).toBe(true);
    expect(ScreeningFilter.shellsOverlap(upper, lower)).toBe(true);
  });
});
