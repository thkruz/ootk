import { CovarianceFrame, StateCovariance } from '../covariance/StateCovariance';
import { CovarianceSample } from '../covariance/CovarianceSample';
import { Matrix } from '../operations/Matrix';
import { Tle } from '../coordinate/Tle';

/**
 * Creates a 6x6 state covariance matrix from a TLE
 * @param tleLine1 The first line of the TLE
 * @param tleLine2 The second line of the TLE
 * @param frame The covariance frame (CovarianceFrame.ECI or CovarianceFrame.RIC)
 * @param sigmaScale Scaling factor for the sigmas (default: 1.0)
 * @returns A StateCovariance object containing the 6x6 covariance matrix
 */
export function createCovarianceFromTle(
  tleLine1: string,
  tleLine2: string,
  frame: CovarianceFrame = CovarianceFrame.RIC,
  sigmaScale: number = 1.0,
): StateCovariance {
  // Parse the TLE and get the state vector
  // Parse the TLE so an invalid element set throws here, as before
  // eslint-disable-next-line no-new
  new Tle(tleLine1, tleLine2);

  /*
   * Determine appropriate sigma values based on TLE
   * These are rough estimates and can be adjusted based on your needs
   */
  const positionSigma = 1.0 * sigmaScale; // km
  const velocitySigma = 0.001 * sigmaScale; // km/s

  // Create a diagonal covariance matrix with sigma values
  const sigmas = [
    positionSigma, positionSigma, positionSigma,
    velocitySigma, velocitySigma, velocitySigma,
  ];

  // Generate the covariance matrix in the desired frame
  return StateCovariance.fromSigmas(sigmas, frame);
}

/**
 * Creates a sample-based covariance from a TLE with more realistic uncertainties
 * @param tleLine1 The first line of the TLE
 * @param tleLine2 The second line of the TLE
 * @param frame The covariance frame (CovarianceFrame.ECI or CovarianceFrame.RIC)
 * @returns A StateCovariance object
 */
export function createSampleCovarianceFromTle(
  tleLine1: string,
  tleLine2: string,
  frame: CovarianceFrame = CovarianceFrame.RIC,
): StateCovariance {
  // Parse the TLE and get the state vector
  const tle = new Tle(tleLine1, tleLine2);
  const temeState = tle.state;
  const j2000State = temeState.toJ2000();

  /*
   * Create initial covariance with basic sigma values
   * Position uncertainties are higher in-track than radial/cross-track
   * for most space catalog objects
   */
  const sigmas = frame === CovarianceFrame.RIC
    ? [0.12, 1.0, 0.1, 0.00012, 0.001, 0.0001] // RIC frame: [R,I,C,Rdot,Idot,Cdot]
    : [0.6, 0.6, 0.6, 0.0006, 0.0006, 0.0006]; // ECI frame: [x,y,z,vx,vy,vz]

  const covariance = StateCovariance.fromSigmas(sigmas, frame);

  // Create a covariance sample that will be used to generate a more realistic covariance
  const sample = new CovarianceSample(j2000State, covariance, tle);

  // Return the desample in the appropriate frame
  return frame === CovarianceFrame.RIC ? sample.desampleRIC() : sample.desampleJ2000();
}

/**
 * Default RIC position-sigma caps (km) for debris screening, in R, I, C order:
 * [radial, in-track, cross-track] = [35, 71, 32] km.
 *
 * These preserve the effective v7 behaviour. v7's default caps were 1200, 5000 and 1000 for
 * R, I, C, but v7 stored sigmas on the diagonal and every consumer read the diagonal as a
 * variance, so the caps that actually bound were sqrt(1200) = 34.6 km, sqrt(5000) = 70.7 km and
 * sqrt(1000) = 31.6 km of 1-sigma. v8 squares the caps correctly, so keeping 1200/5000/1000 would
 * have made them 1200 km sigmas that never bind; the values are rounded up to whole km.
 */
const DEFAULT_SCREENING_SIGMA_CAPS: readonly [number, number, number] = [35, 71, 32];

/**
 * Velocity-to-position sigma ratio (1/s) for the fallback covariance: sigma_v = sigma_p / 1000 s.
 * This is the ratio {@link createSampleCovarianceFromTle} uses for its own RIC seed sigmas
 * (0.12 km / 0.00012 km/s, 1.0 km / 0.001 km/s, 0.1 km / 0.0001 km/s).
 */
const FALLBACK_VELOCITY_PER_POSITION_SIGMA = 1e-3;

/**
 * Build a 6x6 covariance for conjunction screening from a TLE.
 *
 * Starts from {@link createSampleCovarianceFromTle} (RIC frame, R, I, C, Rdot, Idot, Cdot order),
 * scales it to the requested confidence level and caps each position sigma so a single bad TLE
 * cannot produce an enormous covariance bubble:
 *
 * - Confidence: C = k^2 S, so each 1-sigma becomes k sigma (k = `confidenceLevel`).
 * - Caps: with sigma_i = sqrt(C_ii) for the R, I, C position axes and d_i = min(1, cap_i / sigma_i)
 *   (d = 1 for the velocity axes), the result is D C D with D = diag(d). Each capped position
 *   variance becomes exactly cap_i^2 (km^2), correlation coefficients are unchanged, and the
 *   matrix stays symmetric positive semidefinite.
 *
 * The diagonal therefore holds VARIANCES: km^2 for R, I, C and km^2/s^2 for Rdot, Idot, Cdot, and
 * the frame is RIC (the primary object's radial, in-track, cross-track axes). `caps` are 1-sigma
 * caps in km; they are squared internally. The defaults, [35, 71, 32] km, reproduce the caps v7
 * applied in practice (see DEFAULT_SCREENING_SIGMA_CAPS).
 * @param tleLine1 First line of the TLE
 * @param tleLine2 Second line of the TLE
 * @param confidenceLevel Sigma multiplier k (e.g. settingsManager.covarianceConfidenceLevel)
 * @param caps 1-sigma caps in km, [radial, in-track, cross-track] (R, I, C order), default [35, 71, 32]
 * @returns A StateCovariance in the RIC frame, or a non-singular diagonal fallback (position variances
 * cap^2 km^2, velocity variances (cap / 1000 s)^2 km^2/s^2) when the TLE-based computation fails or
 * yields a degenerate diagonal.
 */
export function cappedScreeningCovarianceFromTle(
  tleLine1: string,
  tleLine2: string,
  confidenceLevel: number,
  caps: readonly [number, number, number] = DEFAULT_SCREENING_SIGMA_CAPS,
): StateCovariance {
  let source: number[][];

  try {
    source = createSampleCovarianceFromTle(tleLine1, tleLine2, CovarianceFrame.RIC).matrix.elements;
  } catch {
    return buildFallbackScreeningCovariance_(caps);
  }

  const k2 = confidenceLevel * confidenceLevel;
  const d = [1, 1, 1, 1, 1, 1];

  for (let i = 0; i < 3; i++) {
    const sigma = Math.sqrt(source[i][i] * k2);

    if (!(sigma > 0) || !Number.isFinite(sigma)) {
      return buildFallbackScreeningCovariance_(caps);
    }
    d[i] = Math.min(1, caps[i] / sigma);
  }

  const elements = source.map((row, i) => row.map((v, j) => v * k2 * d[i] * d[j]));

  return new StateCovariance(new Matrix(elements), CovarianceFrame.RIC);
}

/**
 * Builds a fallback 6x6 RIC covariance, used when TLE-based covariance computation fails or
 * degenerates. The diagonal holds variances: cap_i^2 (km^2) for R, I, C and
 * (cap_i * 1e-3 /s)^2 (km^2/s^2) for Rdot, Idot, Cdot, the same velocity-to-position sigma ratio
 * as the seed sigmas of {@link createSampleCovarianceFromTle}. Every diagonal entry is positive,
 * so the matrix is non-singular (v7 and early v8 left the velocity block zero).
 * @param caps 1-sigma caps in km, [radial, in-track, cross-track]
 * @returns A StateCovariance in the RIC frame
 */
function buildFallbackScreeningCovariance_(caps: readonly [number, number, number]): StateCovariance {
  const fallback = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));

  for (let i = 0; i < 3; i++) {
    const sigmaV = caps[i] * FALLBACK_VELOCITY_PER_POSITION_SIGMA;

    fallback[i][i] = caps[i] * caps[i];
    fallback[i + 3][i + 3] = sigmaV * sigmaV;
  }

  return new StateCovariance(new Matrix(fallback), CovarianceFrame.RIC);
}
