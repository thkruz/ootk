/* eslint-disable no-console */
/**
 * Example demonstrating lunar position calculations.
 *
 * This example shows:
 * - Getting Moon position in ECI coordinates
 * - Calculating Moon rise/set times
 * - Computing lunar distance and angular diameter
 * - Finding Moon phase and illumination
 */

// #region imports
import {
  calcGmst,
  Degrees,
  eci2lla,
  GroundStation,
  Kilometers,
  Moon,
} from 'ootk';
// #endregion imports

// #region moon-position
console.log('=== Example 1: Moon Position ===\n');

const date = new Date('2024-01-28T12:00:00.000Z');

// Moon.eci returns the Moon's position as a Vector3D in Earth-centered
// inertial coordinates
const moonEci = Moon.eci(date);

console.log('Moon Position (ECI):');
console.log(`  X: ${moonEci.x.toFixed(2)} km`);
console.log(`  Y: ${moonEci.y.toFixed(2)} km`);
console.log(`  Z: ${moonEci.z.toFixed(2)} km`);

// Distance from Earth center
const distance = Moon.getDistanceFromEarth(date);

console.log(`\nDistance from Earth: ${distance.toFixed(2)} km`);
console.log(`                     ${(distance / 384400).toFixed(4)} x mean lunar distance`);

// Convert to latitude/longitude (sub-lunar point)
const gmst = calcGmst(date);
const moonLla = eci2lla(moonEci, gmst.gmst);

console.log('\nSub-Lunar Point:');
console.log(`  Latitude: ${moonLla.lat.toFixed(4)} deg`);
console.log(`  Longitude: ${moonLla.lon.toFixed(4)} deg`);
// #endregion moon-position

// #region moon-rise-set
console.log('\n=== Example 2: Moon Rise/Set Times ===\n');

const observer = new GroundStation({
  name: 'Cape Cod',
  lat: 41 as Degrees,
  lon: -71 as Degrees,
  alt: 0 as Kilometers,
});

const moonTimes = Moon.getMoonTimes(date, observer, true);

console.log(`Observer Location: ${observer.lat} deg N, ${Math.abs(observer.lon)} deg W`);
console.log(`\nMoon Times for ${date.toDateString()}:`);

if (moonTimes.rise) {
  console.log(`  Moonrise: ${moonTimes.rise.toISOString()}`);
} else {
  console.log('  Moonrise: No moonrise today');
}

if (moonTimes.set) {
  console.log(`  Moonset:  ${moonTimes.set.toISOString()}`);
} else {
  console.log('  Moonset:  No moonset today');
}
// #endregion moon-rise-set

// #region moon-phase-illumination
console.log('\n=== Example 3: Moon Phase and Illumination ===\n');

// getPhase returns the illuminated fraction, the phase value (0 = new,
// 0.5 = full), a named phase bucket, and the times of the next phase events
const phaseInfo = Moon.getPhase(date);

console.log(`Phase: ${(phaseInfo.phaseValue * 100).toFixed(2)}%`);
console.log('  0% = New Moon');
console.log('  25% = First Quarter');
console.log('  50% = Full Moon');
console.log('  75% = Last Quarter');

console.log(`\nIllumination: ${(phaseInfo.fraction * 100).toFixed(2)}%`);
console.log(`Phase Angle: ${Moon.getPhaseAngle(date).toFixed(2)} deg`);
console.log(`Moon Phase: ${phaseInfo.phase.name} ${phaseInfo.phase.emoji}`);
// #endregion moon-phase-illumination

// #region moon-angular-size
console.log('\n=== Example 4: Moon Angular Size ===\n');

// getAngularDiameterDeg accounts for the actual Earth-Moon distance at the
// given time
const angularDiameterDeg = Moon.getAngularDiameterDeg(date);
const angularDiameterArcmin = angularDiameterDeg * 60;

console.log(`Angular Diameter: ${angularDiameterArcmin.toFixed(2)} arcminutes`);
console.log(`                  ${angularDiameterDeg.toFixed(4)} deg`);
console.log('\nMean angular diameter: ~31 arcminutes');
// #endregion moon-angular-size

// #region moon-over-a-day
console.log('\n=== Example 5: Moon Position Every 6 Hours ===\n');

for (let hour = 0; hour < 24; hour += 6) {
  const timePoint = new Date(date);

  timePoint.setUTCHours(hour, 0, 0, 0);

  const moonPos = Moon.eci(timePoint);
  const dist = moonPos.magnitude();

  const gmstTime = calcGmst(timePoint);
  const lla = eci2lla(moonPos, gmstTime.gmst);

  console.log(`${timePoint.toUTCString()}:`);
  console.log(`  Distance: ${dist.toFixed(2)} km`);
  console.log(`  Sub-lunar point: ${lla.lat.toFixed(2)} deg N, ${lla.lon.toFixed(2)} deg E`);
  console.log('');
}
// #endregion moon-over-a-day

// #region next-phase-events
console.log('=== Example 6: Next Phase Events ===\n');

// getPhase precomputes the next occurrence of each principal phase
const next = phaseInfo.next;

console.log(`From ${date.toISOString()}:`);
console.log(`  Next New Moon:      ${next.newMoon.date}`);
console.log(`  Next First Quarter: ${next.firstQuarter.date}`);
console.log(`  Next Full Moon:     ${next.fullMoon.date}`);
console.log(`  Next Third Quarter: ${next.thirdQuarter.date}`);
console.log(`\nNearest upcoming event: ${next.type} at ${next.date}`);
// #endregion next-phase-events
