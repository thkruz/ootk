# Orbit Determination Algorithms

This module provides Initial Orbit Determination (IOD) and Orbit Determination (OD) algorithms for computing satellite orbits from observations.

## Algorithm Overview

| Algorithm | Input Type | Observations | Use Case |
|-----------|------------|--------------|----------|
| **GibbsIOD** | 3 positions | Position vectors | Radar tracking, widely-spaced positions |
| **HerrickGibbsIOD** | 3 positions + times | Position vectors | Radar tracking, closely-spaced positions |
| **LambertIOD** | 2 positions + times | Position vectors | Transfer orbits, rendezvous planning |
| **GaussIOD** (internal) | 3 angles | Optical (RA/Dec) | Seeds GoodingIOD and ModifiedGoodingIOD; not exported |
| **GoodingIOD** | 3 angles | Optical (RA/Dec) | Telescope observations with range iteration |
| **ModifiedGoodingIOD** | 3+ angles | Optical (RA/Dec) | Multi-observation optical refinement |
| **BatchLeastSquaresOD** | N observations | Optical or Radar | Orbit refinement from many observations |
| **LevenbergMarquardtOD** | N observations | Optical or Radar | Robust orbit refinement |

---

## Position-Based IOD Methods

These methods require inertial (J2000) position vectors in km (for example from radar range plus angles). The examples below take positions from an SGP4 propagation of the ISS, so the recovered velocity differs from the SGP4 velocity by the perturbations two-body IOD ignores.

### GibbsIOD

Determines an orbit from three position vectors. The classic geometric method.

**Pros:**
- Simple, fast, closed-form solution
- No iterative convergence required
- Works well with widely-spaced positions (>5 degrees apart)
- Includes velocity direction ambiguity resolution

**Cons:**
- Requires coplanar positions (throws `OrbitDeterminationError` if position 1 is more than 5 degrees out of the plane of positions 2 and 3, or if 2 and 3 are collinear)
- Accuracy degrades for closely-spaced positions
- Needs position vectors, not angles-only observations

**When to Use:**
- Radar tracking with range measurements
- Position vectors spaced 10-45 degrees apart in true anomaly
- Quick initial estimate before refinement

**Example:**
```typescript
import { EpochUTC, GibbsIOD, Seconds, Sgp4Propagator, Tle } from 'ootk';

const tle = new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
);
const truth = new Sgp4Propagator(tle);

// Three J2000 positions (km) 10 minutes apart (about 39 deg of arc)
const t1 = tle.epoch;
const t2 = t1.roll(600 as Seconds);
const t3 = t1.roll(1200 as Seconds);
const [r1, r2, r3] = [t1, t2, t3].map((t) => truth.propagate(t).position);

const iod = new GibbsIOD();
const state = iod.solve(r1, r2, r3, t2, t3); // J2000 state at t2; throws if not coplanar within 5 deg

console.log(state.velocity.subtract(truth.propagate(t2).velocity).magnitude()); // velocity error, km/s
```

---

### HerrickGibbsIOD

An improved method for closely-spaced position vectors using Taylor series expansion.

**Pros:**
- Better accuracy than Gibbs for positions <5 degrees apart
- Simple, non-iterative computation
- No coplanarity check (more forgiving)
- Uses time information for velocity estimation

**Cons:**
- Accuracy can degrade for very widely-spaced positions
- Still requires position vectors (not angles-only)
- May be less stable for highly eccentric orbits

**When to Use:**
- Short observation arcs (seconds to minutes)
- Positions separated by <5 degrees in true anomaly
- High-rate radar tracking data

**Example:**
```typescript
import { HerrickGibbsIOD, Seconds, Sgp4Propagator, Tle } from 'ootk';

const tle = new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
);
const truth = new Sgp4Propagator(tle);

// Three J2000 positions (km) 30 s apart (about 2 deg of arc)
const t1 = tle.epoch;
const t2 = t1.roll(30 as Seconds);
const t3 = t1.roll(60 as Seconds);
const [r1, r2, r3] = [t1, t2, t3].map((t) => truth.propagate(t).position);

const iod = new HerrickGibbsIOD();
const state = iod.solve(r1, t1, r2, t2, r3, t3); // J2000 state at t2

console.log(state.velocity.subtract(truth.propagate(t2).velocity).magnitude()); // velocity error, km/s
```

---

### LambertIOD

Solves Lambert's problem: find the orbit connecting two positions given time of flight.

**Pros:**
- Only needs 2 positions (fewer observations required)
- Supports multiple revolution solutions
- Fundamental to transfer orbit design
- Well-understood numerical properties

**Cons:**
- Near-180 degree transfers are numerically challenging
- May return `null` if no solution exists
- Doesn't directly handle angles-only observations

**When to Use:**
- Transfer orbit calculations
- Rendezvous and intercept planning
- When only 2 position fixes are available
- Orbital maneuver design

**Example:**
```typescript
import { LambertIOD, Seconds, Sgp4Propagator, Tle } from 'ootk';

const tle = new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
);
const truth = new Sgp4Propagator(tle);

const t1 = tle.epoch;
const t2 = t1.roll(1800 as Seconds); // about 116 deg of arc later
const p1 = truth.propagate(t1).position;
const p2 = truth.propagate(t2).position;

const iod = new LambertIOD();
// shortWay: true sweeps the transfer angle below 180 deg, false the long way (named posigrade before v8).
// For nRev >= 1 the sign of nRev selects one of the two multi-revolution solutions.
const state = iod.estimate(p1, p2, t1, t2, { shortWay: true, nRev: 0 });
// J2000 state at t1, or null if no solution

console.log(state?.velocity.subtract(truth.propagate(t1).velocity).magnitude()); // velocity error, km/s
```

---

## Angles-Only IOD Methods

These methods work with optical observations (topocentric right ascension / declination, `ObservationOptical` built from the site's J2000 state and a `RadecTopocentric`).

### GaussIOD

The classic angles-only method using an 8th-order polynomial solver.

**Pros:**
- Works with optical observations (no range needed)
- Well-documented, textbook algorithm (Vallado Example 7-2)
- Uses canonical units for numerical stability

**Cons:**
- Requires minimum 10-second spacing between observations
- Polynomial root-finding can be sensitive
- Returns `null` when the observations are less than 10 s apart or the range polynomial has no unique
  positive root (it never substitutes a default radius)

**When to Use:**
- Telescope observations of unknown objects
- Space surveillance with angles-only sensors
- Quick initial orbit from optical data

**Example:**
GaussIOD is not exported from the `ootk` entry point in v8; it is used internally to seed GoodingIOD and ModifiedGoodingIOD, so call one of those for angles-only work. Its contract: `estimate(o1, o2, o3)` returns the J2000 state at `o2`, or `null` (see Cons).

---

### GoodingIOD

Iterative angles-only method with range estimation using Newton-Raphson.

**Pros:**
- More robust than Gauss for some geometries
- Uses Lambert solver internally for consistency
- `shortWay` (last argument) selects the short-way or long-way Lambert arc between the first and third
  observation; it does not select prograde vs retrograde motion

**Cons:**
- Seeds its range guesses from GaussIOD when none are given, so it fails where Gauss finds no root
- Iterative (slower than Gauss)
- May not converge for poor initial guesses

**When to Use:**
- When GaussIOD fails to converge
- When rough range estimates are available
- LEO/MEO/GEO classification is known

**Example:**
```typescript
import { Degrees, EpochUTC, GroundStation, Kilometers, ObservationOptical, RadecTopocentric, Seconds, Sgp4Propagator, Tle, GoodingIOD } from 'ootk';

const tle = new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
);
const truth = new Sgp4Propagator(tle);
const site = new GroundStation({ name: 'Cape Cod', lat: 41.754785 as Degrees, lon: -70.539151 as Degrees, alt: 0.060966 as Kilometers });

// Simulated topocentric RA/Dec of the ISS during a pass over the site, every 180 s
const start = EpochUTC.fromDateTime(new Date('2024-01-28T00:55:00Z'));
const observations = Array.from({ length: 3 }, (_, i) => {
  const epoch = start.roll((180 * i) as Seconds);
  const siteState = site.toJ2000(epoch.toDateTime());

  return new ObservationOptical(siteState, RadecTopocentric.fromStateVector(truth.propagate(epoch), siteState));
});
const [obs1, obs2, obs3] = observations;

const iod = new GoodingIOD();
// Slant-range guesses (km) for obs1 and obs3 are optional; without them GaussIOD seeds them
const state = iod.estimate(obs1, obs2, obs3); // J2000 state at obs2; throws if Gauss finds no seed

console.log(state.position.subtract(truth.propagate(obs2.epoch).position).magnitude()); // position error, km
```

---

### ModifiedGoodingIOD

Extended Gooding method with Nelder-Mead optimization for 3+ observations.

**Pros:**
- Uses more observations for better accuracy
- Optimization-based refinement
- More robust than single-triplet methods

**Cons:**
- Slower due to optimization
- Range guesses are optional (seeded from GaussIOD); a poor seed may not converge
- More complex to configure (options object: `nRev`, `direction` for the short-way (true) or long-way Lambert arc, `posSearch`, `velSearch`, `tolerance`, `maxIter`)

**When to Use:**
- Multiple optical observations available (5-10+)
- Refinement of initial Gauss/Gooding estimate
- When accuracy matters more than speed

**Example:**
```typescript
import { Degrees, EpochUTC, GroundStation, Kilometers, ObservationOptical, RadecTopocentric, Seconds, Sgp4Propagator, Tle, ModifiedGoodingIOD } from 'ootk';

const tle = new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
);
const truth = new Sgp4Propagator(tle);
const site = new GroundStation({ name: 'Cape Cod', lat: 41.754785 as Degrees, lon: -70.539151 as Degrees, alt: 0.060966 as Kilometers });

// Simulated topocentric RA/Dec of the ISS during a pass over the site, every 60 s
const start = EpochUTC.fromDateTime(new Date('2024-01-28T00:55:00Z'));
const observations = Array.from({ length: 7 }, (_, i) => {
  const epoch = start.roll((60 * i) as Seconds);
  const siteState = site.toJ2000(epoch.toDateTime());

  return new ObservationOptical(siteState, RadecTopocentric.fromStateVector(truth.propagate(epoch), siteState));
});

const iod = new ModifiedGoodingIOD();
// Range guesses (km) for the first and last observation are optional (seeded from GaussIOD)
const state = iod.solve(observations); // J2000 state

console.log(state.position.subtract(truth.propagate(state.epoch).position).magnitude()); // position error, km
```

---

## Orbit Refinement Methods

These methods refine an initial orbit estimate using many observations.

### BatchLeastSquaresOD

Classical batch least squares using normal equations.

**Pros:**
- Processes all observations simultaneously
- Provides state covariance estimate
- Works with mixed observation types (optical + radar)
- Simple, well-understood algorithm

**Cons:**
- Requires good a priori estimate
- May not converge for large initial errors
- Less robust than Levenberg-Marquardt

**When to Use:**
- Refining IOD results with many observations
- When covariance information is needed
- Processing archived observation batches

**Example:**
```typescript
import {
  BatchLeastSquaresOD,
  Degrees,
  EpochUTC,
  GroundStation,
  J2000,
  Kilometers,
  KilometersPerSecond,
  ObservationRadar,
  RAE,
  Seconds,
  Sgp4Propagator,
  Tle,
  Vector3D,
} from 'ootk';

const tle = new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
);
const truth = new Sgp4Propagator(tle);
const site = new GroundStation({ name: 'Cape Cod', lat: 41.754785 as Degrees, lon: -70.539151 as Degrees, alt: 0.060966 as Kilometers });

// Simulated range/azimuth/elevation of the ISS during a pass over the site, every 30 s for 10 minutes
const start = EpochUTC.fromDateTime(new Date('2024-01-28T00:54:00Z'));
const observations = Array.from({ length: 21 }, (_, i) => {
  const epoch = start.roll((30 * i) as Seconds);
  const siteState = site.toJ2000(epoch.toDateTime());

  return new ObservationRadar(siteState, RAE.fromStateVector(truth.propagate(epoch), siteState));
});

// A priori state at the first observation: truth displaced by 5 km and 5 m/s
const t0 = truth.propagate(start);
const aprioriState = new J2000(
  start,
  t0.position.add(new Vector3D(5 as Kilometers, 0 as Kilometers, 0 as Kilometers)),
  t0.velocity.add(new Vector3D(0 as KilometersPerSecond, 0.005 as KilometersPerSecond, 0 as KilometersPerSecond)),
);

// Default force model is two-body (ForceModel().setGravity()); pass one as the third argument for more
const blsOd = new BatchLeastSquaresOD(observations, aprioriState);
const result = blsOd.solve({ tolerance: 1e-3, maxIter: 100 }); // tolerance on the change in weighted RMS
// result.state (J2000 at the first observation epoch), result.covariance, result.rms, result.converged
// solve() throws SingularMatrixError when the observations do not determine all six state components

console.log(result.converged, result.rms, result.state.position.subtract(t0.position).magnitude());
```

---

### LevenbergMarquardtOD

Damped least squares with adaptive step control.

**Pros:**
- More robust than batch least squares
- Adaptive damping prevents divergence
- Handles larger initial errors
- Returns convergence status (`result.converged`, as does BatchLeastSquaresOD since v8)

**Cons:**
- Slightly slower per iteration
- May take more iterations to converge
- Damping parameter tuning can affect performance

**When to Use:**
- When BatchLeastSquaresOD fails to converge
- Larger initial state errors (10-50+ km)
- Operational orbit determination

**Example:**
```typescript
import {
  LevenbergMarquardtOD,
  Degrees,
  EpochUTC,
  GroundStation,
  J2000,
  Kilometers,
  KilometersPerSecond,
  ObservationRadar,
  RAE,
  Seconds,
  Sgp4Propagator,
  Tle,
  Vector3D,
} from 'ootk';

const tle = new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
);
const truth = new Sgp4Propagator(tle);
const site = new GroundStation({ name: 'Cape Cod', lat: 41.754785 as Degrees, lon: -70.539151 as Degrees, alt: 0.060966 as Kilometers });

// Simulated range/azimuth/elevation of the ISS during a pass over the site, every 30 s for 10 minutes
const start = EpochUTC.fromDateTime(new Date('2024-01-28T00:54:00Z'));
const observations = Array.from({ length: 21 }, (_, i) => {
  const epoch = start.roll((30 * i) as Seconds);
  const siteState = site.toJ2000(epoch.toDateTime());

  return new ObservationRadar(siteState, RAE.fromStateVector(truth.propagate(epoch), siteState));
});

// A priori state at the first observation: truth displaced by 5 km and 5 m/s
const t0 = truth.propagate(start);
const aprioriState = new J2000(
  start,
  t0.position.add(new Vector3D(5 as Kilometers, 0 as Kilometers, 0 as Kilometers)),
  t0.velocity.add(new Vector3D(0 as KilometersPerSecond, 0.005 as KilometersPerSecond, 0 as KilometersPerSecond)),
);

// Default force model is two-body (ForceModel().setGravity()); pass one as the third argument for more
const lmOd = new LevenbergMarquardtOD(observations, aprioriState);
const result = lmOd.solve({ epsilon: 1e-6, maxIterations: 50 });
// result.state (J2000 at the first observation epoch), result.covariance, result.rms, result.converged
// solve() throws SingularMatrixError when the observations do not determine all six state components

console.log(result.converged, result.rms, result.state.position.subtract(t0.position).magnitude());
```

---

## Decision Guide

```
START
  |
  v
Do you have position vectors (from radar)?
  |
  +-- YES --> How many positions?
  |             |
  |             +-- 2 positions --> LambertIOD
  |             |
  |             +-- 3 positions --> Are they closely spaced (<5 deg)?
  |                                   |
  |                                   +-- YES --> HerrickGibbsIOD
  |                                   |
  |                                   +-- NO --> GibbsIOD
  |
  +-- NO --> Do you have angles-only observations?
              |
              +-- YES --> How many observations?
              |             |
              |             +-- 3 observations --> GoodingIOD (seeded by Gauss)
              |             |
              |             +-- 4+ observations --> ModifiedGoodingIOD
              |
              +-- Need to refine an initial estimate?
                    |
                    +-- YES --> Is the initial estimate good (<10 km)?
                                  |
                                  +-- YES --> BatchLeastSquaresOD
                                  |
                                  +-- NO --> LevenbergMarquardtOD
```

---

## Developer Notes

### Numerical Stability

1. **Tolerance Selection**: Start with looser tolerances (1e-3) and tighten if needed. Too-tight tolerances can cause unnecessary iterations or convergence failures.

2. **Time Intervals**:
   - LEO: 20-60 second spacing works well
   - MEO: 2-5 minute spacing
   - GEO: 5-10 minute spacing

3. **Eccentric Orbits**: All methods have reduced accuracy for e > 0.3. Consider using more observations and looser tolerances.

### Common Pitfalls

1. **GibbsIOD Coplanarity Error**: If you get "Orbits are not coplanar", your positions may have measurement errors or be from different orbital planes. Try HerrickGibbsIOD instead.

2. **LambertIOD Returns Null**: This usually means:
   - Positions are too close (near-zero transfer)
   - Near-180 degree transfer (numerical singularity)
   - Time of flight is incompatible with orbital mechanics

3. **GoodingIOD Throws "Gauss IOD failed"**: the internal Gauss seed returned null. Check that observations are:
   - At least 10 seconds apart
   - From the same object
   - Have sufficient angular separation

4. **BatchLeastSquaresOD Divergence**: If RMS increases instead of decreasing:
   - A priori estimate is too far from truth (use LevenbergMarquardtOD)
   - Observations have outliers
   - Force model mismatch (pass a `ForceModel` as the third constructor argument; the default is two-body)

5. **SingularMatrixError from BatchLeastSquaresOD / LevenbergMarquardtOD**: since v8 `Matrix.inverse` throws on a singular normal matrix instead of returning garbage, and both solvers let it propagate. It means the observations do not determine all six state components (too few, or angles-only data over too short an arc). Catch it, or add observations.

6. **Epoch Conventions**:
   - GibbsIOD returns state at **t2** (middle position)
   - HerrickGibbsIOD returns state at **t2** (middle position)
   - LambertIOD returns state at **t1** (first position)
   - GoodingIOD returns state at the **second (middle) observation**
   - BatchLeastSquaresOD and LevenbergMarquardtOD return state at the **first observation epoch**

### Testing Your Implementation

When validating IOD results:

1. **Position Accuracy**: IOD methods typically achieve 0.1-5 km accuracy depending on observation quality
2. **Velocity Accuracy**: Expect 0.001-0.01 km/s for good geometry, up to 0.1 km/s for challenging cases
3. **Orbital Elements**: Check semimajor axis (a), eccentricity (e), and inclination (i) match expected values

### Performance Tips

1. **Use KeplerPropagator** for testing: It's fast and eliminates force model complexity
2. **fastDerivatives** (sixth constructor argument of BatchLeastSquaresOD and LevenbergMarquardtOD) uses Kepler for the Jacobian (faster, slightly less accurate)
3. **Observation order**: BatchLeastSquaresOD and LevenbergMarquardtOD sort a copy of the observations by epoch; the caller's array is not modified

---

## References

- Vallado, D.A., *Fundamentals of Astrodynamics and Applications*, 4th ed., 2013
- Gooding, R.H., "A New Procedure for Orbit Determination Based on Three Lines of Sight", Technical Report 93004, 1993
- Curtis, H.D., *Orbital Mechanics for Engineering Students*, 3rd ed., 2014
