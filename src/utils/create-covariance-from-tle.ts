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
  const tle = new Tle(tleLine1, tleLine2);
  const temeState = tle.state;
  const j2000State = temeState.toJ2000();

  // eslint-disable-next-line no-console
  console.log('J2000 State:', j2000State);

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

/** Default RIC position-sigma caps (km) for debris screening: [radial, cross-track, in-track]. */
const DEFAULT_SCREENING_SIGMA_CAPS: readonly [number, number, number] = [1200, 1000, 5000];

/**
 * Build a position covariance for conjunction screening from a TLE.
 *
 * Starts from {@link createSampleCovarianceFromTle}, converts the radial,
 * in-track and cross-track *variances* on the diagonal into 1-sigma values
 * scaled by `confidenceLevel`, and caps each so a single bad TLE cannot produce
 * an enormous covariance bubble. The capped sigmas are written to the [0][0]
 * (radial), [1][1] (cross-track) and [2][2] (in-track) diagonal slots; all
 * other matrix terms are preserved.
 *
 * Note the cross-track / in-track slots are intentionally swapped relative to
 * the source RIC ordering. The original sigmas are cached before any write so
 * the swap reads source values, not values it just overwrote.
 * @param tleLine1 First line of the TLE
 * @param tleLine2 Second line of the TLE
 * @param confidenceLevel Sigma multiplier (e.g. settingsManager.covarianceConfidenceLevel)
 * @param caps Optional [radial, crossTrack, inTrack] sigma caps in km
 * @returns A StateCovariance in the ECI frame, or a safe fallback if the
 * TLE-based computation fails or yields a degenerate diagonal.
 */
export function cappedScreeningCovarianceFromTle(
  tleLine1: string,
  tleLine2: string,
  confidenceLevel: number,
  caps: readonly [number, number, number] = DEFAULT_SCREENING_SIGMA_CAPS,
): StateCovariance {
  let elements: number[][];

  try {
    elements = createSampleCovarianceFromTle(tleLine1, tleLine2).matrix.elements;
  } catch {
    return buildFallbackScreeningCovariance_(caps);
  }

  // Cache originals BEFORE writing: the cross/in-track slots are swapped, so
  // reading after a write would otherwise corrupt the in-track sigma.
  const radialVar = elements[0][0];
  const intrackVar = elements[1][1];
  const crosstrackVar = elements[2][2];

  elements[0][0] = Math.min(Math.sqrt(radialVar) * confidenceLevel, caps[0]); // Radial
  elements[1][1] = Math.min(Math.sqrt(crosstrackVar) * confidenceLevel, caps[1]); // Cross-track
  elements[2][2] = Math.min(Math.sqrt(intrackVar) * confidenceLevel, caps[2]); // In-track

  if (!elements[0][0] || !elements[1][1] || !elements[2][2]) {
    return buildFallbackScreeningCovariance_(caps);
  }

  return new StateCovariance(new Matrix(elements), CovarianceFrame.ECI);
}

/**
 * Builds a fallback 6x6 covariance with the supplied position-sigma caps on the
 * diagonal, used when TLE-based covariance computation fails or degenerates.
 * @param caps [radial, crossTrack, inTrack] sigma caps in km
 * @returns A StateCovariance in the ECI frame
 */
function buildFallbackScreeningCovariance_(caps: readonly [number, number, number]): StateCovariance {
  const fallback = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));

  fallback[0][0] = caps[0];
  fallback[1][1] = caps[1];
  fallback[2][2] = caps[2];

  return new StateCovariance(new Matrix(fallback), CovarianceFrame.ECI);
}
