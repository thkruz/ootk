/* eslint-disable no-console */
/**
 * Example demonstrating different observation formats.
 *
 * This example shows:
 * - Right Ascension and Declination (RADEC) observations
 * - Converting between observation formats
 * - Topocentric vs Geocentric observations
 * - Recovering inertial positions from observations
 */

// #region imports
import {
  Degrees,
  EpochUTC,
  Kilometers,
  RadecGeocentric,
  RadecTopocentric,
  Radians,
  Satellite,
  GroundStation,
  TleLine1,
  TleLine2,
} from 'ootk';
// #endregion imports

// #region setup
// Create the observer (a ground station) and the target satellite.
const observatory = new GroundStation({
  lat: 34.5 as Degrees, // Example: Southern California
  lon: -117.9 as Degrees,
  alt: 1.2 as Kilometers,
  name: 'Example Observatory',
});

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
// #endregion setup

// #region topocentric-radec
console.log('=== Example 1: Topocentric RADEC Observations ===\n');

// Topocentric observations need the observer's inertial state (the "site").
// GroundObject.toJ2000() produces the site vector for a given time.
const satState = satellite.toJ2000(observationTime);
const siteState = observatory.toJ2000(observationTime);

const topoRadec = RadecTopocentric.fromStateVector(satState, siteState);

console.log('Topocentric Observation (from ground station):');
console.log(`  Right Ascension: ${topoRadec.rightAscension.toFixed(6)} rad`);
console.log(`                   ${(topoRadec.rightAscension * (180 / Math.PI)).toFixed(4)}°`);
console.log(`                   ${raToHMS(topoRadec.rightAscension)}`);

console.log(`  Declination:     ${topoRadec.declination.toFixed(6)} rad`);
console.log(`                   ${(topoRadec.declination * (180 / Math.PI)).toFixed(4)}°`);
console.log(`                   ${decToDMS(topoRadec.declination)}`);

console.log(`  Range:           ${topoRadec.range?.toFixed(2)} km`);
// #endregion topocentric-radec

// #region geocentric-radec
console.log('\n=== Example 2: Geocentric RADEC Observations ===\n');

// Geocentric observations are referenced to Earth's center, so no site is needed.
const geoRadec = RadecGeocentric.fromStateVector(satState);

console.log('Geocentric Observation (from Earth center):');
console.log(`  Right Ascension: ${geoRadec.rightAscension.toFixed(6)} rad`);
console.log(`                   ${(geoRadec.rightAscension * (180 / Math.PI)).toFixed(4)}°`);
console.log(`                   ${raToHMS(geoRadec.rightAscension)}`);

console.log(`  Declination:     ${geoRadec.declination.toFixed(6)} rad`);
console.log(`                   ${(geoRadec.declination * (180 / Math.PI)).toFixed(4)}°`);
console.log(`                   ${decToDMS(geoRadec.declination)}`);

console.log(`  Range:           ${geoRadec.range?.toFixed(2)} km`);
// #endregion geocentric-radec

// #region compare-formats
console.log('\n=== Example 3: Comparing Observation Formats ===\n');

// Get RAE (Range, Azimuth, Elevation) for comparison
const rae = observatory.rae(satellite, observationTime);

console.log('Same satellite observed in different coordinate systems:\n');

if (rae) {
  console.log('RAE (Range-Azimuth-Elevation):');
  console.log(`  Azimuth:   ${rae.az.toFixed(4)}°`);
  console.log(`  Elevation: ${rae.el.toFixed(4)}°`);
  console.log(`  Range:     ${rae.rng.toFixed(2)} km`);
}

console.log('\nTopocentric RADEC:');
console.log(`  RA:  ${raToHMS(topoRadec.rightAscension)}`);
console.log(`  Dec: ${decToDMS(topoRadec.declination)}`);
console.log(`  Range: ${topoRadec.range?.toFixed(2)} km`);

console.log('\nGeocentric RADEC:');
console.log(`  RA:  ${raToHMS(geoRadec.rightAscension)}`);
console.log(`  Dec: ${decToDMS(geoRadec.declination)}`);
console.log(`  Range: ${geoRadec.range?.toFixed(2)} km`);
// #endregion compare-formats

// #region manual-radec
console.log('\n=== Example 4: Creating RADEC from Angles ===\n');

// Create a topocentric observation manually from raw angles.
const manualTopoRadec = new RadecTopocentric(
  epoch,
  1.5 as Radians, // Right ascension
  0.5 as Radians, // Declination
  1200 as Kilometers, // Range
);

console.log('Manually created topocentric observation:');
console.log(`  RA:    ${raToHMS(manualTopoRadec.rightAscension)}`);
console.log(`  Dec:   ${decToDMS(manualTopoRadec.declination)}`);
console.log(`  Range: ${manualTopoRadec.range?.toFixed(2)} km`);

// Recover the inertial position by combining the observation with the site.
const positionFromRadec = manualTopoRadec.position(siteState);

console.log('\nRecovered J2000 Position (site + line of sight * range):');
console.log(`  Position: [${positionFromRadec.x.toFixed(2)}, ${positionFromRadec.y.toFixed(2)}, ${positionFromRadec.z.toFixed(2)}] km`);
// #endregion manual-radec

// #region radec-tracking
console.log('\n=== Example 5: Tracking Satellite Motion in RADEC ===\n');

console.log('Time      Right Ascension    Declination    Range');
console.log('────────  ─────────────────  ─────────────  ─────────');

for (let i = 0; i < 6; i++) {
  const trackTime = new Date(observationTime.getTime() + i * 5 * 60 * 1000);
  const trackState = satellite.toJ2000(trackTime);
  const trackSite = observatory.toJ2000(trackTime);
  const trackRadec = RadecTopocentric.fromStateVector(trackState, trackSite);

  const timeStr = trackTime.toISOString().substring(11, 19);
  const raStr = raToHMS(trackRadec.rightAscension);
  const decStr = decToDMS(trackRadec.declination);
  const rngStr = (trackRadec.range ?? 0).toFixed(1).padStart(9);

  console.log(`${timeStr}  ${raStr}  ${decStr}  ${rngStr} km`);
}
// #endregion radec-tracking

// #region angular-separation
console.log('\n=== Example 6: Angular Separation Between Objects ===\n');

const satellites = [
  {
    name: 'ISS',
    sat: satellite,
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

const radecs = satellites.map((satInfo) => {
  const satJ2000 = satInfo.sat.toJ2000(observationTime);
  const satGeoRadec = RadecGeocentric.fromStateVector(satJ2000);

  const nameStr = satInfo.name.padEnd(9);
  const raStr = raToHMS(satGeoRadec.rightAscension);
  const decStr = decToDMS(satGeoRadec.declination);
  const rngStr = (satGeoRadec.range ?? 0).toFixed(1).padStart(9);

  console.log(`${nameStr}  ${raStr}  ${decStr}  ${rngStr} km`);

  return satGeoRadec;
});

// Calculate angular separation using spherical trigonometry
const [sat1Radec, sat2Radec] = radecs;
const ra1 = sat1Radec.rightAscension;
const dec1 = sat1Radec.declination;
const ra2 = sat2Radec.rightAscension;
const dec2 = sat2Radec.declination;

const angularSep = Math.acos(
  Math.sin(dec1) * Math.sin(dec2) +
  Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2),
);

console.log('\nAngular Separation:');
console.log(`  ${(angularSep * (180 / Math.PI)).toFixed(4)}°`);
console.log(`  ${(angularSep * (180 / Math.PI) * 60).toFixed(2)} arcminutes`);
// #endregion angular-separation

// #region helpers
// Helper function: Convert radians to Hours:Minutes:Seconds
function raToHMS(radians: number): string {
  const hours = ((radians * (12 / Math.PI)) % 24 + 24) % 24;
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
// #endregion helpers
