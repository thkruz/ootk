/* eslint-disable no-console */
/**
 * Example demonstrating coordinate transformations.
 *
 * This example shows:
 * - Converting between different coordinate frames (ECI, ECEF, LLA)
 * - Working with different state vector representations (J2000, TEME, ITRF)
 * - Relative coordinates (RIC)
 * - Creating state vectors directly
 */

// #region imports
import {
  calcGmst,
  Degrees,
  ecef2eci,
  eci2ecef,
  eci2lla,
  EpochUTC,
  J2000,
  Kilometers,
  KilometersPerSecond,
  lla2ecef,
  lla2eci,
  Radians,
  RIC,
  Satellite,
  TEME,
  TleLine1,
  TleLine2,
  Vector3D,
} from 'ootk';
// #endregion imports

// #region eci-ecef
console.log('=== Example 1: ECI <-> ECEF Transformations ===\n');

const date = new Date('2024-01-28T12:00:00.000Z');
const gmst = calcGmst(date);

// ECI position vector
const eciPos = {
  x: 6778 as Kilometers,
  y: 0 as Kilometers,
  z: 0 as Kilometers,
};

console.log('ECI Position:');
console.log(`  X: ${eciPos.x.toFixed(2)} km`);
console.log(`  Y: ${eciPos.y.toFixed(2)} km`);
console.log(`  Z: ${eciPos.z.toFixed(2)} km`);

// Convert to ECEF
const ecefPos = eci2ecef(eciPos, gmst.gmst);

console.log('\nECEF Position:');
console.log(`  X: ${ecefPos.x.toFixed(2)} km`);
console.log(`  Y: ${ecefPos.y.toFixed(2)} km`);
console.log(`  Z: ${ecefPos.z.toFixed(2)} km`);

// Convert back to ECI
const eciPos2 = ecef2eci(ecefPos, gmst.gmst);

console.log('\nConverted back to ECI:');
console.log(`  X: ${eciPos2.x.toFixed(2)} km`);
console.log(`  Y: ${eciPos2.y.toFixed(2)} km`);
console.log(`  Z: ${eciPos2.z.toFixed(2)} km`);
// #endregion eci-ecef

// #region eci-lla
console.log('\n=== Example 2: ECI <-> Geodetic (LLA) Transformations ===\n');

// Convert ECI to Geodetic (returns degrees and kilometers)
const lla = eci2lla(eciPos, gmst.gmst);

console.log('Geodetic Coordinates:');
console.log(`  Latitude:  ${lla.lat.toFixed(4)} deg`);
console.log(`  Longitude: ${lla.lon.toFixed(4)} deg`);
console.log(`  Altitude:  ${lla.alt.toFixed(2)} km`);

// lla2eci expects radians, so convert the angles first
const llaRad = {
  lat: (lla.lat * (Math.PI / 180)) as Radians,
  lon: (lla.lon * (Math.PI / 180)) as Radians,
  alt: lla.alt,
};

const eciFromLla = lla2eci(llaRad, gmst.gmst);

console.log('\nConverted back to ECI:');
console.log(`  X: ${eciFromLla.x.toFixed(2)} km`);
console.log(`  Y: ${eciFromLla.y.toFixed(2)} km`);
console.log(`  Z: ${eciFromLla.z.toFixed(2)} km`);
// #endregion eci-lla

// #region state-vector-frames
console.log('\n=== Example 3: Different State Vector Frames (J2000, TEME, ITRF) ===\n');

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Get state in J2000 frame
const j2000State = sat.toJ2000(date);

console.log('J2000 Frame (ECI):');
console.log(`  Position: [${j2000State.position.x.toFixed(2)}, ${j2000State.position.y.toFixed(2)}, ${j2000State.position.z.toFixed(2)}] km`);
console.log(`  Velocity: [${j2000State.velocity.x.toFixed(6)}, ${j2000State.velocity.y.toFixed(6)}, ${j2000State.velocity.z.toFixed(6)}] km/s`);

// Convert to TEME frame
const temeState = j2000State.toTEME();

console.log('\nTEME Frame:');
console.log(`  Position: [${temeState.position.x.toFixed(2)}, ${temeState.position.y.toFixed(2)}, ${temeState.position.z.toFixed(2)}] km`);
console.log(`  Velocity: [${temeState.velocity.x.toFixed(6)}, ${temeState.velocity.y.toFixed(6)}, ${temeState.velocity.z.toFixed(6)}] km/s`);

// Convert to ITRF frame (Earth-fixed)
const itrfState = j2000State.toITRF();

console.log('\nITRF Frame (Earth-fixed):');
console.log(`  Position: [${itrfState.position.x.toFixed(2)}, ${itrfState.position.y.toFixed(2)}, ${itrfState.position.z.toFixed(2)}] km`);
console.log(`  Velocity: [${itrfState.velocity.x.toFixed(6)}, ${itrfState.velocity.y.toFixed(6)}, ${itrfState.velocity.z.toFixed(6)}] km/s`);

// Convert ITRF to Geodetic (Geodetic stores radians; use the Deg getters)
const geodeticFromItrf = itrfState.toGeodetic();

console.log('\nGeodetic from ITRF:');
console.log(`  Latitude:  ${geodeticFromItrf.latDeg.toFixed(4)} deg`);
console.log(`  Longitude: ${geodeticFromItrf.lonDeg.toFixed(4)} deg`);
console.log(`  Altitude:  ${geodeticFromItrf.alt.toFixed(2)} km`);
// #endregion state-vector-frames

// #region ric-relative-frame
console.log('\n=== Example 4: Relative Coordinates (RIC Frame) ===\n');

// Use the ISS as the chief satellite
const chiefState = sat.toJ2000(date);

// Create a deputy slightly ahead in the same orbit by perturbing the
// true anomaly of the chief's classical elements
const deputyElements = chiefState.toClassicalElements();

deputyElements.trueAnomaly = (deputyElements.trueAnomaly + 0.1) as Radians;

const deputyState = deputyElements.toJ2000();

console.log('Satellite 1 (Chief) Position:');
console.log(`  [${chiefState.position.x.toFixed(2)}, ${chiefState.position.y.toFixed(2)}, ${chiefState.position.z.toFixed(2)}] km`);

console.log('\nSatellite 2 (Deputy) Position:');
console.log(`  [${deputyState.position.x.toFixed(2)}, ${deputyState.position.y.toFixed(2)}, ${deputyState.position.z.toFixed(2)}] km`);

// Convert to RIC coordinates (deputy state relative to chief origin)
const ricState = RIC.fromJ2000(deputyState, chiefState);

console.log('\nRelative Position in RIC Frame:');
console.log(`  Radial:      ${ricState.position.x.toFixed(4)} km`);
console.log(`  In-track:    ${ricState.position.y.toFixed(4)} km`);
console.log(`  Cross-track: ${ricState.position.z.toFixed(4)} km`);

console.log('\nRelative Velocity in RIC Frame:');
console.log(`  Radial:      ${ricState.velocity.x.toFixed(6)} km/s`);
console.log(`  In-track:    ${ricState.velocity.y.toFixed(6)} km/s`);
console.log(`  Cross-track: ${ricState.velocity.z.toFixed(6)} km/s`);
// #endregion ric-relative-frame

// #region custom-state-vectors
console.log('\n=== Example 5: Creating State Vectors Directly ===\n');

const epoch = EpochUTC.fromDateTime(date);

// Create a J2000 state vector
const customJ2000 = new J2000(
  epoch,
  new Vector3D(
    6778 as Kilometers,
    0 as Kilometers,
    0 as Kilometers,
  ),
  new Vector3D(
    0 as KilometersPerSecond,
    7.7 as KilometersPerSecond,
    0 as KilometersPerSecond,
  ),
);

console.log('Custom J2000 State:');
console.log(`  Position: [${customJ2000.position.x.toFixed(2)}, ${customJ2000.position.y.toFixed(2)}, ${customJ2000.position.z.toFixed(2)}] km`);
console.log(`  Velocity: [${customJ2000.velocity.x.toFixed(6)}, ${customJ2000.velocity.y.toFixed(6)}, ${customJ2000.velocity.z.toFixed(6)}] km/s`);

// Create a TEME state vector with the same numbers
const customTEME = new TEME(
  epoch,
  new Vector3D(
    6778 as Kilometers,
    0 as Kilometers,
    0 as Kilometers,
  ),
  new Vector3D(
    0 as KilometersPerSecond,
    7.7 as KilometersPerSecond,
    0 as KilometersPerSecond,
  ),
);

console.log('\nCustom TEME State:');
console.log(`  Position: [${customTEME.position.x.toFixed(2)}, ${customTEME.position.y.toFixed(2)}, ${customTEME.position.z.toFixed(2)}] km`);
console.log(`  Velocity: [${customTEME.velocity.x.toFixed(6)}, ${customTEME.velocity.y.toFixed(6)}, ${customTEME.velocity.z.toFixed(6)}] km/s`);

// Convert TEME to J2000
const temeToJ2000 = customTEME.toJ2000();

console.log('\nTEME converted to J2000:');
console.log(`  Position: [${temeToJ2000.position.x.toFixed(2)}, ${temeToJ2000.position.y.toFixed(2)}, ${temeToJ2000.position.z.toFixed(2)}] km`);
console.log(`  Velocity: [${temeToJ2000.velocity.x.toFixed(6)}, ${temeToJ2000.velocity.y.toFixed(6)}, ${temeToJ2000.velocity.z.toFixed(6)}] km/s`);
// #endregion custom-state-vectors

// #region lla-ecef
console.log('\n=== Example 6: Geodetic to ECEF ===\n');

const observerLla = {
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
};

console.log('Observer Location:');
console.log(`  Latitude:  ${observerLla.lat} deg`);
console.log(`  Longitude: ${observerLla.lon} deg`);
console.log(`  Altitude:  ${observerLla.alt} km`);

const observerEcef = lla2ecef(observerLla);

console.log('\nECEF Position:');
console.log(`  X: ${observerEcef.x.toFixed(4)} km`);
console.log(`  Y: ${observerEcef.y.toFixed(4)} km`);
console.log(`  Z: ${observerEcef.z.toFixed(4)} km`);

const distance = Math.hypot(observerEcef.x, observerEcef.y, observerEcef.z);

console.log(`\nDistance from Earth center: ${distance.toFixed(4)} km`);
console.log('Earth equatorial radius: 6378.137 km');
// #endregion lla-ecef
