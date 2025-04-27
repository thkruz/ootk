import { Tle, CovarianceSample, CovarianceFrame, StateCovariance } from '../main.js';

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
