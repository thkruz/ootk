# Lambert Integration Guide: Generating State Vectors Without SGP4

This guide demonstrates how to use Lambert's problem solution to generate state vectors and integrate them with OOTK's orbit propagation capabilities, bypassing SGP4.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Lambert Solver Basics](#lambert-solver-basics)
4. [Integration Workflows](#integration-workflows)
5. [Complete Examples](#complete-examples)
6. [Advanced Usage](#advanced-usage)

---

## Overview

**Lambert's Problem** finds the orbit connecting two position vectors at specific times. This is useful for:

- Orbit determination from observation data
- Transfer orbit design
- Maneuver planning
- Rendezvous calculations
- Generating state vectors from position-only observations

### Key Classes

- **LambertIOD**: Solves Lambert's problem, returns J2000 state vectors
- **J2000**: ECI state vector (position + velocity)
- **ClassicalElements**: Orbital elements (a, e, i, Ω, ω, ν)
- **Satellite**: TLE-based satellite object (requires SGP4 data)
- **RungeKutta89Propagator**: High-precision numerical propagator

---

## Quick Start

### Installation

```bash
npm install ootk
```

### Basic Lambert Solution

```typescript
import { LambertIOD, EpochUTC, Vector3D, Kilometers } from 'ootk';

// Create Lambert solver (default: Earth's gravitational parameter)
const lambert = new LambertIOD();

// Define two positions in ECI coordinates (km)
const p1 = new Vector3D<Kilometers>(6778, 0, 0);
const p2 = new Vector3D<Kilometers>(0, 6778, 0);

// Define epochs
const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T01:30:00.000Z'));

// Solve Lambert's problem
const stateVector = lambert.estimate(p1, p2, t1, t2, {
  posigrade: true,  // Use short path
  nRev: 0           // Zero-revolution transfer
});

if (stateVector) {
  console.log('Position:', stateVector.position);
  console.log('Velocity:', stateVector.velocity);
  console.log('Epoch:', stateVector.epoch);
}
```

---

## Lambert Solver Basics

### Constructor

```typescript
const lambert = new LambertIOD(mu?: number);
```

**Parameters:**

- `mu`: Gravitational parameter (km³/s²)
  - Default: `Earth.mu` (398600.4418 km³/s²)
  - Moon: `Moon.mu` (4902.8 km³/s²)
  - Other bodies: Provide custom value

### Main Method: `estimate()`

```typescript
estimate(
  p1: Vector3D<Kilometers>,
  p2: Vector3D<Kilometers>,
  t1: EpochUTC,
  t2: EpochUTC,
  options?: { posigrade?: boolean; nRev?: number }
): J2000 | null
```

**Parameters:**

- `p1`, `p2`: Position vectors (km) in ECI/J2000 frame
- `t1`, `t2`: Epoch times (EpochUTC objects)
- `posigrade`:
  - `true` = short path (transfer angle < 180°)
  - `false` = long path (transfer angle > 180°)
- `nRev`: Number of complete revolutions (0, 1, 2, ...)

**Returns:**

- `J2000` state vector at epoch `t1` (null if solution fails)

### Understanding the Output

The returned `J2000` object contains:

```typescript
{
  epoch: EpochUTC,                           // Time of the state
  position: Vector3D<Kilometers>,            // Position (km)
  velocity: Vector3D<KilometersPerSecond>    // Velocity (km/s)
}
```

**Key Methods:**

```typescript
stateVector.toClassicalElements()  // Convert to orbital elements
stateVector.magnitude              // Position magnitude
stateVector.velocity.magnitude     // Speed
```

---

## Integration Workflows

### Workflow 1: Direct Use with Numerical Propagators (Recommended)

**Best for:** High-precision orbit propagation without TLE constraints

```typescript
import { LambertIOD, RungeKutta89Propagator, ForceModel, EpochUTC } from 'ootk';

// 1. Solve Lambert's problem
const lambert = new LambertIOD();
const j2000State = lambert.estimate(p1, p2, t1, t2);

if (!j2000State) {
  throw new Error('Lambert solution failed');
}

// 2. Set up force model for propagation
const forceModel = new ForceModel();
forceModel.setEarthGravity(8, 8);  // 8x8 gravity harmonics
forceModel.setAtmosphericDrag();   // Optional: add drag
forceModel.setSolarRadiationPressure();  // Optional: add SRP

// 3. Create propagator with Lambert-derived state
const propagator = new RungeKutta89Propagator(j2000State, forceModel);

// 4. Propagate to future epochs
const futureEpoch = EpochUTC.fromDateTime(new Date('2024-01-02T00:00:00.000Z'));
const futureState = propagator.propagate(futureEpoch);

console.log('Future position:', futureState.position);
console.log('Future velocity:', futureState.velocity);
```

**Advantages:**

- No TLE conversion artifacts
- Full control over perturbation forces
- Higher precision for short-term propagation
- Direct state vector manipulation

---

### Workflow 2: Convert to Satellite Object

**Best for:** Using Satellite class features (ground tracks, visibility, etc.)

```typescript
import {
  LambertIOD,
  ClassicalElements,
  Tle,
  Satellite
} from 'ootk';

// 1. Solve Lambert's problem
const lambert = new LambertIOD();
const j2000State = lambert.estimate(p1, p2, t1, t2);

if (!j2000State) {
  throw new Error('Lambert solution failed');
}

// 2. Convert to classical orbital elements
const elements = j2000State.toClassicalElements();

console.log('Semi-major axis:', elements.semimajorAxis, 'km');
console.log('Eccentricity:', elements.eccentricity);
console.log('Inclination:', elements.inclination, 'deg');

// 3. Generate TLE from classical elements
const tle = Tle.fromClassicalElements(elements);

// 4. Create Satellite object
const satellite = new Satellite({
  tle1: tle.line1,
  tle2: tle.line2,
  name: 'Lambert-derived Satellite'
});

// 5. Use Satellite methods
const futureState = satellite.toJ2000(new Date('2024-01-02T00:00:00.000Z'));
const lla = satellite.lla(new Date('2024-01-02T00:00:00.000Z'));

console.log('Latitude:', lla.lat, 'deg');
console.log('Longitude:', lla.lon, 'deg');
console.log('Altitude:', lla.alt, 'km');
```

**Note:** This workflow uses SGP4 for propagation after TLE conversion.

---

### Workflow 3: Hybrid Approach

**Best for:** Combining Lambert IOD with TLE-based satellites

```typescript
import { LambertIOD, Satellite, RungeKutta89Propagator, ForceModel } from 'ootk';

// Scenario: Plan a transfer from one satellite to another

// 1. Get current states from existing satellites
const satellite1 = new Satellite({ tle1, tle2 });
const satellite2 = new Satellite({ tle1: target_tle1, tle2: target_tle2 });

const currentDate = new Date();
const transferDate = new Date(currentDate.getTime() + 3600000); // +1 hour

const state1 = satellite1.toJ2000(currentDate);
const state2 = satellite2.toJ2000(transferDate);

// 2. Solve for transfer orbit using Lambert
const lambert = new LambertIOD();
const transferOrbit = lambert.estimate(
  state1.position,
  state2.position,
  state1.epoch,
  state2.epoch,
  { posigrade: true, nRev: 0 }
);

if (!transferOrbit) {
  throw new Error('No transfer solution found');
}

// 3. Calculate delta-V required
const deltaV1 = transferOrbit.velocity.subtract(state1.velocity);
console.log('Delta-V magnitude:', deltaV1.magnitude, 'km/s');

// 4. Propagate transfer orbit with high precision
const forceModel = new ForceModel();
forceModel.setEarthGravity(20, 20);
const propagator = new RungeKutta89Propagator(transferOrbit, forceModel);

const arrivalState = propagator.propagate(state2.epoch);
const deltaV2 = state2.velocity.subtract(arrivalState.velocity);

console.log('Arrival delta-V:', deltaV2.magnitude, 'km/s');
console.log('Total delta-V:', deltaV1.magnitude + deltaV2.magnitude, 'km/s');
```

---

## Complete Examples

### Example 1: Orbit Determination from Two Observations

```typescript
import {
  LambertIOD,
  EpochUTC,
  Vector3D,
  Kilometers,
  ClassicalElements
} from 'ootk';

// Observation data from radar/optical tracking
const observation1 = {
  time: new Date('2024-01-01T12:00:00.000Z'),
  position: new Vector3D<Kilometers>(6778.137, 0.0, 0.0)  // ECI coordinates
};

const observation2 = {
  time: new Date('2024-01-01T13:30:00.000Z'),
  position: new Vector3D<Kilometers>(-2000.0, 6400.0, 1500.0)
};

// Convert times to EpochUTC
const epoch1 = EpochUTC.fromDateTime(observation1.time);
const epoch2 = EpochUTC.fromDateTime(observation2.time);

// Solve for the orbit
const lambert = new LambertIOD();
const orbit = lambert.estimate(
  observation1.position,
  observation2.position,
  epoch1,
  epoch2,
  { posigrade: true, nRev: 0 }
);

if (orbit) {
  // Extract orbital elements
  const elements = orbit.toClassicalElements();

  console.log('=== Determined Orbit ===');
  console.log('Epoch:', orbit.epoch.toISOString());
  console.log('Position (km):', orbit.position.x, orbit.position.y, orbit.position.z);
  console.log('Velocity (km/s):', orbit.velocity.x, orbit.velocity.y, orbit.velocity.z);
  console.log('\n=== Classical Elements ===');
  console.log('Semi-major axis:', elements.semimajorAxis.toFixed(3), 'km');
  console.log('Eccentricity:', elements.eccentricity.toFixed(6));
  console.log('Inclination:', elements.inclination.toFixed(3), 'deg');
  console.log('RAAN:', elements.rightAscension.toFixed(3), 'deg');
  console.log('Arg of Perigee:', elements.argOfPerigee.toFixed(3), 'deg');
  console.log('True Anomaly:', elements.trueAnomaly.toFixed(3), 'deg');

  // Calculate orbital period
  const period = elements.period;
  console.log('Orbital Period:', (period / 60).toFixed(2), 'minutes');
} else {
  console.error('Lambert solution failed - check input geometry');
}
```

### Example 2: Multi-Revolution Transfer

```typescript
import { LambertIOD, EpochUTC, Vector3D, Kilometers } from 'ootk';

// LEO to GEO transfer with one complete revolution
const leoPosition = new Vector3D<Kilometers>(6778, 0, 0);  // ~400 km altitude
const geoPosition = new Vector3D<Kilometers>(42164, 0, 0);  // GEO altitude

const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T12:00:00.000Z'));

const lambert = new LambertIOD();

// Compare different revolution options
for (let nRev = 0; nRev <= 2; nRev++) {
  const solution = lambert.estimate(leoPosition, geoPosition, t1, t2, {
    posigrade: true,
    nRev
  });

  if (solution) {
    const elements = solution.toClassicalElements();
    console.log(`\n=== ${nRev}-Revolution Transfer ===`);
    console.log('Departure V:', solution.velocity.magnitude.toFixed(3), 'km/s');
    console.log('Semi-major axis:', elements.semimajorAxis.toFixed(1), 'km');
    console.log('Eccentricity:', elements.eccentricity.toFixed(4));
  }
}
```

### Example 3: Rendezvous Planning with Time Window

```typescript
import {
  LambertIOD,
  Satellite,
  EpochUTC,
  Vector3D,
  Kilometers,
  KilometersPerSecond
} from 'ootk';

// ISS TLE (example - use current TLE in practice)
const iss = new Satellite({
  name: 'ISS',
  tle1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9005',
  tle2: '2 25544  51.6400 208.9163 0006317  69.9862  25.2906 15.54225995  67973'
});

// Chaser spacecraft initial state
const chaserStart = new Date('2024-01-01T00:00:00.000Z');
const chaserState = new Vector3D<Kilometers>(6778, 100, 50);  // Slightly offset
const chaserVelocity = new Vector3D<KilometersPerSecond>(0, 7.5, 0.1);

// Find optimal transfer time (test multiple windows)
const lambert = new LambertIOD();
const transferTimes = [1800, 3600, 5400, 7200];  // 30, 60, 90, 120 minutes

let bestSolution = null;
let minDeltaV = Infinity;

for (const dt of transferTimes) {
  const rendezvousTime = new Date(chaserStart.getTime() + dt * 1000);
  const issState = iss.toJ2000(rendezvousTime);

  const solution = lambert.estimate(
    chaserState,
    issState.position,
    EpochUTC.fromDateTime(chaserStart),
    issState.epoch,
    { posigrade: true, nRev: 0 }
  );

  if (solution) {
    const deltaV = solution.velocity.subtract(chaserVelocity).magnitude;

    console.log(`Transfer time: ${dt/60} min, Delta-V: ${deltaV.toFixed(3)} km/s`);

    if (deltaV < minDeltaV) {
      minDeltaV = deltaV;
      bestSolution = { solution, dt, issState };
    }
  }
}

if (bestSolution) {
  console.log(`\n=== Optimal Rendezvous ===`);
  console.log('Transfer time:', bestSolution.dt / 60, 'minutes');
  console.log('Required delta-V:', minDeltaV.toFixed(3), 'km/s');
  console.log('Intercept position:', bestSolution.issState.position);
}
```

### Example 4: Moon Transfer Trajectory

```typescript
import { LambertIOD, EpochUTC, Vector3D, Kilometers, Moon } from 'ootk';

// Use Moon's gravitational parameter for cislunar trajectory
const lambert = new LambertIOD(Moon.mu);

// Earth-Moon transfer positions (simplified)
const earthDeparture = new Vector3D<Kilometers>(6778, 0, 0);      // LEO
const moonArrival = new Vector3D<Kilometers>(384400, 0, 0);        // ~Moon distance

const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
const t2 = EpochUTC.fromDateTime(new Date('2024-01-04T00:00:00.000Z'));  // 3-day transfer

const solution = lambert.estimate(earthDeparture, moonArrival, t1, t2, {
  posigrade: true,
  nRev: 0
});

if (solution) {
  const elements = solution.toClassicalElements();

  console.log('=== Trans-Lunar Injection ===');
  console.log('Departure velocity:', solution.velocity.magnitude.toFixed(3), 'km/s');
  console.log('Escape velocity at LEO:', (Math.sqrt(2 * 398600.4418 / 6778)).toFixed(3), 'km/s');
  console.log('Transfer orbit apogee:',
    (elements.semimajorAxis * (1 + elements.eccentricity)).toFixed(0), 'km');
}
```

---

## Advanced Usage

### Path Selection: Short vs Long

```typescript
import { LambertIOD, J2000 } from 'ootk';

const lambert = new LambertIOD();

// Method 1: Manual selection
const shortPath = lambert.estimate(p1, p2, t1, t2, { posigrade: true });
const longPath = lambert.estimate(p1, p2, t1, t2, { posigrade: false });

// Method 2: Automatic optimal path selection
const interceptor = new J2000(t1, p1, v1);  // Current state
const target = new J2000(t2, p2, v2);       // Target state

const useShort = LambertIOD.useShortPath(interceptor, target);
const optimalSolution = lambert.estimate(p1, p2, t1, t2, {
  posigrade: useShort
});
```

### Error Handling

```typescript
const solution = lambert.estimate(p1, p2, t1, t2);

if (!solution) {
  // Solution failed - possible reasons:
  // 1. Positions are too close (collinear)
  // 2. Time of flight too short/long for geometry
  // 3. Numerical convergence failure
  // 4. Hyperbolic trajectory (|x| >= 1)

  console.error('Lambert solution failed');

  // Diagnostics
  const distance = p2.subtract(p1).magnitude;
  const timeOfFlight = (t2.toDateTime().getTime() - t1.toDateTime().getTime()) / 1000;

  console.log('Distance between positions:', distance, 'km');
  console.log('Time of flight:', timeOfFlight, 'seconds');

  // Try increasing time or adjusting positions
}
```

### Iterative Optimization for Specific Constraints

```typescript
import { LambertIOD, EpochUTC, Vector3D, Kilometers } from 'ootk';

// Find transfer time for specific delta-V budget
function findTransferTime(
  p1: Vector3D<Kilometers>,
  p2: Vector3D<Kilometers>,
  t1: EpochUTC,
  currentVelocity: Vector3D<KilometersPerSecond>,
  maxDeltaV: number,
  maxTimeHours: number
): { transferTime: number; solution: J2000 } | null {

  const lambert = new LambertIOD();
  const startMs = t1.toDateTime().getTime();

  // Binary search for optimal time
  let low = 300;  // 5 minutes minimum
  let high = maxTimeHours * 3600;

  while (high - low > 60) {  // 1-minute precision
    const mid = Math.floor((low + high) / 2);
    const t2 = EpochUTC.fromDateTime(new Date(startMs + mid * 1000));

    const solution = lambert.estimate(p1, p2, t1, t2, { posigrade: true });

    if (solution) {
      const deltaV = solution.velocity.subtract(currentVelocity).magnitude;

      if (deltaV <= maxDeltaV) {
        high = mid;  // Can do it faster
      } else {
        low = mid;   // Need more time
      }
    } else {
      low = mid;
    }
  }

  const finalT2 = EpochUTC.fromDateTime(new Date(startMs + high * 1000));
  const finalSolution = lambert.estimate(p1, p2, t1, finalT2, { posigrade: true });

  if (finalSolution) {
    return { transferTime: high, solution: finalSolution };
  }

  return null;
}
```

### Combining with Force Models

```typescript
import {
  LambertIOD,
  RungeKutta89Propagator,
  ForceModel,
  EpochUTC
} from 'ootk';

// 1. Get initial estimate from Lambert
const lambert = new LambertIOD();
const initialOrbit = lambert.estimate(p1, p2, t1, t2);

if (!initialOrbit) {
  throw new Error('No solution');
}

// 2. Set up high-fidelity force model
const forceModel = new ForceModel();
forceModel.setEarthGravity(20, 20);      // High-order gravity
forceModel.setThirdBody(true);           // Sun/Moon perturbations
forceModel.setAtmosphericDrag(2.2, 0.01); // Drag (Cd, area/mass)
forceModel.setSolarRadiationPressure(1.2, 0.02); // SRP

// 3. Propagate with perturbations
const propagator = new RungeKutta89Propagator(initialOrbit, forceModel);
const highFidelityState = propagator.propagate(t2);

// 4. Check accuracy against target
const positionError = highFidelityState.position.subtract(p2).magnitude;
console.log('Position error:', positionError, 'km');

// 5. Optional: Iterate to refine solution
if (positionError > 1.0) {  // More than 1 km error
  // Re-solve Lambert with adjusted target
  const correctedTarget = p2.add(
    highFidelityState.position.subtract(p2).scale(0.5)
  );

  const refinedOrbit = lambert.estimate(p1, correctedTarget, t1, t2);
  // Continue iteration...
}
```

---

## Best Practices

### 1. Choose the Right Workflow

| Use Case | Recommended Approach |
|----------|---------------------|
| High-precision orbit propagation | J2000 + RungeKutta89Propagator |
| Quick orbit estimation | J2000 + ClassicalElements |
| Ground track visualization | J2000 → TLE → Satellite |
| Transfer planning | Lambert + direct delta-V calculation |
| Real-time operations | Cache Lambert solutions |

### 2. Validate Solutions

```typescript
// Always check for null returns
const solution = lambert.estimate(p1, p2, t1, t2);
if (!solution) {
  // Handle failure gracefully
  return;
}

// Verify solution makes physical sense
const elements = solution.toClassicalElements();
if (elements.eccentricity >= 1.0) {
  console.warn('Hyperbolic trajectory detected');
}

if (elements.semimajorAxis < 6378) {
  console.error('Orbit intersects Earth!');
}
```

### 3. Time of Flight Considerations

- **Too short**: May not have physical solution
- **Too long**: Multiple revolution solutions possible
- **Rule of thumb**: Time should be 0.1 to 10 orbital periods

### 4. Numerical Stability

The Lambert solver uses:

- Householder's method (3rd order convergence)
- Tolerance: 1e-13
- Max iterations: 50

Most solutions converge in < 10 iterations.

---

## Troubleshooting

### Problem: Lambert returns null

**Causes:**

1. Positions nearly collinear
2. Time of flight incompatible with geometry
3. Numerical convergence issues

**Solutions:**

```typescript
// Check input validity
const r1 = p1.magnitude;
const r2 = p2.magnitude;
const c = p2.subtract(p1).magnitude;  // Chord

// Triangle inequality must hold
if (c >= r1 + r2 || c <= Math.abs(r1 - r2)) {
  console.error('Invalid geometry');
}

// Try different time of flight
const minTOF = Math.PI * Math.sqrt(Math.pow((r1 + r2 + c) / 2, 3) / mu);
console.log('Minimum TOF:', minTOF, 'seconds');
```

### Problem: Large delta-V requirements

**Cause:** Inefficient transfer geometry

**Solution:**

```typescript
// Try multiple revolution transfers
for (let nRev = 0; nRev <= 2; nRev++) {
  const sol = lambert.estimate(p1, p2, t1, t2, { nRev });
  if (sol) {
    console.log(`${nRev} revs: ${sol.velocity.magnitude} km/s`);
  }
}

// Or adjust transfer time
const adjustedT2 = new EpochUTC(t2.toDateTime().getTime() + 3600000);
const betterSol = lambert.estimate(p1, p2, t1, adjustedT2);
```

### Problem: TLE conversion artifacts

**Cause:** Classical elements → TLE conversion limitations

**Solution:**
Use numerical propagators directly instead of Satellite class:

```typescript
// Instead of:
const tle = Tle.fromClassicalElements(elements);
const sat = new Satellite({ tle1: tle.line1, tle2: tle.line2 });

// Use:
const propagator = new RungeKutta89Propagator(j2000State, forceModel);
```

---

## Performance Tips

1. **Reuse Lambert instances**: Constructor is lightweight
2. **Cache solutions**: Lambert solve is ~microseconds, but caching helps for repeated queries
3. **Use appropriate propagators**:
   - Keplerian: Fastest, no perturbations
   - RK4: Medium speed, fixed step
   - RK89: Adaptive step, best accuracy
   - SGP4: For TLE-based satellites only

4. **Parallel processing**: Lambert solutions are independent

```typescript
const transfers = await Promise.all(
  targets.map(target =>
    Promise.resolve(lambert.estimate(start, target, t1, t2))
  )
);
```

---

## References

- Lambert solver: `/home/user/ootk/src/orbit_determination/LambertIOD.ts:1`
- J2000 class: `/home/user/ootk/src/coordinate/J2000.ts:1`
- RungeKutta89: `/home/user/ootk/src/propagator/RungeKutta89Propagator.ts:1`
- ClassicalElements: `/home/user/ootk/src/coordinate/ClassicalElements.ts:1`
- Examples: `/home/user/ootk/examples/iod.ts:1`

---

## Summary

Lambert integration provides a powerful alternative to SGP4 for state vector generation:

✅ **Direct state vector generation** from position observations
✅ **Transfer orbit design** without TLE requirements
✅ **High-precision propagation** using numerical integrators
✅ **Flexible force modeling** for perturbation analysis
✅ **Seamless integration** with existing OOTK components

For most applications involving precise orbit determination or maneuver planning, using Lambert with numerical propagators provides superior accuracy compared to TLE-based SGP4 propagation.
