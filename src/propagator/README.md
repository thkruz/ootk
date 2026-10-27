# Propagators

This directory contains orbital propagators for computing satellite positions over time. Each propagator implements the abstract `Propagator` base class and balances accuracy, speed, and capability differently.

## Quick Reference

| Propagator | Type | Accuracy | Speed | Maneuvers | Best For |
|------------|------|----------|-------|-----------|----------|
| `Sgp4Propagator` | Analytical | Low-Medium | Very Fast | No | TLE-based tracking |
| `KeplerPropagator` | Analytical | Low | Very Fast | Impulsive only | Quick estimates, education |
| `RungeKutta4Propagator` | Numerical (Fixed) | Medium | Medium | Yes | General integration |
| `DormandPrince54Propagator` | Numerical (Adaptive) | Medium-High | Medium-Fast | Yes | General high-fidelity |
| `RungeKutta89Propagator` | Numerical (Adaptive) | Very High | Slower | Yes | High-precision requirements |

## Propagator Details

### Sgp4Propagator

**Type:** Analytical (SGP4/SDP4 model)

The SGP4 propagator uses Two-Line Element (TLE) sets and the SGP4/SDP4 analytical theory to propagate satellite states. This is the industry standard for space catalog tracking. SGP4 itself produces TEME states; `Sgp4Propagator` converts them and returns `J2000` states like every other propagator here.

**Pros:**

- Very fast computation
- Works directly with TLE data from space catalogs
- Accounts for Earth oblateness (J2), atmospheric drag, and lunar/solar perturbations
- Widely used and well-understood

**Cons:**

- Cannot model maneuvers
- Accuracy degrades over time (TLEs need regular updates)
- Limited to Earth-orbiting objects
- Accuracy varies by orbit type (typically 1-3 km after 1 day)

**Use Cases:**

- Space situational awareness
- Conjunction screening with catalog objects
- Real-time tracking applications
- Pass prediction for ground stations

```typescript
import { EpochUTC, Seconds, Sgp4Propagator, Tle } from 'ootk';

const tle = new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
);
const propagator = new Sgp4Propagator(tle);

// SGP4 runs in TEME; the propagator returns J2000 states (km, km/s)
const state = propagator.propagate(tle.epoch.roll(3600 as Seconds));

console.log(state.position.magnitude());
```

---

### KeplerPropagator

**Type:** Analytical (Two-body)

The simplest propagator, using Kepler's two-body equations to analytically propagate classical orbital elements. Assumes a spherical Earth with no perturbations.

**Pros:**

- Extremely fast
- Exact solution for the two-body problem
- Good for understanding orbital mechanics fundamentals
- Supports impulsive maneuvers

**Cons:**

- No perturbation modeling (no drag, J2, third-body, etc.)
- Accuracy degrades rapidly for real-world scenarios
- Only suitable for short-term predictions

**Use Cases:**

- Educational purposes
- Quick orbital estimates
- Initial orbit determination
- Preliminary mission planning
- Scenarios where perturbations are negligible

```typescript
import { ClassicalElements, DEG2RAD, EpochUTC, KeplerPropagator, Kilometers, Radians, Seconds } from 'ootk';

// Angles are radians; semimajor axis is km.
const elements = new ClassicalElements({
  epoch: EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00Z')),
  semimajorAxis: 6878.137 as Kilometers,
  eccentricity: 0.001,
  inclination: (51.6 * DEG2RAD) as Radians,
  rightAscension: (120 * DEG2RAD) as Radians,
  argPerigee: (30 * DEG2RAD) as Radians,
  trueAnomaly: 0 as Radians,
});
const propagator = new KeplerPropagator(elements);
const state = propagator.propagate(elements.epoch.roll(1800 as Seconds));

console.log(state.position.magnitude());
```

---

### RungeKutta4Propagator

**Type:** Numerical (Fixed step)

Classic 4th-order Runge-Kutta numerical integrator with a fixed step size. Integrates the equations of motion using a configurable force model.

**Pros:**

- Well-understood, stable algorithm
- Supports arbitrary force models (gravity, drag, solar radiation pressure, etc.)
- Full maneuver support (impulsive and finite burns)
- Predictable performance (fixed step size)

**Cons:**

- Fixed step size may be inefficient (too small for smooth orbits, too large for dynamic periods)
- Requires tuning the step size to balance accuracy and speed
- No automatic error control

**Use Cases:**

- General-purpose numerical propagation
- Maneuver modeling
- When consistent step sizes are required (e.g., ephemeris generation)
- Situations where computational cost is predictable

**Configuration:**

- Default step size: 15 seconds
- Adjustable via `setStepSize()`

```typescript
import { EpochUTC, ForceModel, J2000, Kilometers, KilometersPerSecond, RungeKutta4Propagator, Seconds, Vector3D } from 'ootk';

const initialState = new J2000(
  EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00Z')),
  new Vector3D(6878.137 as Kilometers, 0 as Kilometers, 0 as Kilometers),
  new Vector3D(0 as KilometersPerSecond, 4.735 as KilometersPerSecond, 5.961 as KilometersPerSecond),
);

const propagator = new RungeKutta4Propagator(
  initialState,
  new ForceModel().setEarthGravity(8, 8).setAtmosphericDrag(500, 10), // mass (kg), area (m^2)
  15, // fixed step size in seconds (default 15)
);
const state = propagator.propagate(initialState.epoch.roll(5400 as Seconds));

console.log(state.position.magnitude());
```

---

### DormandPrince54Propagator

**Type:** Numerical (Adaptive step)

5th-order Dormand-Prince method with embedded 4th-order error estimation. Automatically adjusts step size to maintain a specified error tolerance.

**Pros:**

- Adaptive step sizing for efficiency
- Automatic error control
- Good balance of accuracy and speed
- Widely used in scientific computing
- Supports arbitrary force models and maneuvers

**Cons:**

- Slightly more complex than fixed-step methods
- Step size can become very small during dynamic events
- May take more function evaluations per step than RK4

**Use Cases:**

- General high-fidelity propagation
- Orbit determination
- Long-term predictions where efficiency matters
- Propagation through varying dynamics (e.g., atmospheric entry)

**Configuration:**

- Default tolerance: 1e-9
- Tolerance adjustable in constructor

```typescript
import { EpochUTC, ForceModel, J2000, Kilometers, KilometersPerSecond, DormandPrince54Propagator, Seconds, Vector3D } from 'ootk';

const initialState = new J2000(
  EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00Z')),
  new Vector3D(6878.137 as Kilometers, 0 as Kilometers, 0 as Kilometers),
  new Vector3D(0 as KilometersPerSecond, 4.735 as KilometersPerSecond, 5.961 as KilometersPerSecond),
);

const propagator = new DormandPrince54Propagator(
  initialState,
  new ForceModel().setEarthGravity(8, 8).setAtmosphericDrag(500, 10), // mass (kg), area (m^2)
  1e-9, // local error tolerance (default 1e-9)
);
const state = propagator.propagate(initialState.epoch.roll(5400 as Seconds));

console.log(state.position.magnitude());
```

---

### RungeKutta89Propagator

**Type:** Numerical (Adaptive step)

8th-order Runge-Kutta method with embedded 9th-order error estimation. The highest-order propagator available, providing maximum accuracy.

**Pros:**

- Highest accuracy available
- Excellent for long-term integrations
- Adaptive step sizing
- Can take larger steps while maintaining precision
- Ideal for sensitive applications (close approaches, conjunctions)

**Cons:**

- More function evaluations per step (16 stages)
- Higher computational cost per step
- May be overkill for routine applications

**Use Cases:**

- High-precision conjunction analysis
- Scientific research requiring maximum accuracy
- Reference trajectory generation
- Scenarios with tight accuracy requirements
- Validation of lower-fidelity propagators

**Configuration:**

- Default tolerance: 1e-9
- Tolerance adjustable in constructor

```typescript
import { EpochUTC, ForceModel, J2000, Kilometers, KilometersPerSecond, RungeKutta89Propagator, Seconds, Vector3D } from 'ootk';

const initialState = new J2000(
  EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00Z')),
  new Vector3D(6878.137 as Kilometers, 0 as Kilometers, 0 as Kilometers),
  new Vector3D(0 as KilometersPerSecond, 4.735 as KilometersPerSecond, 5.961 as KilometersPerSecond),
);

const propagator = new RungeKutta89Propagator(
  initialState,
  new ForceModel()
    .setEarthGravity(20, 20)
    .setThirdBodyGravity({ moon: true, sun: true })
    .setAtmosphericDrag(500, 10) // mass (kg), area (m^2)
    .setSolarRadiationPressure(500, 10), // mass (kg), area (m^2)
  1e-12, // tighter tolerance for maximum accuracy
);
const state = propagator.propagate(initialState.epoch.roll(5400 as Seconds));

console.log(state.position.magnitude());
```

---

## Common Features

All propagators share these capabilities from the base `Propagator` class:

- **`propagate(epoch)`** - Propagate to an `EpochUTC` and return a `J2000` state (km, km/s)
- **`ephemeris(start, stop, interval?)`** - Sample from `start` to `stop` every `interval` seconds (default 60; the last sample is exactly at `stop`) and return a `VerletBlendInterpolator`
- **`maneuver(thrust, interval?)`** / **`ephemerisManeuver(start, finish, maneuvers, interval?)`** - Apply `Thrust` maneuvers (`Sgp4Propagator` cannot)
- **`checkpoint()` / `restore(index)` / `clearCheckpoints()`** - Save and restore propagator state
- **`reset()`** - Reset to initial state
- **`ascendingNodeEpoch(start)`** - Find the next ascending node after `start` (searches one orbital period)
- **`descendingNodeEpoch(start)`** - Find next descending node
- **`apogeeEpoch(start)`** - Find next apogee
- **`perigeeEpoch(start)`** - Find next perigee

## Choosing a Propagator

1. **Working with TLEs?** Use `Sgp4Propagator`

2. **Need maneuver modeling?** Use any numerical propagator (RK4, DP54, or RK89)

3. **Quick estimate or educational use?** Use `KeplerPropagator`

4. **General high-fidelity work?** Use `DormandPrince54Propagator`

5. **Maximum accuracy required?** Use `RungeKutta89Propagator`

6. **Need fixed output intervals?** Use `RungeKutta4Propagator` or use `ephemeris()` with any propagator
