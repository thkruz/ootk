# Doppler Shift

Calculating Doppler shift for satellite communications, tracking frequency changes during a pass, and applying Doppler corrections. Use this when predicting the received frequency of a satellite downlink or planning transceiver tuning for a ground station.

<<< ../../examples/doppler.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/doppler.ts
```

## Setup

A `GroundStation` acts as the observer and a `Satellite` (built from a TLE) as the transmitter. The carrier frequency is plain Hz; there is no branded frequency type.

<<< ../../examples/doppler.ts#setup

## Basic Doppler

`Satellite.dopplerFactor(observer, date)` returns the multiplicative factor (1 minus range-rate over c), and `applyDoppler(freq, observer, date)` multiplies a carrier by it. Both return `null` if SGP4 propagation fails at the requested time, so guard the results. A factor below 1 means the satellite is receding (negative shift).

<<< ../../examples/doppler.ts#basic-doppler

## Doppler during a pass

Sampling the factor over time shows the classic S-curve: the shift sweeps from positive (approaching) through zero (closest approach) to negative (receding). Here the satellite is below the horizon, but the geometry-driven trend is the same.

<<< ../../examples/doppler.ts#pass-doppler

## Frequency bands

The Doppler shift in Hz scales linearly with the carrier frequency, so an X-band link sees roughly 19x the absolute shift of a VHF link for the same geometry. The theoretical worst case uses the full orbital velocity as the radial component.

<<< ../../examples/doppler.ts#frequency-bands

## Doppler rate

Differencing the received frequency over a short interval gives the Doppler rate (Hz/s), which drives how fast a receiver must retune during a pass.

<<< ../../examples/doppler.ts#doppler-rate

## Manual dopplerFactor

The standalone `dopplerFactor(location, position, velocity)` utility is what the `Satellite` method uses internally: observer ECI position (from `GroundObject.eci(date)`, which returns a bare `{x, y, z}` vector), plus the satellite's ECI position and velocity from `Satellite.eci(date)`. The results match the method exactly.

<<< ../../examples/doppler.ts#manual-doppler-factor

## Helpers

<<< ../../examples/doppler.ts#helpers

## Output

```txt
Ground Station: Cape Cod Ground Station
Transmit Frequency: 437.8 MHz
Time: 2024-01-28T12:00:00.000Z

=== Example 1: Basic Doppler Shift Calculation ===

Doppler Calculations:
  Doppler Factor: 0.99999592
  Transmit Frequency: 437.8000 MHz
  Received Frequency: 437.7982 MHz
  Frequency Shift: -1.79 kHz

Satellite Position:
  Azimuth: 309.5°
  Elevation: -54.7°
  Range: 10918.1 km

=== Example 2: Doppler Shift During a Pass ===

Time      El    Range    Doppler      Freq Shift
────────  ───  ────────  ──────────  ────────────
12:00:00  -54.7°  10918.1 km  0.99999592      -1.79 kHz
12:01:00  -55.2°  10987.5 km  0.99999628      -1.63 kHz
12:02:00  -55.8°  11050.3 km  0.99999666      -1.46 kHz
12:03:00  -56.2°  11106.1 km  0.99999705      -1.29 kHz
12:04:00  -56.7°  11154.8 km  0.99999745      -1.12 kHz
12:05:00  -57.0°  11196.1 km  0.99999787      -0.93 kHz
12:06:00  -57.3°  11229.8 km  0.99999829      -0.75 kHz
12:07:00  -57.6°  11255.8 km  0.99999873      -0.56 kHz
12:08:00  -57.7°  11273.9 km  0.99999917      -0.36 kHz
12:09:00  -57.8°  11284.0 km  0.99999962      -0.17 kHz
12:10:00  -57.9°  11285.9 km  1.00000008       0.03 kHz

=== Example 3: Doppler Shift Across Different Bands ===

Time: 2024-01-28T12:05:00.000Z

Band       Frequency       Received Freq    Shift
────────  ──────────────  ──────────────  ─────────
VHF       145.8 MHz       145.7997 MHz    -311.06 Hz
UHF       437.8 MHz       437.7991 MHz    -934.04 Hz
L-band    1575.42 MHz (GPS L1)  1.5754 GHz      - 3.36 kHz
S-band    2.2 GHz         2.2000 GHz      - 4.69 kHz
X-band    8.4 GHz         8.4000 GHz      -17.92 kHz
Ku-band   12 GHz          12.0000 GHz     -25.60 kHz

ISS Orbital Velocity: ~7.66 km/s
Max Doppler Factor: ±0.002555%

Theoretical Maximum Frequency Shifts:
  145.8 MHz: ±3.73 kHz
  437.8 MHz: ±11.19 kHz
  1575.42 MHz (GPS L1): ±40.25 kHz
  2.2 GHz: ±56.21 kHz

... (truncated)

=== Example 5: Using dopplerFactor Utility Function ===

Observer ECI Position (km):
  [-2608.11, -3973.30, 4242.78]

Satellite ECI Position (km):
  [-1574.82, 6481.63, 1292.52]

Satellite ECI Velocity (km/s):
  [-4.9744, -0.0382, -5.8304]

Calculated Doppler Factor: 0.99999592
Satellite method result: 0.99999592
```
