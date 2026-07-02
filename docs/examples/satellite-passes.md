# Satellite Passes

Predicting satellite visibility over a ground station, computing look angles (azimuth, elevation, range), and checking field-of-view constraints with the sensor module. Use this when scheduling contacts or determining whether a radar can actually observe a target, not just whether it is above the horizon.

<<< ../../examples/satellite-passes.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/satellite-passes.ts
```

## Create a ground station

`GroundStation` holds the observer's geodetic position, and `Satellite` wraps a TLE with SGP4 propagation. Orbital metadata like `inclination` and `period` is available directly on the satellite.

<<< ../../examples/satellite-passes.ts#create-ground-station

## Visibility check

`Satellite.rae(groundStation, date)` returns range, azimuth, and elevation (or `null` if propagation fails). Elevation above 0° means the satellite is geometrically above the horizon.

<<< ../../examples/satellite-passes.ts#visibility-check

## Field of view constraints

A `PhasedArrayRadar` attaches to the ground station via `addSensor()` plus `setParent()`, and its `FieldOfView` defines a cone (`halfAngle` around a boresight) plus `minRange`/`maxRange` and `minElevation`. `canObserve(sat, date)` applies all constraints at once; `getRae()` exposes the raw geometry so you can report which specific constraint failed.

<<< ../../examples/satellite-passes.ts#field-of-view

## Tracking over time

Sampling `rae()` on a fixed interval distinguishes three states: below horizon, visible (above horizon but outside sensor constraints), and inside the radar's FOV.

<<< ../../examples/satellite-passes.ts#track-over-time

## Multiple satellites

The same station and sensor can evaluate any number of targets; each satellite carries its own propagator, so the per-target cost is just an SGP4 call.

<<< ../../examples/satellite-passes.ts#multiple-satellites

## Helpers

<<< ../../examples/satellite-passes.ts#helpers

## Output

```txt
=== Example 1: ISS Pass Prediction ===

Ground Station: Cape Cod
  Location: 41.754785° N, 70.539151° W
  Altitude: 0.060966 km

Satellite: ISS
  Inclination: 51.6418°
  Period: 92.94362186284005 minutes

=== Example 2: Satellite Visibility Check ===

Time: 2024-01-28T12:00:00.000Z

Look Angles:
  Azimuth:   309.51°
  Elevation: -54.65°
  Range:     10918.10 km

Satellite is BELOW HORIZON

=== Example 3: Field of View Constraints ===

Sensor: Cape Cod Radar
Field of View Constraints:
  Boresight:     Az 0°, El 45°
  Cone Half-Angle: 45°
  Min Elevation:   10°
  Range:           100 - 5556 km

At 2024-01-28T12:00:00.000Z:
  Satellite in FOV: NO
  Constraints not met:
    - Elevation too low (-54.7° < 10°)
    - Range too far (10918 km > 5556 km)

=== Example 4: Satellite Tracking Over Time ===

ISS Position every 5 minutes:

Time                      Az      El     Range   Status
─────────────────────  ──────  ──────  ───────  ────────
12:00:00           309.5°  -54.7°   10918 km  Below horizon
12:05:00           289.7°  -57.0°   11196 km  Below horizon
12:10:00           268.8°  -57.9°   11286 km  Below horizon
12:15:00           248.0°  -56.9°   11170 km  Below horizon
12:20:00           228.5°  -54.2°   10845 km  Below horizon
12:25:00           210.7°  -50.2°   10319 km  Below horizon
12:30:00           194.5°  -45.3°    9617 km  Below horizon
12:35:00           178.9°  -39.8°    8779 km  Below horizon
12:40:00           163.0°  -34.3°    7872 km  Below horizon
12:45:00           145.6°  -29.2°    6995 km  Below horizon
12:50:00           125.8°  -25.1°    6292 km  Below horizon
12:55:00           103.5°  -23.1°    5930 km  Below horizon

=== Example 5: Tracking Multiple Satellites ===

Time: 2024-01-28T18:00:00.000Z

Satellite      Az      El     Range    Visible   In FOV
────────────  ──────  ──────  ───────  ────────  ──────
ISS             51.8°  -31.6°    7440 km  No        No
HST (Hubble)   217.8°   -4.3°    3188 km  No        No
```
