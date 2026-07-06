/* eslint-disable no-console */
/**
 * @file Conjunction Assessment Example
 * @description Demonstrates high accuracy conjunction assessment using
 * historical TLE accuracy and covariance propagation.
 *
 * This example shows how to:
 * 1. Set up a conjunction assessment between two space objects
 * 2. Use high-fidelity propagators for improved accuracy
 * 3. Propagate covariance matrices based on TLE quality
 * 4. Calculate probability of collision
 *
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

// #region imports
import {
  ConjunctionAssessment,
  CovarianceFrame,
  EpochUTC,
  ForceModel,
  Kilometers,
  RungeKutta89Propagator,
  StateCovariance,
  Tle,
} from 'ootk';
// #endregion imports

// #region scenario-setup
// Sample TLE data for two satellites in close proximity
const primaryTle = new Tle(
  '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005',
  '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000',
);

const secondaryTle = new Tle(
  '1 44691U 19074A   25019.50000000  .00016500  00000-0  10200-3 0  9006',
  '2 44691  51.6450 339.8050 0002600  90.5050 269.6050 15.50005000000000',
);

// Search window (6 hours, starting half a day after the TLE epoch)
const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
const endTime = EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z');

// Hard body radii used for probability of collision
const primaryRadius = 0.05 as Kilometers; // 50 meters
const secondaryRadius = 0.01 as Kilometers; // 10 meters
// #endregion scenario-setup

// #region basic-sgp4-assessment
console.log('=== Example 1: Basic Conjunction Assessment ===\n');

// With TLE inputs and no extra options, both objects are propagated with SGP4
const basicAssessment = new ConjunctionAssessment(
  { name: 'ISS (Zarya)', tle: primaryTle, radius: primaryRadius },
  { name: 'Secondary Object', tle: secondaryTle, radius: secondaryRadius },
);

const basicEvent = basicAssessment.assess({ startTime, endTime });

console.log(basicEvent.toString());
console.log(`\nHigh Risk: ${basicEvent.isHighRisk(1.0 as Kilometers)}`);
// #endregion basic-sgp4-assessment

// #region high-fidelity-with-covariance
console.log('\n=== Example 2: High-Fidelity Assessment with Covariance ===\n');

// Build a force model with 8x8 spherical harmonic gravity plus drag and
// solar radiation pressure (both need spacecraft mass in kg and area in m^2)
const forceModel = new ForceModel();

forceModel.setEarthGravity(8, 8);
forceModel.setAtmosphericDrag(460000, 1500);
forceModel.setSolarRadiationPressure(460000, 2500);

// Seed each numerical propagator with the SGP4 state at the window start,
// then hand the propagators to the assessment via the propagator override.
const primaryJ2000 = primaryTle.propagate(startTime).toJ2000();
const secondaryJ2000 = secondaryTle.propagate(startTime).toJ2000();

const hifiAssessment = new ConjunctionAssessment(
  {
    name: 'ISS (Zarya)',
    tle: primaryTle,
    radius: primaryRadius,
    propagator: new RungeKutta89Propagator(primaryJ2000, forceModel),
  },
  {
    name: 'Secondary Object',
    tle: secondaryTle,
    radius: secondaryRadius,
    propagator: new RungeKutta89Propagator(secondaryJ2000, forceModel),
  },
);

const hifiEvent = hifiAssessment.assess({
  startTime,
  endTime,
  forceModel,
  propagateCovariance: true, // Propagate TLE-based covariances via sigma points
});

console.log(hifiEvent.toString());

if (hifiEvent.probabilityOfCollision !== undefined) {
  console.log(`\nProbability of Collision: ${hifiEvent.probabilityOfCollision.toExponential(6)}`);
}

const mahalanobis = hifiEvent.getMahalanobisDistance();

if (mahalanobis !== undefined) {
  console.log(`Mahalanobis Distance: ${mahalanobis.toFixed(3)} sigma`);
}
// #endregion high-fidelity-with-covariance

// #region custom-covariance
console.log('\n=== Example 3: Custom Covariance Matrices ===\n');

/*
 * Define custom covariances (1-sigma values in RIC frame)
 * [radial, intrack, crosstrack, radial_vel, intrack_vel, crosstrack_vel]
 */
const primaryCovariance = StateCovariance.fromSigmas(
  [
    0.5, // 500 m radial uncertainty
    1.5, // 1.5 km intrack uncertainty
    0.5, // 500 m crosstrack uncertainty
    0.001, // 1 m/s radial velocity uncertainty
    0.003, // 3 m/s intrack velocity uncertainty
    0.001, // 1 m/s crosstrack velocity uncertainty
  ],
  CovarianceFrame.RIC,
);

const secondaryCovariance = StateCovariance.fromSigmas(
  [0.3, 1.0, 0.3, 0.0005, 0.002, 0.0005],
  CovarianceFrame.RIC,
);

const customAssessment = new ConjunctionAssessment(
  {
    name: 'ISS (Zarya)',
    tle: primaryTle,
    covariance: primaryCovariance,
    radius: primaryRadius,
  },
  {
    name: 'Secondary Object',
    tle: secondaryTle,
    covariance: secondaryCovariance,
    radius: secondaryRadius,
  },
);

const customEvent = customAssessment.assess({ startTime, endTime });

console.log(customEvent.toString());
// #endregion custom-covariance

// #region multi-object-screening
console.log('\n=== Example 4: Multi-Object Screening ===\n');

// List of potential conjunction objects
const secondaryTles = [
  secondaryTle,
  new Tle(
    '1 12345U 81001A   25019.50000000  .00016400  00000-0  10100-3 0  9007',
    '2 12345  51.6500 339.8100 0002650  90.5100 269.6100 15.50010000000000',
  ),
];

const screeningThreshold = 5.0 as Kilometers; // 5 km screening threshold
const pcThreshold = 1e-6; // Pc > 1e-6 is concerning

console.log(`Screening ${secondaryTles.length} objects for conjunctions...\n`);

secondaryTles.forEach((tle, index) => {
  const screeningAssessment = new ConjunctionAssessment(
    { tle: primaryTle, radius: primaryRadius },
    { tle, radius: secondaryRadius },
  );

  const event = screeningAssessment.assess({
    startTime,
    endTime,
    propagateCovariance: true,
  });

  if (event.missDistance < screeningThreshold) {
    console.log(`Object ${index + 1}: CLOSE APPROACH DETECTED`);
    console.log(`  TCA: ${event.tca.toString()}`);
    console.log(`  Miss Distance: ${event.missDistance.toFixed(3)} km`);

    if (event.probabilityOfCollision !== undefined && event.probabilityOfCollision > pcThreshold) {
      console.log(`  Pc: ${event.probabilityOfCollision.toExponential(3)} [HIGH RISK]`);
    } else if (event.probabilityOfCollision !== undefined) {
      console.log(`  Pc: ${event.probabilityOfCollision.toExponential(3)}`);
    }
    console.log();
  } else {
    console.log(`Object ${index + 1}: no close approach inside ${screeningThreshold} km`);
    console.log(`  Miss Distance: ${event.missDistance.toFixed(3)} km\n`);
  }
});

console.log('=== All Examples Complete ===');
// #endregion multi-object-screening
