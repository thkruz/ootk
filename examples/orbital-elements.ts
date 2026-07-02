/* eslint-disable no-console */
/**
 * Example demonstrating orbital elements and conversions.
 *
 * This example shows:
 * - Creating satellites from TLEs
 * - Extracting classical orbital elements
 * - Converting between state vectors and classical elements
 * - Creating TLEs from classical elements
 */

// #region imports
import {
  ClassicalElements,
  Degrees,
  EpochUTC,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Satellite,
  Tle,
  TleLine1,
  TleLine2,
  Vector3D,
} from 'ootk';
// #endregion imports

// #region tle-to-elements
// Example 1: Extract orbital elements from a TLE
console.log('=== Example 1: Extract Orbital Elements from TLE ===\n');

const issTle = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const date = new Date('2024-01-28T13:05:27.451Z');
const j2000State = issTle.toJ2000(date);
const elements = j2000State.toClassicalElements();

console.log('ISS Orbital Elements:');
console.log(`  Semi-major axis: ${elements.semimajorAxis.toFixed(2)} km`);
console.log(`  Eccentricity: ${elements.eccentricity.toFixed(6)}`);
console.log(`  Inclination: ${(elements.inclination * (180 / Math.PI)).toFixed(4)}°`);
console.log(`  Right Ascension: ${(elements.rightAscension * (180 / Math.PI)).toFixed(4)}°`);
console.log(`  Arg of Perigee: ${(elements.argPerigee * (180 / Math.PI)).toFixed(4)}°`);
console.log(`  True Anomaly: ${(elements.trueAnomaly * (180 / Math.PI)).toFixed(4)}°`);

// Calculate derived parameters
console.log(`\nDerived Parameters:`);
console.log(`  Period: ${elements.period.toFixed(2)} minutes`);
console.log(`  Apogee altitude: ${((elements.semimajorAxis * (1 + elements.eccentricity)) - 6378.137).toFixed(2)} km`);
console.log(`  Perigee altitude: ${((elements.semimajorAxis * (1 - elements.eccentricity)) - 6378.137).toFixed(2)} km`);
// #endregion tle-to-elements

// #region elements-to-state-vector
// Example 2: Create classical elements and convert to state vector
console.log('\n=== Example 2: Create Orbital Elements and Convert to State Vector ===\n');

const customElements = new ClassicalElements({
  epoch: EpochUTC.fromDateTime(date),
  semimajorAxis: 8000 as Kilometers,
  eccentricity: 0.1,
  inclination: 45 as Degrees,
  rightAscension: 90 as Degrees,
  argPerigee: 30 as Degrees,
  trueAnomaly: 0 as Degrees,
});

console.log('Custom Orbit:');
console.log(`  Semi-major axis: ${customElements.semimajorAxis.toFixed(2)} km`);
console.log(`  Eccentricity: ${customElements.eccentricity.toFixed(6)}`);
console.log(`  Inclination: ${customElements.inclination.toFixed(4)}°`);
console.log(`  Period: ${customElements.period.toFixed(2)} minutes`);

const stateVector = customElements.toJ2000();

console.log(`\nState Vector:`);
console.log(`  Position: [${stateVector.position.x.toFixed(2)}, ${stateVector.position.y.toFixed(2)}, ${stateVector.position.z.toFixed(2)}] km`);
console.log(`  Velocity: [${stateVector.velocity.x.toFixed(6)}, ${stateVector.velocity.y.toFixed(6)}, ${stateVector.velocity.z.toFixed(6)}] km/s`);
// #endregion elements-to-state-vector

// #region state-vector-to-elements
// Example 3: Convert state vector to classical elements
console.log('\n=== Example 3: Create State Vector and Convert to Classical Elements ===\n');

const customState = new J2000(
  EpochUTC.fromDateTime(date),
  new Vector3D(
    -4040.9257 as Kilometers,
    -4884.0906 as Kilometers,
    3522.9643 as Kilometers,
  ),
  new Vector3D(
    5.4662 as KilometersPerSecond,
    -3.4425 as KilometersPerSecond,
    -2.4854 as KilometersPerSecond,
  ),
);

const derivedElements = customState.toClassicalElements();

console.log('Derived Orbital Elements:');
console.log(`  Semi-major axis: ${derivedElements.semimajorAxis.toFixed(2)} km`);
console.log(`  Eccentricity: ${derivedElements.eccentricity.toFixed(6)}`);
console.log(`  Inclination: ${(derivedElements.inclination * (180 / Math.PI)).toFixed(4)}°`);
console.log(`  Right Ascension: ${(derivedElements.rightAscension * (180 / Math.PI)).toFixed(4)}°`);
console.log(`  Arg of Perigee: ${(derivedElements.argPerigee * (180 / Math.PI)).toFixed(4)}°`);
console.log(`  True Anomaly: ${(derivedElements.trueAnomaly * (180 / Math.PI)).toFixed(4)}°`);
// #endregion state-vector-to-elements

// #region elements-to-tle
// Example 4: Create TLE from classical elements
console.log('\n=== Example 4: Create TLE from Classical Elements ===\n');

const geoElements = new ClassicalElements({
  epoch: EpochUTC.fromDateTime(date),
  semimajorAxis: 42164 as Kilometers, // GEO altitude
  eccentricity: 0.0001,
  inclination: 0.1 as Degrees,
  rightAscension: 0 as Degrees,
  argPerigee: 0 as Degrees,
  trueAnomaly: 0 as Degrees,
});

const geoTle = Tle.fromClassicalElements(geoElements);

console.log('Generated TLE for GEO satellite:');
console.log(geoTle.line1);
console.log(geoTle.line2);

// Verify by reading back
const verifyTle = new Satellite({
  tle1: geoTle.line1,
  tle2: geoTle.line2,
});

const verifyState = verifyTle.toJ2000(date);
const verifyElements = verifyState.toClassicalElements();

console.log(`\nVerification - Semi-major axis: ${verifyElements.semimajorAxis.toFixed(2)} km`);
console.log(`Verification - Period: ${verifyElements.period.toFixed(2)} minutes (should be ~1436 min for GEO)`);
// #endregion elements-to-tle

// #region orbit-types
// Example 5: Different orbit types
console.log('\n=== Example 5: Different Orbit Types ===\n');

const orbits = [
  {
    name: 'LEO (Circular)',
    elements: new ClassicalElements({
      epoch: EpochUTC.fromDateTime(date),
      semimajorAxis: 6778 as Kilometers,
      eccentricity: 0.001,
      inclination: 51.6 as Degrees,
      rightAscension: 0 as Degrees,
      argPerigee: 0 as Degrees,
      trueAnomaly: 0 as Degrees,
    }),
  },
  {
    name: 'MEO (GPS-like)',
    elements: new ClassicalElements({
      epoch: EpochUTC.fromDateTime(date),
      semimajorAxis: 26560 as Kilometers,
      eccentricity: 0.01,
      inclination: 55 as Degrees,
      rightAscension: 0 as Degrees,
      argPerigee: 0 as Degrees,
      trueAnomaly: 0 as Degrees,
    }),
  },
  {
    name: 'HEO (Molniya)',
    elements: new ClassicalElements({
      epoch: EpochUTC.fromDateTime(date),
      semimajorAxis: 26554 as Kilometers,
      eccentricity: 0.74,
      inclination: 63.4 as Degrees,
      rightAscension: 0 as Degrees,
      argPerigee: 270 as Degrees,
      trueAnomaly: 0 as Degrees,
    }),
  },
];

orbits.forEach((orbit) => {
  console.log(`${orbit.name}:`);
  console.log(`  Altitude at apogee: ${((orbit.elements.semimajorAxis * (1 + orbit.elements.eccentricity)) - 6378.137).toFixed(2)} km`);
  console.log(`  Altitude at perigee: ${((orbit.elements.semimajorAxis * (1 - orbit.elements.eccentricity)) - 6378.137).toFixed(2)} km`);
  console.log(`  Period: ${orbit.elements.period.toFixed(2)} minutes`);
  console.log('');
});
// #endregion orbit-types
