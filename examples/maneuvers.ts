/* eslint-disable no-console */
/**
 * Example demonstrating orbital maneuver calculations.
 *
 * This example shows:
 * - Hohmann transfer calculations with TwoBurnOrbitTransfer
 * - Delta-V budgets for two-burn transfers
 * - Converting a transfer into scheduled Thrust maneuvers
 * - Plane change delta-V with PlaneChangeBurn
 */

// #region imports
import {
  ClassicalElements,
  DEG2RAD,
  EpochUTC,
  Kilometers,
  PlaneChangeBurn,
  Radians,
  TwoBurnOrbitTransfer,
} from 'ootk';
// #endregion imports

// #region orbit-definitions
const epoch = EpochUTC.fromDateTimeString('2024-01-28T00:00:00.000Z');
const earthRadius = 6378.137;

// Initial LEO orbit (nearly circular, ~400 km altitude)
const leoOrbit = new ClassicalElements({
  epoch,
  semimajorAxis: 6778 as Kilometers,
  eccentricity: 0.001,
  inclination: (28.5 * DEG2RAD) as Radians,
  rightAscension: 0 as Radians,
  argPerigee: 0 as Radians,
  trueAnomaly: 0 as Radians,
});

// Target GEO orbit (circular, equatorial)
const geoOrbit = new ClassicalElements({
  epoch,
  semimajorAxis: 42164 as Kilometers,
  eccentricity: 0.001,
  inclination: 0 as Radians,
  rightAscension: 0 as Radians,
  argPerigee: 0 as Radians,
  trueAnomaly: 0 as Radians,
});

console.log('=== Example 1: Hohmann Transfer from LEO to GEO ===\n');

console.log('Initial Orbit (LEO):');
console.log(`  Altitude: ${(leoOrbit.semimajorAxis - earthRadius).toFixed(2)} km`);
console.log(`  Inclination: ${leoOrbit.inclinationDegrees.toFixed(1)} deg`);
console.log(`  Period: ${leoOrbit.period.toFixed(2)} minutes`);

console.log('\nTarget Orbit (GEO):');
console.log(`  Altitude: ${(geoOrbit.semimajorAxis - earthRadius).toFixed(2)} km`);
console.log(`  Inclination: ${geoOrbit.inclinationDegrees.toFixed(1)} deg`);
console.log(`  Period: ${geoOrbit.period.toFixed(2)} minutes`);
// #endregion orbit-definitions

// #region hohmann-leo-to-geo
// TwoBurnOrbitTransfer.hohmannTransfer() takes the radii of the two circular
// orbits and returns burn magnitudes plus the transfer time.
const leoToGeo = TwoBurnOrbitTransfer.hohmannTransfer(leoOrbit.semimajorAxis, geoOrbit.semimajorAxis);

console.log('\nHohmann Transfer:');
console.log(`  Initial circular velocity: ${leoToGeo.vInit.toFixed(3)} km/s`);
console.log(`  Final circular velocity: ${leoToGeo.vFinal.toFixed(3)} km/s`);
console.log(`  First burn (perigee): ${leoToGeo.vTransA.toFixed(3)} km/s`);
console.log(`  Second burn (apogee): ${leoToGeo.vTransB.toFixed(3)} km/s`);
console.log(`  Total delta-V: ${leoToGeo.deltaV.toFixed(3)} km/s`);
console.log(`  Transfer time: ${(leoToGeo.tTrans / 60).toFixed(2)} minutes (half orbit)`);

// The transfer ellipse spans from the initial radius to the final radius
const transferSma = (leoOrbit.semimajorAxis + geoOrbit.semimajorAxis) / 2;
const transferEcc = (geoOrbit.semimajorAxis - leoOrbit.semimajorAxis) / (geoOrbit.semimajorAxis + leoOrbit.semimajorAxis);

console.log(`  Transfer semi-major axis: ${transferSma.toFixed(2)} km`);
console.log(`  Transfer eccentricity: ${transferEcc.toFixed(6)}`);
console.log(`  Periapsis altitude: ${(leoOrbit.semimajorAxis - earthRadius).toFixed(2)} km`);
console.log(`  Apoapsis altitude: ${(geoOrbit.semimajorAxis - earthRadius).toFixed(2)} km`);
// #endregion hohmann-leo-to-geo

// #region burn-schedule
// toManeuvers() converts the transfer into two impulsive Thrust objects,
// with the second burn scheduled one transfer time after the first.
const [burnA, burnB] = leoToGeo.toManeuvers(epoch);

console.log('\nBurn Schedule (impulsive Thrust maneuvers):');
console.log(`  Burn 1: ${burnA.center.toString()}`);
console.log(`    Intrack delta-V: ${burnA.intrack.toFixed(1)} m/s`);
console.log(`  Burn 2: ${burnB.center.toString()}`);
console.log(`    Intrack delta-V: ${burnB.intrack.toFixed(1)} m/s`);
// #endregion burn-schedule

// #region plane-change
console.log('\n=== Example 2: Plane Change at GEO ===\n');

// A launch from 28.5 deg inclination also needs a plane change to reach an
// equatorial GEO. Plane changes are cheapest where velocity is lowest, so
// perform it at GEO with the apogee circularization burn.
const deltaInclination = (28.5 * DEG2RAD) as Radians;
const planeChangeDeltaV = PlaneChangeBurn.computeDeltaV(leoToGeo.vFinal, deltaInclination);

console.log(`Inclination change: ${(deltaInclination / DEG2RAD).toFixed(1)} deg`);
console.log(`Velocity at GEO: ${leoToGeo.vFinal.toFixed(3)} km/s`);
console.log(`Plane change delta-V (separate burn): ${planeChangeDeltaV.toFixed(3)} km/s`);
console.log(`Hohmann + separate plane change: ${(leoToGeo.deltaV + planeChangeDeltaV).toFixed(3)} km/s`);
// #endregion plane-change

// #region leo-to-molniya
console.log('\n=== Example 3: Raising Apogee from LEO to Molniya Altitude ===\n');

const molniyaOrbit = new ClassicalElements({
  epoch,
  semimajorAxis: 26554 as Kilometers,
  eccentricity: 0.74,
  inclination: (63.4 * DEG2RAD) as Radians,
  rightAscension: 0 as Radians,
  argPerigee: (270 * DEG2RAD) as Radians,
  trueAnomaly: 0 as Radians,
});

const molniyaApogeeRadius = molniyaOrbit.semimajorAxis * (1 + molniyaOrbit.eccentricity);

console.log('Target Orbit (Molniya):');
console.log(`  Semi-major axis: ${molniyaOrbit.semimajorAxis.toFixed(2)} km`);
console.log(`  Eccentricity: ${molniyaOrbit.eccentricity.toFixed(4)}`);
console.log(`  Apogee altitude: ${(molniyaApogeeRadius - earthRadius).toFixed(2)} km`);
console.log(`  Perigee altitude: ${(molniyaOrbit.semimajorAxis * (1 - molniyaOrbit.eccentricity) - earthRadius).toFixed(2)} km`);
console.log(`  Period: ${molniyaOrbit.period.toFixed(2)} minutes`);

// Size a Hohmann-style transfer ellipse from LEO up to the Molniya apogee
// radius. A real Molniya insertion would not circularize at apogee, so only
// the first burn and transfer time apply directly.
const leoToMolniyaApogee = TwoBurnOrbitTransfer.hohmannTransfer(leoOrbit.semimajorAxis, molniyaApogeeRadius);

console.log('\nTransfer Ellipse (LEO to Molniya apogee radius):');
console.log(`  First burn (perigee): ${leoToMolniyaApogee.vTransA.toFixed(3)} km/s`);
console.log(`  Circularization at apogee (if desired): ${leoToMolniyaApogee.vTransB.toFixed(3)} km/s`);
console.log(`  Transfer time: ${(leoToMolniyaApogee.tTrans / 60).toFixed(2)} minutes`);
// #endregion leo-to-molniya

// #region transfer-comparison
console.log('\n=== Example 4: Comparison of Common Transfers ===\n');

const transferCases = [
  { name: 'LEO to GEO', rInit: 6778, rFinal: 42164 },
  { name: 'LEO to MEO (GPS)', rInit: 6778, rFinal: 26560 },
  { name: 'LEO to ISS-like', rInit: 6678, rFinal: 6778 },
];

for (const transferCase of transferCases) {
  const transfer = TwoBurnOrbitTransfer.hohmannTransfer(transferCase.rInit, transferCase.rFinal);

  console.log(`${transferCase.name}:`);
  console.log(`  First burn: ${(transfer.vTransA * 1000).toFixed(1)} m/s`);
  console.log(`  Second burn: ${(transfer.vTransB * 1000).toFixed(1)} m/s`);
  console.log(`  Total delta-V: ${transfer.deltaV.toFixed(3)} km/s`);
  console.log(`  Transfer time: ${(transfer.tTrans / 60).toFixed(2)} minutes`);
  console.log('');
}
// #endregion transfer-comparison
