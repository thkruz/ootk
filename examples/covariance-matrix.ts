/* eslint-disable no-console */
/**
 * Example demonstrating covariance matrix generation from TLEs.
 *
 * This example shows:
 * - Creating a diagonal RIC-frame covariance from a TLE
 * - Reading 1-sigma uncertainties from a covariance
 * - Building a more realistic covariance via sigma-point sampling
 * - Comparing covariance growth for TLEs of different ages
 */

// #region imports
import { CovarianceFrame, createCovarianceFromTle, createSampleCovarianceFromTle, TleLine1 } from 'ootk';
// #endregion imports

// #region iss-tles
// Two TLEs for the International Space Station at different epochs
const tle1 = '1 25544U 98067A   23054.45075046  .00008600  00000+0  16094-3 0  9999' as TleLine1;
const tle2 = '2 25544  51.6417 203.5231 0005102 218.5493 303.0730 15.49367633384846';

const tle1b = '1 25544U 98067A   25116.54581482  .00016635  00000+0  30629-3 0  9995' as TleLine1;
const tle2b = '2 25544  51.6362 202.8258 0002482  75.3938 284.7326 15.49295384507153';
// #endregion iss-tles

// #region ric-covariance
// Create a basic diagonal covariance matrix in the RIC frame
const ricCovariance = createCovarianceFromTle(tle1, tle2, CovarianceFrame.RIC);

console.log('RIC Frame Covariance Matrix:');
console.log(JSON.stringify(ricCovariance.matrix.elements));

// Get the standard deviations (sigmas) back from the matrix diagonal
const sigmas = ricCovariance.sigmas();

console.log('Standard Deviations:');
console.log(sigmas.toString());
// #endregion ric-covariance

// #region sample-covariance
// Create a more realistic covariance using sigma-point sampling.
// The samples are propagated and scaled by TLE quality and age, so the
// resulting uncertainty grows as the TLE gets older.
const sampleCovariance = createSampleCovarianceFromTle(tle1, tle2);

console.log('Sample-based Covariance Matrix:');
console.log(JSON.stringify(sampleCovariance.matrix.elements));

console.log(`Radial Uncertainty: ${sampleCovariance.sigmas().elements[0]} km`);
console.log(`Intrack Uncertainty: ${sampleCovariance.sigmas().elements[1]} km`);
console.log(`Crosstrack Uncertainty: ${sampleCovariance.sigmas().elements[2]} km`);
// #endregion sample-covariance

// #region newer-tle-comparison
// Repeat with the newer TLE. A more recent epoch means less aging, so the
// sampled uncertainties are smaller.
const sampleCovariance2 = createSampleCovarianceFromTle(tle1b, tle2b);

console.log('Sample-based Covariance Matrix (newer TLE):');
console.log(JSON.stringify(sampleCovariance2.matrix.elements));

console.log(`Radial Uncertainty: ${sampleCovariance2.sigmas().elements[0]} km`);
console.log(`Intrack Uncertainty: ${sampleCovariance2.sigmas().elements[1]} km`);
console.log(`Crosstrack Uncertainty: ${sampleCovariance2.sigmas().elements[2]} km`);
// #endregion newer-tle-comparison
