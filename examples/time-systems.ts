/* eslint-disable no-console */
/**
 * Example demonstrating different time systems and epoch conversions.
 *
 * This example shows:
 * - Different epoch types (UTC, TAI, TT, TDB, GPS)
 * - Converting between time systems
 * - Julian dates
 * - GMST (Greenwich Mean Sidereal Time)
 * - Time differences and offsets
 */

import {
  calcGmst,
  Days,
  EpochGPS,
  EpochTAI,
  EpochTDB,
  EpochTT,
  EpochUTC,
  jday,
} from '../dist/main.js';

// Example 1: Create epochs in different time systems
console.log('=== Example 1: Different Time Systems ===\n');

const date = new Date('2024-01-28T12:00:00.000Z');

const utcEpoch = EpochUTC.fromDateTime(date);
const taiEpoch = EpochTAI.fromDateTime(date);
const ttEpoch = EpochTT.fromDateTime(date);
const tdbEpoch = EpochTDB.fromDateTime(date);
const gpsEpoch = EpochGPS.fromDateTime(date);

console.log(`UTC (Coordinated Universal Time): ${utcEpoch.toDateTime().toISOString()}`);
console.log(`TAI (International Atomic Time):  ${taiEpoch.toDateTime().toISOString()}`);
console.log(`TT  (Terrestrial Time):           ${ttEpoch.toDateTime().toISOString()}`);
console.log(`TDB (Barycentric Dynamical Time): ${tdbEpoch.toDateTime().toISOString()}`);
console.log(`GPS (GPS Time):                   ${gpsEpoch.toDateTime().toISOString()}`);

// Example 2: Time system conversions
console.log('\n=== Example 2: Converting Between Time Systems ===\n');

console.log('Starting with UTC:');
console.log(`  UTC: ${utcEpoch.toDateTime().toISOString()}`);

// Convert UTC to other systems
const utcToTai = utcEpoch.toTai();
const utcToTt = utcEpoch.toTt();
const utcToTdb = utcEpoch.toTdb();
const utcToGps = utcEpoch.toGps();

console.log(`  → TAI: ${utcToTai.toDateTime().toISOString()}`);
console.log(`  → TT:  ${utcToTt.toDateTime().toISOString()}`);
console.log(`  → TDB: ${utcToTdb.toDateTime().toISOString()}`);
console.log(`  → GPS: ${utcToGps.toDateTime().toISOString()}`);

console.log('\nStarting with TAI:');
console.log(`  TAI: ${taiEpoch.toDateTime().toISOString()}`);

const taiToUtc = taiEpoch.toUtc();
const taiToTt = taiEpoch.toTt();

console.log(`  → UTC: ${taiToUtc.toDateTime().toISOString()}`);
console.log(`  → TT:  ${taiToTt.toDateTime().toISOString()}`);

// Example 3: Julian dates
console.log('\n=== Example 3: Julian Dates ===\n');

const jd = jday(
  date.getUTCFullYear(),
  date.getUTCMonth() + 1,
  date.getUTCDate(),
  date.getUTCHours(),
  date.getUTCMinutes(),
  date.getUTCSeconds(),
);

console.log(`Date: ${date.toISOString()}`);
console.log(`Julian Date: ${jd.toFixed(6)}`);
console.log(`Modified Julian Date: ${(jd - 2400000.5).toFixed(6)}`);

// J2000 epoch (January 1, 2000, 12:00:00 TT)
const j2000Date = new Date('2000-01-01T12:00:00.000Z');
const j2000Jd = jday(
  j2000Date.getUTCFullYear(),
  j2000Date.getUTCMonth() + 1,
  j2000Date.getUTCDate(),
  j2000Date.getUTCHours(),
  j2000Date.getUTCMinutes(),
  j2000Date.getUTCSeconds(),
);

console.log(`\nJ2000 Epoch:`);
console.log(`  Date: ${j2000Date.toISOString()}`);
console.log(`  Julian Date: ${j2000Jd.toFixed(6)}`);

// Example 4: GMST (Greenwich Mean Sidereal Time)
console.log('\n=== Example 4: Greenwich Mean Sidereal Time ===\n');

const gmstResult = calcGmst(date);

console.log(`Date: ${date.toISOString()}`);
console.log(`GMST: ${gmstResult.gmst.toFixed(6)} radians`);
console.log(`      ${(gmstResult.gmst * (180 / Math.PI)).toFixed(6)}°`);
console.log(`      ${((gmstResult.gmst * (180 / Math.PI)) / 15).toFixed(6)} hours`);

// Convert to hour:minute:second format
const gmstHours = (gmstResult.gmst * (180 / Math.PI)) / 15;
const hours = Math.floor(gmstHours);
const minutes = Math.floor((gmstHours - hours) * 60);
const seconds = ((gmstHours - hours) * 60 - minutes) * 60;

console.log(`      ${hours}h ${minutes}m ${seconds.toFixed(2)}s`);

// Example 5: Time differences
console.log('\n=== Example 5: Time System Offsets ===\n');

// TAI-UTC offset (leap seconds)
const taiUtcDiff = (utcToTai.toDateTime().getTime() - utcEpoch.toDateTime().getTime()) / 1000;

console.log(`TAI - UTC = ${taiUtcDiff} seconds (leap seconds)`);

// TT-TAI offset (constant 32.184 seconds)
const ttTaiDiff = (utcToTt.toDateTime().getTime() - utcToTai.toDateTime().getTime()) / 1000;

console.log(`TT - TAI  = ${ttTaiDiff.toFixed(3)} seconds (constant)`);

// GPS-UTC offset
const gpsUtcDiff = (utcToGps.toDateTime().getTime() - utcEpoch.toDateTime().getTime()) / 1000;

console.log(`GPS - UTC = ${gpsUtcDiff} seconds`);

// Example 6: Working with epoch arithmetic
console.log('\n=== Example 6: Epoch Arithmetic ===\n');

const startEpoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));

console.log(`Start: ${startEpoch.toDateTime().toISOString()}`);

// Add 1 day
const oneDayLater = startEpoch.roll(1 as Days);

console.log(`+1 day: ${oneDayLater.toDateTime().toISOString()}`);

// Add 7 days
const oneWeekLater = startEpoch.roll(7 as Days);

console.log(`+7 days: ${oneWeekLater.toDateTime().toISOString()}`);

// Example 7: Multiple date conversions
console.log('\n=== Example 7: Common Date/Time Scenarios ===\n');

const scenarios = [
  { name: 'GPS Epoch Start', date: new Date('1980-01-06T00:00:00.000Z') },
  { name: 'J2000.0', date: new Date('2000-01-01T12:00:00.000Z') },
  { name: 'Unix Epoch', date: new Date('1970-01-01T00:00:00.000Z') },
  { name: 'Current Example', date: new Date('2024-01-28T12:00:00.000Z') },
];

scenarios.forEach((scenario) => {
  const jdValue = jday(
    scenario.date.getUTCFullYear(),
    scenario.date.getUTCMonth() + 1,
    scenario.date.getUTCDate(),
    scenario.date.getUTCHours(),
    scenario.date.getUTCMinutes(),
    scenario.date.getUTCSeconds(),
  );

  const gmstValue = calcGmst(scenario.date);

  console.log(`${scenario.name}:`);
  console.log(`  Date: ${scenario.date.toISOString()}`);
  console.log(`  JD: ${jdValue.toFixed(6)}`);
  console.log(`  GMST: ${(gmstValue.gmst * (180 / Math.PI) / 15).toFixed(4)} hours`);
  console.log('');
});

// Example 8: Precision timing
console.log('=== Example 8: High-Precision Time Comparison ===\n');

const preciseDate = new Date('2024-01-28T12:34:56.789Z');
const utcPrecise = EpochUTC.fromDateTime(preciseDate);

console.log(`Input: ${preciseDate.toISOString()}`);
console.log(`UTC epoch posix: ${utcPrecise.posix.toFixed(9)} seconds since Unix epoch`);

// Show difference between time systems in milliseconds
const taiPrecise = utcPrecise.toTai();
const ttPrecise = utcPrecise.toTt();

const utcMillis = utcPrecise.toDateTime().getTime();
const taiMillis = taiPrecise.toDateTime().getTime();
const ttMillis = ttPrecise.toDateTime().getTime();

console.log(`\nTime differences (from UTC):`);
console.log(`  TAI: +${(taiMillis - utcMillis).toFixed(0)} ms`);
console.log(`  TT:  +${(ttMillis - utcMillis).toFixed(0)} ms`);
