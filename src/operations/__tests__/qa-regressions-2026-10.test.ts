/**
 * Permanent regression tests for the v8 operations fixes from the 2026-10-13 ootk QA deep dive,
 * slice "2.8 Operations and optimize" plus section 1 items 11 and 12. Report:
 * hq/reports/ootk-qa-deep-dive-2026-10-13.md
 *
 * Moved from test/qa/operations-optimize.qa.test.ts. Each test asserts the corrected behavior.
 */
import {
  BoxMuller,
  EpochUTC,
  EulerAngles,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Matrix,
  ObservationOptical,
  ObservationRadar,
  Quaternion,
  RAE,
  RadecTopocentric,
  Radians,
  Random,
  RandomGaussianSource,
  Seconds,
  Vector3D,
} from '@src/main';

const allFinite = (values: ArrayLike<number>): boolean => Array.from(values).every((v) => Number.isFinite(v));

const makeSite = (epoch: EpochUTC): J2000 =>
  new J2000(
    epoch,
    new Vector3D(6378 as Kilometers, 0 as Kilometers, 0 as Kilometers),
    new Vector3D(0 as KilometersPerSecond, 0.465 as KilometersPerSecond, 0 as KilometersPerSecond),
  );

describe('RandomGaussianSource (QA 2026-10 regressions)', () => {
  // Report 1.11, operations/RandomGaussianSource.ts:42. result.add() return value is discarded.
  // Expected length 3, actual 1.
  it('gaussVector(3) returns a 3-element vector', () => {
    expect(new RandomGaussianSource(42).gaussVector(3).length).toBe(3);
  });

  // Report 1.11, RandomGaussianSource.ts:42 via gaussSphere(). Elements 1 and 2 are undefined, so the
  // result is NaN. Expected a finite unit vector.
  it('gaussSphere() returns a finite unit vector', () => {
    const v = new RandomGaussianSource(42).gaussSphere();

    expect(allFinite([v.x, v.y, v.z]), `gaussSphere() = (${v.x}, ${v.y}, ${v.z})`).toBe(true);
    expect(v.magnitude()).toBeCloseTo(1, 12);
  });

  // Report 1.11, observation/Observation.ts:103 consumes gaussVector(noise.columns). With a length-1
  // vector the Cholesky product reads undefined and the sampled RA/Dec are NaN. Expected finite.
  it('ObservationOptical.sample() produces finite right ascension and declination', () => {
    const epoch = new EpochUTC(1_700_000_000 as Seconds);
    const obs = new ObservationOptical(makeSite(epoch), new RadecTopocentric(epoch, 1.0 as Radians, 0.5 as Radians));
    const sampled = obs.sample(new RandomGaussianSource(7)) as ObservationOptical;
    const values = [sampled.observation.rightAscension, sampled.observation.declination];

    expect(allFinite(values), `sampled RA/Dec = ${values.join(', ')}`).toBe(true);
  });

  // Report 1.11, observation/ObservationRadar.ts:79 via Observation.ts:103. Range/az/el become NaN.
  it('ObservationRadar.sample() produces finite range, azimuth and elevation', () => {
    const epoch = new EpochUTC(1_700_000_000 as Seconds);
    const obs = new ObservationRadar(makeSite(epoch), new RAE(epoch, 1000 as Kilometers, 1.0 as Radians, 0.5 as Radians));
    const sampled = obs.sample(new RandomGaussianSource(7)) as ObservationRadar;
    const values = [sampled.observation.rng, sampled.observation.azRad, sampled.observation.elRad];

    expect(allFinite(values), `sampled rng/az/el = ${values.join(', ')}`).toBe(true);
  });
});

describe('Random (QA 2026-10 regressions)', () => {
  // Report 1.12, operations/Random.ts:49. Math.round(nextFloat(max) * max) scales twice. JSDoc contract:
  // integer in [0, max). Expected all draws in [0, 9], actual draws reach up to 100.
  it('nextInt(10) stays within its documented range [0, 10) over 10,000 draws', () => {
    const rng = new Random(12345);
    let min = Infinity;
    let max = -Infinity;
    let nonInteger = 0;

    for (let i = 0; i < 10_000; i++) {
      const v = rng.nextInt(10);

      min = Math.min(min, v);
      max = Math.max(max, v);
      if (!Number.isInteger(v)) {
        nonInteger++;
      }
    }

    expect({ min, max, nonInteger }).toEqual({ min: 0, max: 9, nonInteger: 0 });
  });

  // Report 2.8, Random.ts:37. Negative seeds make the LCG state negative, so nextFloat() is negative.
  // Expected a value in [0, 1).
  it('nextFloat() with a negative seed stays in [0, 1)', () => {
    const v = new Random(-100).nextFloat();

    expect(v >= 0 && v < 1, `nextFloat() returned ${v}`).toBe(true);
  });
});

describe('BoxMuller (QA 2026-10 regressions)', () => {
  // Report 2.8, BoxMuller.ts:52 with Random.ts:37. Seed 22643 drives the LCG to state 0 on the first
  // draw, so log(0) = -Infinity and the first Gaussian is Infinity. Expected finite.
  it('seed 22643 first Gaussian draw is finite', () => {
    const v = new BoxMuller(0, 1, 22643).nextGauss();

    expect(Number.isFinite(v), `first draw was ${v}`).toBe(true);
  });

  // Report 2.8, BoxMuller.ts:52. Seed 1 hits LCG state 0 at draw 149806. Expected no Infinity/NaN in
  // 150,000 draws.
  it('seed 1 produces only finite values over 150,000 Gaussian draws', () => {
    const bm = new BoxMuller(0, 1, 1);
    let firstBad = -1;

    for (let i = 0; i < 150_000; i++) {
      if (!Number.isFinite(bm.nextGauss())) {
        firstBad = i;
        break;
      }
    }

    expect(firstBad, `first non-finite draw at index ${firstBad}`).toBe(-1);
  });

  // Report 2.8, Random.ts:37. A negative seed gives a negative uniform, so log(u1) is NaN.
  it('negative seed produces a finite Gaussian draw', () => {
    const v = new BoxMuller(0, 1, -100).nextGauss();

    expect(Number.isFinite(v), `first draw was ${v}`).toBe(true);
  });
});

describe('Matrix (QA 2026-10 regressions)', () => {
  // Report 2.8, operations/Matrix.ts:418-474. No partial pivoting: the 1e-20 pivot wipes out the
  // answer. Expected A * inv(A) = I within 1e-9; actual product is far from identity.
  it('inverse of [[1e-20, 1], [1, 1]] times the matrix is identity (partial pivoting)', () => {
    const a = new Matrix([[1e-20, 1], [1, 1]]);
    const product = a.multiply(a.inverse());
    const identity = [[1, 0], [0, 1]];
    let maxErr = 0;

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        maxErr = Math.max(maxErr, Math.abs(product.elements[i][j] - identity[i][j]));
      }
    }

    expect(maxErr).toBeLessThan(1e-9);
  });

  // Report 2.8, Matrix.ts:455. Singular [[1,2],[2,4]] silently returns the plausible finite matrix
  // [[0, 0.5], [1, -0.5]]. Expected a throw. (Open design choice: returning a NaN-filled or flagged
  // result would also be acceptable; this test picks throw.)
  it('inverse of the singular matrix [[1, 2], [2, 4]] throws', () => {
    expect(() => new Matrix([[1, 2], [2, 4]]).inverse()).toThrow();
  });

  // Report 2.8, Matrix.ts:379-397. Non-positive-definite input gives sqrt(negative) = NaN silently.
  // Expected a throw or null; actual a matrix containing NaN.
  it('cholesky of a non-positive-definite matrix throws or returns null', () => {
    let threw = false;
    let result: Matrix | null = null;

    try {
      result = new Matrix([[1, 2], [2, 1]]).cholesky();
    } catch {
      threw = true;
    }

    expect(threw || result === null, `cholesky returned ${JSON.stringify(result?.elements)}`).toBe(true);
  });

  // Report 2.8, Matrix.ts:379. cholesky does not check squareness; a 2x3 input returns a 2x2 result.
  it('cholesky of a non-square matrix throws', () => {
    expect(() => new Matrix([[4, 0, 0], [0, 4, 0]]).cholesky()).toThrow();
  });

  // Report 2.8 minor, Matrix.ts:271. outerProduct computes the element-wise (Hadamard) product.
  it.todo('Matrix.outerProduct computes a true outer product (or is renamed to match its Hadamard product)');

  // Report 2.8 minor, Vector.ts:296. cross() silently returns a value for non-3 vectors.
  it.todo('Vector.cross rejects vectors whose length is not 3');
});

describe('EulerAngles (QA 2026-10 regressions)', () => {
  // Report 2.8, operations/EulerAngles.ts:67,69. atan instead of atan2 folds roll and yaw into
  // (-90, 90). Expected (170, 10, 120) deg; actual (-10, 10, -60).
  it('fromDcm321 round-trips (170, 10, 120) deg with full-range roll and yaw', () => {
    const dcm = EulerAngles.fromDegrees(170 as never, 10 as never, 120 as never).dcm321();
    const out = EulerAngles.fromDcm321(dcm);

    expect([out.rollDegrees, out.pitchDegrees, out.yawDegrees].map((d) => Math.round(d * 1e6) / 1e6))
      .toEqual([170, 10, 120]);
  });
});

describe('Quaternion (QA 2026-10 regressions)', () => {
  afterEach(() => {
    Quaternion.zero.x = 0;
    Quaternion.zero.y = 0;
    Quaternion.zero.z = 0;
    Quaternion.zero.w = 0;
  });

  // Report 2.8, operations/Quaternion.ts:169. q and -q are the same rotation. Expected 0, actual 2pi.
  it('angle(q, q.negate()) is 0', () => {
    const q = new Quaternion(0.1, 0.2, 0.3, 0.9).normalize();

    expect(q.angle(q.negate())).toBeCloseTo(0, 9);
  });

  // Report 2.8, Quaternion.ts:169. A 3.6 rad rotation about z is the same as 2pi - 3.6 = 2.683 rad
  // the other way. Expected shortest arc 2.6832, actual 3.6.
  it('angle of a 3.6 rad rotation reports the shortest arc 2pi - 3.6', () => {
    const q = new Quaternion(0, 0, Math.sin(1.8), Math.cos(1.8));

    expect(q.angle(Quaternion.one)).toBeCloseTo(2 * Math.PI - 3.6, 9);
  });

  // Report 2.8, Quaternion.ts:76. normalize() of zero returns the shared Quaternion.zero singleton;
  // mutating the result changes the global. Expected Quaternion.zero untouched.
  it('mutating the result of a zero quaternion normalize() leaves Quaternion.zero unchanged', () => {
    const n = new Quaternion(0, 0, 0, 0).normalize();

    n.w = 5;

    expect([Quaternion.zero.x, Quaternion.zero.y, Quaternion.zero.z, Quaternion.zero.w]).toEqual([0, 0, 0, 0]);
  });
});

describe('Vector3D (QA 2026-10 regressions)', () => {
  afterEach(() => {
    Vector3D.origin.x = 0;
    Vector3D.origin.y = 0;
    Vector3D.origin.z = 0;
  });

  // Report 2.8, operations/Vector3D.ts:136. normalize() of zero returns the shared Vector3D.origin;
  // mutating the result moves the global origin. Expected origin still (0, 0, 0).
  it('mutating the result of a zero vector normalize() leaves Vector3D.origin unchanged', () => {
    const n = new Vector3D<number>(0, 0, 0).normalize();

    n.x = 5;

    expect([Vector3D.origin.x, Vector3D.origin.y, Vector3D.origin.z]).toEqual([0, 0, 0]);
  });
});
