/**
 * v8 regression tests for src/observation (QA 2026-10, report section 2.4 and section 1 item 11).
 */
import {
  DEG2RAD,
  Degrees,
  EpochUTC,
  ITRF,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Matrix,
  ObservationOptical,
  ObservationRadar,
  Propagator,
  RAE,
  RadecTopocentric,
  Radians,
  RandomGaussianSource,
  Vector3D,
} from '../../main';

const epoch = EpochUTC.fromDateTime(new Date('2024-01-13T03:00:00Z'));
const site = new J2000(
  epoch,
  new Vector3D(4000 as Kilometers, 3000 as Kilometers, 3500 as Kilometers),
  new Vector3D(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond),
);
const target = new J2000(
  epoch,
  new Vector3D(5000 as Kilometers, 4500 as Kilometers, 4200 as Kilometers),
  new Vector3D(-3 as KilometersPerSecond, 5 as KilometersPerSecond, 2 as KilometersPerSecond),
);
const fixedPropagator = { propagate: () => target } as unknown as Propagator;

function stats(values: number[]): { mean: number; std: number } {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);

  return { mean, std: Math.sqrt(variance) };
}

describe('v8: observation noise sampling (report 1.11 and 2.4)', () => {
  const draws = 20000;

  /*
   * Verifier fix M.10: with the default multiplier sigma = 1, sigma and sqrt(sigma) scaling agree,
   * so this test now samples with sigma = 0.5. The expected standard deviation is 0.5 times the
   * stated sigma; the old sqrt scaling would give 0.707 times (41 % high) and fail the 5 % bound.
   */
  it('ObservationRadar.sample(random, 0.5) has half the stated sigma per component (within 5%, 20000 draws, seeded)', () => {
    const rngSigma = 0.32;
    const angSigma = 0.015 * DEG2RAD;
    const truth = RAE.fromStateVector(target, site);
    const obs = new ObservationRadar(site, truth, ObservationRadar.noiseFromSigmas(rngSigma as Kilometers, angSigma as Radians, angSigma as Radians));
    const random = new RandomGaussianSource(12345);
    const dr: number[] = [];
    const de: number[] = [];

    for (let i = 0; i < draws; i++) {
      const s = obs.sample(random, 0.5) as ObservationRadar;

      dr.push(s.observation.rng - truth.rng);
      de.push(s.observation.elRad - truth.elRad);
    }

    expect(Math.abs(stats(dr).std / (0.5 * rngSigma) - 1)).toBeLessThan(0.05);
    expect(Math.abs(stats(de).std / (0.5 * angSigma) - 1)).toBeLessThan(0.05);
    // Mean within 4 standard errors of zero
    expect(Math.abs(stats(dr).mean)).toBeLessThan((4 * 0.5 * rngSigma) / Math.sqrt(draws));
  });

  it('sigma = 2 doubles the standard deviation (the factor scales sigma, not variance)', () => {
    const raSigma = 0.0037 * DEG2RAD;
    const truth = RadecTopocentric.fromStateVector(target, site);
    const obs = new ObservationOptical(site, truth);
    const random = new RandomGaussianSource(777);
    const dra: number[] = [];

    for (let i = 0; i < draws; i++) {
      const s = obs.sample(random, 2) as ObservationOptical;

      dra.push(s.observation.rightAscension - truth.rightAscension);
    }

    expect(Math.abs(stats(dra).std / (2 * raSigma) - 1)).toBeLessThan(0.05);
  });

  it('correlated noise: sample covariance reproduces C when noise = C^-1 (not an element-wise reciprocal)', () => {
    // C = [[4, 1.2], [1.2, 1]] * 1e-10 rad^2: sigmas 2e-5 and 1e-5 rad, correlation 0.6
    const c = new Matrix([[4e-10, 1.2e-10], [1.2e-10, 1e-10]]);
    const truth = RadecTopocentric.fromStateVector(target, site);
    const obs = new ObservationOptical(site, truth, c.inverse());
    const random = new RandomGaussianSource(2024);
    const a: number[] = [];
    const b: number[] = [];

    for (let i = 0; i < draws; i++) {
      const s = obs.sample(random) as ObservationOptical;

      a.push(s.observation.rightAscension - truth.rightAscension);
      b.push(s.observation.declination - truth.declination);
    }

    const sa = stats(a);
    const sb = stats(b);
    let cov = 0;

    for (let i = 0; i < draws; i++) {
      cov += (a[i] - sa.mean) * (b[i] - sb.mean);
    }
    const corr = cov / (draws - 1) / (sa.std * sb.std);

    expect(Math.abs(sa.std / 2e-5 - 1)).toBeLessThan(0.05);
    expect(Math.abs(sb.std / 1e-5 - 1)).toBeLessThan(0.05);
    // Standard error of r near 0.6 with n = 20000 is (1 - r^2) / sqrt(n) = 0.0045
    expect(Math.abs(corr - 0.6)).toBeLessThan(0.02);
    // noiseCovariance() inverts the weight matrix
    const back = obs.noiseCovariance();

    expect(back.elements[0][1] / 1.2e-10).toBeCloseTo(1, 9);
  });
});

describe('v8: ObservationRadar.clos is a cross line-of-sight distance (report 2.4)', () => {
  it('is zero for a perfect observation, rho * dtheta for an angle error, and blind to range error', () => {
    const truth = RAE.fromStateVector(target, site);
    const rho = target.position.subtract(site.position).magnitude();
    const exact = new ObservationRadar(site, truth);
    const rangeOff = new ObservationRadar(site, new RAE(epoch, (truth.rng + 5) as Kilometers, truth.azRad, truth.elRad));
    const dEl = 1e-5;
    const angleOff = new ObservationRadar(site, new RAE(epoch, truth.rng, truth.azRad, (truth.elRad + dEl) as Radians));

    expect(exact.clos(fixedPropagator)).toBeLessThan(1e-6);
    expect(rangeOff.clos(fixedPropagator)).toBeLessThan(1e-6);
    // Chord 2 rho sin(dEl / 2) = rho dEl to first order
    expect(angleOff.clos(fixedPropagator) / (rho * dEl)).toBeCloseTo(1, 4);
  });
});

describe('v8: RAE state conversions (report 2.4)', () => {
  it('toStateVector without rates leaves the observation untouched and round-trips position', () => {
    const truth = RAE.fromStateVector(target, site);
    const bare = new RAE(epoch, truth.rng, truth.azRad, truth.elRad);
    const state = bare.toStateVector(site);

    expect(bare.rngRate).toBeUndefined();
    expect(bare.azRateRad).toBeUndefined();
    expect(bare.elRateRad).toBeUndefined();
    expect(state.position.subtract(target.position).magnitude()).toBeLessThan(1e-6);
  });

  it('fromStateVector at exact zenith gives finite rates: el rate = -|horizontal velocity| / range', () => {
    // Site on the ITRF x axis (lat 0, lon 0); target 500 km straight up moving 7 km/s north (+z)
    const s = new ITRF(
      epoch,
      new Vector3D(6378.137 as Kilometers, 0 as Kilometers, 0 as Kilometers),
      Vector3D.origin as Vector3D<KilometersPerSecond>,
    ).toJ2000();
    const t = new ITRF(
      epoch,
      new Vector3D(6878.137 as Kilometers, 0 as Kilometers, 0 as Kilometers),
      new Vector3D(0 as KilometersPerSecond, 0 as KilometersPerSecond, 7 as KilometersPerSecond),
    ).toJ2000();
    const rae = RAE.fromStateVector(t, s);

    expect(rae.el).toBeCloseTo(90, 6);
    expect(Number.isFinite(rae.azRateRad!)).toBe(true);
    expect(Number.isFinite(rae.elRateRad!)).toBe(true);
    expect(rae.elRateRad!).toBeCloseTo(-7 / 500, 6);
  });
});

describe('v8: right ascension convention (report 2.4)', () => {
  it('topocentric RA is in [0, 2pi) from both constructors, like geocentric', () => {
    const behind = new J2000(
      epoch,
      new Vector3D(3000 as Kilometers, 2000 as Kilometers, 3500 as Kilometers),
      Vector3D.origin as Vector3D<KilometersPerSecond>,
    );
    const fromState = RadecTopocentric.fromStateVector(behind, site);
    const fromDeg = RadecTopocentric.fromDegrees(epoch, 350 as Degrees, 0 as Degrees);

    expect(fromState.rightAscension).toBeGreaterThanOrEqual(0);
    expect(fromState.rightAscension).toBeLessThan(2 * Math.PI);
    expect(fromDeg.rightAscension).toBeCloseTo(350 * DEG2RAD, 12);
  });
});
