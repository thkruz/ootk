/**
 * Property and reference-value regression tests for the operations fixes from the
 * 2026-10-13 QA deep dive (report section 2.8 and section 1 items 11 and 12).
 */
import {
  BoxMuller,
  EulerAngles,
  Matrix,
  Quaternion,
  Radians,
  Random,
  RandomGaussianSource,
  SingularMatrixError,
  Vector3D,
} from '../../main';

const maxIdentityError = (m: Matrix): number => {
  let err = 0;

  for (let i = 0; i < m.rows; i++) {
    for (let j = 0; j < m.columns; j++) {
      err = Math.max(err, Math.abs(m.elements[i][j] - (i === j ? 1 : 0)));
    }
  }

  return err;
};

describe('Matrix.inverse with partial pivoting', () => {
  it('A * inv(A) = I to 1e-12 for a seeded random well-conditioned 6x6', () => {
    const rng = new Random(2026);
    const elements: number[][] = [];

    for (let i = 0; i < 6; i++) {
      elements.push([]);
      for (let j = 0; j < 6; j++) {
        // Entries in [-1, 1) plus 6 on the diagonal: strictly diagonally dominant, so well conditioned.
        elements[i].push(2 * rng.nextFloat() - 1 + (i === j ? 6 : 0));
      }
    }
    const a = new Matrix(elements);
    const inv = a.inverse();

    expect(maxIdentityError(a.multiply(inv))).toBeLessThan(1e-12);
    expect(maxIdentityError(inv.multiply(a))).toBeLessThan(1e-12);
  });

  it('inverts the permutation matrix [[0, 1], [1, 0]] (zero leading pivot) to itself', () => {
    const a = new Matrix([
      [0, 1],
      [1, 0],
    ]);
    const inv = a.inverse();

    expect(maxIdentityError(a.multiply(inv))).toBeLessThan(1e-12);
    expect(inv.elements).toEqual([
      [0, 1],
      [1, 0],
    ]);
  });

  it('matches the closed-form 2x2 inverse of [[1e-20, 1], [1, 1]]', () => {
    // inv([[a, b], [c, d]]) = [[d, -b], [-c, a]] / (ad - bc); here ad - bc = 1e-20 - 1.
    const det = 1e-20 - 1;
    const inv = new Matrix([
      [1e-20, 1],
      [1, 1],
    ]).inverse();

    expect(inv.elements[0][0]).toBeCloseTo(1 / det, 14);
    expect(inv.elements[0][1]).toBeCloseTo(-1 / det, 14);
    expect(inv.elements[1][0]).toBeCloseTo(-1 / det, 14);
    expect(inv.elements[1][1] / (1e-20 / det)).toBeCloseTo(1, 12);
  });

  it('inverts a covariance-scaled diagonal diag(1e6, 1e-12) without a false singularity', () => {
    const inv = new Matrix([
      [1e6, 0],
      [0, 1e-12],
    ]).inverse();

    expect(inv.elements[0][0] / 1e-6).toBeCloseTo(1, 14);
    expect(inv.elements[1][1] / 1e12).toBeCloseTo(1, 14);
  });

  it('throws SingularMatrixError on singular input and tryInverse returns null', () => {
    const singular = new Matrix([
      [1, 2],
      [2, 4],
    ]);

    expect(() => singular.inverse()).toThrow(SingularMatrixError);
    expect(singular.tryInverse()).toBeNull();
    expect(Matrix.allZeros(3, 3).tryInverse()).toBeNull();
  });

  it('throws a plain Error (also from tryInverse) for a non-square matrix', () => {
    const rect = new Matrix([[1, 2, 3]]);

    expect(() => rect.inverse()).toThrow(/square/u);
    expect(() => rect.tryInverse()).toThrow(/square/u);
  });
});

describe('Matrix.cholesky', () => {
  it('factors the textbook SPD matrix [[4,12,-16],[12,37,-43],[-16,-43,98]] to [[2,0,0],[6,1,0],[-8,5,3]]', () => {
    // Reference factor from the worked example in the Wikipedia "Cholesky decomposition" article
    // (verified by hand: L * L^T reproduces A exactly).
    const l = new Matrix([
      [4, 12, -16],
      [12, 37, -43],
      [-16, -43, 98],
    ]).cholesky();

    expect(l.elements).toEqual([
      [2, 0, 0],
      [6, 1, 0],
      [-8, 5, 3],
    ]);
  });

  it('reconstructs A = L * L^T for a positive semi-definite matrix with a trailing zero variance', () => {
    const a = new Matrix([
      [4, 2, 0],
      [2, 2, 0],
      [0, 0, 0],
    ]);
    const l = a.cholesky();
    const back = l.multiply(l.transpose());

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(back.elements[i][j]).toBeCloseTo(a.elements[i][j], 14);
      }
    }
  });

  it('throws for an indefinite symmetric matrix', () => {
    expect(() => new Matrix([
      [1, 2],
      [2, 1],
    ]).cholesky()).toThrow(/positive semi-definite/u);
  });
});

describe('Random', () => {
  it('nextInt(6): 1e5 draws populate every bucket of [0, 5] within 10 percent of uniform', () => {
    const rng = new Random(987);
    const draws = 100_000;
    const counts = new Array<number>(6).fill(0);
    let outOfRange = 0;

    for (let i = 0; i < draws; i++) {
      const v = rng.nextInt(6);

      if (!Number.isInteger(v) || v < 0 || v > 5) {
        outOfRange++;
      } else {
        counts[v]++;
      }
    }

    expect(outOfRange).toBe(0);
    for (const c of counts) {
      expect(Math.abs(c - draws / 6) / (draws / 6)).toBeLessThan(0.1);
    }
  });

  it('a negative seed is reduced modulo 233280 (Random(-100) equals Random(233180))', () => {
    const a = new Random(-100);
    const b = new Random(233180);

    for (let i = 0; i < 10; i++) {
      expect(a.nextFloat()).toBe(b.nextFloat());
    }
  });
});

describe('BoxMuller', () => {
  // Seed 22643 drives the LCG to state 0 on the first draw; seed 1 reaches it at draw 149806.
  const seeds = [0, 1, 42, 22643, -100, 123456];

  it.each(seeds)('seed %i: 1e5 draws have mean within 0.02 of 0, variance within 0.03 of 1, all finite', (seed) => {
    const bm = new BoxMuller(0, 1, seed);
    const n = 100_000;
    let sum = 0;
    let sumSq = 0;
    let nonFinite = 0;

    for (let i = 0; i < n; i++) {
      const v = bm.nextGauss();

      if (!Number.isFinite(v)) {
        nonFinite++;
        continue;
      }
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;

    expect(nonFinite).toBe(0);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(variance - 1)).toBeLessThan(0.03);
  });

  it('seed 1 stays finite through the full 233280-state LCG cycle', () => {
    const bm = new BoxMuller(0, 1, 1);

    for (let i = 0; i < 233_280; i++) {
      expect(Number.isFinite(bm.nextGauss())).toBe(true);
    }
  });
});

describe('RandomGaussianSource', () => {
  it('gaussVector(n) has length n and draws the same sequence as BoxMuller(0, 1, seed)', () => {
    const v = new RandomGaussianSource(42).gaussVector(5);
    const bm = new BoxMuller(0, 1, 42);

    expect(v.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(v.elements[i]).toBe(bm.nextGauss());
    }
  });

  it('gaussSphere(r) always has magnitude r', () => {
    const src = new RandomGaussianSource(3);

    for (let i = 0; i < 100; i++) {
      expect(src.gaussSphere(7).magnitude()).toBeCloseTo(7, 12);
    }
  });
});

describe('EulerAngles.fromDcm321', () => {
  it('recovers angles from an independently built R1(roll) R2(pitch) R3(yaw) over all quadrants', () => {
    // dcm321 = R1(phi) R2(theta) R3(psi) with passive elementary rotations (Schaub and Junkins section 3.3).
    for (const roll of [-170, -95, -10, 0, 45, 135, 179]) {
      for (const pitch of [-80, -30, 0, 10, 89]) {
        for (const yaw of [-179, -120, -45, 0, 60, 120, 175]) {
          const r = roll * Math.PI / 180;
          const p = pitch * Math.PI / 180;
          const y = yaw * Math.PI / 180;
          const dcm = Matrix.rotX(r as Radians).multiply(Matrix.rotY(p as Radians)).multiply(Matrix.rotZ(y as Radians));
          const out = EulerAngles.fromDcm321(dcm);

          expect(out.roll).toBeCloseTo(r, 9);
          expect(out.pitch).toBeCloseTo(p, 9);
          expect(out.yaw).toBeCloseTo(y, 9);
        }
      }
    }
  });
});

describe('Quaternion.angle', () => {
  it('equals 2 acos(|p . q|) for unit quaternions, is symmetric and lies in [0, pi]', () => {
    // For unit quaternions the relative rotation angle is 2 acos(|p . q|) (sign of q is irrelevant).
    const rng = new Random(77);

    for (let i = 0; i < 200; i++) {
      const p = new Quaternion(rng.nextFloat() - 0.5, rng.nextFloat() - 0.5, rng.nextFloat() - 0.5, rng.nextFloat() - 0.5).normalize();
      const q = new Quaternion(rng.nextFloat() - 0.5, rng.nextFloat() - 0.5, rng.nextFloat() - 0.5, rng.nextFloat() - 0.5).normalize();
      const expected = 2 * Math.acos(Math.min(1, Math.abs(p.dot(q))));
      const a = p.angle(q);

      expect(a).toBeCloseTo(expected, 7);
      expect(q.angle(p)).toBeCloseTo(a, 12);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(Math.PI + 1e-12);
    }
  });

  it('a pi/2 rotation about z is pi/2 from identity, and its negation too', () => {
    const q = new Quaternion(0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4));

    expect(q.angle(Quaternion.one)).toBeCloseTo(Math.PI / 2, 12);
    expect(q.negate().angle(Quaternion.one)).toBeCloseTo(Math.PI / 2, 12);
  });
});

describe('normalize() of zero returns a fresh instance', () => {
  it('Vector3D and Quaternion zero normalize() are new objects, not the shared singletons', () => {
    expect(new Vector3D(0, 0, 0).normalize()).not.toBe(Vector3D.origin);
    expect(new Quaternion(0, 0, 0, 0).normalize()).not.toBe(Quaternion.zero);
  });
});
