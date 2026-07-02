/* eslint-disable no-console */
/**
 * Lambert State Vector Generation Examples
 *
 * This example demonstrates how to use Lambert's problem solution
 * to generate state vectors without relying on SGP4 or TLEs.
 */

// #region imports
import {
  EpochUTC,
  Kilometers,
  KilometersPerSecond,
  LambertIOD,
  RungeKutta89Propagator,
  Satellite,
  Tle,
  Vector3D,
} from 'ootk';
// #endregion imports

// #region basic-lambert
/**
 * Example 1: Basic Lambert Solution
 * Generate a state vector from two position observations
 */
function example1BasicLambert(): void {
  console.log('\n=== Example 1: Basic Lambert Solution ===\n');

  // Two positions in ECI coordinates (km)
  const p1 = new Vector3D<Kilometers>(6778.137 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers);
  const p2 = new Vector3D<Kilometers>(-2000.0 as Kilometers, 6400.0 as Kilometers, 1500.0 as Kilometers);

  // Observation times
  const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T12:00:00.000Z'));
  const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T13:30:00.000Z'));

  // Solve Lambert's problem
  const lambert = new LambertIOD();
  const stateVector = lambert.estimate(p1, p2, t1, t2, {
    posigrade: true,
    nRev: 0,
  });

  if (!stateVector) {
    console.error('Lambert solution failed!');

    return;
  }

  // Display state vector
  console.log('State Vector at t1:');
  console.log('  Epoch:', stateVector.epoch.toString());
  console.log('  Position (km):', {
    x: stateVector.position.x.toFixed(3),
    y: stateVector.position.y.toFixed(3),
    z: stateVector.position.z.toFixed(3),
  });
  console.log('  Velocity (km/s):', {
    x: stateVector.velocity.x.toFixed(6),
    y: stateVector.velocity.y.toFixed(6),
    z: stateVector.velocity.z.toFixed(6),
  });

  // Convert to classical elements
  const elements = stateVector.toClassicalElements();

  console.log('\nClassical Orbital Elements:');
  console.log('  Semi-major axis:', elements.semimajorAxis.toFixed(3), 'km');
  console.log('  Eccentricity:', elements.eccentricity.toFixed(6));
  console.log('  Inclination:', elements.inclinationDegrees.toFixed(3), 'deg');
  console.log('  RAAN:', elements.rightAscensionDegrees.toFixed(3), 'deg');
  console.log('  Arg of Perigee:', elements.argPerigeeDegrees.toFixed(3), 'deg');
  console.log('  True Anomaly:', elements.trueAnomalyDegrees.toFixed(3), 'deg');
  console.log('  Period:', elements.period.toFixed(2), 'minutes');

  // Calculate apogee and perigee
  const apogee = elements.semimajorAxis * (1 + elements.eccentricity);
  const perigee = elements.semimajorAxis * (1 - elements.eccentricity);

  console.log('  Apogee altitude:', (apogee - 6378.137).toFixed(3), 'km');
  console.log('  Perigee altitude:', (perigee - 6378.137).toFixed(3), 'km');
}
// #endregion basic-lambert

// #region lambert-with-propagator
/**
 * Example 2: Lambert + Numerical Propagator
 * Use Lambert solution with high-precision propagation (no SGP4)
 */
function example2LambertWithPropagator(): void {
  console.log('\n=== Example 2: Lambert + Numerical Propagator ===\n');

  // Initial observation
  const p1 = new Vector3D<Kilometers>(7000.0 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers);
  const p2 = new Vector3D<Kilometers>(0.0 as Kilometers, 7000.0 as Kilometers, 0.0 as Kilometers);

  const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
  const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T01:30:00.000Z'));

  // Solve for orbit
  const lambert = new LambertIOD();
  const initialState = lambert.estimate(p1, p2, t1, t2);

  if (!initialState) {
    console.error('Lambert solution failed!');

    return;
  }

  console.log('Initial state from Lambert:');
  console.log('  Position magnitude:', initialState.position.magnitude().toFixed(3), 'km');
  console.log('  Velocity magnitude:', initialState.velocity.magnitude().toFixed(6), 'km/s');

  // Propagate using RungeKutta89 (high precision, no TLE required)
  const propagator = new RungeKutta89Propagator(initialState);

  // Propagate 1 day into future
  const futureEpoch = EpochUTC.fromDateTime(new Date('2024-01-02T00:00:00.000Z'));
  const futureState = propagator.propagate(futureEpoch);

  console.log('\nState after 1 day propagation (RK89):');
  console.log('  Position (km):', {
    x: futureState.position.x.toFixed(3),
    y: futureState.position.y.toFixed(3),
    z: futureState.position.z.toFixed(3),
  });
  console.log('  Velocity (km/s):', {
    x: futureState.velocity.x.toFixed(6),
    y: futureState.velocity.y.toFixed(6),
    z: futureState.velocity.z.toFixed(6),
  });

  // Compare with Keplerian expectations (period is in minutes)
  const elements = initialState.toClassicalElements();
  const periodMinutes = elements.period;

  console.log('\nOrbit completed', ((24 * 60) / periodMinutes).toFixed(2), 'revolutions in 1 day');
}
// #endregion lambert-with-propagator

// #region lambert-to-satellite
/**
 * Example 3: Convert Lambert Solution to Satellite Object
 * Generate TLE from Lambert solution for use with Satellite class
 */
function example3LambertToSatellite(): void {
  console.log('\n=== Example 3: Lambert to Satellite Conversion ===\n');

  // Position observations
  const p1 = new Vector3D<Kilometers>(6878.137 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers); // ~500 km altitude
  const p2 = new Vector3D<Kilometers>(0.0 as Kilometers, 6878.137 as Kilometers, 0.0 as Kilometers);

  const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
  const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T01:30:00.000Z'));

  // Solve Lambert
  const lambert = new LambertIOD();
  const j2000State = lambert.estimate(p1, p2, t1, t2);

  if (!j2000State) {
    console.error('Lambert solution failed!');

    return;
  }

  // Convert to classical elements
  const elements = j2000State.toClassicalElements();

  console.log('Classical Elements from Lambert:');
  console.log('  a:', elements.semimajorAxis.toFixed(3), 'km');
  console.log('  e:', elements.eccentricity.toFixed(6));
  console.log('  i:', elements.inclinationDegrees.toFixed(3), 'deg');

  // Generate TLE
  const tle = Tle.fromClassicalElements(elements);

  console.log('\nGenerated TLE:');
  console.log('  Line 1:', tle.line1);
  console.log('  Line 2:', tle.line2);

  // Create Satellite object
  const satellite = new Satellite({
    tle1: tle.line1,
    tle2: tle.line2,
    name: 'Lambert-Derived Satellite',
  });

  console.log('\nSatellite created from Lambert solution:');
  console.log('  Name:', satellite.name);
  console.log('  Inclination:', satellite.inclination.toFixed(3), 'deg');
  console.log('  Period:', satellite.period.toFixed(2), 'minutes');
  console.log('  Apogee:', satellite.apogee.toFixed(3), 'km');
  console.log('  Perigee:', satellite.perigee.toFixed(3), 'km');

  // Use Satellite methods
  const futureDate = new Date('2024-01-01T06:00:00.000Z');
  const lla = satellite.lla(futureDate);

  console.log('\nSatellite position at +6 hours:');
  console.log('  Latitude:', lla.lat.toFixed(3), 'deg');
  console.log('  Longitude:', lla.lon.toFixed(3), 'deg');
  console.log('  Altitude:', lla.alt.toFixed(3), 'km');
}
// #endregion lambert-to-satellite

// #region transfer-orbit-planning
/**
 * Example 4: Transfer Orbit Planning
 * Calculate delta-V for orbit transfer using Lambert
 */
function example4TransferOrbit(): void {
  console.log('\n=== Example 4: Transfer Orbit Planning ===\n');

  // Initial circular orbit (LEO)
  const r1 = 6778.137; // km (400 km altitude)
  const v1Circular = Math.sqrt(398600.4418 / r1); // Circular velocity

  const pos1 = new Vector3D<Kilometers>(r1 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers);
  const vel1 = new Vector3D<KilometersPerSecond>(
    0.0 as KilometersPerSecond,
    v1Circular as KilometersPerSecond,
    0.0 as KilometersPerSecond,
  );

  // Target circular orbit (MEO), 90 degrees ahead
  const r2 = 12000.0; // km
  const pos2 = new Vector3D<Kilometers>(0.0 as Kilometers, r2 as Kilometers, 0.0 as Kilometers);

  const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
  const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T05:00:00.000Z')); // 5-hour transfer

  // Solve Lambert for transfer orbit
  const lambert = new LambertIOD();
  const transferOrbit = lambert.estimate(pos1, pos2, t1, t2);

  if (!transferOrbit) {
    console.error('Lambert solution failed!');

    return;
  }

  // Calculate delta-V requirements
  const deltaV1 = transferOrbit.velocity.subtract(vel1);
  const deltaV1Magnitude = deltaV1.magnitude();

  console.log('Transfer from LEO to MEO:');
  console.log('  Initial orbit radius:', r1.toFixed(3), 'km');
  console.log('  Target orbit radius:', r2.toFixed(3), 'km');
  console.log('  Transfer time:', '5 hours');
  console.log('\nTransfer orbit velocity at departure:');
  console.log('  Required V:', transferOrbit.velocity.magnitude().toFixed(6), 'km/s');
  console.log('  Current V:', v1Circular.toFixed(6), 'km/s');
  console.log('  Delta-V1:', deltaV1Magnitude.toFixed(6), 'km/s');
  console.log('  Delta-V1 (m/s):', (deltaV1Magnitude * 1000).toFixed(2), 'm/s');

  // Transfer orbit characteristics
  const elements = transferOrbit.toClassicalElements();

  console.log('\nTransfer orbit elements:');
  console.log('  Semi-major axis:', elements.semimajorAxis.toFixed(3), 'km');
  console.log('  Eccentricity:', elements.eccentricity.toFixed(6));
  console.log('  Apogee:', (elements.semimajorAxis * (1 + elements.eccentricity)).toFixed(3), 'km');
  console.log('  Perigee:', (elements.semimajorAxis * (1 - elements.eccentricity)).toFixed(3), 'km');
}
// #endregion transfer-orbit-planning

// #region multi-revolution
/**
 * Example 5: Multi-Revolution Comparison
 * Compare different revolution options for same transfer
 */
function example5MultiRevolution(): void {
  console.log('\n=== Example 5: Multi-Revolution Transfers ===\n');

  const p1 = new Vector3D<Kilometers>(7000.0 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers);
  const p2 = new Vector3D<Kilometers>(0.0 as Kilometers, 8000.0 as Kilometers, 0.0 as Kilometers);

  const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
  const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T06:00:00.000Z'));

  const lambert = new LambertIOD();

  console.log('Comparing transfer options (6-hour time of flight):');
  console.log('From:', { x: p1.x, y: p1.y, z: p1.z }, 'km');
  console.log('To:', { x: p2.x, y: p2.y, z: p2.z }, 'km\n');

  // Try 0, 1, and 2 complete revolutions
  for (let nRev = 0; nRev <= 2; nRev++) {
    const solution = lambert.estimate(p1, p2, t1, t2, {
      posigrade: true,
      nRev,
    });

    if (solution) {
      const elements = solution.toClassicalElements();
      const vMag = solution.velocity.magnitude();

      console.log(`${nRev}-Revolution Transfer:`);
      console.log('  Departure velocity:', vMag.toFixed(6), 'km/s');
      console.log('  Semi-major axis:', elements.semimajorAxis.toFixed(3), 'km');
      console.log('  Eccentricity:', elements.eccentricity.toFixed(6));
      console.log('  Period:', elements.period.toFixed(2), 'minutes');
      console.log('');
    } else {
      console.log(`${nRev}-Revolution: No solution\n`);
    }
  }
}
// #endregion multi-revolution

// #region short-vs-long-path
/**
 * Example 6: Short Path vs Long Path
 * Demonstrate the difference between short and long path transfers
 */
function example6PathComparison(): void {
  console.log('\n=== Example 6: Short Path vs Long Path ===\n');

  const p1 = new Vector3D<Kilometers>(7000.0 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers);
  const p2 = new Vector3D<Kilometers>(-7000.0 as Kilometers, 1000.0 as Kilometers, 0.0 as Kilometers);

  const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
  const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T02:00:00.000Z'));

  const lambert = new LambertIOD();

  // Short path (posigrade = true)
  const shortPath = lambert.estimate(p1, p2, t1, t2, { posigrade: true });

  // Long path (posigrade = false)
  const longPath = lambert.estimate(p1, p2, t1, t2, { posigrade: false });

  console.log('Transfer between nearly opposite points:\n');

  if (shortPath) {
    const elementsShort = shortPath.toClassicalElements();

    console.log('Short Path Transfer:');
    console.log('  Velocity:', shortPath.velocity.magnitude().toFixed(6), 'km/s');
    console.log('  Semi-major axis:', elementsShort.semimajorAxis.toFixed(3), 'km');
    console.log('  Eccentricity:', elementsShort.eccentricity.toFixed(6));
    console.log('');
  }

  if (longPath) {
    const elementsLong = longPath.toClassicalElements();

    console.log('Long Path Transfer:');
    console.log('  Velocity:', longPath.velocity.magnitude().toFixed(6), 'km/s');
    console.log('  Semi-major axis:', elementsLong.semimajorAxis.toFixed(3), 'km');
    console.log('  Eccentricity:', elementsLong.eccentricity.toFixed(6));
  }

  if (shortPath && longPath) {
    const deltaVDiff = Math.abs(shortPath.velocity.magnitude() - longPath.velocity.magnitude());

    console.log('\nDifference:');
    console.log('  Delta-V difference:', (deltaVDiff * 1000).toFixed(2), 'm/s');
  }
}
// #endregion short-vs-long-path

// #region validation
/**
 * Example 7: Validation and Error Checking
 * Demonstrate proper error handling and solution validation
 */
function example7Validation(): void {
  console.log('\n=== Example 7: Validation and Error Checking ===\n');

  const lambert = new LambertIOD();

  // Test Case 1: Valid solution
  console.log('Test 1: Valid transfer');
  const p1 = new Vector3D<Kilometers>(7000.0 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers);
  const p2 = new Vector3D<Kilometers>(0.0 as Kilometers, 7000.0 as Kilometers, 0.0 as Kilometers);
  const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
  const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T01:30:00.000Z'));

  let solution = lambert.estimate(p1, p2, t1, t2);

  if (solution) {
    console.log('  [ok] Solution found');
    console.log('  Velocity:', solution.velocity.magnitude().toFixed(6), 'km/s\n');
  } else {
    console.log('  [fail] Solution failed\n');
  }

  // Test Case 2: Very short time of flight
  console.log('Test 2: Very short time of flight (30 seconds)');
  const t2Short = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:30.000Z'));

  solution = lambert.estimate(p1, p2, t1, t2Short);
  if (solution) {
    console.log('  [ok] Solution found (hyperbolic velocity required)');
    console.log('  Velocity:', solution.velocity.magnitude().toFixed(6), 'km/s');
  } else {
    console.log('  [fail] Solution failed, time of flight too short\n');
  }

  // Test Case 3: Positions too close
  console.log('Test 3: Positions very close together');
  const p2Close = new Vector3D<Kilometers>(7000.1 as Kilometers, 0.1 as Kilometers, 0.0 as Kilometers);

  solution = lambert.estimate(p1, p2Close, t1, t2);
  if (solution) {
    console.log('  [ok] Solution found\n');
  } else {
    console.log('  [fail] Solution failed, positions too close\n');
  }

  // Test Case 4: Validate orbital parameters
  console.log('Test 4: Solution validation');
  solution = lambert.estimate(p1, p2, t1, t2);
  if (solution) {
    const elements = solution.toClassicalElements();
    const earthRadius = 6378.137;

    console.log('  Checking orbital parameters:');

    // Check if orbit intersects Earth
    const perigeeRadius = elements.semimajorAxis * (1 - elements.eccentricity);

    if (perigeeRadius < earthRadius) {
      console.log('  [warn] WARNING: Orbit intersects Earth!');
      console.log('    Perigee radius:', perigeeRadius.toFixed(3), 'km');
    } else {
      console.log('  [ok] Orbit is valid (perigee above surface)');
      console.log('    Perigee altitude:', (perigeeRadius - earthRadius).toFixed(3), 'km');
    }

    // Check for hyperbolic orbit
    if (elements.eccentricity >= 1.0) {
      console.log('  [warn] Hyperbolic trajectory (e >= 1.0)');
    } else {
      console.log('  [ok] Elliptical orbit (e < 1.0)');
    }
  }
}
// #endregion validation

// #region run-all
function main(): void {
  console.log('\nLambert State Vector Generation Examples');
  console.log('Generating state vectors without SGP4/TLE');

  example1BasicLambert();
  example2LambertWithPropagator();
  example3LambertToSatellite();
  example4TransferOrbit();
  example5MultiRevolution();
  example6PathComparison();
  example7Validation();

  console.log('\nAll examples completed!\n');
}

main();
// #endregion run-all
