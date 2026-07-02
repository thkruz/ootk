# Gooding IOD

This example runs angles-only initial orbit determination with the Gooding method: three optical right ascension/declination observations plus initial slant-range guesses are enough to recover a full state vector. This is the workflow for telescopes and other passive sensors that measure direction but not range.

<<< ../../examples/gooding-iod.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/gooding-iod.ts
```

## Setup Site

Angles-only observations carry no range information, so the solver needs the observer's inertial position at every observation epoch. A `GroundObject` holds the geodetic site and its `toJ2000(date)` method returns the site's J2000 state at any time.

<<< ../../examples/gooding-iod.ts#setup-site

## Setup Observations

Each `ObservationOptical` pairs the site's J2000 state at the observation time with a `RadecTopocentric` built via `fromDegrees(epoch, ra, dec)`. The three observations span two hours, long enough for the target's motion to show up in the RA/Dec values.

<<< ../../examples/gooding-iod.ts#setup-observations

## Solve Gooding

`GoodingIOD` is constructed with an optional gravitational parameter (defaults to Earth's mu). `solve(o1, o2, o3, r1Init, r3Init)` takes the three observations plus initial slant-range guesses for the first and third; it iterates the ranges until the implied positions are Keplerian-consistent and returns a `J2000` state at the middle observation epoch. If you have no range estimate at all, `estimate(o1, o2, o3)` bootstraps the ranges with Gauss IOD internally.

<<< ../../examples/gooding-iod.ts#solve-gooding

## Results

The solved `J2000` state converts to TEME with `toTEME()` and to Keplerian elements with `toClassicalElements()` (element angles are stored in radians). With only three synthetic observations and coarse range guesses, the recovered orbit is a loose fit; real applications refine it with more observations and a batch least squares pass.

<<< ../../examples/gooding-iod.ts#results

## Output

Observation dates are constructed in local time, so exact values differ per machine timezone.

```txt
Observation 1: 2025-11-22T07:00:00.000Z RA 333.38 deg, Dec -6.24 deg
Observation 2: 2025-11-22T08:00:00.000Z RA 334.12 deg, Dec -5.87 deg
Observation 3: 2025-11-22T09:00:00.000Z RA 334.89 deg, Dec -5.51 deg

Solved State Vector (TEME) at middle observation epoch:
  Epoch: 2025-11-22T08:00:00.000Z
  Position: [261029.45, -121146.91, -25021.18] km
  Velocity: [0.798135, 0.522975, 0.447411] km/s

Classical Orbital Elements:
  Semi-major axis: 241702.57 km
  Eccentricity: 0.473120
  Inclination: 31.4378 deg
  Right Ascension: 343.1596 deg
  Arg of Perigee: 212.3778 deg
  True Anomaly: 137.8107 deg
  Period: 19709.77 minutes
```
