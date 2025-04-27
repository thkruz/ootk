/* eslint-disable no-console */
import { TleLine1 } from '@src/main.js';
import { CovarianceFrame, createCovarianceFromTle, createSampleCovarianceFromTle } from '../dist/main.js';

// Example TLE for the International Space Station
const tle1 = '1 25544U 98067A   23054.45075046  .00008600  00000+0  16094-3 0  9999' as TleLine1;
const tle2 = '2 25544  51.6417 203.5231 0005102 218.5493 303.0730 15.49367633384846';

const tle1b = '1 25544U 98067A   25116.54581482  .00016635  00000+0  30629-3 0  9995' as TleLine1;
const tle2b = '2 25544  51.6362 202.8258 0002482  75.3938 284.7326 15.49295384507153';

// Create a basic covariance matrix in RIC frame
const ricCovariance = createCovarianceFromTle(tle1, tle2, CovarianceFrame.RIC);

console.log('RIC Frame Covariance Matrix:');
console.log(JSON.stringify(ricCovariance.matrix), null, 2);

// Get the standard deviations (sigmas)
const sigmas = ricCovariance.sigmas();

console.log('Standard Deviations:');
console.log(sigmas.toString());

// Create a more realistic covariance using sampling
const sampleCovariance = createSampleCovarianceFromTle(tle1, tle2);

console.log('Sample-based Covariance Matrix:');
console.log(JSON.stringify(sampleCovariance.matrix), null, 2);

console.log(`Radial Uncertainty: ${sampleCovariance.sigmas().elements[0]} km`);
console.log(`Intrack Uncertainty: ${sampleCovariance.sigmas().elements[1]} km`);
console.log(`Crosstrack Uncertainty: ${sampleCovariance.sigmas().elements[2]} km`);

// Now use tleb
const sampleCovariance2 = createSampleCovarianceFromTle(tle1b, tle2b);

console.log('Sample-based Covariance Matrix:');
console.log(JSON.stringify(sampleCovariance2.matrix), null, 2);

console.log(`Radial Uncertainty: ${sampleCovariance2.sigmas().elements[0]} km`);
console.log(`Intrack Uncertainty: ${sampleCovariance2.sigmas().elements[1]} km`);
console.log(`Crosstrack Uncertainty: ${sampleCovariance2.sigmas().elements[2]} km`);
