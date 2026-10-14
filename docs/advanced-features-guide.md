# ootk Advanced Features Guide

This guide covers the parts of ootk beyond SGP4 and look angles: numerical propagation and force
models, interpolation and compression of ephemerides, covariance, conjunction assessment, orbit
determination, relative motion, maneuvers, the numerical optimizers and CCSDS ephemeris files.
It assumes you have read [Getting Started](./getting-started.md). Every example is a complete
TypeScript file that compiles against ootk 8.

Upgrading from ootk 7? The [v8 migration guide](./migration-v8.md) lists every breaking change,
several of which are in the modules described here (Lambert `shortWay`, CDM units, the screening
covariance helper, `Matrix.inverse`).

## Table of Contents

1. [Numerical propagation](#1-numerical-propagation)
2. [Ephemerides, interpolation and compression](#2-ephemerides-interpolation-and-compression)
3. [Covariance](#3-covariance)
4. [Conjunction assessment](#4-conjunction-assessment)
5. [Orbit determination](#5-orbit-determination)
6. [Relative motion](#6-relative-motion)
7. [Maneuver planning](#7-maneuver-planning)
8. [Optimizers and linear algebra](#8-optimizers-and-linear-algebra)
9. [CCSDS ephemeris files (OEM)](#9-ccsds-ephemeris-files-oem)
10. [Performance notes](#10-performance-notes)

## 1. Numerical propagation

### Propagators

All propagators extend `Propagator` and expose `propagate(epoch: EpochUTC): J2000`.

| Class | Method | Typical use |
|---|---|---|
| `Sgp4Propagator` | SGP4 from a `Tle` | Catalog objects, same model as `Satellite` |
| `KeplerPropagator` | Two-body, from `ClassicalElements` | Quick analytic estimates |
| `RungeKutta4Propagator` | Fixed-step RK4 (default 15 s) | Simple, predictable cost |
| `DormandPrince54Propagator` | Adaptive RK 5(4) | General numerical work |
| `RungeKutta89Propagator` | Adaptive RK 8(9) | High-accuracy work |

The numerical propagators take an initial `J2000` state and a `ForceModel`. The adaptive ones also
take a tolerance (default 1e-9).

### Force models

`ForceModel` setters return the model, so they chain:

| Method | Force |
|---|---|
| `setGravity(mu?)` | Point-mass central gravity (the default for numerical propagators) |
| `setEarthGravity(degree, order)` | EGM96 spherical harmonics; degree and order are clamped to 0..36 |
| `setThirdBodyGravity({ moon, sun })` | Lunar and solar point-mass perturbations |
| `setSolarRadiationPressure(mass, area, coeff = 1.2)` | Cannonball SRP with conical shadow; mass in kg, area in m² |
| `setAtmosphericDrag(mass, area, coeff = 2.2, cosine = 4, f107 = 150)` | Harris-Priester drag; mass in kg, area in m² |

Notes on drag:

- `cosine` is the Harris-Priester exponent n in cos^n(psi / 2), not the cosine of an angle.
  Montenbruck and Gill suggest 2 for low-inclination orbits and 6 for polar orbits.
- `f107` is the F10.7 solar flux in SFU. The Harris-Priester table describes mean solar activity,
  so ootk multiplies the whole density by a solar-activity factor that is exactly 1 at 150 SFU
  (the default reproduces standard Harris-Priester) and does not change the day/night ratio. At
  400 km the factor is about 0.20 at 70 SFU and about 2.27 at 250 SFU. It is a first-order
  correction, not a replacement for Jacchia-Roberts or NRLMSISE-00.
- `setAtmosphericDrag` is marked deprecated in the source as a work in progress.

### Example: SGP4 state into RK89

```typescript
import { EpochUTC, ForceModel, RungeKutta89Propagator, Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const start = new Date('2024-01-28T12:00:00Z');
const initial = iss.toJ2000(start);

const forceModel = new ForceModel()
  .setEarthGravity(8, 8)
  .setThirdBodyGravity({ moon: true, sun: true })
  .setSolarRadiationPressure(420000, 2500)
  .setAtmosphericDrag(420000, 1500, 2.2, 4, 150);

const propagator = new RungeKutta89Propagator(initial, forceModel);

// 6 hours later
const later = EpochUTC.fromDateTime(new Date('2024-01-28T18:00:00Z'));
const numerical = propagator.propagate(later);
const sgp4 = iss.toJ2000(later.toDateTime());

console.log(`RK89 radius ${numerical.position.magnitude().toFixed(3)} km`);
console.log(`RK89 vs SGP4 after 6 h: ${numerical.position.distance(sgp4.position).toFixed(2)} km`);
```

The SGP4 state is a mean-element solution, so a numerical propagation started from it drifts away
from SGP4 by kilometers per day; that difference is model disagreement, not a bug in either.

### Example: two-body propagation

```typescript
import { ClassicalElements, DEG2RAD, EpochUTC, KeplerPropagator, Kilometers, Radians, Seconds } from 'ootk';

const epoch = EpochUTC.fromDateTimeString('2024-01-28T00:00:00.000Z');

// ClassicalElements angles are radians
const elements = new ClassicalElements({
  epoch,
  semimajorAxis: 7000 as Kilometers,
  eccentricity: 0.01,
  inclination: (51.6 * DEG2RAD) as Radians,
  rightAscension: (30 * DEG2RAD) as Radians,
  argPerigee: (90 * DEG2RAD) as Radians,
  trueAnomaly: 0 as Radians,
});

const kepler = new KeplerPropagator(elements);
const oneOrbitLater = epoch.roll((elements.period * 60) as Seconds); // period is minutes
const state = kepler.propagate(oneOrbitLater);

console.log(`Period ${elements.period.toFixed(2)} min`);
console.log(`Back at the start after one period: ${state.position.distance(elements.toJ2000().position).toExponential(2)} km`);
```

### Event searches

`Propagator` can search one orbit ahead for node crossings and apsides:

```typescript
import { EpochUTC, RungeKutta89Propagator, Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const start = EpochUTC.fromDateTime(new Date('2024-01-28T12:00:00Z'));
const propagator = new RungeKutta89Propagator(iss.toJ2000(start.toDateTime()));

console.log(`Ascending node: ${propagator.ascendingNodeEpoch(start).toString()}`);
console.log(`Perigee:        ${propagator.perigeeEpoch(start).toString()}`);
```

## 2. Ephemerides, interpolation and compression

`Propagator.ephemeris(start, stop, interval = 60)` propagates across a span (interval in seconds)
and returns a `VerletBlendInterpolator`. Any `StateInterpolator` answers
`interpolate(epoch): J2000 | null`, returning `null` outside its window. Other interpolators:
`LagrangeInterpolator.fromEphemeris(states, order = 10)`, `CubicSplineInterpolator`,
`ChebyshevInterpolator`.

`ChebyshevCompressor` fits Chebyshev polynomials to an interpolator. `compress(cpr = 21,
segmentDuration?)` takes the coefficients per segment and the segment length in seconds; when the
segment length is omitted it defaults to the orbital period at the start of the ephemeris (about
92 minutes for the ISS, so one day becomes about 16 segments).

```typescript
import { ChebyshevCompressor, EpochUTC, RungeKutta89Propagator, Satellite, Seconds, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const start = EpochUTC.fromDateTime(new Date('2024-01-28T12:00:00Z'));
const stop = start.roll(86400 as Seconds);

const propagator = new RungeKutta89Propagator(iss.toJ2000(start.toDateTime()));
const ephemeris = propagator.ephemeris(start, stop, 60 as Seconds);

const compressed = new ChebyshevCompressor(ephemeris).compress(21);

const t = start.roll(43210 as Seconds);
const exact = ephemeris.interpolate(t);
const approx = compressed.interpolate(t);

if (exact && approx) {
  console.log(`Verlet ephemeris: ${ephemeris.sizeBytes} bytes, Chebyshev: ${compressed.sizeBytes} bytes`);
  console.log(`Compression error: ${(exact.position.distance(approx.position) * 1000).toFixed(3)} m`);
}
```

## 3. Covariance

`StateCovariance` holds a 6x6 matrix and a `CovarianceFrame` (`ECI` or `RIC`). Units are km, km/s
and their products; the diagonal holds variances (km², km²/s²). `StateCovariance.fromSigmas`
builds a diagonal matrix from 1-sigma values, and `sigmas()` returns them back.

TLE-derived covariances:

| Function | Result |
|---|---|
| `createCovarianceFromTle(tle1, tle2, frame?)` | Diagonal covariance from fixed nominal sigmas |
| `createSampleCovarianceFromTle(tle1, tle2, frame?)` | Sigma-point covariance, inflated by TLE quality and age |
| `cappedScreeningCovarianceFromTle(tle1, tle2, k, caps?)` | Sample covariance scaled by k² with position sigmas capped, for screening |

`CovarianceSample` ages the TLE against the epoch of the state you give it, never the wall clock,
so results are reproducible.

`cappedScreeningCovarianceFromTle` returns a real covariance in the RIC frame: variances on the
diagonal in R, I, C, Rdot, Idot, Cdot order. `caps` are 1-sigma limits in km in R, I, C order
(default `[35, 71, 32]`); a position axis whose k-sigma exceeds its cap is scaled so that its
variance becomes cap², with correlations preserved. This changed in ootk 8; see the migration guide.

```typescript
import {
  cappedScreeningCovarianceFromTle, CovarianceFrame, createCovarianceFromTle, createSampleCovarianceFromTle, TleLine1,
} from 'ootk';

const tle1 = '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1;
const tle2 = '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741';

const simple = createCovarianceFromTle(tle1, tle2, CovarianceFrame.RIC);
const sampled = createSampleCovarianceFromTle(tle1, tle2, CovarianceFrame.RIC);
const screening = cappedScreeningCovarianceFromTle(tle1, tle2, 3);

const km = (v: number): string => v.toFixed(4);

console.log('Simple 1-sigma R, I, C (km):', Array.from(simple.sigmas().elements).slice(0, 3).map(km));
console.log('Sampled 1-sigma R, I, C (km):', Array.from(sampled.sigmas().elements).slice(0, 3).map(km));
console.log('Screening frame:', screening.frame); // 'ric' (CovarianceFrame.RIC)
console.log('Screening R, I, C variances (km^2):', [0, 1, 2].map((i) => km(screening.matrix.elements[i][i])));
```

## 4. Conjunction assessment

### One pair

`ConjunctionAssessment` finds the time of closest approach (TCA) between two objects over a window
and, when both covariances are available, the probability of collision. Pc is the exact 2D
short-encounter integral of the combined position covariance over the hard-body disc (Foster and
Estes; Alfano), with the secondary covariance rotated into the primary RIC frame before the two are
summed. Hard-body radii are in km.

```typescript
import { ConjunctionAssessment, CovarianceFrame, EpochUTC, Kilometers, StateCovariance, Tle } from 'ootk';

const primaryTle = new Tle(
  '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005',
  '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000',
);
const secondaryTle = new Tle(
  '1 44691U 19074A   25019.50000000  .00016500  00000-0  10200-3 0  9006',
  '2 44691  51.6450 339.8050 0002600  90.5050 269.6050 15.50005000000000',
);

// 1-sigma values, RIC frame: R, I, C (km) then Rdot, Idot, Cdot (km/s)
const primaryCovariance = StateCovariance.fromSigmas([0.5, 1.5, 0.5, 0.001, 0.003, 0.001], CovarianceFrame.RIC);
const secondaryCovariance = StateCovariance.fromSigmas([0.3, 1.0, 0.3, 0.0005, 0.002, 0.0005], CovarianceFrame.RIC);

const assessment = new ConjunctionAssessment(
  { name: 'ISS', tle: primaryTle, covariance: primaryCovariance, radius: 0.05 as Kilometers },
  { name: 'Secondary', tle: secondaryTle, covariance: secondaryCovariance, radius: 0.01 as Kilometers },
);

const event = assessment.assess({
  startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
  endTime: EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z'),
});

console.log(`TCA: ${event.tca.toString()}`);
console.log(`Miss distance: ${(event.missDistance * 1000).toFixed(1)} m`);
console.log(`R / I / C: ${event.radialDistance.toFixed(3)} / ${event.intrackDistance.toFixed(3)} / ${event.crosstrackDistance.toFixed(3)} km`);
console.log(`Pc: ${event.probabilityOfCollision?.toExponential(3) ?? 'n/a'}`);
console.log(`High risk (1 km, 1e-4): ${event.isHighRisk()}`);
```

For higher fidelity, pass `propagator: new RungeKutta89Propagator(state, forceModel)` on each object
and `propagateCovariance: true` to `assess` (see `examples/conjunction-assessment-example.ts`).

### Screening a catalog

`CatalogScreener.screenOneToMany`, `screenManyToMany` and `screenCatalog` first discard pairs whose
orbital shells cannot meet, then run a full assessment on the rest. The shell filter rejects a pair
only when one perigee radius exceeds the other apogee radius by more than `shellPad` (default
10 km), which absorbs the short-period variation that TLE mean elements leave out.

```typescript
import { CatalogScreener, EpochUTC, Kilometers, Tle } from 'ootk';

const primary = {
  name: 'ISS',
  radius: 0.05 as Kilometers,
  tle: new Tle(
    '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005',
    '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000',
  ),
};

const catalog = [
  {
    tle: new Tle(
      '1 44691U 19074A   25019.50000000  .00016500  00000-0  10200-3 0  9006',
      '2 44691  51.6450 339.8050 0002600  90.5050 269.6050 15.50005000000000',
    ),
  },
];

const results = CatalogScreener.screenOneToMany(primary, catalog, {
  startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
  endTime: EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z'),
  shellPad: 10 as Kilometers,
});

for (const r of results) {
  console.log(`${r.primaryId} vs ${r.secondaryId}: ${r.event.missDistance.toFixed(3)} km, risk ${r.riskScore.toFixed(3)}`);
}
```

### CDM files

`CdmParser.parse` reads a CCSDS 508.0 Conjunction Data Message. In the file, `MISS_DISTANCE` and
`RELATIVE_POSITION_*` are in metres, `RELATIVE_SPEED` and `RELATIVE_VELOCITY_*` in m/s and the
covariance in m², m²/s and m²/s²; the parser converts them to ootk's km, km/s and km² units.
`CdmExporter.export(event)` writes metres back out with `[m]` unit tags. Files written by ootk 7
carry explicit `[km]` tags and still parse correctly.

## 5. Orbit determination

### Initial orbit determination

| Class | Input | Call |
|---|---|---|
| `LambertIOD` | Two positions and times | `estimate(p1, p2, t1, t2, { shortWay, nRev })` returns `J2000 \| null` |
| `GibbsIOD` | Three coplanar positions | `solve(r1, r2, r3, t2, t3)` |
| `HerrickGibbsIOD` | Three closely spaced positions | `solve(r1, t1, r2, t2, r3, t3)` |
| `GoodingIOD` | Three optical observations | `estimate(o1, o2, o3, rho1?, rho3?, nRev?, shortWay?)`; seeds the ranges with Gauss IOD (internal, not exported) when none are given |

Lambert's `shortWay` option (named `posigrade` before ootk 8) chooses the transfer angle, not the
direction of motion: `true` (default) sweeps the angle below 180 degrees, `false` sweeps 360 degrees
minus that angle. A retrograde transfer is obtained by choosing the sweep that matches the motion;
`LambertIOD.useShortPath(interceptor, target)` picks it from an interceptor state. The old
`posigrade` key is not read any more, so a leftover `posigrade: false` silently gives the short way.

```typescript
import { EpochUTC, J2000, Kilometers, LambertIOD, Seconds, Vector3D } from 'ootk';

const t1 = EpochUTC.fromDateTimeString('2024-01-28T00:00:00.000Z');
const t2 = t1.roll(1500 as Seconds);

const p1 = new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D(0 as Kilometers, 7200 as Kilometers, 500 as Kilometers);

const lambert = new LambertIOD();
const shortArc = lambert.estimate(p1, p2, t1, t2, { shortWay: true });
const longArc = lambert.estimate(p1, p2, t1, t2, { shortWay: false });

if (shortArc && longArc) {
  // Departure velocities are in km/s
  const v = (s: J2000): string => s.velocity.magnitude().toFixed(3);

  console.log(`Short way departure speed: ${v(shortArc)} km/s`);
  console.log(`Long way departure speed:  ${v(longArc)} km/s`);

  const elements = shortArc.toClassicalElements();

  console.log(`Short-way orbit: a ${elements.semimajorAxis.toFixed(1)} km, i ${elements.inclinationDegrees.toFixed(2)} deg`);
}
```

### Batch least squares

`BatchLeastSquaresOD(observations, apriori, forceModel?)` refines an a priori `J2000` state from
`Observation`s (`ObservationRadar` for range/az/el, `ObservationOptical` for RA/Dec). `solve()`
returns a `BatchLeastSquaresResult` with `state`, `covariance`, `rms` (noise-weighted, about 1 at
the noise floor) and `converged`, which is false when `maxIter` ran out before the RMS settled.

If the observations do not determine all six state components, the normal matrix is singular and
`solve()` throws `SingularMatrixError` (the same applies to `LevenbergMarquardtOD`).

```typescript
import {
  BatchLeastSquaresOD, Degrees, EpochUTC, GroundStation, J2000, Kilometers, KilometersPerSecond, ObservationRadar,
  RAE, Satellite, Seconds, SingularMatrixError, TleLine1, TleLine2, Vector3D,
} from 'ootk';

const station = new GroundStation({
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
});

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Synthetic radar observations every 20 s during a pass (2024-01-29 00:08 to 00:14 UTC)
const passStart = EpochUTC.fromDateTimeString('2024-01-29T00:08:00.000Z');
const observations: ObservationRadar[] = [];

for (let i = 0; i < 18; i++) {
  const epoch = passStart.roll((i * 20) as Seconds);
  const date = epoch.toDateTime();
  const site = station.toJ2000(date);

  observations.push(new ObservationRadar(site, RAE.fromStateVector(iss.toJ2000(date), site)));
}

// A priori: the true state with a 2 km, 2 m/s error
const truth = iss.toJ2000(passStart.toDateTime());
const apriori = new J2000(
  truth.epoch,
  truth.position.add(new Vector3D(2 as Kilometers, 0 as Kilometers, 0 as Kilometers)),
  truth.velocity.add(new Vector3D(0 as KilometersPerSecond, 0.002 as KilometersPerSecond, 0 as KilometersPerSecond)),
);

try {
  const result = new BatchLeastSquaresOD(observations, apriori).solve();

  console.log(`Converged: ${result.converged}, weighted RMS ${result.rms.toExponential(2)}`);
  console.log(`Position error after fit: ${(result.state.position.distance(truth.position) * 1000).toFixed(1)} m`);
} catch (e) {
  if (e instanceof SingularMatrixError) {
    console.log('Observations do not determine the orbit');
  } else {
    throw e;
  }
}
```

The fit above uses two-body dynamics (the default force model) against SGP4-generated
observations, so the residual position error is the model difference over the six-minute arc.

## 6. Relative motion

`RIC.fromJ2000(state, origin)` expresses `state` relative to `origin` in the origin's radial,
in-track and cross-track axes. The first argument is the object you are describing, the second is
the reference. The velocity is the inertial velocity difference rotated into RIC; it does not
subtract the rotating-frame term, so two co-orbiting objects separated in-track show a radial rate
of about n times their separation. `Satellite.toRIC(reference, date)` is the shortcut for two
satellites.

```typescript
import { RIC, Radians, Satellite, TleLine1, TleLine2 } from 'ootk';

const chief = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const date = new Date('2024-01-28T12:00:00Z');
const chiefState = chief.toJ2000(date);

// A deputy 0.001 rad (about 6.8 km) ahead in true anomaly
const deputyElements = chiefState.toClassicalElements();

deputyElements.trueAnomaly = (deputyElements.trueAnomaly + 0.001) as Radians;
const deputyState = deputyElements.toJ2000();

const ric = RIC.fromJ2000(deputyState, chiefState);

console.log(`Radial ${ric.position.x.toFixed(3)} km, in-track ${ric.position.y.toFixed(3)} km, cross-track ${ric.position.z.toFixed(3)} km`);
```

`Hill` models relative motion with the Clohessy-Wiltshire equations; `Hill.fromState`,
`Hill.fromNmc` (natural motion circumnavigation) and `Hill.fromPerch` build common geometries, and
`propagate`, `ephemeris` and `solveManeuver(waypoint)` operate on them.

## 7. Maneuver planning

### Impulsive burns

`Thrust(center, radial, intrack, crosstrack, durationRate = 0)` is a burn centered at the `EpochUTC`
`center`, with components in m/s in the RIC frame of the state it is applied to. A zero
`durationRate` (s per m/s) makes it impulsive.

```typescript
import { EpochUTC, Kilometers, KilometersPerSecond, MetersPerSecond, Thrust, J2000, Vector3D } from 'ootk';

const epoch = EpochUTC.fromDateTimeString('2024-01-28T00:00:00.000Z');
const state = new J2000(
  epoch,
  new Vector3D(6778 as Kilometers, 0 as Kilometers, 0 as Kilometers),
  new Vector3D(0 as KilometersPerSecond, 7.6686 as KilometersPerSecond, 0 as KilometersPerSecond),
);

// 10 m/s prograde
const burn = new Thrust(epoch, 0 as MetersPerSecond, 10 as MetersPerSecond, 0 as MetersPerSecond);
const after = burn.apply(state);

console.log(`Burn magnitude ${burn.magnitude} m/s, impulsive: ${burn.isImpulsive}`);
console.log(`Semimajor axis ${state.semimajorAxis.toFixed(2)} -> ${after.semimajorAxis.toFixed(2)} km`);
```

### Transfers, plane changes and propellant

- `TwoBurnOrbitTransfer.hohmannTransfer(rInit, rFinal)` takes radii in km. `vTransA`, `vTransB` and
  `deltaV` are in km/s, `tTrans` in seconds; `toManeuvers(epoch)` returns the two `Thrust` objects.
- `TwoBurnOrbitTransfer.hohmannTransferWithPlaneChange(rInit, rFinal, deltaIncRad)` folds an
  inclination change into one burn.
- `PlaneChangeBurn.computeDeltaV(v, deltaIncRad, flightPathAngleRad = 0)` uses
  2 v cos(gamma) sin(|di| / 2); `PlaneChangeBurn.compute(elements, targetIncRad)` also finds the
  node and returns the burn epoch and post-burn elements.
- `PropellantBudget` applies the rocket equation with mass in kg, delta-v in m/s and Isp in s.

```typescript
import { DEG2RAD, EpochUTC, PlaneChangeBurn, PropellantBudget, TwoBurnOrbitTransfer } from 'ootk';

const leo = 6778; // km
const geo = 42164; // km

const hohmann = TwoBurnOrbitTransfer.hohmannTransfer(leo, geo);

console.log(`Burn 1 ${hohmann.vTransA.toFixed(4)} km/s, burn 2 ${hohmann.vTransB.toFixed(4)} km/s`);
console.log(`Total ${hohmann.deltaV.toFixed(4)} km/s, transfer time ${(hohmann.tTrans / 3600).toFixed(2)} h`);

const [burnA, burnB] = hohmann.toManeuvers(EpochUTC.fromDateTimeString('2024-01-28T00:00:00.000Z'));

console.log(`Second burn at ${burnB.center.toString()}, ${burnA.magnitude.toFixed(1)} m/s first`);

// A 28.5 deg plane change at GEO speed (circular, flight-path angle 0)
const planeChange = PlaneChangeBurn.computeDeltaV(hohmann.vFinal, 28.5 * DEG2RAD);

console.log(`Plane change at GEO: ${planeChange.toFixed(4)} km/s`);

// Propellant for the whole mission on a 2000 kg spacecraft with Isp 320 s
const totalMs = (hohmann.deltaV + planeChange) * 1000;

console.log(`Propellant: ${PropellantBudget.propellantUsed(2000, totalMs, 320).toFixed(0)} kg`);
```

`Waypoint` and `Waypoint.toManeuvers(...)` plan multi-burn rendezvous sequences against a target
`StateInterpolator`; see `src/maneuver` for the full signature.

## 8. Optimizers and linear algebra

### Downhill simplex (Nelder-Mead)

`DownhillSimplex.solveSimplex(f, simplex, options)` minimises `f(x: Float64Array): number`.
`generateSimplex(x0, step)` builds the starting simplex. The search stops when both the simplex
size (`xTolerance`) and the spread of function values (`fTolerance`) fall below their limits, or
after `maxIter` iterations.

```typescript
import { DownhillSimplex } from 'ootk';

// Rosenbrock function, minimum at (1, 1)
const rosenbrock = (x: Float64Array): number => (1 - x[0]) ** 2 + 100 * (x[1] - x[0] ** 2) ** 2;

const start = DownhillSimplex.generateSimplex(Float64Array.from([-1.2, 1.0]), 0.1);
const best = DownhillSimplex.solveSimplex(rosenbrock, start, { xTolerance: 1e-10, fTolerance: 1e-12, maxIter: 5000 });

console.log(best[0].toFixed(6), best[1].toFixed(6)); // close to 1, 1
```

### Golden section search

`GoldenSection.search(f, lower, upper, { tolerance, solveMax })` finds the extremum of a unimodal
function on an interval; `searchMin` and `searchMax` are shortcuts.

```typescript
import { GoldenSection } from 'ootk';

const xMin = GoldenSection.search((x) => (x - 3) ** 2, 0, 10, { tolerance: 1e-8 });
const xMax = GoldenSection.searchMax((x) => Math.sin(x), 0, Math.PI);

console.log(xMin.toFixed(6), xMax.toFixed(6)); // 3.000000 1.570796
```

### Regression

```typescript
import { PolynomialRegression, SimpleLinearRegression } from 'ootk';

const xs = [0, 1, 2, 3, 4, 5];
const ys = [1.1, 2.9, 5.2, 7.1, 8.8, 11.2];

const line = new SimpleLinearRegression(xs, ys);

console.log(`y = ${line.slope.toFixed(3)} x + ${line.intercept.toFixed(3)}`);
console.log(`y(6) = ${line.evaluate(6).toFixed(3)}`);

const quad = PolynomialRegression.solve(Float64Array.from(xs), Float64Array.from(ys.map((y, i) => y + 0.1 * xs[i] ** 2)), 2);

console.log('Quadratic coefficients (highest order first):', Array.from(quad.coefficients).map((c) => c.toFixed(3)));
```

### Matrix inverse

`Matrix.inverse()` uses Gauss-Jordan elimination with partial pivoting and equilibration. A matrix
that is singular to working precision makes it throw `SingularMatrixError`; `tryInverse()` returns
`null` instead.

```typescript
import { Matrix, SingularMatrixError } from 'ootk';

const a = new Matrix([[4, 7], [2, 6]]);

console.log(a.inverse().elements); // [[0.6, -0.7], [-0.2, 0.4]]

const singular = new Matrix([[1, 2], [2, 4]]);

console.log(singular.tryInverse()); // null

try {
  singular.inverse();
} catch (e) {
  console.log(e instanceof SingularMatrixError); // true
}
```

## 9. CCSDS ephemeris files (OEM)

`OemParser.parse(text)` reads a CCSDS 502.0 Orbit Ephemeris Message in KVN form. Data lines follow
the `META_STOP` of each segment as the standard specifies; the non-standard `DATA_START` /
`DATA_STOP` markers some tools write are also accepted. `EphemerisSatellite.fromParsedOem(oem)`
builds an object you can query like a `Satellite`. EME2000, J2000, ICRF and GCRF segments are used
as J2000, TEME is kept as TEME, Earth-fixed frames (ITRF variants, ECEF) are rotated to J2000, and
any other `REF_FRAME` is rejected with an error.

```typescript
import { EphemerisSatellite, OdmExporter, OemParser, Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  name: 'ISS',
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Write two hours of ephemeris at 60 s steps, then read it back
const text = OdmExporter.formatOem(iss, new Date('2024-01-28T12:00:00Z'), 2, 60);
const oem = OemParser.parse(text);

console.log(`Segments: ${oem.dataBlocks.length}, states: ${oem.dataBlocks[0].ephemeris.length}`);
console.log(`Frame: ${oem.dataBlocks[0].metadata.REF_FRAME}`);

const ephemerisSat = EphemerisSatellite.fromParsedOem(oem);
const eci = ephemerisSat.eci(new Date('2024-01-28T12:30:30Z'));

console.log(eci ? eci.position : 'outside the ephemeris span');
```

## 10. Performance notes

- SGP4 (`Satellite`, `Sgp4Propagator`) is by far the cheapest way to get a position and is the
  right model for catalog TLEs. Numerical propagation is for when you need force-model control or
  a state that did not come from a TLE.
- `RungeKutta89Propagator` takes larger steps than `DormandPrince54Propagator` at tight tolerances;
  the fixed-step `RungeKutta4Propagator` has predictable cost but needs a small step for accuracy.
- Spherical-harmonic gravity cost grows with degree squared; 8x8 or 12x12 is enough for most LEO
  work, and degree and order above 36 are clamped.
- Generate an ephemeris once with `Propagator.ephemeris` and interpolate it instead of propagating
  repeatedly to nearby epochs; compress long ephemerides with `ChebyshevCompressor`.
- For pass prediction over long spans, `AccessCalculator` (coarse step plus edge bisection) is much
  cheaper than `Sensor.calculatePasses` (one propagation per second).
- `CatalogScreener` runs the cheap shell filter first; keep `skipCoarseFilter` false for large
  catalogs.
