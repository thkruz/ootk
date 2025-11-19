/* eslint-disable no-console */
/**
 * Example demonstrating Doppler shift calculations.
 *
 * This example shows:
 * - Calculating Doppler shift for satellite communications
 * - Computing frequency shifts due to relative motion
 * - Tracking Doppler changes during a satellite pass
 * - Applying Doppler corrections
 */

import {
  Degrees,
  dopplerFactor,
  Kilometers,
  Satellite,
  Sensor,
  TleLine1,
  TleLine2,
} from '../dist/main.js';

// Example 1: Basic Doppler calculation
console.log('=== Example 1: Basic Doppler Shift Calculation ===\n');

// Create ground station
const groundStation = new Sensor({
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
  name: 'Cape Cod Ground Station',
});

// Create ISS satellite
const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const transmitFreq = 437.8e6; // 437.8 MHz (UHF amateur radio frequency)
const date = new Date('2024-01-28T12:00:00.000Z');

console.log(`Ground Station: ${groundStation.name}`);
console.log(`Transmit Frequency: ${(transmitFreq / 1e6).toFixed(1)} MHz`);
console.log(`Time: ${date.toISOString()}\n`);

// Calculate Doppler shift
const doppler = iss.dopplerFactor(groundStation, date);
const receivedFreq = iss.applyDoppler(transmitFreq, groundStation, date);
const freqShift = receivedFreq - transmitFreq;

console.log('Doppler Calculations:');
console.log(`  Doppler Factor: ${doppler.toFixed(8)}`);
console.log(`  Transmit Frequency: ${(transmitFreq / 1e6).toFixed(4)} MHz`);
console.log(`  Received Frequency: ${(receivedFreq / 1e6).toFixed(4)} MHz`);
console.log(`  Frequency Shift: ${(freqShift / 1e3).toFixed(2)} kHz`);

// Get look angles for context
const rae = groundStation.rae(iss, date);

console.log(`\nSatellite Position:`);
console.log(`  Azimuth: ${rae.az.toFixed(1)}°`);
console.log(`  Elevation: ${rae.el.toFixed(1)}°`);
console.log(`  Range: ${rae.rng.toFixed(1)} km`);

// Example 2: Doppler during a satellite pass
console.log('\n=== Example 2: Doppler Shift During a Pass ===\n');

// Simulate a pass over 10 minutes
const passStart = new Date('2024-01-28T12:00:00.000Z');
const interval = 60; // seconds

console.log('Time      El    Range    Doppler      Freq Shift');
console.log('────────  ───  ────────  ──────────  ────────────');

for (let i = 0; i <= 10; i++) {
  const time = new Date(passStart.getTime() + i * interval * 1000);
  const timeStr = time.toISOString().substring(11, 19);

  const passRae = groundStation.rae(iss, time);
  const passDoppler = iss.dopplerFactor(groundStation, time);
  const passReceivedFreq = iss.applyDoppler(transmitFreq, groundStation, time);
  const passFreqShift = passReceivedFreq - transmitFreq;

  const elStr = passRae.el.toFixed(1).padStart(5);
  const rngStr = passRae.rng.toFixed(1).padStart(8);
  const dopplerStr = passDoppler.toFixed(8);
  const shiftStr = (passFreqShift / 1e3).toFixed(2).padStart(9);

  console.log(`${timeStr}  ${elStr}° ${rngStr} km  ${dopplerStr}  ${shiftStr} kHz`);
}

// Example 3: Different frequency bands
console.log('\n=== Example 3: Doppler Shift Across Different Bands ===\n');

const frequencies = [
  { band: 'VHF', freq: 145.8e6, name: '145.8 MHz' },
  { band: 'UHF', freq: 437.8e6, name: '437.8 MHz' },
  { band: 'L-band', freq: 1575.42e6, name: '1575.42 MHz (GPS L1)' },
  { band: 'S-band', freq: 2200e6, name: '2.2 GHz' },
  { band: 'X-band', freq: 8400e6, name: '8.4 GHz' },
  { band: 'Ku-band', freq: 12e9, name: '12 GHz' },
];

const bandCheckTime = new Date('2024-01-28T12:05:00.000Z');

console.log(`Time: ${bandCheckTime.toISOString()}\n`);
console.log('Band       Frequency       Received Freq    Shift');
console.log('────────  ──────────────  ──────────────  ─────────');

frequencies.forEach((f) => {
  const bandReceivedFreq = iss.applyDoppler(f.freq, groundStation, bandCheckTime);
  const bandFreqShift = bandReceivedFreq - f.freq;

  const bandStr = f.band.padEnd(8);
  const freqStr = f.name.padEnd(14);
  const recvStr = formatFrequency(bandReceivedFreq).padEnd(14);
  const shiftStr = formatFrequency(Math.abs(bandFreqShift)).padStart(9);

  console.log(`${bandStr}  ${freqStr}  ${recvStr}  ${bandFreqShift >= 0 ? '+' : '-'}${shiftStr}`);
});

// Example 4: Maximum Doppler shift
console.log('\n=== Example 4: Maximum Doppler Shift ===\n');

// For a LEO satellite, maximum Doppler occurs when satellite velocity
// is directly toward or away from the observer

// Calculate approximate maximum radial velocity
// ISS orbital velocity ~ 7.66 km/s
const orbitalVelocity = 7.66; // km/s
const maxRadialVelocity = orbitalVelocity; // km/s (worst case)

// Calculate theoretical maximum Doppler factor
const speedOfLight = 299792.458; // km/s
const maxDopplerFactor = maxRadialVelocity / speedOfLight;

console.log(`ISS Orbital Velocity: ~${orbitalVelocity} km/s`);
console.log(`Speed of Light: ${speedOfLight} km/s`);
console.log(`Max Doppler Factor: ±${(maxDopplerFactor * 100).toFixed(6)}%`);

console.log('\nTheoretical Maximum Frequency Shifts:');

frequencies.slice(0, 4).forEach((f) => {
  const maxShift = f.freq * maxDopplerFactor;

  console.log(`  ${f.name}: ±${formatFrequency(maxShift)}`);
});

// Example 5: Doppler rate of change
console.log('\n=== Example 5: Doppler Rate of Change ===\n');

const rateStart = new Date('2024-01-28T12:00:00.000Z');
const deltaTime = 10; // seconds

console.log('Measuring Doppler rate of change over time:\n');

for (let i = 0; i < 5; i++) {
  const t1 = new Date(rateStart.getTime() + i * 60 * 1000);
  const t2 = new Date(t1.getTime() + deltaTime * 1000);

  const freq1 = iss.applyDoppler(transmitFreq, groundStation, t1);
  const freq2 = iss.applyDoppler(transmitFreq, groundStation, t2);

  const freqChange = freq2 - freq1;
  const rateOfChange = freqChange / deltaTime; // Hz per second

  const timeStr = t1.toISOString().substring(11, 19);

  console.log(`At ${timeStr}:`);
  console.log(`  Frequency: ${(freq1 / 1e6).toFixed(4)} MHz`);
  console.log(`  Rate of change: ${rateOfChange.toFixed(2)} Hz/s`);
  console.log('');
}

// Example 6: Using dopplerFactor function directly
console.log('=== Example 6: Using dopplerFactor Utility Function ===\n');

const observerVelocity = [0, 0, 0]; // Ground station (stationary in ECEF)
const satelliteState = iss.eci(date);
const satelliteVelocity = [
  satelliteState.velocity.x,
  satelliteState.velocity.y,
  satelliteState.velocity.z,
];

const observerState = groundStation.eci(date);
const observerPosition = [
  observerState.position.x,
  observerState.position.y,
  observerState.position.z,
];
const satellitePosition = [
  satelliteState.position.x,
  satelliteState.position.y,
  satelliteState.position.z,
];

// Calculate relative position vector
const relativePos = [
  satellitePosition[0] - observerPosition[0],
  satellitePosition[1] - observerPosition[1],
  satellitePosition[2] - observerPosition[2],
];

// Calculate relative velocity
const relativeVel = [
  satelliteVelocity[0] - observerVelocity[0],
  satelliteVelocity[1] - observerVelocity[1],
  satelliteVelocity[2] - observerVelocity[2],
];

console.log('Position Vector (km):');
console.log(`  [${relativePos[0].toFixed(2)}, ${relativePos[1].toFixed(2)}, ${relativePos[2].toFixed(2)}]`);

console.log('\nVelocity Vector (km/s):');
console.log(`  [${relativeVel[0].toFixed(4)}, ${relativeVel[1].toFixed(4)}, ${relativeVel[2].toFixed(4)}]`);

const manualDoppler = dopplerFactor(relativePos, relativeVel);

console.log(`\nCalculated Doppler Factor: ${manualDoppler.toFixed(8)}`);
console.log(`Satellite method result: ${doppler.toFixed(8)}`);

// Helper function to format frequencies
function formatFrequency(freq: number): string {
  if (freq >= 1e9) {
    return `${(freq / 1e9).toFixed(4)} GHz`;
  } else if (freq >= 1e6) {
    return `${(freq / 1e6).toFixed(4)} MHz`;
  } else if (freq >= 1e3) {
    return `${(freq / 1e3).toFixed(2)} kHz`;
  } else {
    return `${freq.toFixed(2)} Hz`;
  }
}
