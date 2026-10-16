/* eslint-disable no-console */
/**
 * Example demonstrating breakup epoch estimation by orbit-plane convergence.
 *
 * This example shows:
 * - Building a synthetic fragment cloud from one parent state and random delta-v kicks
 * - Estimating the breakup epoch, its uncertainty and a quality flag
 * - Locating the parent at the estimated epoch (ground-track point of the breakup)
 * - Running the same estimate on real TLEs: the Cosmos 1408 debris in the test fixtures
 */

// #region imports
import { readFileSync } from 'node:fs';
import {
  breakupLocationAtEpoch,
  ClassicalElements,
  EpochUTC,
  estimateBreakupEpoch,
  fragmentDispersionStats,
  J2000,
  j2SecularRates,
  Kilometers,
  KilometersPerSecond,
  Radians,
  Seconds,
  Vector3D,
  type BreakupFragmentElements,
  type BreakupTleLines,
} from 'ootk';
// #endregion imports

// #region synthetic-cloud
// Parent: 480 km, 82.56 deg (a Cosmos 1408-like orbit), at argument of latitude 30 deg.
const t0 = EpochUTC.fromDateTimeString('2021-11-15T02:47:00.000Z');
const parent = new ClassicalElements({
  epoch: t0,
  semimajorAxis: 6858 as Kilometers,
  eccentricity: 0.002,
  inclination: (82.56 * Math.PI / 180) as Radians,
  rightAscension: (130 * Math.PI / 180) as Radians,
  argPerigee: (40 * Math.PI / 180) as Radians,
  trueAnomaly: (350 * Math.PI / 180) as Radians,
});
const state = parent.toJ2000();

// Small deterministic PRNG so the output is reproducible.
let seed = 7;
const uniform = (): number => {
  seed = (seed * 1103515245 + 12345) % 2147483648;

  return seed / 2147483648;
};
const normal = (): number => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform());

// 60 fragments with 50 m/s (1-sigma per axis) kicks, carried 90 days forward with secular J2.
const ageSec = 90 * 86400;
const fragments: BreakupFragmentElements[] = [];

for (let k = 0; k < 60; k++) {
  const dv = new Vector3D(normal() * 0.05, normal() * 0.05, normal() * 0.05) as Vector3D<KilometersPerSecond>;
  const el = new J2000(t0, state.position, state.velocity.add(dv)).toClassicalElements();
  const rates = j2SecularRates(el.semimajorAxis, el.eccentricity, el.inclination);

  fragments.push({
    epoch: t0.roll(ageSec as Seconds),
    semimajorAxis: el.semimajorAxis,
    eccentricity: el.eccentricity,
    inclination: el.inclination,
    rightAscension: el.rightAscension + rates.raanDot * ageSec,
    argPerigee: el.argPerigee + rates.argPerigeeDot * ageSec,
  });
}

const now = fragmentDispersionStats(fragments)!;

console.log(`Fragments: ${now.count}, RAAN spread now: ${now.raanSpreadDeg.toFixed(2)} deg`);
console.log(`RAAN rate spread: ${now.raanDotStdDegPerDay.toFixed(4)} deg/day`);
// #endregion synthetic-cloud

// #region estimate
const estimate = estimateBreakupEpoch(fragments, { lookbackDays: 120 });

console.log('\n=== Estimate (synthetic) ===');
console.log(`Epoch:       ${estimate.epoch?.toDateTime().toISOString()}`);
console.log(`True epoch:  ${t0.toDateTime().toISOString()}`);
console.log(`1-sigma:     ${(estimate.uncertaintySec / 3600).toFixed(2)} h`);
console.log(`Spread:      ${estimate.spreadAtMinDeg.toFixed(4)} deg at the minimum, ${estimate.spreadNowDeg.toFixed(4)} deg now`);
console.log(`Quality:     ${estimate.quality} ${estimate.reasons.join(', ')}`);
// #endregion estimate

// #region location
const location = breakupLocationAtEpoch(parent, estimate.epoch!)!;

console.log('\n=== Parent at the estimated epoch ===');
console.log(`Lat ${location.latitudeDeg.toFixed(2)} deg, lon ${location.longitudeDeg.toFixed(2)} deg, alt ${location.altitudeKm.toFixed(1)} km (${location.propagator})`);
// #endregion location

// #region real-tles
// Cosmos 1408 debris (international designator 1982-092, catalog numbers from 49000) in the ootk
// SGP4 test fixture. Run from the repository root.
const lines = readFileSync('./test/sgp4/full-catalog/TLE.txt', 'utf8').split(/\r?\n/u);
const debris: BreakupTleLines[] = [];

for (let i = 0; i < lines.length - 1; i++) {
  const line1 = lines[i].replace(/^﻿/u, '');

  if (line1.startsWith('1 ') && line1.substring(9, 14) === '82092' && Number(line1.substring(2, 7)) >= 49000) {
    debris.push({ line1, line2: lines[i + 1] });
  }
}

const real = estimateBreakupEpoch(debris, { lookbackDays: 365 });

console.log('\n=== Estimate (Cosmos 1408 debris, TLEs up to 2022-08) ===');
console.log(`Fragments:   ${real.fragmentsUsed} used, ${real.fragmentsDragFiltered} dropped by the drag filter, ${real.fragmentsTrimmed} trimmed`);
console.log(`Epoch:       ${real.epoch?.toDateTime().toISOString()} (event: 2021-11-15T02:47Z)`);
console.log(`1-sigma:     ${(real.uncertaintySec / 86400).toFixed(2)} days`);
console.log(`Quality:     ${real.quality} ${real.reasons.join(', ')}`);
// #endregion real-tles
