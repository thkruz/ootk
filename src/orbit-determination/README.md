# Orbit Determination Algorithms

This module provides Initial Orbit Determination (IOD) and Orbit Determination (OD) algorithms for computing satellite orbits from observations.

## Algorithm Overview

| Algorithm | Input Type | Observations | Use Case |
|-----------|------------|--------------|----------|
| **GibbsIOD** | 3 positions | Position vectors | Radar tracking, widely-spaced positions |
| **HerrickGibbsIOD** | 3 positions + times | Position vectors | Radar tracking, closely-spaced positions |
| **LambertIOD** | 2 positions + times | Position vectors | Transfer orbits, rendezvous planning |
| **GaussIOD** | 3 angles | Optical (RA/Dec) | Telescope observations |
| **GoodingIOD** | 3 angles | Optical (RA/Dec) | Telescope observations with range iteration |
| **ModifiedGoodingIOD** | 3+ angles | Optical (RA/Dec) | Multi-observation optical refinement |
| **BatchLeastSquaresOD** | N observations | Optical or Radar | Orbit refinement from many observations |
| **LevenbergMarquardtOD** | N observations | Optical or Radar | Robust orbit refinement |

---

## Position-Based IOD Methods

These methods require inertial position vectors (e.g., from radar range + angles).

### GibbsIOD

Determines an orbit from three position vectors. The classic geometric method.

**Pros:**
- Simple, fast, closed-form solution
- No iterative convergence required
- Works well with widely-spaced positions (>5 degrees apart)
- Includes velocity direction ambiguity resolution

**Cons:**
- Requires coplanar positions (throws error if >5 degrees out of plane)
- Accuracy degrades for closely-spaced positions
- Needs position vectors, not angles-only observations

**When to Use:**
- Radar tracking with range measurements
- Position vectors spaced 10-45 degrees apart in true anomaly
- Quick initial estimate before refinement

**Example:**
```typescript
const iod = new GibbsIOD();
const state = iod.solve(r1, r2, r3, t2, t3); // Returns state at t2
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
const iod = new HerrickGibbsIOD();
const state = iod.solve(r1, t1, r2, t2, r3, t3); // Returns state at t2
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
const iod = new LambertIOD();
const state = iod.estimate(p1, p2, t1, t2, { posigrade: true, nRev: 0 });
// Returns state at t1, or null if no solution
```

---

## Angles-Only IOD Methods

These methods work with optical observations (Right Ascension / Declination).

### GaussIOD

The classic angles-only method using an 8th-order polynomial solver.

**Pros:**
- Works with optical observations (no range needed)
- Well-documented, textbook algorithm (Vallado Example 7-2)
- Uses canonical units for numerical stability

**Cons:**
- Requires minimum 10-second spacing between observations
- Polynomial root-finding can be sensitive
- May return `null` for poor observation geometry

**When to Use:**
- Telescope observations of unknown objects
- Space surveillance with angles-only sensors
- Quick initial orbit from optical data

**Example:**
```typescript
const iod = new GaussIOD();
const state = iod.estimate(obs1, obs2, obs3);
```

---

### GoodingIOD

Iterative angles-only method with range estimation using Newton-Raphson.

**Pros:**
- More robust than Gauss for some geometries
- Uses Lambert solver internally for consistency
- Supports retrograde orbit detection

**Cons:**
- Requires initial range estimates
- Iterative (slower than Gauss)
- May not converge for poor initial guesses

**When to Use:**
- When GaussIOD fails to converge
- When rough range estimates are available
- LEO/MEO/GEO classification is known

**Example:**
```typescript
const iod = new GoodingIOD();
const state = iod.estimate(obs1, obs2, obs3, rho1init, rho3init);
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
- Requires good initial range estimates
- More complex to configure

**When to Use:**
- Multiple optical observations available (5-10+)
- Refinement of initial Gauss/Gooding estimate
- When accuracy matters more than speed

**Example:**
```typescript
const iod = new ModifiedGoodingIOD();
const state = iod.solve(observations, rho1init, rho3init);
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
const blsOd = new BatchLeastSquaresOD(observations, aprioriState);
const result = blsOd.solve({ tolerance: 1e-6, maxIter: 100 });
// result.state, result.covariance, result.rms
```

---

### LevenbergMarquardtOD

Damped least squares with adaptive step control.

**Pros:**
- More robust than batch least squares
- Adaptive damping prevents divergence
- Handles larger initial errors
- Returns convergence status

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
const lmOd = new LevenbergMarquardtOD(observations, aprioriState);
const result = lmOd.solve({ tolerance: 1e-6, maxIter: 100 });
// result.state, result.covariance, result.rms, result.converged
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
              |             +-- 3 observations --> GaussIOD (try first)
              |             |                      or GoodingIOD
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

3. **GaussIOD Returns Null**: Check that observations are:
   - At least 10 seconds apart
   - From the same object
   - Have sufficient angular separation

4. **BatchLeastSquaresOD Divergence**: If RMS increases instead of decreasing:
   - A priori estimate is too far from truth (use LevenbergMarquardtOD)
   - Observations have outliers
   - Force model mismatch (use `fastDerivatives: true` for Kepler-only)

5. **Epoch Conventions**:
   - GibbsIOD returns state at **t2** (middle position)
   - HerrickGibbsIOD returns state at **t2** (middle position)
   - LambertIOD returns state at **t1** (first position)
   - BatchLeastSquaresOD returns state at **first observation epoch**

### Testing Your Implementation

When validating IOD results:

1. **Position Accuracy**: IOD methods typically achieve 0.1-5 km accuracy depending on observation quality
2. **Velocity Accuracy**: Expect 0.001-0.01 km/s for good geometry, up to 0.1 km/s for challenging cases
3. **Orbital Elements**: Check semimajor axis (a), eccentricity (e), and inclination (i) match expected values

### Performance Tips

1. **Use KeplerPropagator** for testing: It's fast and eliminates force model complexity
2. **fastDerivatives flag** in BatchLeastSquaresOD uses Kepler for Jacobian computation (faster, slightly less accurate)
3. **Batch observations first**: Sort by epoch before passing to OD methods

---

## References

- Vallado, D.A., *Fundamentals of Astrodynamics and Applications*, 4th ed., 2013
- Gooding, R.H., "A New Procedure for Orbit Determination Based on Three Lines of Sight", Technical Report 93004, 1993
- Curtis, H.D., *Orbital Mechanics for Engineering Students*, 3rd ed., 2014
