/* eslint-disable no-console */
/**
 * Example demonstrating different observation formats.
 *
 * This example shows:
 * - Right Ascension and Declination (RADEC) observations
 * - Converting between observation formats
 * - Topocentric vs Geocentric observations
 * - Creating state vectors from observations
 */

import {
  Degrees,
  EpochUTC,
  Kilometers,
  RadecGeocentric,
  RadecTopocentric,
  Radians,
  Satellite,
  Sensor,
  TleLine1,
  TleLine2,
} from '../dist/main.js';

// Example 1: Topocentric RADEC observation
console.log('=== Example 1: Topocentric RADEC Observations ===\n');

// Create ground station
const observatory = new Sensor({
  lat: 34.5 as Degrees, // Example: Southern California
  lon: -117.9 as Degrees,
  alt: 1.2 as Kilometers,
  name: 'Example Observatory',
});

// Create satellite
const satellite = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const observationTime = new Date('2024-01-28T12:00:00.000Z');
const epoch = EpochUTC.fromDateTime(observationTime);

console.log(`Observatory: ${observatory.name}`);
console.log(`  Location: ${observatory.lat}° N, ${Math.abs(observatory.lon)}° W`);
console.log(`  Altitude: ${observatory.alt} km`);
console.log(`\nObservation Time: ${observationTime.toISOString()}\n`);

// Get satellite state
const satState = satellite.toJ2000(observationTime);

// Create topocentric observation
const topoRadec = RadecTopocentric.fromStateVector(satState, observatory);

console.log('Topocentric Observation (from ground station):');
console.log(`  Right Ascension: ${topoRadec.rightAscension.toFixed(6)} rad`);
console.log(`                   ${(topoRadec.rightAscension * (180 / Math.PI)).toFixed(4)}°`);
console.log(`                   ${raToHMS(topoRadec.rightAscension)}`);

console.log(`  Declination:     ${topoRadec.declination.toFixed(6)} rad`);
console.log(`                   ${(topoRadec.declination * (180 / Math.PI)).toFixed(4)}°`);
console.log(`                   ${decToDMS(topoRadec.declination)}`);

console.log(`  Range:           ${topoRadec.range.toFixed(2)} km`);

// Example 2: Geocentric RADEC observation
console.log('\n=== Example 2: Geocentric RADEC Observations ===\n');

// Create geocentric observation (from Earth's center)
const geoRadec = RadecGeocentric.fromStateVector(satState);

console.log('Geocentric Observation (from Earth center):');
console.log(`  Right Ascension: ${geoRadec.rightAscension.toFixed(6)} rad`);
console.log(`                   ${(geoRadec.rightAscension * (180 / Math.PI)).toFixed(4)}°`);
console.log(`                   ${raToHMS(geoRadec.rightAscension)}`);

console.log(`  Declination:     ${geoRadec.declination.toFixed(6)} rad`);
console.log(`                   ${(geoRadec.declination * (180 / Math.PI)).toFixed(4)}°`);
console.log(`                   ${decToDMS(geoRadec.declination)}`);

console.log(`  Range:           ${geoRadec.range.toFixed(2)} km`);

// Example 3: Compare different observation formats
console.log('\n=== Example 3: Comparing Observation Formats ===\n');

// Get RAE (Range, Azimuth, Elevation) for comparison
const rae = observatory.rae(satellite, observationTime);

console.log('Same satellite observed in different coordinate systems:\n');

console.log('RAE (Range-Azimuth-Elevation):');
console.log(`  Azimuth:   ${rae.az.toFixed(4)}°`);
console.log(`  Elevation: ${rae.el.toFixed(4)}°`);
console.log(`  Range:     ${rae.rng.toFixed(2)} km`);

console.log('\nTopocentric RADEC:');
console.log(`  RA:  ${raToHMS(topoRadec.rightAscension)}`);
console.log(`  Dec: ${decToDMS(topoRadec.declination)}`);
console.log(`  Range: ${topoRadec.range.toFixed(2)} km`);

console.log('\nGeocentric RADEC:');
console.log(`  RA:  ${raToHMS(geoRadec.rightAscension)}`);
console.log(`  Dec: ${decToDMS(geoRadec.declination)}`);
console.log(`  Range: ${geoRadec.range.toFixed(2)} km`);

// Example 4: Creating observations from angles
console.log('\n=== Example 4: Creating RADEC from Angles ===\n');

// Create a topocentric observation manually
const manualTopoRadec = new RadecTopocentric(
  epoch,
  1.5 as Radians, // Right ascension
  0.5 as Radians, // Declination
  1200 as Kilometers, // Range
  observatory,
);

console.log('Manually created topocentric observation:');
console.log(`  RA:    ${raToHMS(manualTopoRadec.rightAscension)}`);
console.log(`  Dec:   ${decToDMS(manualTopoRadec.declination)}`);
console.log(`  Range: ${manualTopoRadec.range.toFixed(2)} km`);

// Convert to state vector
const stateFromRadec = manualTopoRadec.toJ2000();

console.log('\nConverted to J2000 State Vector:');
console.log(`  Position: [${stateFromRadec.position.x.toFixed(2)}, ${stateFromRadec.position.y.toFixed(2)}, ${stateFromRadec.position.z.toFixed(2)}] km`);

// Example 5: Tracking object across the sky
console.log('\n=== Example 5: Tracking Satellite Motion in RADEC ===\n');

console.log('Time      Right Ascension    Declination    Range');
console.log('────────  ─────────────────  ─────────────  ─────────');

for (let i = 0; i < 6; i++) {
  const trackTime = new Date(observationTime.getTime() + i * 5 * 60 * 1000);
  const trackState = satellite.toJ2000(trackTime);
  const trackRadec = RadecTopocentric.fromStateVector(trackState, observatory);

  const timeStr = trackTime.toISOString().substring(11, 19);
  const raStr = raToHMS(trackRadec.rightAscension);
  const decStr = decToDMS(trackRadec.declination);
  const rngStr = trackRadec.range.toFixed(1).padStart(9);

  console.log(`${timeStr}  ${raStr}  ${decStr}  ${rngStr} km`);
}

// Example 6: Geocentric observations for different satellites
console.log('\n=== Example 6: Multiple Satellites in Geocentric RADEC ===\n');

const satellites = [
  {
    name: 'ISS',
    sat: new Satellite({
      tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
      tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
    }),
  },
  {
    name: 'Hubble',
    sat: new Satellite({
      tle1: '1 20580U 90037B   24028.50123227  .00000825  00000-0  39644-4 0  9997' as TleLine1,
      tle2: '2 20580  28.4696 273.2640 0002975 297.7865 189.2151 15.09696656316758' as TleLine2,
    }),
  },
];

console.log(`Time: ${observationTime.toISOString()}\n`);
console.log('Satellite  Right Ascension    Declination    Range');
console.log('─────────  ─────────────────  ─────────────  ─────────');

satellites.forEach((satInfo) => {
  const satJ2000 = satInfo.sat.toJ2000(observationTime);
  const satGeoRadec = RadecGeocentric.fromStateVector(satJ2000);

  const nameStr = satInfo.name.padEnd(9);
  const raStr = raToHMS(satGeoRadec.rightAscension);
  const decStr = decToDMS(satGeoRadec.declination);
  const rngStr = satGeoRadec.range.toFixed(1).padStart(9);

  console.log(`${nameStr}  ${raStr}  ${decStr}  ${rngStr} km`);
});

// Example 7: Angular separation between objects
console.log('\n=== Example 7: Angular Separation Between Objects ===\n');

const sat1State = satellites[0].sat.toJ2000(observationTime);
const sat2State = satellites[1].sat.toJ2000(observationTime);

const sat1Radec = RadecGeocentric.fromStateVector(sat1State);
const sat2Radec = RadecGeocentric.fromStateVector(sat2State);

// Calculate angular separation using spherical trigonometry
const ra1 = sat1Radec.rightAscension;
const dec1 = sat1Radec.declination;
const ra2 = sat2Radec.rightAscension;
const dec2 = sat2Radec.declination;

const angularSep = Math.acos(
  Math.sin(dec1) * Math.sin(dec2) +
  Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2),
);

console.log(`${satellites[0].name}:`);
console.log(`  RA:  ${raToHMS(ra1)}`);
console.log(`  Dec: ${decToDMS(dec1)}`);

console.log(`\n${satellites[1].name}:`);
console.log(`  RA:  ${raToHMS(ra2)}`);
console.log(`  Dec: ${decToDMS(dec2)}`);

console.log(`\nAngular Separation:`);
console.log(`  ${(angularSep * (180 / Math.PI)).toFixed(4)}°`);
console.log(`  ${(angularSep * (180 / Math.PI) * 60).toFixed(2)} arcminutes`);

// Helper function: Convert radians to Hours:Minutes:Seconds
function raToHMS(radians: number): string {
  const hours = (radians * (12 / Math.PI)) % 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = ((hours - h) * 60 - m) * 60;

  return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toFixed(2).padStart(5, '0')}s`;
}

// Helper function: Convert radians to Degrees:Minutes:Seconds
function decToDMS(radians: number): string {
  const degrees = radians * (180 / Math.PI);
  const sign = degrees >= 0 ? '+' : '-';
  const absDegrees = Math.abs(degrees);
  const d = Math.floor(absDegrees);
  const m = Math.floor((absDegrees - d) * 60);
  const s = ((absDegrees - d) * 60 - m) * 60;

  return `${sign}${d.toString().padStart(2, '0')}° ${m.toString().padStart(2, '0')}' ${s.toFixed(2).padStart(5, '0')}"`;
}
