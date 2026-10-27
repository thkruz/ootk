# Observations

Right ascension/declination observation formats, topocentric vs geocentric observations, and recovering inertial positions from observations. Use this when working with optical/telescope measurements, where targets are naturally expressed as RA/Dec angles rather than range/azimuth/elevation.

<<< ../../examples/observations.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/observations.ts
```

## Setup

The observer is a `GroundStation` (which knows how to produce its own inertial state) and the target is a `Satellite` built from a TLE. `EpochUTC.fromDateTime()` converts a JavaScript `Date` into the epoch type the observation classes use.

<<< ../../examples/observations.ts#setup

## Topocentric RADEC

`RadecTopocentric.fromStateVector(state, site)` takes two J2000 state vectors: the target and the observing site. Get the site vector from `GroundObject.toJ2000(date)`, computed at the same time as the target state. The result carries RA/Dec in radians plus range and angle rates.

<<< ../../examples/observations.ts#topocentric-radec

## Geocentric RADEC

`RadecGeocentric.fromStateVector(state)` references the observation to Earth's center, so no site vector is needed. Geocentric RA/Dec differs from the topocentric values because of parallax: the satellite is close enough that the observer's position on the surface matters.

<<< ../../examples/observations.ts#geocentric-radec

## Comparing formats

The same geometry can be expressed as RAE (local horizon frame), topocentric RADEC (inertial angles from the site), or geocentric RADEC (inertial angles from Earth's center). Note the ranges differ between the topocentric and geocentric forms since they measure from different origins.

<<< ../../examples/observations.ts#compare-formats

## Manual RADEC

`RadecTopocentric` can be constructed directly from raw angles (radians) and an optional range. To turn an observation back into an inertial position, call `position(site)`: it scales the line-of-sight unit vector by the range and adds the site position. Velocity recovery via `velocity(site)` additionally requires RA/Dec rates.

<<< ../../examples/observations.ts#manual-radec

## Tracking in RADEC

When tracking over time, recompute both the target state and the site state at each timestep; the site moves in the inertial frame as Earth rotates.

<<< ../../examples/observations.ts#radec-tracking

## Angular separation

Geocentric RA/Dec pairs can be compared with standard spherical trigonometry to get the angular separation between two objects.

<<< ../../examples/observations.ts#angular-separation

## Helpers

Formatting helpers for astronomical angle conventions: right ascension as hours/minutes/seconds and declination as signed degrees/arcminutes/arcseconds.

<<< ../../examples/observations.ts#helpers

## Output

```txt
Observatory: Example Observatory
  Location: 34.5° N, 117.9° W
  Altitude: 1.2 km

Observation Time: 2024-01-28T12:00:00.000Z

=== Example 1: Topocentric RADEC Observations ===

Topocentric Observation (from ground station):
  Right Ascension: 1.107873 rad
                   63.4765°
                   04h 13m 54.35s
  Declination:     -0.275189 rad
                   -15.7671°
                   -15° 46' 01.73"
  Range:           8498.28 km

=== Example 2: Geocentric RADEC Observations ===

Geocentric Observation (from Earth center):
  Right Ascension: 1.803319 rad
                   103.3225°
                   06h 53m 17.41s
  Declination:     0.191907 rad
                   10.9955°
                   +10° 59' 43.70"
  Range:           6794.28 km

=== Example 3: Comparing Observation Formats ===

Same satellite observed in different coordinate systems:

RAE (Range-Azimuth-Elevation):
  Azimuth:   276.8752°
  Elevation: -37.9685°
  Range:     8498.28 km

... (truncated)

=== Example 5: Tracking Satellite Motion in RADEC ===

Time      Right Ascension    Declination    Range
────────  ─────────────────  ─────────────  ─────────
12:00:00  04h 13m 54.35s  -15° 46' 01.73"     8498.3 km
12:05:00  04h 49m 13.90s  -28° 55' 37.61"     8466.6 km
12:10:00  05h 16m 15.90s  -43° 07' 15.01"     8522.8 km
12:15:00  05h 32m 24.76s  -57° 42' 07.50"     8641.0 km
12:20:00  05h 22m 23.77s  -72° 03' 05.17"     8791.4 km
12:25:00  02h 21m 13.75s  -83° 17' 26.93"     8946.2 km

=== Example 6: Angular Separation Between Objects ===

Time: 2024-01-28T12:00:00.000Z

Satellite  Right Ascension    Declination    Range
─────────  ─────────────────  ─────────────  ─────────
ISS        06h 53m 17.41s  +10° 59' 43.70"     6794.3 km
Hubble     02h 26m 13.70s  +24° 10' 36.19"     6912.0 km

Angular Separation:
  64.4435°
  3866.61 arcminutes
```
