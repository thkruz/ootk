# Lambert Integration Guide: Generating State Vectors Without SGP4

This guide shows how to use the Lambert solver (`LambertIOD`) to build state vectors from two
positions and a time of flight, and how to feed those states into ootk's numerical propagators,
the `Satellite` class and transfer planning. Every example below compiles against ootk 8 and the
runnable versions live in [`examples/lambert-state-vector.ts`](https://github.com/thkruz/ootk/blob/main/examples/lambert-state-vector.ts)
(see also the annotated [Lambert State Vectors](./examples/lambert-state-vector.md) page).

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Lambert Solver Basics](#lambert-solver-basics)
4. [Integration Workflows](#integration-workflows)
5. [Complete Examples](#complete-examples)
6. [Advanced Usage](#advanced-usage)
7. [Troubleshooting](#troubleshooting)

---

## Overview

**Lambert's problem** finds the two-body orbit that passes through position `p1` at time `t1`
and position `p2` at time `t2`. It is useful for:

- Orbit determination from two position fixes
- Transfer orbit design and delta-V budgeting
- Rendezvous and intercept planning
- Generating a full state vector (position and velocity) from position-only data

### Key Classes

- **LambertIOD**: solves Lambert's problem and returns a `J2000` state at `t1`
- **J2000**: inertial state vector (position in km, velocity in km/s, `EpochUTC` epoch)
- **ClassicalElements**: orbital elements (angles stored in radians, with `*Degrees` getters)
- **Tle** and **Satellite**: TLE generation and SGP4-based propagation
- **RungeKutta89Propagator**: high-precision numerical propagator

---

## Quick Start

```bash
npm install ootk
```

```typescript
import { EpochUTC, Kilometers, LambertIOD, Vector3D } from 'ootk';

// Default central body is the Earth (mu = Earth.mu, km^3/s^2)
const lambert = new LambertIOD();

// Two positions in the J2000 inertial frame (km)
const p1 = new Vector3D<Kilometers>(6778 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D<Kilometers>(0 as Kilometers, 6778 as Kilometers, 0 as Kilometers);

const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T00:30:00.000Z'));

const state = lambert.estimate(p1, p2, t1, t2, {
  shortWay: true, // sweep the transfer angle below 180 deg
  nRev: 0, // no complete revolutions
});

if (state) {
  console.log('Epoch:', state.epoch.toString());
  console.log('Position (km):', state.position.toString());
  console.log('Velocity (km/s):', state.velocity.toString());
} else {
  console.log('Lambert solver did not converge');
}
```

---

## Lambert Solver Basics

### Constructor

```typescript
import { Earth, LambertIOD } from 'ootk';

const earthLambert = new LambertIOD(); // mu defaults to Earth.mu
const sameThing = new LambertIOD(Earth.mu);
```

`mu` is the gravitational parameter of the **central body** of the transfer, in km^3/s^2. The
default is `Earth.mu` (398600.4415 km^3/s^2). The positions you pass must be measured from that
same body. For an Earth-centred trajectory (including a trans-lunar coast from LEO) use the
Earth's `mu`; using the Moon's `mu` with geocentric positions gives a meaningless answer. Use a
different `mu` only when the positions are relative to that body (for example a lunar-orbit
transfer with Moon-centred positions and `MoonBody.MU`).

### Main method: `estimate()`

<!-- doccheck:skip -->
```typescript
estimate(
  p1: Vector3D<Kilometers>,
  p2: Vector3D<Kilometers>,
  t1: EpochUTC,
  t2: EpochUTC,
  options?: { shortWay?: boolean; nRev?: number },
): J2000 | null
```

- `p1`, `p2`: position vectors in km in an inertial frame centred on the body whose `mu` the
  solver uses (J2000 for Earth).
- `t1`, `t2`: epochs. The time of flight is `t2.difference(t1)` in seconds.
- `shortWay` (default `true`): which of the two transfer angles to sweep. `true` sweeps the angle
  between `p1` and `p2` that is below 180 deg, `false` sweeps 360 deg minus that angle. It does
  **not** select prograde or retrograde motion: the orbit normal is `p1 x p2` for the short way and
  the opposite for the long way, so a retrograde transfer is obtained by choosing the sweep that
  matches the desired motion. `LambertIOD.useShortPath(interceptor, target)` makes that choice from
  the interceptor's current angular momentum. (This option was called `posigrade` before ootk 8. The
  old key is ignored at runtime, so a call that still passes `posigrade: false` silently gets the
  short way.)
- `nRev` (default `0`): number of complete revolutions. For `|nRev| >= 1` there are two solutions
  for the same time of flight; the sign selects the branch (positive gives the branch the solver
  has always returned, negative gives the other one). See `LambertIOD.solve`.

**Returns** a `J2000` state at `t1` whose velocity is the departure velocity in km/s, or `null`
when the iteration does not converge. Always check for `null`.

### Working with the output

```typescript
import { EpochUTC, Kilometers, LambertIOD, Seconds, Vector3D } from 'ootk';

const p1 = new Vector3D<Kilometers>(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D<Kilometers>(0 as Kilometers, 7000 as Kilometers, 0 as Kilometers);
const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
const t2 = t1.roll(1460 as Seconds); // EpochUTC.roll takes seconds

const state = new LambertIOD().estimate(p1, p2, t1, t2);

if (state) {
  const elements = state.toClassicalElements();

  console.log('|r| (km):', state.position.magnitude().toFixed(3));
  console.log('|v| (km/s):', state.velocity.magnitude().toFixed(6));
  console.log('a (km):', elements.semimajorAxis.toFixed(3));
  console.log('e:', elements.eccentricity.toFixed(6));
  console.log('i (deg):', elements.inclinationDegrees.toFixed(3)); // inclination itself is radians
  console.log('Period (min):', elements.period.toFixed(2)); // period is already in minutes
}
```

`magnitude()` is a method, not a property. `ClassicalElements` stores its angles in radians
(`inclination`, `rightAscension`, `argPerigee`, `trueAnomaly`); print them through the
`inclinationDegrees`, `rightAscensionDegrees`, `argPerigeeDegrees` and `trueAnomalyDegrees`
getters. `period` is in minutes.

### Algorithm

`LambertIOD.solve` works in canonical units (lengths in units of the larger radius, time in
units of r / sqrt(mu / r)) on the Lancaster-Blanchard `x` variable of the transfer ellipse:

- the time of flight is written as a function of `x` (elliptic for |x| < 1, hyperbolic for
  x > 1), with the long way flipping the sign of the `beta` angle;
- for zero revolutions the solver runs a **secant iteration** on log(time of flight) against
  log(1 + x); for multi-revolution transfers it runs the secant iteration on time of flight
  against tan(pi x / 2), starting from a pair of initial guesses on the requested branch;
- the iteration stops when successive `x` values agree to 1e-13, or fails (returns `null`) after
  50 iterations;
- the departure velocity is then built from its radial and transverse components.

It is not Householder's method, and there is no third-order convergence guarantee; a typical
zero-revolution solve takes a handful of secant steps.

---

## Integration Workflows

### Workflow 1: Lambert state into a numerical propagator (recommended)

```typescript
import { EpochUTC, ForceModel, Kilometers, LambertIOD, RungeKutta89Propagator, Seconds, Vector3D } from 'ootk';

const p1 = new Vector3D<Kilometers>(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D<Kilometers>(0 as Kilometers, 7000 as Kilometers, 0 as Kilometers);
const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
const t2 = t1.roll(1460 as Seconds);

const initialState = new LambertIOD().estimate(p1, p2, t1, t2);

if (!initialState) {
  throw new Error('Lambert solution failed');
}

// Every ForceModel setter returns the model, so calls chain.
const forceModel = new ForceModel()
  .setEarthGravity(8, 8) // EGM96 to degree and order 8 (replaces point-mass gravity)
  .setThirdBodyGravity({ moon: true, sun: true })
  .setSolarRadiationPressure(500, 10); // mass 500 kg, area 10 m^2

const propagator = new RungeKutta89Propagator(initialState, forceModel);
const futureState = propagator.propagate(EpochUTC.fromDateTime(new Date('2024-01-02T00:00:00.000Z')));

console.log('Position after 1 day (km):', futureState.position.toString());
console.log('Velocity after 1 day (km/s):', futureState.velocity.toString());
```

Without a `forceModel` argument the propagator uses point-mass Earth gravity. Drag can be added
with `setAtmosphericDrag(mass, area, coeff?, cosine?, f107?)` (mass in kg, area in m^2, `cosine`
is the Harris-Priester exponent n, `f107` the solar flux in SFU); the method is still marked
deprecated as a work in progress.

### Workflow 2: Lambert state into a `Satellite`

```typescript
import { EpochUTC, Kilometers, LambertIOD, Satellite, Seconds, Tle, Vector3D } from 'ootk';

const p1 = new Vector3D<Kilometers>(6878.137 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D<Kilometers>(0 as Kilometers, 6878.137 as Kilometers, 0 as Kilometers);
const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
const t2 = t1.roll(1420 as Seconds);

const state = new LambertIOD().estimate(p1, p2, t1, t2);

if (!state) {
  throw new Error('Lambert solution failed');
}

const elements = state.toClassicalElements();
const tle = Tle.fromClassicalElements(elements);

const satellite = new Satellite({ tle1: tle.line1, tle2: tle.line2, name: 'Lambert-derived' });

console.log('Inclination (deg):', satellite.inclination.toFixed(3));
console.log('Period (min):', satellite.period.toFixed(2));

const lla = satellite.lla(new Date('2024-01-01T06:00:00.000Z'));

if (lla) {
  console.log(`Lat ${lla.lat.toFixed(3)} deg, lon ${lla.lon.toFixed(3)} deg, alt ${lla.alt.toFixed(3)} km`);
}
```

`Tle.fromClassicalElements` treats the osculating Lambert elements as SGP4 mean elements, so the
generated TLE does not reproduce the Lambert state exactly; SGP4 positions drift away from it by
kilometres. `satellite.lla()` returns `null` when SGP4 fails, so check it.

### Workflow 3: Transfer between two catalogued satellites

```typescript
import { LambertIOD, RungeKutta89Propagator, Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const hubble = new Satellite({
  tle1: '1 20580U 90037B   24028.50123227  .00000825  00000-0  39644-4 0  9997' as TleLine1,
  tle2: '2 20580  28.4696 273.2640 0002975 297.7865 189.2151 15.09696656316758' as TleLine2,
});

// Use times close to the TLE epochs; SGP4 accuracy degrades with TLE age.
const departureDate = new Date('2024-01-28T12:00:00.000Z');
const arrivalDate = new Date(departureDate.getTime() + 45 * 60 * 1000); // 45 minutes later

const start = iss.toJ2000(departureDate);
const end = hubble.toJ2000(arrivalDate);

const transfer = new LambertIOD().estimate(start.position, end.position, start.epoch, end.epoch, {
  shortWay: LambertIOD.useShortPath(start, end),
});

if (transfer) {
  const dv1 = transfer.velocity.subtract(start.velocity).magnitude();

  // Two-body coast to the arrival epoch, then match the target velocity.
  const arrival = new RungeKutta89Propagator(transfer).propagate(end.epoch);
  const dv2 = end.velocity.subtract(arrival.velocity).magnitude();

  console.log(`Departure dv ${dv1.toFixed(3)} km/s, arrival dv ${dv2.toFixed(3)} km/s`);
}
```

The second burn is computed from a two-body propagation so it matches the Lambert assumption. If
you coast with a richer force model the arrival point misses `p2`; see
[Combining with force models](#combining-with-force-models).

---

## Complete Examples

### Example 1: Orbit from two position fixes

```typescript
import { EpochUTC, Kilometers, LambertIOD, Vector3D } from 'ootk';

const p1 = new Vector3D<Kilometers>(6778.137 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D<Kilometers>(-2000 as Kilometers, 6400 as Kilometers, 1500 as Kilometers);
const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T12:00:00.000Z'));
const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T12:28:00.000Z'));

const orbit = new LambertIOD().estimate(p1, p2, t1, t2, { shortWay: true, nRev: 0 });

if (orbit) {
  const el = orbit.toClassicalElements();

  console.log('Epoch:', orbit.epoch.toString());
  console.log('Semi-major axis:', el.semimajorAxis.toFixed(3), 'km');
  console.log('Eccentricity:', el.eccentricity.toFixed(6));
  console.log('Inclination:', el.inclinationDegrees.toFixed(3), 'deg');
  console.log('RAAN:', el.rightAscensionDegrees.toFixed(3), 'deg');
  console.log('Arg of perigee:', el.argPerigeeDegrees.toFixed(3), 'deg');
  console.log('True anomaly:', el.trueAnomalyDegrees.toFixed(3), 'deg');
  console.log('Period:', el.period.toFixed(2), 'min'); // already minutes
  console.log('Perigee altitude:', el.perigee.toFixed(3), 'km'); // above 6378.137 km
  console.log('Apogee altitude:', el.apogee.toFixed(3), 'km');
} else {
  console.error('Lambert solution failed: check the geometry and time of flight');
}
```

`ClassicalElements.apogee` and `perigee` are altitudes above the WGS-84 equatorial radius
(6378.137 km); `apogeeRadius` and `perigeeRadius` are the geocentric distances.

### Example 2: Multi-revolution transfers

```typescript
import { EpochUTC, Kilometers, LambertIOD, Vector3D } from 'ootk';

const p1 = new Vector3D<Kilometers>(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D<Kilometers>(0 as Kilometers, 8000 as Kilometers, 0 as Kilometers);
const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T06:00:00.000Z'));

const lambert = new LambertIOD();

for (const nRev of [0, 1, -1, 2, -2]) {
  const solution = lambert.estimate(p1, p2, t1, t2, { shortWay: true, nRev });

  if (solution) {
    const el = solution.toClassicalElements();

    console.log(
      `nRev ${nRev}: |v1| ${solution.velocity.magnitude().toFixed(4)} km/s, ` +
        `a ${el.semimajorAxis.toFixed(1)} km, e ${el.eccentricity.toFixed(4)}`,
    );
  } else {
    console.log(`nRev ${nRev}: no solution`);
  }
}
```

For each `|nRev| >= 1` the positive and negative values return the two branches. A branch has
no solution when the time of flight is shorter than the minimum time for that many revolutions.

### Example 3: Choosing a rendezvous time

```typescript
import { EpochUTC, Kilometers, KilometersPerSecond, LambertIOD, Satellite, TleLine1, TleLine2, Vector3D } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const chaserStart = new Date('2024-01-28T12:00:00.000Z');
const chaserPosition = new Vector3D<Kilometers>(6778 as Kilometers, 100 as Kilometers, 50 as Kilometers);
const chaserVelocity = new Vector3D<KilometersPerSecond>(
  0 as KilometersPerSecond,
  7.5 as KilometersPerSecond,
  0.1 as KilometersPerSecond,
);

const lambert = new LambertIOD();
const flightTimesSec = [1800, 3600, 5400, 7200]; // 30, 60, 90, 120 minutes
let best: { dtSec: number; deltaV: number } | null = null;

for (const dtSec of flightTimesSec) {
  const target = iss.toJ2000(new Date(chaserStart.getTime() + dtSec * 1000));
  const solution = lambert.estimate(chaserPosition, target.position, EpochUTC.fromDateTime(chaserStart), target.epoch);

  if (solution) {
    const deltaV = solution.velocity.subtract(chaserVelocity).magnitude();

    console.log(`Flight time ${dtSec / 60} min: departure dv ${deltaV.toFixed(3)} km/s`);

    if (!best || deltaV < best.deltaV) {
      best = { dtSec, deltaV };
    }
  }
}

if (best) {
  console.log(`Lowest departure dv: ${best.deltaV.toFixed(3)} km/s at ${best.dtSec / 60} min`);
}
```

### Example 4: Trans-lunar coast (geocentric)

A coast from LEO to lunar distance is a geocentric problem, so it uses the Earth's `mu` (the
default). This is the two-body approximation only: it ignores the Moon's gravity, which dominates
near arrival.

```typescript
import { Earth, EpochUTC, Kilometers, LambertIOD, Vector3D } from 'ootk';

const departure = new Vector3D<Kilometers>(6778 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const arrival = new Vector3D<Kilometers>(-384400 as Kilometers, 20000 as Kilometers, 0 as Kilometers);
const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
const t2 = EpochUTC.fromDateTime(new Date('2024-01-04T12:00:00.000Z'));

const solution = new LambertIOD(Earth.mu).estimate(departure, arrival, t1, t2);

if (solution) {
  const el = solution.toClassicalElements();
  const escapeSpeed = Math.sqrt((2 * Earth.mu) / departure.magnitude());

  console.log('Departure speed:', solution.velocity.magnitude().toFixed(3), 'km/s');
  console.log('Local escape speed:', escapeSpeed.toFixed(3), 'km/s');
  console.log('Transfer apogee radius:', el.apogeeRadius.toFixed(0), 'km');
}
```

---

## Advanced Usage

### Path selection: short vs long

```typescript
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, LambertIOD, Seconds, Vector3D } from 'ootk';

const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
const t2 = t1.roll(3000 as Seconds);
const p1 = new Vector3D<Kilometers>(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D<Kilometers>(-5000 as Kilometers, -5000 as Kilometers, 0 as Kilometers);
const v1 = new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond);
const v2 = new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond);

const lambert = new LambertIOD();

// Manual selection: p2 lies 225 deg counter-clockwise from p1, i.e. 135 deg clockwise.
const shortPath = lambert.estimate(p1, p2, t1, t2, { shortWay: true }); // sweeps 135 deg (clockwise about +z)
const longPath = lambert.estimate(p1, p2, t1, t2, { shortWay: false }); // sweeps 225 deg (counter-clockwise)

// Automatic selection: keep the interceptor's current sense of motion.
const interceptor = new J2000(t1, p1, v1);
const target = new J2000(t2, p2, v2);
const shortWay = LambertIOD.useShortPath(interceptor, target);
const matched = lambert.estimate(p1, p2, t1, t2, { shortWay });

console.log(shortPath !== null, longPath !== null, shortWay, matched !== null);
```

Here the interceptor moves counter-clockwise about +z (angular momentum along +z), while
`p1 x p2` points along -z because the short way is clockwise. `useShortPath` compares the two and
returns `false`, so `matched` is the 225 deg counter-clockwise transfer that keeps the
interceptor's direction of motion. An interceptor moving clockwise at the same point would get
`true`. This is why `shortWay` is not a prograde/retrograde switch.

### Feasibility: parabolic and minimum-energy times of flight

With r1 = |p1|, r2 = |p2|, chord c = |p2 - p1| and semiperimeter s = (r1 + r2 + c) / 2:

- **Parabolic time** (the boundary between elliptic and hyperbolic zero-revolution transfers):
  t_p = (sqrt(2) / 3) / sqrt(mu) * (s^1.5 - sgn * (s - c)^1.5), with sgn = +1 for the short way
  and -1 for the long way. A zero-revolution solution exists for any positive time of flight;
  below t_p it is hyperbolic (e > 1).
- **Minimum-energy time**: the transfer ellipse with the smallest semi-major axis, a_m = s / 2,
  takes t_m = sqrt(a_m^3 / mu) * (pi - sgn * (beta_m - sin beta_m)) with
  sin(beta_m / 2) = sqrt((s - c) / s).

```typescript
import { Earth, Kilometers, Vector3D } from 'ootk';

function transferTimes(p1: Vector3D<Kilometers>, p2: Vector3D<Kilometers>, shortWay = true, mu = Earth.mu) {
  const r1 = p1.magnitude();
  const r2 = p2.magnitude();
  const c = p2.subtract(p1).magnitude();
  const s = (r1 + r2 + c) / 2;
  const sgn = shortWay ? 1 : -1;

  const parabolic = (Math.SQRT2 / 3) / Math.sqrt(mu) * (s ** 1.5 - sgn * (s - c) ** 1.5);
  const betaM = 2 * Math.asin(Math.sqrt((s - c) / s));
  const minEnergy = Math.sqrt((s / 2) ** 3 / mu) * (Math.PI - sgn * (betaM - Math.sin(betaM)));

  return { parabolicSec: parabolic, minEnergySec: minEnergy };
}

const p1 = new Vector3D<Kilometers>(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D<Kilometers>(0 as Kilometers, 7000 as Kilometers, 0 as Kilometers);

console.log(transferTimes(p1, p2)); // parabolic about 906 s, minimum energy about 2225 s (a = s / 2 = 5975 km)
```

### Validating a solution: does it hit the Earth?

A converged solution can still be useless. Short flight times force very high velocities, and
the transfer conic can pass below the surface. The test is on the **perigee radius**
r_p = a (1 - e), not on the semi-major axis, and it only matters if perigee lies on the arc that
is actually flown: the transfer hits the Earth when r_p < R and the true anomaly increases through
0 (perigee) between departure and arrival, or when either endpoint is itself below R.

```typescript
import { EpochUTC, Kilometers, LambertIOD, Vector3D } from 'ootk';

const EARTH_RADIUS_KM = 6378.137;

const p1 = new Vector3D<Kilometers>(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D<Kilometers>(-7000 as Kilometers, 1000 as Kilometers, 0 as Kilometers);
const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T00:20:00.000Z'));

const lambert = new LambertIOD();
const departure = lambert.estimate(p1, p2, t1, t2);

if (departure) {
  const elements = departure.toClassicalElements();
  const nu1 = elements.trueAnomaly; // radians, in [0, 2 pi)
  // Arrival true anomaly: nu1 plus the swept angle (short way here).
  const nu2 = nu1 + p1.angle(p2);
  const passesPerigee = nu2 > 2 * Math.PI; // the arc crosses nu = 0

  if (elements.eccentricity >= 1) {
    console.log('Hyperbolic transfer (e >= 1)');
  }

  if (passesPerigee && elements.perigeeRadius < EARTH_RADIUS_KM) {
    console.log('Transfer passes below the surface, perigee radius', elements.perigeeRadius.toFixed(1), 'km');
  } else {
    console.log('Transfer stays above the surface');
  }
}
```

### Combining with force models

Lambert is a two-body solution. Propagating it with perturbations makes the arrival miss `p2`;
a simple fix is to re-aim with the miss vector (a shooting iteration).

```typescript
import { EpochUTC, ForceModel, Kilometers, LambertIOD, RungeKutta89Propagator, Vector3D } from 'ootk';

const p1 = new Vector3D<Kilometers>(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D<Kilometers>(0 as Kilometers, 7000 as Kilometers, 1000 as Kilometers);
const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T00:40:00.000Z'));

const lambert = new LambertIOD();
const forceModel = new ForceModel().setEarthGravity(20, 20).setThirdBodyGravity({ moon: true, sun: true });

let aim = p2;
let solution = lambert.estimate(p1, aim, t1, t2);

for (let i = 0; i < 5 && solution; i++) {
  const arrival = new RungeKutta89Propagator(solution, forceModel).propagate(t2);
  const miss = arrival.position.subtract(p2);

  console.log(`Iteration ${i}: miss ${miss.magnitude().toFixed(3)} km`);

  if (miss.magnitude() < 0.001) {
    break;
  }

  aim = aim.subtract(miss) as Vector3D<Kilometers>;
  solution = lambert.estimate(p1, aim, t1, t2);
}
```

`setEarthGravity` clamps degree and order to the bundled EGM96 table (36).

---

## Troubleshooting

### `estimate()` returns `null`

The secant iteration did not reach 1e-13 within 50 steps. Common causes:

1. `p1` and `p2` are nearly collinear (transfer angle near 0 or 180 deg), so the transfer plane
   is undefined.
2. The time of flight is too short for the requested number of revolutions (`|nRev| >= 1`).
3. Extreme geometries (very large radius ratio, very long flight times at `nRev = 0`).

Try a different time of flight, the other `shortWay` value, or the other multi-revolution branch
(negate `nRev`). Changing a time is done in seconds:

```typescript
import { EpochUTC, Seconds } from 'ootk';

const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T01:30:00.000Z'));
const oneHourLater = t2.roll(3600 as Seconds); // roll() takes seconds
const sameFromConstructor = new EpochUTC((t2.posix + 3600) as Seconds); // the constructor takes POSIX seconds, not ms

console.log(oneHourLater.toString() === sameFromConstructor.toString());
```

### Large delta-V

Compare the zero-revolution, multi-revolution and long-way solutions, and scan the time of flight
(Example 3). The minimum-energy time above is a good starting point for a single transfer.

### TLE conversion artifacts

`Tle.fromClassicalElements` fits osculating elements as if they were SGP4 mean elements. If you
need the Lambert trajectory itself, propagate the `J2000` state with `RungeKutta89Propagator`
instead of converting to a `Satellite`.

---

## References

- `src/orbit-determination/LambertIOD.ts`: solver, `estimate`, `solve`, `useShortPath`
- `src/coordinate/J2000.ts`: inertial state vector
- `src/propagator/RungeKutta89Propagator.ts`: numerical propagator
- `src/coordinate/ClassicalElements.ts`: element conversion, `apogee`/`perigee` altitudes,
  `apogeeRadius`/`perigeeRadius`
- `examples/lambert-state-vector.ts`: runnable versions of the workflows above
- Vallado, *Fundamentals of Astrodynamics and Applications*, 4th ed., section 7.6 (Lambert's
  problem, minimum-energy and parabolic times of flight)
