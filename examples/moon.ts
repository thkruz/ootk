/* eslint-disable no-console */
/**
 * Example demonstrating lunar position calculations.
 *
 * This example shows:
 * - Getting Moon position in different coordinate frames
 * - Calculating Moon rise/set times
 * - Computing lunar distance and angular diameter
 * - Finding Moon phase and illumination
 */

import {
  Degrees,
  eci2lla,
  Kilometers,
  Meters,
  Moon,
  calcGmst,
} from '../dist/main.js';

// Example 1: Get Moon position at a specific time
console.log('=== Example 1: Moon Position ===\n');

const date = new Date('2024-01-28T12:00:00.000Z');

// Get Moon position in ECI coordinates
const moonEci = Moon.eci(date);

console.log('Moon Position (ECI):');
console.log(`  X: ${moonEci.position.x.toFixed(2)} km`);
console.log(`  Y: ${moonEci.position.y.toFixed(2)} km`);
console.log(`  Z: ${moonEci.position.z.toFixed(2)} km`);

// Calculate distance from Earth
const distance = Math.sqrt(
  moonEci.position.x * moonEci.position.x +
  moonEci.position.y * moonEci.position.y +
  moonEci.position.z * moonEci.position.z,
);

console.log(`\nDistance from Earth: ${distance.toFixed(2)} km`);
console.log(`                     ${(distance / 384400).toFixed(4)} × mean lunar distance`);

// Convert to latitude/longitude (sub-lunar point)
const gmst = calcGmst(date);
const moonLla = eci2lla(moonEci.position, gmst.gmst);

console.log('\nSub-Lunar Point:');
console.log(`  Latitude: ${moonLla.lat.toFixed(4)}°`);
console.log(`  Longitude: ${moonLla.lon.toFixed(4)}°`);

// Example 2: Moon rise and set times
console.log('\n=== Example 2: Moon Rise/Set Times ===\n');

const observerLat = 41 as Degrees;
const observerLon = -71 as Degrees;
const observerAlt = 0 as Meters;

const moonTimes = Moon.getTimes(date, observerLat, observerLon, observerAlt);

console.log(`Observer Location: ${observerLat}° N, ${Math.abs(observerLon)}° W`);
console.log(`\nMoon Times for ${date.toDateString()}:`);

if (moonTimes.rise) {
  console.log(`  Moonrise: ${moonTimes.rise.toLocaleTimeString()}`);
} else {
  console.log('  Moonrise: No moonrise today');
}

if (moonTimes.set) {
  console.log(`  Moonset:  ${moonTimes.set.toLocaleTimeString()}`);
} else {
  console.log('  Moonset:  No moonset today');
}

// Example 3: Moon phase and illumination
console.log('\n=== Example 3: Moon Phase and Illumination ===\n');

const illumination = Moon.getIllumination(date);

console.log(`Phase: ${(illumination.phase * 100).toFixed(2)}%`);
console.log(`  0% = New Moon`);
console.log(`  25% = First Quarter`);
console.log(`  50% = Full Moon`);
console.log(`  75% = Last Quarter`);

console.log(`\nIllumination: ${(illumination.fraction * 100).toFixed(2)}%`);
console.log(`Phase Angle: ${(illumination.phaseAngle * (180 / Math.PI)).toFixed(2)}°`);

// Determine moon phase name
let phaseName = '';

if (illumination.phase < 0.03 || illumination.phase > 0.97) {
  phaseName = 'New Moon';
} else if (illumination.phase < 0.22) {
  phaseName = 'Waxing Crescent';
} else if (illumination.phase < 0.28) {
  phaseName = 'First Quarter';
} else if (illumination.phase < 0.47) {
  phaseName = 'Waxing Gibbous';
} else if (illumination.phase < 0.53) {
  phaseName = 'Full Moon';
} else if (illumination.phase < 0.72) {
  phaseName = 'Waning Gibbous';
} else if (illumination.phase < 0.78) {
  phaseName = 'Last Quarter';
} else {
  phaseName = 'Waning Crescent';
}

console.log(`Moon Phase: ${phaseName}`);

// Example 4: Angular diameter
console.log('\n=== Example 4: Moon Angular Size ===\n');

// Mean lunar radius is 1737.4 km
const lunarRadius = 1737.4 as Kilometers;

// Calculate angular diameter in radians
const angularDiameterRad = 2 * Math.atan(lunarRadius / distance);

// Convert to degrees and arcminutes
const angularDiameterDeg = angularDiameterRad * (180 / Math.PI);
const angularDiameterArcmin = angularDiameterDeg * 60;

console.log(`Angular Diameter: ${angularDiameterArcmin.toFixed(2)} arcminutes`);
console.log(`                  ${angularDiameterDeg.toFixed(4)}°`);
console.log(`\nMean angular diameter: ~31 arcminutes`);

// Example 5: Moon position over a day
console.log('\n=== Example 5: Moon Position Every 6 Hours ===\n');

for (let hour = 0; hour < 24; hour += 6) {
  const timePoint = new Date(date.getTime());

  timePoint.setUTCHours(hour, 0, 0, 0);

  const moonPos = Moon.eci(timePoint);
  const dist = Math.sqrt(
    moonPos.position.x * moonPos.position.x +
    moonPos.position.y * moonPos.position.y +
    moonPos.position.z * moonPos.position.z,
  );

  const gmstTime = calcGmst(timePoint);
  const lla = eci2lla(moonPos.position, gmstTime.gmst);

  console.log(`${timePoint.toUTCString()}:`);
  console.log(`  Distance: ${dist.toFixed(2)} km`);
  console.log(`  Sub-lunar point: ${lla.lat.toFixed(2)}° N, ${lla.lon.toFixed(2)}° E`);
  console.log('');
}

// Example 6: Find next full moon (approximate)
console.log('=== Example 6: Finding Next Full Moon (Approximate) ===\n');

const startDate = new Date('2024-01-01T00:00:00.000Z');
let fullMoonDate: Date | null = null;

// Check every day for a month
for (let day = 0; day < 60; day++) {
  const checkDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
  const illum = Moon.getIllumination(checkDate);

  // Full moon is when phase is closest to 0.5
  if (Math.abs(illum.phase - 0.5) < 0.02) {
    fullMoonDate = checkDate;
    console.log(`Approximate Full Moon: ${fullMoonDate.toDateString()}`);
    console.log(`  Phase: ${(illum.phase * 100).toFixed(2)}%`);
    console.log(`  Illumination: ${(illum.fraction * 100).toFixed(2)}%`);

    break;
  }
}

if (!fullMoonDate) {
  console.log('No full moon found in search period');
}
