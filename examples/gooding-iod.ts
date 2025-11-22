/* eslint-disable no-console */
import { Degrees, Kilometers, Seconds } from '@src/main';
import { Sensor } from '@src/objects';
import { RadecTopocentric } from '@src/observation';
import { ObservationOptical } from '@src/observation/ObservationOptical';
import { GoodingIOD } from '@src/orbit_determination';
import { EpochUTC } from '@src/time';

const sensorLocation = {
  latitude: 41.958076,
  longitude: -70.662182,
  altitude: 0, // meters
};

/**
 * Realistic observations of a GEO satellite pass
 * Observations span 2 hours with satellite motion reflected in RA/Dec changes
 */
const observations = [
  {
    timestamp: new Date(2025, 10, 22, 2, 0, 0).getTime(),
    ra: 333.38 as Degrees,
    dec: -6.24 as Degrees,
  },
  {
    timestamp: new Date(2025, 10, 22, 3, 0, 0).getTime(),
    ra: 334.12 as Degrees,
    dec: -5.87 as Degrees,
  },
  {
    timestamp: new Date(2025, 10, 22, 4, 0, 0).getTime(),
    ra: 334.89 as Degrees,
    dec: -5.51 as Degrees,
  },
];

const sensor = new Sensor(
  {
    lat: sensorLocation.latitude as Degrees,
    lon: sensorLocation.longitude as Degrees,
    alt: sensorLocation.altitude as Kilometers,
    minEl: 0 as Degrees,
    maxEl: 90 as Degrees,
    minAz: 0 as Degrees,
    maxAz: 360 as Degrees,
    minRng: 0 as Kilometers,
    maxRng: 60_000 as Kilometers,
  },
);

// Get three observations
const obs1 = new ObservationOptical(sensor.toJ2000(new Date(observations[0].timestamp)), RadecTopocentric.fromDegrees(
  new EpochUTC((new Date(observations[0].timestamp).getTime() / 1000) as Seconds),
  observations[0].ra,
  observations[0].dec,
));

console.log('Obs1:', JSON.stringify(obs1, null, 2));

const obs2 = new ObservationOptical(sensor.toJ2000(new Date(observations[1].timestamp)), RadecTopocentric.fromDegrees(
  new EpochUTC((new Date(observations[1].timestamp).getTime() / 1000) as Seconds),
  observations[1].ra,
  observations[1].dec,
));

console.log('Obs2:', JSON.stringify(obs2, null, 2));

const obs3 = new ObservationOptical(sensor.toJ2000(new Date(observations[2].timestamp)), RadecTopocentric.fromDegrees(
  new EpochUTC((new Date(observations[2].timestamp).getTime() / 1000) as Seconds),
  observations[2].ra,
  observations[2].dec,
));

console.log('Obs3:', JSON.stringify(obs3, null, 2));

// Run IOD
const iod = new GoodingIOD(obs1, obs2, obs3);

/**
 * Use SLANT RANGE from observer to satellite for initial estimates
 * GEO altitude is ~35,786 km above Earth surface
 * For a ground observer, slant range to GEO satellite ≈ 35,800 - 40,000 km
 * depending on elevation angle
 */
const rangeEstimate1 = 36800 as Kilometers;
const rangeEstimate3 = 36800 as Kilometers;

const solved = iod.solve(rangeEstimate1, rangeEstimate3);
const classicalElements = solved.toClassicalElements();
const sv = solved.toTEME();

console.log('Solved State Vector (TEME):', JSON.stringify(sv, null, 2));
console.log('Classical Orbital Elements:', JSON.stringify(classicalElements, null, 2));
