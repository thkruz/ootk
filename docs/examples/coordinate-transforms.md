# Coordinate Transforms

This example converts positions between coordinate frames (ECI, ECEF, LLA), propagates a satellite into different state vector representations (J2000, TEME, ITRF), and computes relative motion in the RIC frame. These transforms are the glue between orbit propagation, ground processing, and proximity analysis.

<<< ../../examples/coordinate-transforms.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/coordinate-transforms.ts
```

## ECI and ECEF

`eci2ecef` and `ecef2eci` rotate a position about the Earth's spin axis by the Greenwich Mean Sidereal Time angle, which `calcGmst` computes from a `Date`. The functions accept plain `{x, y, z}` objects in kilometers, and the round trip reproduces the input.

<<< ../../examples/coordinate-transforms.ts#eci-ecef

## ECI and geodetic (LLA)

`eci2lla` returns latitude and longitude in degrees with altitude in kilometers. Note the asymmetry: `lla2eci` expects radians, so the angles must be converted before going back. The small position difference on the return trip comes from the geodetic (ellipsoidal) altitude model.

<<< ../../examples/coordinate-transforms.ts#eci-lla

## State vector frames

`Satellite.toJ2000` propagates the TLE with SGP4 and rotates the TEME result into the J2000 inertial frame. From a `J2000` state, `toTEME()` and `toITRF()` reach the other frames, and `ITRF.toGeodetic()` yields a `Geodetic` object. `Geodetic` stores radians internally, so use the `latDeg`/`lonDeg` getters for display.

<<< ../../examples/coordinate-transforms.ts#state-vector-frames

## RIC relative frame

The RIC (Radial, In-track, Cross-track) frame expresses one object's state relative to another, which is the standard view for conjunction and formation analysis. Use the static `RIC.fromJ2000(deputy, chief)` factory; the deputy here is built by perturbing the chief's true anomaly through `toClassicalElements()` and `toJ2000()`.

<<< ../../examples/coordinate-transforms.ts#ric-relative-frame

## Creating state vectors directly

`J2000` and `TEME` states can be constructed from an `EpochUTC` plus position and velocity `Vector3D`s. Identical numbers in the two frames are different physical states: converting the TEME state to J2000 shifts the vector because the frames differ by precession and nutation.

<<< ../../examples/coordinate-transforms.ts#custom-state-vectors

## Geodetic to ECEF

`lla2ecef` converts a degrees-based LLA object to Earth-fixed Cartesian coordinates using the WGS-84 ellipsoid, which is why the geocentric distance at 41.75 deg latitude is about 9 km less than the equatorial radius.

<<< ../../examples/coordinate-transforms.ts#lla-ecef

## Output

```txt
=== Example 1: ECI <-> ECEF Transformations ===

ECI Position:
  X: 6778.00 km
  Y: 0.00 km
  Z: 0.00 km

ECEF Position:
  X: 4103.43 km
  Y: 5394.73 km
  Z: 0.00 km

Converted back to ECI:
  X: 6778.00 km
  Y: 0.00 km
  Z: 0.00 km

=== Example 2: ECI <-> Geodetic (LLA) Transformations ===

Geodetic Coordinates:
  Latitude:  0.0000 deg
  Longitude: 52.7421 deg
  Altitude:  399.86 km

Converted back to ECI:
  X: 6770.87 km
  Y: -0.00 km
  Z: 0.00 km

=== Example 3: Different State Vector Frames (J2000, TEME, ITRF) ===

J2000 Frame (ECI):
  Position: [-1536.88, 6490.06, 1295.88] km
  Velocity: [-4.988100, -0.011607, -5.818747] km/s

TEME Frame:
  Position: [-1574.82, 6481.63, 1292.52] km
  Velocity: [-4.974387, -0.038184, -5.830361] km/s

ITRF Frame (Earth-fixed):
  Position: [-6112.25, 2670.58, 1292.52] km
  Velocity: [-2.786382, -3.536609, -5.830361] km/s

Geodetic from ITRF:
  Latitude:  11.0343 deg
  Longitude: 156.3984 deg
  Altitude:  416.92 km

=== Example 4: Relative Coordinates (RIC Frame) ===

Satellite 1 (Chief) Position:
  [-1536.88, 6490.06, 1295.88] km

Satellite 2 (Deputy) Position:
  [-1970.72, 6456.65, 774.39] km

Relative Position in RIC Frame:
  Radial:      -33.2487 km
  In-track:    678.3660 km
  Cross-track: -0.0000 km

... (truncated)

=== Example 6: Geodetic to ECEF ===

Observer Location:
  Latitude:  41.754785 deg
  Longitude: -70.539151 deg
  Altitude:  0.060966 km

ECEF Position:
  X: 1587.5953 km
  Y: -4492.9853 km
  Z: 4225.3650 km

Distance from Earth center: 6368.7585 km
Earth equatorial radius: 6378.137 km
```
