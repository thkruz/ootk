# Moon

This example computes the Moon's position in ECI coordinates, moonrise and moonset times for a ground observer, phase and illumination data, and angular size. Use these APIs when planning night observations or modeling lunar interference for optical sensors.

<<< ../../examples/moon.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/moon.ts
```

## Moon position

`Moon.eci` returns the Moon's position as a `Vector3D<Kilometers>` in Earth-centered inertial coordinates, and `Moon.getDistanceFromEarth` returns the geocentric distance. Combining the ECI vector with `calcGmst` and `eci2lla` gives the sub-lunar point in geodetic coordinates.

<<< ../../examples/moon.ts#moon-position

## Rise and set times

`Moon.getMoonTimes` takes a `GroundObject` (here a `GroundStation` with degrees and kilometers) and searches one day for horizon crossings. Either `rise` or `set` can be `null` when that event does not occur inside the search window, and the `alwaysUp`/`alwaysDown` flags cover polar cases.

<<< ../../examples/moon.ts#moon-rise-set

## Phase and illumination

`Moon.getPhase` returns the illuminated `fraction`, a `phaseValue` from 0 (new) through 0.5 (full) back to 1 (new), and a named phase bucket with an emoji. `Moon.getPhaseAngle` returns the phase angle in degrees, where 0 is new moon and 180 is full moon.

<<< ../../examples/moon.ts#moon-phase-illumination

## Angular size

`Moon.getAngularDiameterDeg` computes the apparent diameter using the true Earth-Moon distance at the given time, so it varies between roughly 29 and 34 arcminutes across the anomalistic month.

<<< ../../examples/moon.ts#moon-angular-size

## Position over a day

Sampling `Moon.eci` every 6 hours shows the distance changing slowly while the sub-lunar longitude sweeps westward with Earth's rotation.

<<< ../../examples/moon.ts#moon-over-a-day

## Next phase events

The `next` field of `getPhase` precomputes the next occurrence of each principal phase (new, first quarter, full, third quarter) plus the nearest upcoming event, so there is no need to scan day by day.

<<< ../../examples/moon.ts#next-phase-events

## Output

```txt
=== Example 1: Moon Position ===

Moon Position (ECI):
  X: -375309.83 km
  Y: 130111.11 km
  Z: 81275.72 km

Distance from Earth: 405452.97 km
                     1.0548 x mean lunar distance

Sub-Lunar Point:
  Latitude: 11.5648 deg
  Longitude: -146.3782 deg

=== Example 2: Moon Rise/Set Times ===

Observer Location: 41 deg N, 71 deg W

Moon Times for Sun Jan 28 2024:
  Moonrise: No moonrise today
  Moonset:  2024-01-28T13:41:13.643Z

=== Example 3: Moon Phase and Illumination ===

Phase: 58.70%
  0% = New Moon
  25% = First Quarter
  50% = Full Moon
  75% = Last Quarter

Illumination: 92.72%
Phase Angle: 210.28 deg
Moon Phase: Waning Gibbous 🌖

=== Example 4: Moon Angular Size ===

Angular Diameter: 29.46 arcminutes
                  0.4910 deg

Mean angular diameter: ~31 arcminutes

=== Example 5: Moon Position Every 6 Hours ===

Sun, 28 Jan 2024 00:00:00 GMT:
  Distance: 404996.44 km
  Sub-lunar point: 14.11 deg N, 28.61 deg E

... (truncated)

Sun, 28 Jan 2024 18:00:00 GMT:
  Distance: 405608.30 km
  Sub-lunar point: 10.25 deg N, 126.08 deg E

=== Example 6: Next Phase Events ===

From 2024-01-28T12:00:00.000Z:
  Next New Moon:      2024-02-09T19:59:47.844Z
  Next First Quarter: 2024-02-17T05:10:48.538Z
  Next Full Moon:     2024-02-24T14:21:49.233Z
  Next Third Quarter: 2024-02-02T10:48:47.149Z

Nearest upcoming event: thirdQuarter at 2024-02-02T10:48:47.149Z
```
