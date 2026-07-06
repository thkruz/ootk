# Lambert State Vectors

This example uses `LambertIOD` to solve Lambert's problem: given two position vectors and the time of flight between them, recover the full state vector (position plus velocity) with no SGP4 or TLE involved. That state can then feed numerical propagation, TLE generation, transfer planning, and multi-revolution trade studies.

<<< ../../examples/lambert-state-vector.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/lambert-state-vector.ts
```

## Basic Lambert

`lambert.estimate(p1, p2, t1, t2, options)` returns a `J2000` state at `t1`, or `undefined` when no solution converges, so always check the result. `toClassicalElements()` converts the state to orbital elements; the `*Degrees` getters avoid manual radian conversion and `period` is already in minutes.

<<< ../../examples/lambert-state-vector.ts#basic-lambert

## Lambert with propagator

The Lambert-derived `J2000` state can seed `RungeKutta89Propagator` for high-precision numerical propagation, bypassing SGP4 entirely. `propagate(epoch)` integrates from the cached state to the requested epoch.

<<< ../../examples/lambert-state-vector.ts#lambert-with-propagator

## Lambert to Satellite

`Tle.fromClassicalElements(elements)` fits a TLE to the solution, which can then construct a `Satellite` object and use its convenience methods such as `lla(date)`. Note that this treats osculating elements as mean elements, so SGP4 positions from the generated TLE will not exactly match the Lambert state.

<<< ../../examples/lambert-state-vector.ts#lambert-to-satellite

## Transfer orbit planning

Lambert's problem is the general form of transfer planning: fix the departure and arrival positions and the time of flight, and the solution's departure velocity minus the current orbital velocity is the first burn's delta-V vector.

<<< ../../examples/lambert-state-vector.ts#transfer-orbit-planning

## Multi revolution

For long flight times the transfer can complete whole revolutions before arrival. The `nRev` option selects the number of complete revolutions; higher `nRev` solutions here need less departure velocity at the cost of a more constrained geometry.

<<< ../../examples/lambert-state-vector.ts#multi-revolution

## Short vs long path

The `posigrade` flag chooses which way around the central body the transfer sweeps. Between nearly opposite points the two paths converge toward the same half-orbit geometry, so their delta-V difference is small.

<<< ../../examples/lambert-state-vector.ts#short-vs-long-path

## Validation

`estimate()` returning `undefined` is the failure signal, but a returned solution can still be physically useless: very short flight times force hyperbolic-scale velocities, and the resulting ellipse may dip below the Earth's surface. Check perigee radius and eccentricity before trusting a solution.

<<< ../../examples/lambert-state-vector.ts#validation

## Run all

<<< ../../examples/lambert-state-vector.ts#run-all

## Output

```txt
Lambert State Vector Generation Examples
Generating state vectors without SGP4/TLE

=== Example 1: Basic Lambert Solution ===

State Vector at t1:
  Epoch: 2024-01-01T12:00:00.000Z
  Position (km): { x: '6778.137', y: '0.000', z: '0.000' }
  Velocity (km/s): { x: '5.696659', y: '5.710923', z: '1.338498' }

Classical Orbital Elements:
  Semi-major axis: 7853.355 km
  Eccentricity: 0.703585
  Inclination: 13.191 deg
  RAAN: 0.000 deg
  Arg of Perigee: 233.862 deg
  True Anomaly: 126.138 deg
  Period: 115.44 minutes
  Apogee altitude: 7000.717 km
  Perigee altitude: -4050.281 km

=== Example 2: Lambert + Numerical Propagator ===

Initial state from Lambert:
  Position magnitude: 7000.000 km
  Velocity magnitude: 7.928951 km/s

State after 1 day propagation (RK89):
  Position (km): { x: '6488.321', y: '10781.861', z: '0.000' }
  Velocity (km/s): { x: '-3.498089', y: '-0.313370', z: '0.000000' }

Orbit completed 12.57 revolutions in 1 day

=== Example 3: Lambert to Satellite Conversion ===

Classical Elements from Lambert:
  a: 7775.497 km
  e: 0.774509
  i: 0.000 deg

Generated TLE:
  Line 1: 1 00001U 58001A   24001.00000000  .00000000  00000+0  00000+0 0  9990
  Line 2: 2 00001   0.0000   0.0000 7745093 225.0000  37.5498 12.66223876    06

Satellite created from Lambert solution:
  Name: Lambert-Derived Satellite
  Inclination: 0.000 deg
  Period: 113.72 minutes
  Apogee: 7426.696 km
  Perigee: -4617.697 km

... (truncated)

=== Example 6: Short Path vs Long Path ===

Transfer between nearly opposite points:

Short Path Transfer:
  Velocity: 8.435877 km/s
  Semi-major axis: 9330.136 km
  Eccentricity: 0.523382

Long Path Transfer:
  Velocity: 8.435857 km/s
  Semi-major axis: 9330.065 km
  Eccentricity: 0.469926

Difference:
  Delta-V difference: 0.02 m/s

=== Example 7: Validation and Error Checking ===

Test 1: Valid transfer
  [ok] Solution found
  Velocity: 7.928951 km/s

Test 2: Very short time of flight (30 seconds)
  [ok] Solution found (hyperbolic velocity required)
  Velocity: 329.940694 km/s
Test 3: Positions very close together
  [ok] Solution found

Test 4: Solution validation
  Checking orbital parameters:
  [warn] WARNING: Orbit intersects Earth!
    Perigee radius: 1805.850 km
  [ok] Elliptical orbit (e < 1.0)

All examples completed!
```
