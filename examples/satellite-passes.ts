/* eslint-disable no-console */
/**
 * Example demonstrating satellite pass prediction and visibility calculations.
 *
 * This example shows:
 * - Calculating satellite passes
 * - Finding when satellites are visible from a ground station
 * - Computing look angles (azimuth, elevation, range)
 * - Checking field of view constraints
 */

import {
  Degrees,
  DetailedSensor,
  Kilometers,
  Satellite,
  Sensor,
  SpaceObjectType,
  TleLine1,
  TleLine2,
} from '../dist/main.js';

// Example 1: Calculate passes for ISS
console.log('=== Example 1: ISS Pass Prediction ===\n');

// Create a ground station
const groundStation = new Sensor({
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
  name: 'Cape Cod',
});

// Create ISS satellite
const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

console.log(`Ground Station: ${groundStation.name}`);
console.log(`  Location: ${groundStation.lat}° N, ${Math.abs(groundStation.lon)}° W`);
console.log(`  Altitude: ${groundStation.alt} km`);

console.log('\nSatellite: ISS');
console.log(`  Inclination: ${iss.inclination}°`);
console.log(`  Period: ${iss.period} minutes`);

// Calculate passes (checking every 30 seconds for next 24 hours)
const passes = groundStation.calculatePasses(30, iss);

console.log(`\nFound ${passes.length} passes in the next 24 hours:\n`);

passes.slice(0, 5).forEach((pass, index) => {
  console.log(`Pass ${index + 1}:`);
  console.log(`  Rise Time: ${pass.start.toLocaleString()}`);
  console.log(`  Set Time:  ${pass.end.toLocaleString()}`);
  console.log(`  Duration:  ${((pass.end.getTime() - pass.start.getTime()) / 1000 / 60).toFixed(1)} minutes`);
  console.log(`  Max Elevation: ${pass.maxEl.toFixed(1)}°`);

  if (pass.maxEl > 45) {
    console.log(`  ⭐ Excellent pass!`);
  } else if (pass.maxEl > 20) {
    console.log(`  ✓ Good pass`);
  }

  console.log('');
});

// Example 2: Check visibility at a specific time
console.log('=== Example 2: Satellite Visibility Check ===\n');

const checkTime = new Date('2024-01-28T12:00:00.000Z');

// Get current look angles
const rae = groundStation.rae(iss, checkTime);

console.log(`Time: ${checkTime.toISOString()}`);
console.log(`\nLook Angles:`);
console.log(`  Azimuth:   ${rae.az.toFixed(2)}°`);
console.log(`  Elevation: ${rae.el.toFixed(2)}°`);
console.log(`  Range:     ${rae.rng.toFixed(2)} km`);

// Check if satellite is visible
const isVisible = rae.el > 0;

console.log(`\nSatellite is ${isVisible ? 'VISIBLE' : 'BELOW HORIZON'}`);

if (isVisible) {
  console.log(`\nDirection: ${getCardinalDirection(rae.az)}`);
  console.log(`Elevation: ${getElevationDescription(rae.el)}`);
}

// Example 3: Detailed sensor with field of view constraints
console.log('\n=== Example 3: Field of View Constraints ===\n');

const radar = new DetailedSensor({
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
  minAz: 0 as Degrees,
  maxAz: 360 as Degrees,
  minEl: 10 as Degrees, // Minimum elevation 10°
  maxEl: 85 as Degrees,
  minRng: 100 as Kilometers, // Minimum range 100 km
  maxRng: 5556 as Kilometers, // Maximum range 5556 km
  name: 'Cape Cod Radar',
  type: SpaceObjectType.PHASED_ARRAY_RADAR,
});

console.log(`Sensor: ${radar.name}`);
console.log(`Field of View Constraints:`);
console.log(`  Azimuth:   ${radar.minAz}° - ${radar.maxAz}°`);
console.log(`  Elevation: ${radar.minEl}° - ${radar.maxEl}°`);
console.log(`  Range:     ${radar.minRng} - ${radar.maxRng} km`);

// Check if satellite is in FOV
const inFov = radar.isSatInFov(iss, checkTime);

console.log(`\nAt ${checkTime.toISOString()}:`);
console.log(`  Satellite in FOV: ${inFov ? 'YES ✓' : 'NO ✗'}`);

if (inFov) {
  console.log(`  The satellite meets all FOV constraints`);
} else {
  const raeCheck = radar.rae(iss, checkTime);

  console.log(`  Constraints not met:`);

  if (raeCheck.el < radar.minEl) {
    console.log(`    - Elevation too low (${raeCheck.el.toFixed(1)}° < ${radar.minEl}°)`);
  }

  if (raeCheck.el > radar.maxEl) {
    console.log(`    - Elevation too high (${raeCheck.el.toFixed(1)}° > ${radar.maxEl}°)`);
  }

  if (raeCheck.rng < radar.minRng) {
    console.log(`    - Range too close (${raeCheck.rng.toFixed(0)} km < ${radar.minRng} km)`);
  }

  if (raeCheck.rng > radar.maxRng) {
    console.log(`    - Range too far (${raeCheck.rng.toFixed(0)} km > ${radar.maxRng} km)`);
  }
}

// Example 4: Track satellite across the sky
console.log('\n=== Example 4: Satellite Tracking Over Time ===\n');

const trackStart = new Date('2024-01-28T12:00:00.000Z');

console.log('ISS Position every 5 minutes:\n');
console.log('Time                      Az      El     Range   Status');
console.log('─────────────────────  ──────  ──────  ───────  ────────');

for (let i = 0; i < 12; i++) {
  const trackTime = new Date(trackStart.getTime() + i * 5 * 60 * 1000);
  const trackRae = groundStation.rae(iss, trackTime);

  const timeStr = trackTime.toISOString().substring(11, 19);
  const azStr = trackRae.az.toFixed(1).padStart(6);
  const elStr = trackRae.el.toFixed(1).padStart(6);
  const rngStr = trackRae.rng.toFixed(0).padStart(7);

  let status = 'Below horizon';

  if (trackRae.el > 0) {
    status = 'Visible';

    if (radar.isSatInFov(iss, trackTime)) {
      status = 'In FOV ✓';
    }
  }

  console.log(`${timeStr}          ${azStr}° ${elStr}° ${rngStr} km  ${status}`);
}

// Example 5: Multiple satellites
console.log('\n=== Example 5: Tracking Multiple Satellites ===\n');

const satellites = [
  {
    name: 'ISS',
    sat: new Satellite({
      tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
      tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
    }),
  },
  {
    name: 'HST (Hubble)',
    sat: new Satellite({
      tle1: '1 20580U 90037B   24028.50123227  .00000825  00000-0  39644-4 0  9997' as TleLine1,
      tle2: '2 20580  28.4696 273.2640 0002975 297.7865 189.2151 15.09696656316758' as TleLine2,
    }),
  },
];

const multiCheckTime = new Date('2024-01-28T18:00:00.000Z');

console.log(`Time: ${multiCheckTime.toISOString()}\n`);
console.log('Satellite      Az      El     Range    Visible   In FOV');
console.log('────────────  ──────  ──────  ───────  ────────  ──────');

satellites.forEach((satInfo) => {
  const satRae = groundStation.rae(satInfo.sat, multiCheckTime);
  const satVisible = satRae.el > 0;
  const satInFov = radar.isSatInFov(satInfo.sat, multiCheckTime);

  const nameStr = satInfo.name.padEnd(12);
  const azStr = satRae.az.toFixed(1).padStart(6);
  const elStr = satRae.el.toFixed(1).padStart(6);
  const rngStr = satRae.rng.toFixed(0).padStart(7);
  const visStr = (satVisible ? 'Yes' : 'No').padEnd(8);
  const fovStr = satInFov ? 'Yes ✓' : 'No';

  console.log(`${nameStr}  ${azStr}° ${elStr}° ${rngStr} km  ${visStr}  ${fovStr}`);
});

// Helper functions
function getCardinalDirection(azimuth: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(azimuth / 22.5) % 16;

  return directions[index];
}

function getElevationDescription(elevation: number): string {
  if (elevation > 80) return 'Nearly overhead';
  if (elevation > 60) return 'Very high in the sky';
  if (elevation > 45) return 'High in the sky';
  if (elevation > 30) return 'Medium elevation';
  if (elevation > 15) return 'Low in the sky';

  return 'Near the horizon';
}
