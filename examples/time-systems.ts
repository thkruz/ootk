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

// #region imports
import { calcGmst, EpochUTC, jday, Seconds } from 'ootk';
// #endregion imports

// #region create-epochs
console.log('=== Example 1: Different Time Systems ===\n');

const date = new Date('2024-01-28T12:00:00.000Z');

// EpochUTC is the primary time class. All other time systems are derived
// from it via the to*() conversion methods.
const utcEpoch = EpochUTC.fromDateTime(date);
const taiEpoch = utcEpoch.toTAI();
const ttEpoch = utcEpoch.toTT();
const tdbEpoch = utcEpoch.toTDB();
const gpsEpoch = utcEpoch.toGPS();

console.log(`UTC (Coordinated Universal Time): ${utcEpoch.toDateTime().toISOString()}`);
console.log(`TAI (International Atomic Time):  ${taiEpoch.toDateTime().toISOString()}`);
console.log(`TT  (Terrestrial Time):           ${ttEpoch.toDateTime().toISOString()}`);
console.log(`TDB (Barycentric Dynamical Time): ${tdbEpoch.toDateTime().toISOString()}`);
console.log(`GPS (week:seconds of week):       ${gpsEpoch.toString()}`);
// #endregion create-epochs

// #region gps-time
console.log('\n=== Example 2: GPS Time ===\n');

// GPS time is expressed as weeks since 1980-01-06 plus seconds into the week
console.log(`GPS reference epoch: ${EpochUTC.fromDateTimeString('1980-01-06T00:00:00.000Z').toDateTime().toISOString()}`);
console.log(`GPS week:            ${gpsEpoch.week}`);
console.log(`GPS week (10-bit):   ${gpsEpoch.week10Bit}`);
console.log(`GPS week (13-bit):   ${gpsEpoch.week13Bit}`);
console.log(`Seconds of week:     ${gpsEpoch.seconds.toFixed(3)}`);

// GPS epochs can be converted back to UTC
const gpsRoundTrip = gpsEpoch.toUTC();

console.log(`\nRound trip GPS -> UTC: ${gpsRoundTrip.toDateTime().toISOString()}`);
// #endregion gps-time

// #region julian-dates
console.log('\n=== Example 3: Julian Dates ===\n');

// The jday function computes a Julian date from calendar components
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

// Epoch classes provide the same values directly
console.log(`\nFrom EpochUTC:`);
console.log(`  Julian Date: ${utcEpoch.toJulianDate().toFixed(6)}`);
console.log(`  Modified Julian Date: ${utcEpoch.toMjd().toFixed(6)}`);
console.log(`  Julian Centuries since J2000: ${utcEpoch.toJulianCenturies().toFixed(8)}`);

// J2000 epoch (January 1, 2000, 12:00:00)
const j2000Epoch = EpochUTC.fromDateTimeString('2000-01-01T12:00:00.000Z');

console.log(`\nJ2000 Epoch:`);
console.log(`  Date: ${j2000Epoch.toDateTime().toISOString()}`);
console.log(`  Julian Date: ${j2000Epoch.toJulianDate().toFixed(6)}`);
// #endregion julian-dates

// #region gmst
console.log('\n=== Example 4: Greenwich Mean Sidereal Time ===\n');

const gmstResult = calcGmst(date);

console.log(`Date: ${date.toISOString()}`);
console.log(`GMST: ${gmstResult.gmst.toFixed(6)} radians`);
console.log(`      ${(gmstResult.gmst * (180 / Math.PI)).toFixed(6)} deg`);
console.log(`      ${((gmstResult.gmst * (180 / Math.PI)) / 15).toFixed(6)} hours`);

// Convert to hour:minute:second format
const gmstHours = (gmstResult.gmst * (180 / Math.PI)) / 15;
const hours = Math.floor(gmstHours);
const minutes = Math.floor((gmstHours - hours) * 60);
const seconds = ((gmstHours - hours) * 60 - minutes) * 60;

console.log(`      ${hours}h ${minutes}m ${seconds.toFixed(2)}s`);

// EpochUTC can also compute GMST directly
console.log(`\nFrom EpochUTC: ${utcEpoch.gmstAngle().toFixed(6)} radians`);
// #endregion gmst

// #region time-offsets
console.log('\n=== Example 5: Time System Offsets ===\n');

// Each epoch stores posix seconds in its own time scale, so subtracting
// posix values reveals the offset between systems

// TAI-UTC offset (leap seconds)
const taiUtcDiff = taiEpoch.posix - utcEpoch.posix;

console.log(`TAI - UTC = ${taiUtcDiff} seconds (leap seconds)`);

// TT-TAI offset (constant 32.184 seconds)
const ttTaiDiff = ttEpoch.posix - taiEpoch.posix;

console.log(`TT - TAI  = ${ttTaiDiff.toFixed(3)} seconds (constant)`);

// TDB-TT offset (periodic relativistic correction, under 2 ms)
const tdbTtDiff = (tdbEpoch.posix - ttEpoch.posix) * 1000;

console.log(`TDB - TT  = ${tdbTtDiff.toFixed(3)} milliseconds (periodic)`);
// #endregion time-offsets

// #region epoch-arithmetic
console.log('\n=== Example 6: Epoch Arithmetic ===\n');

const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T00:00:00.000Z');

console.log(`Start: ${startEpoch.toDateTime().toISOString()}`);

// roll shifts an epoch by a number of seconds
const secondsPerDay = 86400 as Seconds;
const oneDayLater = startEpoch.roll(secondsPerDay);

console.log(`+1 day: ${oneDayLater.toDateTime().toISOString()}`);

// Add 7 days
const oneWeekLater = startEpoch.roll((7 * 86400) as Seconds);

console.log(`+7 days: ${oneWeekLater.toDateTime().toISOString()}`);

// difference returns the seconds between two epochs
console.log(`Difference: ${oneWeekLater.difference(startEpoch)} seconds`);
// #endregion epoch-arithmetic

// #region reference-epochs
console.log('\n=== Example 7: Common Date/Time Scenarios ===\n');

const scenarios = [
  { name: 'GPS Epoch Start', date: new Date('1980-01-06T00:00:00.000Z') },
  { name: 'J2000.0', date: new Date('2000-01-01T12:00:00.000Z') },
  { name: 'Unix Epoch', date: new Date('1970-01-01T00:00:00.000Z') },
  { name: 'Current Example', date: new Date('2024-01-28T12:00:00.000Z') },
];

scenarios.forEach((scenario) => {
  const epoch = EpochUTC.fromDateTime(scenario.date);
  const gmstValue = calcGmst(scenario.date);

  console.log(`${scenario.name}:`);
  console.log(`  Date: ${scenario.date.toISOString()}`);
  console.log(`  JD: ${epoch.toJulianDate().toFixed(6)}`);
  console.log(`  GMST: ${(gmstValue.gmst * (180 / Math.PI) / 15).toFixed(4)} hours`);
  console.log('');
});

console.log('=== Example 8: High-Precision Time Comparison ===\n');

const preciseDate = new Date('2024-01-28T12:34:56.789Z');
const utcPrecise = EpochUTC.fromDateTime(preciseDate);

console.log(`Input: ${preciseDate.toISOString()}`);
console.log(`UTC epoch posix: ${utcPrecise.posix.toFixed(9)} seconds since Unix epoch`);

// Show difference between time systems in milliseconds
const taiPrecise = utcPrecise.toTAI();
const ttPrecise = utcPrecise.toTT();

console.log('\nTime differences (from UTC):');
console.log(`  TAI: +${((taiPrecise.posix - utcPrecise.posix) * 1000).toFixed(0)} ms`);
console.log(`  TT:  +${((ttPrecise.posix - utcPrecise.posix) * 1000).toFixed(0)} ms`);
// #endregion reference-epochs
