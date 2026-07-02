# Maneuvers

This example computes Hohmann transfers with `TwoBurnOrbitTransfer`, turns a transfer into scheduled `Thrust` maneuvers, and prices an inclination change with `PlaneChangeBurn`. Use it when you need a delta-V budget or a burn schedule for moving between near-circular orbits.

<<< ../../examples/maneuvers.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/maneuvers.ts
```

## Orbit definitions

`ClassicalElements` describes each endpoint orbit. Angles are `Radians`, so degree values are converted with `DEG2RAD`, and the `period` getter returns minutes. The elements are only used here for context (altitude, period, inclination); the transfer math below needs just the two radii.

<<< ../../examples/maneuvers.ts#orbit-definitions

## Hohmann LEO to GEO

`TwoBurnOrbitTransfer.hohmannTransfer(rInit, rFinal)` is a static factory that takes the radii of two circular orbits in km and returns the circular velocities (`vInit`, `vFinal`), the two burn magnitudes (`vTransA` at perigee, `vTransB` at apogee) in km/s, the transfer time `tTrans` in seconds, and a `deltaV` getter summing both burns.

<<< ../../examples/maneuvers.ts#hohmann-leo-to-geo

## Burn schedule

`toManeuvers(epoch)` converts the transfer into two impulsive `Thrust` objects in the RIC frame. The delta-V is applied in the intrack direction (in m/s on the `Thrust` API), and the second burn is centered one transfer time after the first.

<<< ../../examples/maneuvers.ts#burn-schedule

## Plane change

A launch from 28.5 degrees inclination still needs a plane change to reach equatorial GEO. `PlaneChangeBurn.computeDeltaV(velocityAtNode, deltaIncRad)` implements dv = 2 v sin(di/2); doing the rotation at GEO, where velocity is lowest, keeps the cost down. In practice the plane change is combined vectorially with the apogee burn, so the separate-burn figure shown here is an upper bound.

<<< ../../examples/maneuvers.ts#plane-change

## LEO to Molniya

The same Hohmann helper sizes a transfer ellipse from LEO up to the Molniya apogee radius. Only the first burn and transfer time map directly onto a real Molniya insertion, since a Molniya orbit is not circularized at apogee; `vTransB` is reported as the cost of circularizing there if you wanted to.

<<< ../../examples/maneuvers.ts#leo-to-molniya

## Transfer comparison

Because `hohmannTransfer()` is a pure static function of the two radii, it is convenient for tabulating delta-V and time-of-flight across candidate transfers.

<<< ../../examples/maneuvers.ts#transfer-comparison

## Output

```txt
=== Example 1: Hohmann Transfer from LEO to GEO ===

Initial Orbit (LEO):
  Altitude: 399.86 km
  Inclination: 28.5 deg
  Period: 92.56 minutes

Target Orbit (GEO):
  Altitude: 35785.86 km
  Inclination: 0.0 deg
  Period: 1436.06 minutes

Hohmann Transfer:
  Initial circular velocity: 7.669 km/s
  Final circular velocity: 3.075 km/s
  First burn (perigee): 2.398 km/s
  Second burn (apogee): 1.457 km/s
  Total delta-V: 3.854 km/s
  Transfer time: 317.47 minutes (half orbit)
  Transfer semi-major axis: 24471.00 km
  Transfer eccentricity: 0.723019
  Periapsis altitude: 399.86 km
  Apoapsis altitude: 35785.86 km

Burn Schedule (impulsive Thrust maneuvers):
  Burn 1: 2024-01-28T00:00:00.000Z
    Intrack delta-V: 2397.5 m/s
  Burn 2: 2024-01-28T05:17:28.402Z
    Intrack delta-V: 1456.5 m/s

=== Example 2: Plane Change at GEO ===

Inclination change: 28.5 deg
Velocity at GEO: 3.075 km/s
Plane change delta-V (separate burn): 1.514 km/s
Hohmann + separate plane change: 5.368 km/s

=== Example 3: Raising Apogee from LEO to Molniya Altitude ===

Target Orbit (Molniya):
  Semi-major axis: 26554.00 km
  Eccentricity: 0.7400
  Apogee altitude: 39825.82 km
  Perigee altitude: 525.90 km
  Period: 717.72 minutes

Transfer Ellipse (LEO to Molniya apogee radius):
  First burn (perigee): 2.459 km/s
  Circularization at apogee (if desired): 1.451 km/s
  Transfer time: 357.58 minutes

=== Example 4: Comparison of Common Transfers ===

LEO to GEO:
  First burn: 2397.5 m/s
  Second burn: 1456.5 m/s
  Total delta-V: 3.854 km/s
  Transfer time: 317.47 minutes

LEO to MEO (GPS):
  First burn: 2011.4 m/s
  Second burn: 1403.7 m/s
  Total delta-V: 3.415 km/s
  Transfer time: 178.48 minutes

LEO to ISS-like:
  First burn: 28.7 m/s
  Second burn: 28.5 m/s
  Total delta-V: 0.057 km/s
  Transfer time: 45.77 minutes
```
