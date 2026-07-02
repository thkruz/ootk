# Numerical Integrators

This example propagates the ISS for 24 hours with two numerical integrators (fixed-step RungeKutta4 and adaptive RungeKutta89) driven by a configurable force model, and prints the SGP4 result at the same time for comparison. Reach for numerical propagation when SGP4's analytic mean-element theory is not accurate enough, or when you need to model specific perturbations.

<<< ../../examples/integrator.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/integrator.ts
```

## Setup Satellite

Build a `Satellite` from a TLE and define the propagation window. `sat.eci(stop)` is the SGP4 answer at the stop time (TEME frame), printed as a baseline. `sat.toJ2000(start)` converts the SGP4 state at the start time into the J2000 state that seeds the numerical integrators.

<<< ../../examples/integrator.ts#setup-satellite

## Force Model

`ForceModel` is a builder for the perturbations the integrator will evaluate. This one uses an 8x8 Earth geopotential, lunar and solar third-body gravity, solar radiation pressure, and atmospheric drag (both parameterized by mass in kg and cross-sectional area in m^2).

<<< ../../examples/integrator.ts#force-model

## RK4 Propagation

`RungeKutta4Propagator` is a classic fixed-step integrator. `propagate(epoch)` steps the seeded J2000 state to the requested `EpochUTC` under the configured force model.

<<< ../../examples/integrator.ts#rk4-propagation

## RK89 Propagation

`RungeKutta89Propagator` is a high-order adaptive-step integrator. After 24 hours the two integrators agree to a few meters, while both differ from SGP4 by a few hundred kilometers: expected, since SGP4 uses its own simplified force theory and the TLE encodes mean elements fitted for it.

<<< ../../examples/integrator.ts#rk89-propagation

## Output

```txt
SGP4 state at stop time (TEME):
{
  position: { x: -663.6938353817707, y: 6495.793093922628, z: 1874.733222146894 },
  velocity: {
    x: -5.086304552715983,
    y: 1.111360309899012,
    z: -5.625002780548332
  }
}

RungeKutta4 state after 24 hours (J2000):
_J2000 {
  epoch: _EpochUTC { posix: 1706504400 },
  position: _Vector3D {
    x: -964.313601162822,
    y: 6549.750969705299,
    z: 1490.1670220023666
  },
  velocity: _Vector3D {
    x: -5.028176395740335,
    y: 0.5772068247154211,
    z: -5.761952625767482
  }
}

RungeKutta89 state after 24 hours (J2000):
_J2000 {
  epoch: _EpochUTC { posix: 1706504400 },
  position: _Vector3D {
    x: -964.3094290875154,
    y: 6549.750581942014,
    z: 1490.1718512113523
  },
  velocity: _Vector3D {
    x: -5.028177380019933,
    y: 0.5772138007621341,
    z: -5.761950980723573
  }
}
```

The start and stop dates are constructed in local time, so the exact numbers depend on the machine's timezone.
