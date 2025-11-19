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
 * @copyright (c) 2025 Kruczek Labs LLC
 */

import {
  ConjunctionAssessment,
  EpochUTC,
  ForceModel,
  Kilometers,
  Tle,
  StateCovariance,
  CovarianceFrame,
} from '../src/main';

// Example 1: Basic Conjunction Assessment using TLEs
function basicConjunctionAssessment() {
  console.log('=== Example 1: Basic Conjunction Assessment ===\n');

  // Sample TLE data for two satellites in close proximity
  const primaryTle = new Tle(
    '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005',
    '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000',
  );

  const secondaryTle = new Tle(
    '1 44691U 19074A   25019.50000000  .00016500  00000-0  10200-3 0  9006',
    '2 44691  51.6450 339.8050 0002600  90.5050 269.6050 15.50005000000000',
  );

  // Create conjunction assessment with object radii
  const assessment = new ConjunctionAssessment(
    {
      name: 'ISS (Zarya)',
      tle: primaryTle,
      radius: 0.05 as Kilometers, // 50 meters
    },
    {
      name: 'Secondary Object',
      tle: secondaryTle,
      radius: 0.01 as Kilometers, // 10 meters
    },
  );

  // Define search window (6 hours)
  const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
  const endTime = EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z');

  // Perform conjunction assessment
  const event = assessment.assess({
    startTime,
    endTime,
  });

  // Display results
  console.log(event.toString());
  console.log(`\nHigh Risk: ${event.isHighRisk(1.0 as Kilometers)}`);
}

// Example 2: High-Fidelity Propagation with Covariance
function highFidelityConjunctionAssessment() {
  console.log('\n=== Example 2: High-Fidelity Assessment with Covariance ===\n');

  const primaryTle = new Tle(
    '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005',
    '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000',
  );

  const secondaryTle = new Tle(
    '1 44691U 19074A   25019.50000000  .00016500  00000-0  10200-3 0  9006',
    '2 44691  51.6450 339.8050 0002600  90.5050 269.6050 15.50005000000000',
  );

  const assessment = new ConjunctionAssessment(
    {
      name: 'ISS (Zarya)',
      tle: primaryTle,
      radius: 0.05 as Kilometers,
    },
    {
      name: 'Secondary Object',
      tle: secondaryTle,
      radius: 0.01 as Kilometers,
    },
  );

  const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
  const endTime = EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z');

  // Use high-fidelity propagation with force model
  const forceModel = new ForceModel().setGravity(8, 8).setAtmosphericDrag().setSolarRadiationPressure();

  const event = assessment.assess({
    startTime,
    endTime,
    useHighFidelity: true,
    forceModel,
    propagateCovariance: true, // Propagate TLE-based covariances
  });

  console.log(event.toString());

  if (event.probabilityOfCollision !== undefined) {
    console.log(`\nProbability of Collision: ${event.probabilityOfCollision.toExponential(6)}`);
  }

  if (event.getMahalanobisDistance() !== undefined) {
    console.log(`Mahalanobis Distance: ${event.getMahalanobisDistance()!.toFixed(3)} sigma`);
  }
}

// Example 3: Custom Covariance Matrices
function customCovarianceAssessment() {
  console.log('\n=== Example 3: Custom Covariance Matrices ===\n');

  const primaryTle = new Tle(
    '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005',
    '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000',
  );

  const secondaryTle = new Tle(
    '1 44691U 19074A   25019.50000000  .00016500  00000-0  10200-3 0  9006',
    '2 44691  51.6450 339.8050 0002600  90.5050 269.6050 15.50005000000000',
  );

  // Define custom covariances (1-sigma values in RIC frame)
  // [radial, intrack, crosstrack, radial_vel, intrack_vel, crosstrack_vel]
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

  const assessment = new ConjunctionAssessment(
    {
      name: 'ISS (Zarya)',
      tle: primaryTle,
      covariance: primaryCovariance,
      radius: 0.05 as Kilometers,
    },
    {
      name: 'Secondary Object',
      tle: secondaryTle,
      covariance: secondaryCovariance,
      radius: 0.01 as Kilometers,
    },
  );

  const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
  const endTime = EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z');

  const event = assessment.assess({
    startTime,
    endTime,
  });

  console.log(event.toString());
}

// Example 4: Screening Multiple Objects
function screeningExample() {
  console.log('\n=== Example 4: Multi-Object Screening ===\n');

  const primaryTle = new Tle(
    '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005',
    '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000',
  );

  // List of potential conjunction objects
  const secondaryTles = [
    new Tle(
      '1 44691U 19074A   25019.50000000  .00016500  00000-0  10200-3 0  9006',
      '2 44691  51.6450 339.8050 0002600  90.5050 269.6050 15.50005000000000',
    ),
    new Tle(
      '1 12345U 81001A   25019.50000000  .00016400  00000-0  10100-3 0  9007',
      '2 12345  51.6500 339.8100 0002650  90.5100 269.6100 15.50010000000000',
    ),
  ];

  const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
  const endTime = EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z');

  const screeningThreshold = 5.0 as Kilometers; // 5 km screening threshold
  const pcThreshold = 1e-6; // Pc > 1e-6 is concerning

  console.log(`Screening ${secondaryTles.length} objects for conjunctions...\n`);

  secondaryTles.forEach((secondaryTle, index) => {
    const assessment = new ConjunctionAssessment(
      { tle: primaryTle, radius: 0.05 as Kilometers },
      { tle: secondaryTle, radius: 0.01 as Kilometers },
    );

    const event = assessment.assess({
      startTime,
      endTime,
      useHighFidelity: true,
      propagateCovariance: true,
    });

    if (event.missDistance < screeningThreshold) {
      console.log(`Object ${index + 1}: CLOSE APPROACH DETECTED`);
      console.log(`  TCA: ${event.tca.toISOString()}`);
      console.log(`  Miss Distance: ${event.missDistance.toFixed(3)} km`);

      if (event.probabilityOfCollision !== undefined && event.probabilityOfCollision > pcThreshold) {
        console.log(`  Pc: ${event.probabilityOfCollision.toExponential(3)} [HIGH RISK]`);
      } else if (event.probabilityOfCollision !== undefined) {
        console.log(`  Pc: ${event.probabilityOfCollision.toExponential(3)}`);
      }
      console.log();
    }
  });
}

// Run all examples
if (require.main === module) {
  basicConjunctionAssessment();
  highFidelityConjunctionAssessment();
  customCovarianceAssessment();
  screeningExample();

  console.log('\n=== All Examples Complete ===');
}
