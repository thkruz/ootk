/**
 * ootk v8 regression tests for the conjunction module (QA deep dive 2026-10-13, report section 1
 * items 7, 8, 14 and section 2.6). Every expected value comes from an independent derivation:
 * Chan's isotropic series (equivalently 1 - Q1, the Marcum Q function), a separate polar
 * Gauss-Legendre double integral of the 2D Gaussian over the hard-body disc, closed-form
 * eigenvalues of rotated diagonal matrices, or frame-invariance properties.
 */

import {
  ConjunctionAssessment,
  CovarianceFrame,
  CdmExporter,
  CdmParser,
  CovarianceRealism,
  DEFAULT_SHELL_PAD_KM,
  EpochUTC,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Matrix,
  ProbabilityOfCollision,
  ScreeningFilter,
  Seconds,
  StateCovariance,
  Tle,
  Vector3D,
} from '../../main';
import { Propagator } from '../../propagator/Propagator';

const MU = 398600.4418;

/**
 * Chan (2008), "Spacecraft Collision Probability", eq. 4.38 for an isotropic covariance:
 * Pc = e^(-v/2) sum_m (v/2)^m / m! * [1 - e^(-u/2) sum_{k<=m} (u/2)^k / k!],
 * v = (d / sigma)^2, u = (R / sigma)^2. This is the noncentral chi-square CDF with 2 degrees of
 * freedom, i.e. 1 - Q1(d / sigma, R / sigma).
 */
function chanIsotropicPc(d: number, r: number, sigma: number): number {
  const v = (d / sigma) ** 2;
  const u = (r / sigma) ** 2;
  /*
   * Poisson upper tail e^(-u/2) sum_{k>m} (u/2)^k / k!, summed directly so that the bracket
   * 1 - e^(-u/2) sum_{k<=m} (...) keeps full relative precision when it is tiny
   */
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

  for (let m = 0; m < 400; m++) {
    if (m > 0) {
      outer *= v / 2 / m;
    }
    pc += outer * poissonTail(m);
    if (m > v && outer < 1e-25) {
      break;
    }
  }

  return pc;
}

/** Gauss-Legendre nodes and weights on [-1, 1] by Newton iteration on P_n. */
function gaussLegendre(n: number): { x: number[]; w: number[] } {
  const x: number[] = [];
  const w: number[] = [];

  for (let i = 1; i <= n; i++) {
    let z = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5));
    let dp = 0;

    for (let it = 0; it < 100; it++) {
      let p0 = 1;
      let p1 = z;

      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k;

        p0 = p1;
        p1 = p2;
      }
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;

      z -= dz;
      if (Math.abs(dz) < 1e-15) {
        break;
      }
    }
    x.push(z);
    w.push(2 / ((1 - z * z) * dp * dp));
  }

  return { x, w };
}

/**
 * Independent reference: integrate the 2D Gaussian N(mean, cov) over the disc of radius r centred
 * at the origin with a tensor Gauss-Legendre rule in polar coordinates (composite in radius and
 * angle). Converges spectrally for the smooth integrands used below.
 */
function polarQuadraturePc(mean: [number, number], cov: [[number, number], [number, number]], r: number): number {
  const det = cov[0][0] * cov[1][1] - cov[0][1] * cov[1][0];
  const i00 = cov[1][1] / det;
  const i01 = -cov[0][1] / det;
  const i11 = cov[0][0] / det;
  const norm = 1 / (2 * Math.PI * Math.sqrt(det));
  const gl = gaussLegendre(48);
  const radialPanels = 8;
  const angularPanels = 32;
  let sum = 0;

  for (let pr = 0; pr < radialPanels; pr++) {
    const r0 = (pr * r) / radialPanels;
    const r1 = ((pr + 1) * r) / radialPanels;

    for (let pt = 0; pt < angularPanels; pt++) {
      const t0 = (pt * 2 * Math.PI) / angularPanels;
      const t1 = ((pt + 1) * 2 * Math.PI) / angularPanels;

      for (let i = 0; i < gl.x.length; i++) {
        const rr = 0.5 * (r1 - r0) * gl.x[i] + 0.5 * (r1 + r0);

        for (let j = 0; j < gl.x.length; j++) {
          const tt = 0.5 * (t1 - t0) * gl.x[j] + 0.5 * (t1 + t0);
          const dx = rr * Math.cos(tt) - mean[0];
          const dy = rr * Math.sin(tt) - mean[1];
          const q = dx * (i00 * dx + i01 * dy) + dy * (i01 * dx + i11 * dy);

          sum += gl.w[i] * gl.w[j] * 0.25 * (r1 - r0) * (t1 - t0) * rr * Math.exp(-0.5 * q);
        }
      }
    }
  }

  return norm * sum;
}

/**
 * Library Pc for a miss (radial, cross-track) and a 2x2 radial/cross-track covariance, with the
 * relative velocity along in-track so the encounter plane is the R-C plane.
 */
function libraryPcRc(missR: number, missC: number, cRR: number, cRC: number, cCC: number, hbr: number): number {
  const m = new Matrix([
    [cRR, 0, cRC, 0, 0, 0],
    [0, 1, 0, 0, 0, 0],
    [cRC, 0, cCC, 0, 0, 0],
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

describe('ProbabilityOfCollision 2D Pc (v8 exact integral)', () => {
  it.each([
    // [miss km, HBR km, sigma km, published value]: isotropic sigma 100 m, HBR 20 m
    [0, 0.02, 0.1, 1.9801e-2],
    [0.03, 0.02, 0.1, 1.8939e-2],
    [0.2, 0.02, 0.1, 2.7336e-3],
    [0.3, 0.02, 0.1, 2.2999e-4],
  ])('isotropic miss %f km matches the independently re-derived value', (miss, hbr, sigma, published) => {
    const pc = libraryPcRc(miss, 0, sigma * sigma, 0, sigma * sigma, hbr);

    expect(Math.abs(pc - published) / published).toBeLessThan(1e-4);
  });

  it.each([
    [0, 0.02, 0.1],
    [0.05, 0.01, 0.2],
    [0.5, 0.02, 0.1],
    [0.0, 1.0, 0.1],
    [1.05, 1.0, 0.1],
    [0.002, 0.015, 0.003],
  ])('isotropic miss %f HBR %f sigma %f equals Chan series / 1 - Q1 to 1e-9 relative', (miss, hbr, sigma) => {
    const pc = libraryPcRc(miss * 0.6, miss * 0.8, sigma * sigma, 0, sigma * sigma, hbr);
    const ref = chanIsotropicPc(miss, hbr, sigma);

    expect(Math.abs(pc - ref)).toBeLessThan(1e-9 * Math.max(ref, 1e-12));
  });

  /*
   * Anisotropic cases. No published inputs were available offline, so each case is constructed
   * (HBR 15 m as in Alfano 2009 test case 1, strongly elongated covariances, correlated R-C
   * terms) and cross-checked against the independent polar quadrature above at 1e-3 relative.
   */
  it.each([
    // [missR, missC, sigmaMajor, sigmaMinor, rotation deg, HBR] in km
    [0.05, 0.08, 0.2, 0.02, 30, 0.015],
    [0.3, -0.1, 1.0, 0.05, -60, 0.015],
    [0.01, 0.002, 0.05, 0.004, 10, 0.015],
    [0.0, 0.0, 0.5, 0.01, 75, 0.02],
  ])('anisotropic miss (%f, %f) km, sigmas %f x %f km at %f deg, HBR %f km matches 2D quadrature', (mr, mc, s1, s2, rotDeg, hbr) => {
    const a = (rotDeg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const cRR = c * c * s1 * s1 + s * s * s2 * s2;
    const cCC = s * s * s1 * s1 + c * c * s2 * s2;
    const cRC = c * s * (s1 * s1 - s2 * s2);
    const pc = libraryPcRc(mr, mc, cRR, cRC, cCC, hbr);
    const ref = polarQuadraturePc([mr, mc], [[cRR, cRC], [cRC, cCC]], hbr);

    expect(ref).toBeGreaterThan(0);
    expect(Math.abs(pc - ref) / ref).toBeLessThan(1e-3);
  });

  /*
   * Verifier fix M.10: rotation invariance alone passed in v7 too (its Pc was wrong by the same
   * factor at every orientation). This version also pins the value at both orientations to the
   * small hard-body limit Pc -> R^2 / (2 sqrt(det C)) exp(-m^T C^-1 m / 2) (Foster and Estes 1992;
   * Alfano 2005), which v7's 4x to 9x error fails. With R = 1.5 m and sigma_min about 98 m the
   * O(R^2 / sigma^2) truncation is below 1e-3 relative.
   */
  it('matches the small hard-body closed form before and after rotating the geometry about the relative velocity', () => {
    const hbr = 0.0015;
    const smallHbr = (mr: number, mc: number, cRR: number, cRC: number, cCC: number): number => {
      const det = cRR * cCC - cRC * cRC;
      const q = (cCC * mr * mr - 2 * cRC * mr * mc + cRR * mc * mc) / det;

      return ((hbr * hbr) / (2 * Math.sqrt(det))) * Math.exp(-q / 2);
    };
    const base = libraryPcRc(0.05, 0.08, 0.04, 0.005, 0.01, hbr);
    const ref = smallHbr(0.05, 0.08, 0.04, 0.005, 0.01);
    const a = 1.1;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Rotate miss and covariance by the same angle in the R-C plane
    const mr = c * 0.05 - s * 0.08;
    const mc = s * 0.05 + c * 0.08;
    const cRR = c * c * 0.04 - 2 * c * s * 0.005 + s * s * 0.01;
    const cCC = s * s * 0.04 + 2 * c * s * 0.005 + c * c * 0.01;
    const cRC = c * s * (0.04 - 0.01) + (c * c - s * s) * 0.005;
    const rotated = libraryPcRc(mr, mc, cRR, cRC, cCC, hbr);

    expect(Math.abs(base - ref) / ref).toBeLessThan(1e-3);
    expect(Math.abs(rotated - ref) / ref).toBeLessThan(1e-3);
    expect(rotated).toBeCloseTo(base, 15);
  });

  it('zero relative velocity uses a 3D overlap probability that is continuous and matches the d -> 0 limit', () => {
    const sigma = 0.1;
    const cov = StateCovariance.fromSigmas([sigma, sigma, sigma, 1e-4, 1e-4, 1e-4], CovarianceFrame.RIC);
    const pcAt = (d: number): number => ProbabilityOfCollision.calculate(
      new Vector3D(d as Kilometers, 0 as Kilometers, 0 as Kilometers), new Vector3D(0, 0, 0), cov, 0.02 as Kilometers,
    );
    // Central chi (3 dof) CDF at R / sigma = 0.2: erf(0.2 / sqrt 2) - sqrt(2 / pi) 0.2 e^(-0.02)
    const erf = (x: number): number => {
      let term = x;
      let sum = x;

      for (let n = 1; n < 60; n++) {
        term *= (-x * x) / n;
        sum += term / (2 * n + 1);
      }

      return (2 / Math.sqrt(Math.PI)) * sum;
    };
    const central = erf(0.2 / Math.SQRT2) - Math.sqrt(2 / Math.PI) * 0.2 * Math.exp(-0.02);

    expect(pcAt(0)).toBeCloseTo(central, 12);
    // The old fallback jumped from 0.00135 to 0 at 3 sigma; now neighbouring values are close
    const below = pcAt(0.02 + 3 * sigma - 1e-9);
    const above = pcAt(0.02 + 3 * sigma + 1e-9);

    expect(below).toBeGreaterThan(0);
    expect(Math.abs(below - above)).toBeLessThan(1e-12);
  });
});

function circularState(epoch: EpochUTC, rKm: number, vDir: [number, number, number]): J2000 {
  const v = Math.sqrt(MU / rKm);

  return new J2000(
    epoch,
    new Vector3D(rKm as Kilometers, 0 as Kilometers, 0 as Kilometers),
    new Vector3D((v * vDir[0]) as KilometersPerSecond, (v * vDir[1]) as KilometersPerSecond, (v * vDir[2]) as KilometersPerSecond),
  );
}

describe('ConjunctionAssessment covariance frames (v8)', () => {
  const epoch = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
  const window = { startTime: epoch, endTime: epoch.roll(60 as Seconds), searchStepSize: 30 as Seconds };
  const sigmasP = [0.01, 0.02, 0.03, 1e-5, 1e-5, 1e-5];
  const sigmasS = [0.04, 1.0, 0.05, 1e-5, 1e-5, 1e-5];

  it('combined position trace equals the sum of both traces for a 60 deg crossing (rotation preserves trace)', () => {
    const p = circularState(epoch, 7000, [0, 1, 0]);
    const s = circularState(epoch, 7000.05, [0, 0.5, Math.sqrt(3) / 2]);
    const event = new ConjunctionAssessment(
      { state: p, covariance: StateCovariance.fromSigmas(sigmasP, CovarianceFrame.RIC), radius: 0.01 as Kilometers },
      { state: s, covariance: StateCovariance.fromSigmas(sigmasS, CovarianceFrame.RIC), radius: 0.01 as Kilometers },
    ).assess(window);
    const m = event.combinedCovariance!.matrix.elements;
    const expectedTrace = sigmasP.slice(0, 3).reduce((a, x) => a + x * x, 0) + sigmasS.slice(0, 3).reduce((a, x) => a + x * x, 0);

    expect(m[0][0] + m[1][1] + m[2][2]).toBeCloseTo(expectedTrace, 9);
    // The secondary's 1 km in-track sigma now has a cross-track component in the primary frame
    expect(m[2][2]).toBeGreaterThan(0.5);
  });

  it('a secondary covariance given in ECI gives the same combined covariance as the same one given in its RIC frame', () => {
    const p = circularState(epoch, 7000, [0, 1, 0]);
    const s = circularState(epoch, 7000.05, [0, 0, 1]);
    const ricCov = StateCovariance.fromSigmas(sigmasS, CovarianceFrame.RIC);
    // Secondary RIC at TCA ~ epoch: R = +x, C = r x v = -y, I = C x R = +z. ECI = Q^T C_ric Q
    const q = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
    const e = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_v, j) => {
      if ((i < 3) !== (j < 3)) {
        return 0;
      }
      const bi = i < 3 ? 0 : 3;
      let sum = 0;

      for (let k = 0; k < 3; k++) {
        sum += q[k][i - bi] * sigmasS[k + bi] * sigmasS[k + bi] * q[k][j - bi];
      }

      return sum;
    }));
    const eciCov = new StateCovariance(new Matrix(e), CovarianceFrame.ECI);
    const primaryCov = StateCovariance.fromSigmas(sigmasP, CovarianceFrame.RIC);
    const run = (secondaryCov: StateCovariance): number[][] => new ConjunctionAssessment(
      { state: p, covariance: primaryCov, radius: 0.01 as Kilometers },
      { state: s, covariance: secondaryCov, radius: 0.01 as Kilometers },
    ).assess(window).combinedCovariance!.matrix.elements;
    const a = run(ricCov);
    const b = run(eciCov);

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(a[i][j]).toBeCloseTo(b[i][j], 4);
      }
    }
  });

  /*
   * Verifier fix M.4: CDM OBJECT_DESIGNATOR is the catalog number (CATALOG_NAME = SATCAT, CCSDS
   * 508.0-B-1 Table 3-3), so the TLE default is Tle.satnum; the COSPAR id goes to
   * INTERNATIONAL_DESIGNATOR. v7 and early v8 put the COSPAR id in OBJECT_DESIGNATOR.
   */
  it('passes names, catalog numbers, COSPAR ids and per-object covariances to the event', () => {
    const tle = new Tle(
      '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005',
      '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000',
    );
    const cov = StateCovariance.fromSigmas(sigmasP, CovarianceFrame.RIC);
    const event = new ConjunctionAssessment(
      { name: 'A', tle, covariance: cov, radius: 0.01 as Kilometers },
      { name: 'B', state: circularState(epoch, 7000, [0, 1, 0]), designator: '26900', internationalDesignator: '2000-001A' },
    ).assess(window);

    expect(event.primaryName).toBe('A');
    expect(event.secondaryName).toBe('B');
    expect(event.primaryDesignator).toBe('25544');
    expect(event.primaryInternationalDesignator).toBe('1998-067A');
    expect(event.secondaryDesignator).toBe('26900');
    expect(event.secondaryInternationalDesignator).toBe('2000-001A');

    const cdm = CdmExporter.export(event);

    expect(cdm).toContain('OBJECT_DESIGNATOR = 25544');
    expect(cdm).toContain('INTERNATIONAL_DESIGNATOR = 1998-067A');
    expect(cdm).toContain('OBJECT_DESIGNATOR = 26900');
    expect(cdm).toContain('INTERNATIONAL_DESIGNATOR = 2000-001A');
    expect(cdm.match(/CATALOG_NAME = SATCAT/gu)?.length).toBe(2);
  });
});

/*
 * Verifier fixes M.3 and M.5. A zero-length window pins TCA to the epoch, so the frames below are
 * exact. Primary at r = 7000 x km moving +y: R = +x, I = +y, C = +z. Secondary at the same point
 * moving (0, cos t, sin t): R_s = +x, I_s = (0, cos t, sin t), C_s = (0, -sin t, cos t).
 * A secondary RIC covariance diag(a, b, c) expressed in the primary frame has
 * C[I][C] = b (I_s . y)(I_s . z) + c (C_s . y)(C_s . z) = sin t cos t (b - c).
 * Reversing the rotation (M = Q_s Q_p^T instead of Q_p Q_s^T) flips the sign.
 */
describe('Covariance rotation direction and signed CDM round trip (v8)', () => {
  const epoch = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
  const zeroWindow = { startTime: epoch, endTime: epoch };
  const primaryCov = StateCovariance.fromSigmas([0.01, 0.02, 0.03, 1e-5, 1e-5, 1e-5], CovarianceFrame.RIC);
  const a = 0.04 ** 2;
  const b = 1.0 ** 2;
  const c = 0.05 ** 2;
  const secondaryCov = new StateCovariance(new Matrix([
    [a, 0, 0, 0, 0, 0],
    [0, b, 0, 0, 0, 0],
    [0, 0, c, 0, 0, 0],
    [0, 0, 0, 1e-10, 0, 0],
    [0, 0, 0, 0, 1e-10, 0],
    [0, 0, 0, 0, 0, 1e-10],
  ]), CovarianceFrame.RIC);
  const crossing = (deg: number, offset: [number, number, number]): ReturnType<ConjunctionAssessment['assess']> => {
    const t = (deg * Math.PI) / 180;
    const p = circularState(epoch, 7000, [0, 1, 0]);
    const v = Math.sqrt(MU / 7000);
    const s = new J2000(
      epoch,
      new Vector3D((7000 + offset[0]) as Kilometers, offset[1] as Kilometers, offset[2] as Kilometers),
      new Vector3D(0 as KilometersPerSecond, (v * Math.cos(t)) as KilometersPerSecond, (v * Math.sin(t)) as KilometersPerSecond),
    );

    return new ConjunctionAssessment(
      { state: p, covariance: primaryCov, radius: 0.01 as Kilometers, designator: '11111' },
      { state: s, covariance: secondaryCov, radius: 0.01 as Kilometers, designator: '22222' },
    ).assess(zeroWindow);
  };

  for (const deg of [30, 60]) {
    it(`${deg} deg crossing: combined[I][C] = +sin cos (b - c) in ConjunctionAssessment and CdmParser`, () => {
      const t = (deg * Math.PI) / 180;
      // The secondary offset is radial only, so its RIC frame differs from a pure rotation about R by < 1e-5
      const expected = Math.sin(t) * Math.cos(t) * (b - c);
      const event = crossing(deg, [0.05, 0, 0]);
      const m = event.combinedCovariance!.matrix.elements;

      expect(expected).toBeGreaterThan(0.2);
      expect(m[1][2]).toBeCloseTo(expected, 6);
      expect(m[2][1]).toBeCloseTo(expected, 6);
      // Rotation about R leaves the radial variance alone: primary 0.01^2 plus secondary a
      expect(m[0][0]).toBeCloseTo(0.01 ** 2 + a, 9);

      const parsed = CdmParser.toConjunctionEvent(CdmParser.parse(CdmExporter.export(event)));
      const mp = parsed.combinedCovariance!.matrix.elements;

      expect(mp[1][2]).toBeCloseTo(expected, 6);
      expect(mp[2][1]).toBeCloseTo(expected, 6);
    });
  }

  it('ConjunctionAssessment -> CdmExporter -> CdmParser keeps signed R, T, N (T negative)', () => {
    const event = crossing(60, [0.05, -0.3, 0.1]);

    // Primary RIC is (x, y, z) here, so the relative position is the offset itself
    expect(event.radialDistance).toBeCloseTo(0.05, 9);
    expect(event.intrackDistance).toBeCloseTo(-0.3, 9);
    expect(event.crosstrackDistance).toBeCloseTo(0.1, 9);

    const cdm = CdmExporter.export(event);

    expect(cdm).toMatch(/RELATIVE_POSITION_T = -300\.0+ \[m\]/u);

    const back = CdmParser.toConjunctionEvent(CdmParser.parse(cdm));

    expect(back.radialDistance).toBeCloseTo(0.05, 6);
    expect(back.intrackDistance).toBeCloseTo(-0.3, 6);
    expect(back.crosstrackDistance).toBeCloseTo(0.1, 6);
    expect(back.radialVelocity).toBeCloseTo(event.radialVelocity!, 6);
    expect(back.intrackVelocity).toBeCloseTo(event.intrackVelocity!, 6);
    expect(back.crosstrackVelocity).toBeCloseTo(event.crosstrackVelocity!, 6);
    expect(Math.sign(back.crosstrackVelocity!)).toBe(Math.sign(event.crosstrackVelocity!));
    expect(back.primaryDesignator).toBe('11111');
  });
});

/** Propagator that adds an offset function of time (s from t0) to a fixed base state. */
class OffsetPropagator extends Propagator {
  private last_: J2000;

  constructor(private readonly t0_: number, private readonly base_: J2000, private readonly offset_: (dt: number) => number[]) {
    super();
    this.last_ = base_;
  }

  propagate(epoch: EpochUTC): J2000 {
    const [dx, dy, dz] = this.offset_(epoch.posix - this.t0_);

    this.last_ = new J2000(
      epoch,
      new Vector3D((this.base_.position.x + dx) as Kilometers, (this.base_.position.y + dy) as Kilometers, (this.base_.position.z + dz) as Kilometers),
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

  restore(): void {
    // Stateless
  }

  clearCheckpoints(): void {
    // Stateless
  }

  get state(): J2000 {
    return this.last_;
  }
}

describe('ConjunctionAssessment TCA search (v8)', () => {
  const epoch = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
  const base = circularState(epoch, 7000, [0, 1, 0]);

  it('finds a single fast encounter between grid samples to the TCA tolerance', () => {
    // Straight-line pass at 12 km/s with 0.2 km miss at t = 1037.25 s (never on the 60 s grid)
    const tca = 1037.25;
    const prop = new OffsetPropagator(epoch.posix, base, (dt) => [0.2, 12 * (dt - tca), 0]);
    const event = new ConjunctionAssessment(
      { state: base, propagator: new OffsetPropagator(epoch.posix, base, () => [0, 0, 0]) },
      { state: base, propagator: prop },
    ).assess({ startTime: epoch, endTime: epoch.roll(3600 as Seconds) });

    // Golden section stops at 1 ms: at 12 km/s that is up to 12 m along track, 4e-4 km of range
    expect(event.tca.posix - epoch.posix).toBeCloseTo(tca, 2);
    expect(Math.abs(event.missDistance - 0.2)).toBeLessThan(4e-4);
  });

  it('prefers the deeper of two local minima regardless of which grid sample is lower', () => {
    // Slow approach to 3 km at t = 600 s (on the grid) and a fast 0.5 km pass at t = 2410 s
    const prop = new OffsetPropagator(epoch.posix, base, (dt) => {
      const slow = [3, 0.02 * (dt - 600), 0];
      const fast = [0.5, 9 * (dt - 2410), 0];

      return Math.hypot(...slow) < Math.hypot(...fast) ? slow : fast;
    });
    const event = new ConjunctionAssessment(
      { state: base, propagator: new OffsetPropagator(epoch.posix, base, () => [0, 0, 0]) },
      { state: base, propagator: prop },
    ).assess({ startTime: epoch, endTime: epoch.roll(3600 as Seconds) });

    expect(Math.abs(event.missDistance - 0.5)).toBeLessThan(1e-4);
    expect(event.tca.posix - epoch.posix).toBeCloseTo(2410, 2);
  });
});

describe('ConjunctionAssessment high-fidelity seed (v8)', () => {
  it('defaults the RK89 seed epoch to the window start (same as passing it explicitly)', { timeout: 60000 }, () => {
    const tle1 = new Tle(
      '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005',
      '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000',
    );
    const tle2 = new Tle(
      '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9006',
      '2 25544  51.6400 339.8100 0002571  90.5100 269.6100 15.50000000000000',
    );
    const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
    const opts = { startTime, endTime: startTime.roll(300 as Seconds), useHighFidelity: true, searchStepSize: 60 as Seconds };
    const a = new ConjunctionAssessment({ tle: tle1 }, { tle: tle2 }).assess(opts);
    const b = new ConjunctionAssessment({ tle: tle1 }, { tle: tle2 }).assess({ ...opts, highFidelitySeedEpoch: startTime });

    expect(a.missDistance).toBe(b.missDistance);
    expect(a.tca.posix).toBe(b.tca.posix);
  });
});

describe('CovarianceRealism eigenvalues (v8 Smith 1961 closed form)', () => {
  /** Rotation about an arbitrary axis, used to build R diag(l) R^T with known eigenvalues. */
  function rotated(l: [number, number, number]): Matrix {
    const k = new Vector3D(1, 2, 3).normalize();
    const a = 0.7;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const r = [
      [c + k.x * k.x * (1 - c), k.x * k.y * (1 - c) - k.z * s, k.x * k.z * (1 - c) + k.y * s],
      [k.y * k.x * (1 - c) + k.z * s, c + k.y * k.y * (1 - c), k.y * k.z * (1 - c) - k.x * s],
      [k.z * k.x * (1 - c) - k.y * s, k.z * k.y * (1 - c) + k.x * s, c + k.z * k.z * (1 - c)],
    ];
    const m = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_v, j) => {
      if (i < 3 && j < 3) {
        return r[i][0] * l[0] * r[j][0] + r[i][1] * l[1] * r[j][1] + r[i][2] * l[2] * r[j][2];
      }

      return i === j ? 1e-6 : 0;
    }));

    return new Matrix(m);
  }

  it.each([
    [[4, 2, 1]],
    [[0.04, 0.04, 0.01]],
    [[1, 1, 1]],
    [[9, 1e-6, 1e-6]],
  ] as [[number, number, number]][])('recovers eigenvalues %j of a rotated diagonal matrix', (l) => {
    const result = CovarianceRealism.analyzeEigenvalues(new StateCovariance(rotated(l), CovarianceFrame.RIC));
    const expected = [...l].sort((a, b) => b - a);

    for (let i = 0; i < 3; i++) {
      expect(result.eigenvalues[i]).toBeCloseTo(expected[i], 9);
    }
    expect(result.isSingular).toBe(false);
  });

  it('labels a ratio above 3 optimistic and between 0.5 and 3 realistic', () => {
    const cov = StateCovariance.fromSigmas([1, 1, 1, 0.001, 0.001, 0.001], CovarianceFrame.RIC);
    const p = circularState(EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'), 7000, [0, 1, 0]);
    const event = (miss: number) => new ConjunctionAssessment(
      { state: p, covariance: cov, radius: 0.01 as Kilometers },
      { state: circularState(p.epoch, 7000 + miss, [0, 1, 0]), covariance: StateCovariance.fromSigmas([1e-3, 1e-3, 1e-3, 1e-6, 1e-6, 1e-6], CovarianceFrame.RIC), radius: 0.01 as Kilometers },
    ).assess({ startTime: p.epoch, endTime: p.epoch.roll(1 as Seconds), searchStepSize: 1 as Seconds });

    expect(CovarianceRealism.computeConsistencyRatio(event(10))!.assessment).toBe('optimistic');
    expect(CovarianceRealism.computeConsistencyRatio(event(1))!.assessment).toBe('realistic');
  });
});

describe('ScreeningFilter apogee/perigee pad (v8)', () => {
  const shell = (perigee: number, apogee: number) => ({ perigee: perigee as Kilometers, apogee: apogee as Kilometers, inclination: 0 as never });

  it('rejects only when the gap exceeds the pad, symmetrically', () => {
    const pad = DEFAULT_SHELL_PAD_KM;
    const low = shell(6800, 6900);

    expect(ScreeningFilter.shellsOverlap(low, shell(6900 + pad - 1e-6, 7000))).toBe(true);
    expect(ScreeningFilter.shellsOverlap(low, shell(6900 + pad + 1e-6, 7000))).toBe(false);
    expect(ScreeningFilter.shellsOverlap(shell(6900 + pad + 1e-6, 7000), low)).toBe(false);
    expect(ScreeningFilter.shellsOverlap(low, shell(6950, 7000), 20 as Kilometers)).toBe(false);
    expect(ScreeningFilter.shellsOverlap(low, shell(6950, 7000), 60 as Kilometers)).toBe(true);
  });

  it('builds shells from geocentric radii and radian inclination', () => {
    const tle = new Tle(
      '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005',
      '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000',
    );
    const s = ScreeningFilter.getOrbitalShell(tle);

    expect(s.inclination).toBeCloseTo((51.64 * Math.PI) / 180, 9);
    expect(s.perigee).toBeCloseTo(tle.perigee + 6378.137, 9);
    expect(s.apogee).toBeGreaterThan(s.perigee);
  });
});
