/* eslint-disable no-console */
// #region imports
import {
  Degrees,
  EpochUTC,
  GoodingIOD,
  GroundObject,
  Kilometers,
  ObservationOptical,
  RadecTopocentric,
} from 'ootk';
// #endregion imports

// #region setup-site
// Optical observations are angles-only, so the observer's inertial position
// at each epoch is required. A GroundObject provides toJ2000(date) for that.
const site = new GroundObject({
  name: 'Cape Cod Observatory',
  lat: 41.958076 as Degrees,
  lon: -70.662182 as Degrees,
  alt: 0 as Kilometers,
});
// #endregion setup-site

// #region setup-observations
/**
 * Realistic observations of a GEO satellite pass.
 * Observations span 2 hours with satellite motion reflected in RA/Dec changes.
 */
const observations = [
  {
    date: new Date(2025, 10, 22, 2, 0, 0),
    ra: 333.38 as Degrees,
    dec: -6.24 as Degrees,
  },
  {
    date: new Date(2025, 10, 22, 3, 0, 0),
    ra: 334.12 as Degrees,
    dec: -5.87 as Degrees,
  },
  {
    date: new Date(2025, 10, 22, 4, 0, 0),
    ra: 334.89 as Degrees,
    dec: -5.51 as Degrees,
  },
];

// Pair each RA/Dec observation with the site's inertial position at that epoch
const [obs1, obs2, obs3] = observations.map((o) => new ObservationOptical(
  site.toJ2000(o.date),
  RadecTopocentric.fromDegrees(EpochUTC.fromDateTime(o.date), o.ra, o.dec),
));

for (const [i, obs] of [obs1, obs2, obs3].entries()) {
  console.log(`Observation ${i + 1}: ${obs.epoch.toDateTime().toISOString()}` +
    ` RA ${obs.observation.rightAscensionDegrees.toFixed(2)} deg,` +
    ` Dec ${obs.observation.declinationDegrees.toFixed(2)} deg`);
}
// #endregion setup-observations

// #region solve-gooding
/**
 * Gooding IOD needs initial SLANT RANGE guesses from observer to satellite
 * for the first and third observations.
 * GEO altitude is ~35,786 km above Earth's surface, so for a ground observer
 * the slant range to a GEO satellite is roughly 35,800 to 40,000 km
 * depending on elevation angle.
 */
const rangeEstimate1 = 36800 as Kilometers;
const rangeEstimate3 = 36800 as Kilometers;

const iod = new GoodingIOD();
const solved = iod.solve(obs1, obs2, obs3, rangeEstimate1, rangeEstimate3);
// #endregion solve-gooding

// #region results
const sv = solved.toTEME();
const elements = solved.toClassicalElements();

console.log('\nSolved State Vector (TEME) at middle observation epoch:');
console.log(`  Epoch: ${sv.epoch.toDateTime().toISOString()}`);
console.log(`  Position: [${sv.position.x.toFixed(2)}, ${sv.position.y.toFixed(2)}, ${sv.position.z.toFixed(2)}] km`);
console.log(`  Velocity: [${sv.velocity.x.toFixed(6)}, ${sv.velocity.y.toFixed(6)}, ${sv.velocity.z.toFixed(6)}] km/s`);

console.log('\nClassical Orbital Elements:');
console.log(`  Semi-major axis: ${elements.semimajorAxis.toFixed(2)} km`);
console.log(`  Eccentricity: ${elements.eccentricity.toFixed(6)}`);
console.log(`  Inclination: ${(elements.inclination * (180 / Math.PI)).toFixed(4)} deg`);
console.log(`  Right Ascension: ${(elements.rightAscension * (180 / Math.PI)).toFixed(4)} deg`);
console.log(`  Arg of Perigee: ${(elements.argPerigee * (180 / Math.PI)).toFixed(4)} deg`);
console.log(`  True Anomaly: ${(elements.trueAnomaly * (180 / Math.PI)).toFixed(4)} deg`);
console.log(`  Period: ${elements.period.toFixed(2)} minutes`);
// #endregion results
