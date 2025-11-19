/* eslint-disable no-console */
/**
 * Example demonstrating orbital maneuver calculations.
 *
 * This example shows:
 * - Hohmann transfer calculations
 * - Two-burn orbit transfers
 * - Delta-V calculations
 * - Transfer orbit parameters
 */

import {
  ClassicalElements,
  Degrees,
  EpochUTC,
  Kilometers,
  TwoBurnOrbitTransfer,
} from '../dist/main.js';

console.log('=== Example 1: Hohmann Transfer from LEO to GEO ===\n');

const date = new Date('2024-01-28T00:00:00.000Z');

// Create initial LEO orbit (circular)
const leoOrbit = new ClassicalElements({
  epoch: EpochUTC.fromDateTime(date),
  semimajorAxis: 6778 as Kilometers, // ~400 km altitude
  eccentricity: 0.001, // Nearly circular
  inclination: 28.5 as Degrees,
  rightAscension: 0 as Degrees,
  argPerigee: 0 as Degrees,
  trueAnomaly: 0 as Degrees,
});

// Create target GEO orbit (circular)
const geoOrbit = new ClassicalElements({
  epoch: EpochUTC.fromDateTime(date),
  semimajorAxis: 42164 as Kilometers, // GEO altitude
  eccentricity: 0.001,
  inclination: 0 as Degrees, // Equatorial
  rightAscension: 0 as Degrees,
  argPerigee: 0 as Degrees,
  trueAnomaly: 0 as Degrees,
});

console.log('Initial Orbit (LEO):');
console.log(`  Altitude: ${(leoOrbit.semimajorAxis - 6378.137).toFixed(2)} km`);
console.log(`  Period: ${leoOrbit.period.toFixed(2)} minutes`);
console.log(`  Velocity: ${Math.sqrt(398600.4418 / leoOrbit.semimajorAxis).toFixed(3)} km/s`);

console.log('\nTarget Orbit (GEO):');
console.log(`  Altitude: ${(geoOrbit.semimajorAxis - 6378.137).toFixed(2)} km`);
console.log(`  Period: ${geoOrbit.period.toFixed(2)} minutes`);
console.log(`  Velocity: ${Math.sqrt(398600.4418 / geoOrbit.semimajorAxis).toFixed(3)} km/s`);

// Calculate Hohmann transfer
const transfer = new TwoBurnOrbitTransfer(leoOrbit, geoOrbit);
const hohmann = transfer.hohmannTransfer();

console.log('\nHohmann Transfer:');
console.log(`  Transfer semi-major axis: ${hohmann.semimajorAxis.toFixed(2)} km`);
console.log(`  Transfer eccentricity: ${hohmann.eccentricity.toFixed(6)}`);
console.log(`  Transfer period: ${hohmann.period.toFixed(2)} minutes`);
console.log(`  Transfer time: ${(hohmann.period / 2).toFixed(2)} minutes (half orbit)`);

// Calculate transfer orbit periapsis and apoapsis
const transferPeriapsis = hohmann.semimajorAxis * (1 - hohmann.eccentricity);
const transferApoapsis = hohmann.semimajorAxis * (1 + hohmann.eccentricity);

console.log(`  Periapsis altitude: ${(transferPeriapsis - 6378.137).toFixed(2)} km`);
console.log(`  Apoapsis altitude: ${(transferApoapsis - 6378.137).toFixed(2)} km`);

// Calculate delta-V requirements
const v1 = Math.sqrt(398600.4418 / leoOrbit.semimajorAxis); // LEO velocity
const vTransferPerigee = Math.sqrt(398600.4418 * (2 / leoOrbit.semimajorAxis - 1 / hohmann.semimajorAxis));
const deltaV1 = vTransferPerigee - v1;

const v2 = Math.sqrt(398600.4418 / geoOrbit.semimajorAxis); // GEO velocity
const vTransferApogee = Math.sqrt(398600.4418 * (2 / geoOrbit.semimajorAxis - 1 / hohmann.semimajorAxis));
const deltaV2 = v2 - vTransferApogee;

const totalDeltaV = deltaV1 + deltaV2;

console.log('\nDelta-V Requirements:');
console.log(`  First burn (at LEO): ${deltaV1.toFixed(3)} km/s`);
console.log(`  Second burn (at GEO): ${deltaV2.toFixed(3)} km/s`);
console.log(`  Total delta-V: ${totalDeltaV.toFixed(3)} km/s`);

// Example 2: Transfer between elliptical orbits
console.log('\n=== Example 2: Transfer from LEO to Molniya Orbit ===\n');

const molniyaOrbit = new ClassicalElements({
  epoch: EpochUTC.fromDateTime(date),
  semimajorAxis: 26554 as Kilometers,
  eccentricity: 0.74,
  inclination: 63.4 as Degrees,
  rightAscension: 0 as Degrees,
  argPerigee: 270 as Degrees,
  trueAnomaly: 0 as Degrees,
});

console.log('Target Orbit (Molniya):');
console.log(`  Semi-major axis: ${molniyaOrbit.semimajorAxis.toFixed(2)} km`);
console.log(`  Eccentricity: ${molniyaOrbit.eccentricity.toFixed(4)}`);
console.log(`  Apogee altitude: ${((molniyaOrbit.semimajorAxis * (1 + molniyaOrbit.eccentricity)) - 6378.137).toFixed(2)} km`);
console.log(`  Perigee altitude: ${((molniyaOrbit.semimajorAxis * (1 - molniyaOrbit.eccentricity)) - 6378.137).toFixed(2)} km`);
console.log(`  Period: ${molniyaOrbit.period.toFixed(2)} minutes`);

const molniyaTransfer = new TwoBurnOrbitTransfer(leoOrbit, molniyaOrbit);
const molniyaHohmann = molniyaTransfer.hohmannTransfer();

console.log('\nTransfer Orbit:');
console.log(`  Semi-major axis: ${molniyaHohmann.semimajorAxis.toFixed(2)} km`);
console.log(`  Eccentricity: ${molniyaHohmann.eccentricity.toFixed(4)}`);
console.log(`  Period: ${molniyaHohmann.period.toFixed(2)} minutes`);
console.log(`  Transfer time: ${(molniyaHohmann.period / 2).toFixed(2)} minutes`);

// Example 3: Orbit raising maneuver
console.log('\n=== Example 3: Simple Orbit Raising (LEO to MEO) ===\n');

const meoOrbit = new ClassicalElements({
  epoch: EpochUTC.fromDateTime(date),
  semimajorAxis: 26560 as Kilometers, // GPS-like orbit
  eccentricity: 0.001,
  inclination: 55 as Degrees,
  rightAscension: 0 as Degrees,
  argPerigee: 0 as Degrees,
  trueAnomaly: 0 as Degrees,
});

console.log('Initial Orbit (LEO):');
console.log(`  Altitude: ${(leoOrbit.semimajorAxis - 6378.137).toFixed(2)} km`);
console.log(`  Period: ${leoOrbit.period.toFixed(2)} minutes`);

console.log('\nTarget Orbit (MEO - GPS-like):');
console.log(`  Altitude: ${(meoOrbit.semimajorAxis - 6378.137).toFixed(2)} km`);
console.log(`  Period: ${meoOrbit.period.toFixed(2)} minutes`);

const meoTransfer = new TwoBurnOrbitTransfer(leoOrbit, meoOrbit);
const meoHohmann = meoTransfer.hohmannTransfer();

// Calculate delta-V for this transfer
const vLeo = Math.sqrt(398600.4418 / leoOrbit.semimajorAxis);
const vMeoTransferPerigee = Math.sqrt(398600.4418 * (2 / leoOrbit.semimajorAxis - 1 / meoHohmann.semimajorAxis));
const meoDeltaV1 = vMeoTransferPerigee - vLeo;

const vMeo = Math.sqrt(398600.4418 / meoOrbit.semimajorAxis);
const vMeoTransferApogee = Math.sqrt(398600.4418 * (2 / meoOrbit.semimajorAxis - 1 / meoHohmann.semimajorAxis));
const meoDeltaV2 = vMeo - vMeoTransferApogee;

console.log('\nTransfer Parameters:');
console.log(`  Transfer semi-major axis: ${meoHohmann.semimajorAxis.toFixed(2)} km`);
console.log(`  Transfer time: ${(meoHohmann.period / 2).toFixed(2)} minutes`);
console.log(`  First burn delta-V: ${meoDeltaV1.toFixed(3)} km/s`);
console.log(`  Second burn delta-V: ${meoDeltaV2.toFixed(3)} km/s`);
console.log(`  Total delta-V: ${(meoDeltaV1 + meoDeltaV2).toFixed(3)} km/s`);

// Example 4: Comparison of different transfers
console.log('\n=== Example 4: Comparison of Common Transfers ===\n');

const transfers = [
  { name: 'LEO to GEO', initial: 6778, final: 42164 },
  { name: 'LEO to MEO (GPS)', initial: 6778, final: 26560 },
  { name: 'LEO to ISS-like', initial: 6678, final: 6778 },
];

transfers.forEach((t) => {
  const r1 = t.initial as Kilometers;
  const r2 = t.final as Kilometers;
  const at = (r1 + r2) / 2; // Transfer orbit semi-major axis

  const v1 = Math.sqrt(398600.4418 / r1);
  const vt1 = Math.sqrt(398600.4418 * (2 / r1 - 1 / at));
  const dv1 = Math.abs(vt1 - v1);

  const v2 = Math.sqrt(398600.4418 / r2);
  const vt2 = Math.sqrt(398600.4418 * (2 / r2 - 1 / at));
  const dv2 = Math.abs(v2 - vt2);

  const period = 2 * Math.PI * Math.sqrt(Math.pow(at, 3) / 398600.4418) / 60; // minutes

  console.log(`${t.name}:`);
  console.log(`  Total delta-V: ${(dv1 + dv2).toFixed(3)} km/s`);
  console.log(`  Transfer time: ${(period / 2).toFixed(2)} minutes`);
  console.log('');
});
