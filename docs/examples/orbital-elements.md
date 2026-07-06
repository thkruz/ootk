# Orbital Elements

This example shows how to move between the three common orbit representations in ootk: TLEs, classical (Keplerian) orbital elements, and inertial state vectors. Use these conversions whenever you need to inspect an orbit's shape from tracking data, build a synthetic orbit from scratch, or export an orbit as a TLE for SGP4 consumers.

<<< ../../examples/orbital-elements.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/orbital-elements.ts
```

## TLE to Elements

Propagate a `Satellite` (built from a TLE) to a specific date with `toJ2000()`, then call `toClassicalElements()` on the resulting state. Angle members on `ClassicalElements` are stored in radians, so the script converts to degrees for display. Derived quantities like `period` are available directly, and apogee/perigee altitudes fall out of the semi-major axis and eccentricity.

<<< ../../examples/orbital-elements.ts#tle-to-elements

## Elements to State Vector

`ClassicalElements` can also be constructed directly. The constructor accepts angles in degrees (they are converted internally), and `toJ2000()` produces the equivalent inertial position and velocity at the element epoch.

<<< ../../examples/orbital-elements.ts#elements-to-state-vector

## State Vector to Elements

The reverse direction: build a `J2000` state from raw position (km) and velocity (km/s) vectors, then recover the Keplerian elements with `toClassicalElements()`. This is the typical path when your input is a propagator output or a radar-derived state.

<<< ../../examples/orbital-elements.ts#state-vector-to-elements

## Elements to TLE

`Tle.fromClassicalElements()` fits a TLE to a set of elements. Note that TLEs encode SGP4 mean elements, not osculating elements, so reading the TLE back through SGP4 gives values close to (but not exactly) the input; the verification block shows the round trip lands within about 1 km of the GEO semi-major axis.

<<< ../../examples/orbital-elements.ts#elements-to-tle

## Orbit Types

The same `ClassicalElements` API describes any orbit regime. This block builds representative LEO, MEO, and Molniya-style HEO orbits and prints their apogee/perigee altitudes and periods.

<<< ../../examples/orbital-elements.ts#orbit-types

## Output

```txt
=== Example 1: Extract Orbital Elements from TLE ===

ISS Orbital Elements:
  Semi-major axis: 6794.45 km
  Eccentricity: 0.001030
  Inclination: 51.5075°
  Right Ascension: 292.0110°
  Arg of Perigee: 125.3753°
  True Anomaly: 294.0422°

Derived Parameters:
  Period: 92.89 minutes
  Apogee altitude: 423.31 km
  Perigee altitude: 409.31 km

=== Example 2: Create Orbital Elements and Convert to State Vector ===

Custom Orbit:
  Semi-major axis: 8000.00 km
  Eccentricity: 0.100000
  Inclination: 45.0000°
  Period: 118.68 minutes

State Vector:
  Position: [2843.28, 2667.36, -6053.18] km
  Velocity: [-4.020084, 6.609623, 1.024256] km/s

=== Example 3: Create State Vector and Convert to Classical Elements ===

Derived Orbital Elements:
  Semi-major axis: 6427.20 km
  Eccentricity: 0.305487
  Inclination: 32.5870°
  Right Ascension: 110.7914°
  Arg of Perigee: 245.6083°
  True Anomaly: 229.9747°

=== Example 4: Create TLE from Classical Elements ===

Generated TLE for GEO satellite:
1 00001U 58001A   24028.54545661  .00000000  00000+0  00000+0 0  9995
2 00001   5.7296   0.0000 0001000   0.0000   0.0000 01.00274396    05

Verification - Semi-major axis: 42165.10 km
Verification - Period: 1436.12 minutes (should be ~1436 min for GEO)

=== Example 5: Different Orbit Types ===

LEO (Circular):
  Altitude at apogee: 406.64 km
  Altitude at perigee: 393.09 km
  Period: 92.56 minutes

MEO (GPS-like):
  Altitude at apogee: 20447.46 km
  Altitude at perigee: 19916.26 km
  Period: 717.96 minutes

HEO (Molniya):
  Altitude at apogee: 39825.82 km
  Altitude at perigee: 525.90 km
  Period: 717.72 minutes
```
