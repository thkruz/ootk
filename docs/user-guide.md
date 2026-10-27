# OOTK User Guide

A tour of the ootk 8 API, organised by task. Every example on this page is a complete TypeScript
module that compiles against the current source; most are trimmed from the runnable scripts in
[`examples/`](https://github.com/thkruz/ootk/tree/main/examples). Upgrading from ootk 7? Read the
[v8 migration guide](./migration-v8.md) first: several functions changed units or names.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Satellites](#satellites)
3. [Ground Stations and Sensors](#ground-stations-and-sensors)
4. [Pass Prediction](#pass-prediction)
5. [Coordinate Systems](#coordinate-systems)
6. [Low-Level Transforms](#low-level-transforms)
7. [Orbit Propagation](#orbit-propagation)
8. [Force Models](#force-models)
9. [Initial Orbit Determination](#initial-orbit-determination)
10. [Observations](#observations)
11. [Time Systems](#time-systems)
12. [Interpolation and Compression](#interpolation-and-compression)
13. [Mathematical Operations](#mathematical-operations)
14. [Optimization](#optimization)
15. [Covariance](#covariance)
16. [Celestial Bodies](#celestial-bodies)
17. [Maneuvers](#maneuvers)
18. [Conjunction Assessment](#conjunction-assessment)
19. [Ephemeris and Message Files](#ephemeris-and-message-files)
20. [Utilities](#utilities)
21. [Quick Reference](#quick-reference)

---

## Core Concepts

### Branded unit types

ootk tags numbers with their unit at the type level. `Degrees`, `Radians`, `Kilometers`,
`KilometersPerSecond`, `Seconds`, `Minutes` and friends are plain numbers at run time, but the
compiler refuses to pass a `Degrees` where `Radians` is expected. Cast literals with `as`:

```typescript
import { DEG2RAD, Degrees, Kilometers, RAD2DEG, Radians } from 'ootk';

const lat = 41.75 as Degrees;
const alt = 0.06 as Kilometers;

// Convert explicitly when an API wants the other angle unit
const latRad = (lat * DEG2RAD) as Radians;
const back = (latRad * RAD2DEG) as Degrees;

console.log(lat, alt, latRad, back);
```

The cast only labels the number; it does not convert it. Casting a degree value `as Radians`
compiles and silently gives a wrong answer, so check the parameter type before you cast.

### Which APIs use which units

| Area | Angles | Distances | Notes |
|---|---|---|---|
| `Satellite`, `GroundStation`, sensors, `FieldOfView` | degrees | km | Look angles, lat/lon, TLE-derived inclination |
| `ClassicalElements`, `Geodetic`, `RAE` constructor, state vectors | radians | km, km/s | Use the `*Degrees` getters or `fromDegrees` factories |
| Time | | | `Epoch.posix` is seconds; `Satellite.period` is minutes |

### Frames and nullable results

- `Satellite.eci()` and `Tle.propagate()` return **TEME** (the SGP4 output frame).
- `Satellite.toJ2000()`, `Sgp4Propagator` and the numerical propagators work in **J2000**.
- `Satellite.eci()`, `lla()`, `ecef()` and `rae()` return `null` when SGP4 fails (for example a
  decayed or badly aged TLE), so check the result before using it.

---

## Satellites

### Creating a satellite from a TLE

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  name: 'ISS (ZARYA)',
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

console.log(iss.sccNum); // '25544'
console.log(iss.inclination); // 51.6418 (degrees)
console.log(iss.period); // minutes
```

`Satellite.fromTLE(tle1, tle2, name?)` and `Satellite.fromOmm(omm)` are equivalent factories.

### Orbital parameters

The TLE-derived fields on a `Satellite` are in degrees, km and minutes:

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

console.log(`Inclination:    ${iss.inclination} deg`);
console.log(`RAAN:           ${iss.rightAscension} deg`);
console.log(`Arg of perigee: ${iss.argOfPerigee} deg`);
console.log(`Eccentricity:   ${iss.eccentricity}`);
console.log(`Mean motion:    ${iss.meanMotion} rev/day`);
console.log(`Period:         ${iss.period.toFixed(2)} min`);
console.log(`Semi-major axis ${iss.semiMajorAxis.toFixed(1)} km`);

// Altitudes above the WGS-84 equatorial radius (6378.137 km)
console.log(`Apogee alt:     ${iss.apogee.toFixed(1)} km`);
console.log(`Perigee alt:    ${iss.perigee.toFixed(1)} km`);

// Distances from the Earth's center
console.log(`Apogee radius:  ${iss.apogeeRadius.toFixed(1)} km`);
console.log(`Perigee radius: ${iss.perigeeRadius.toFixed(1)} km`);
```

`apogee` and `perigee` are heights above a sphere of radius 6378.137 km (not geodetic
altitudes); `apogeeRadius` and `perigeeRadius` are geocentric. `Tle` and `ClassicalElements`
expose the same four getters with the same meaning.

### Position at a time

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const date = new Date('2024-01-28T12:00:00.000Z');

// TEME position (km) and velocity (km/s), straight from SGP4
const eci = iss.eci(date);

if (eci) {
  console.log(eci.position.x, eci.velocity.x);
}

// Geodetic latitude/longitude (degrees) and altitude (km)
const lla = iss.lla(date);

if (lla) {
  console.log(`${lla.lat.toFixed(3)}, ${lla.lon.toFixed(3)}, ${lla.alt.toFixed(1)} km`);
}

// Earth-fixed position (km)
const ecef = iss.ecef(date);

console.log(ecef);

// Full state objects for further frame conversions
const j2000 = iss.toJ2000(date);
const itrf = iss.toITRF(date);
const geodetic = iss.toGeodetic(date); // radians internally; latDeg/lonDeg getters

console.log(j2000.position.magnitude(), itrf.position.magnitude(), geodetic.latDeg);
```

### Orbital elements from a satellite

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Osculating J2000 elements at a time (angles in radians)
const elements = iss.toClassicalElements(new Date('2024-01-28T12:00:00.000Z'));

console.log(elements.semimajorAxis); // km
console.log(elements.inclinationDegrees); // degrees
console.log(elements.period); // minutes
console.log(elements.getOrbitRegime()); // OrbitRegime.LEO ('Low Earth Orbit')
```

`getOrbitRegime()` classifies orbits as GEO, MEO, LEO, HEO or OTHER. MEO means e at most 0.25
with perigee and apogee altitudes both between 2,000 and 31,570 km, which covers GPS, GLONASS,
Galileo, BeiDou MEO and O3b.

### Look angles from the ground

```typescript
import { Degrees, GroundStation, Kilometers, Satellite, TleLine1, TleLine2 } from 'ootk';

const station = new GroundStation({
  name: 'Cape Cod',
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
});
const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const rae = iss.rae(station, new Date('2024-01-28T12:00:00.000Z'));

if (rae) {
  console.log(`Az ${rae.az.toFixed(1)} deg, El ${rae.el.toFixed(1)} deg, Range ${rae.rng.toFixed(0)} km`);
  console.log(rae.el > 0 ? 'Above the horizon' : 'Below the horizon');
}
```

Elevations are geometric (no atmospheric refraction). `iss.toRae(station, date)` returns the
same geometry as an `RAE` observation object.

---

## Ground Stations and Sensors

Sensors are components: they carry a field of view but no position. Create a `GroundStation`
(or any platform), build a concrete sensor, then attach it.

### Creating a sensor

```typescript
import {
  Degrees, GroundStation, Kilometers, PhasedArrayRadar, Satellite, SensorType, TleLine1, TleLine2,
} from 'ootk';

const station = new GroundStation({
  name: 'Cape Cod',
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
});

const radar = new PhasedArrayRadar({
  id: 1,
  name: 'Cape Cod Radar',
  sensorType: SensorType.PHASED_ARRAY_RADAR,
  beamwidth: 2 as Degrees,
  boresightAz: [47 as Degrees, 167 as Degrees], // one entry per face
  boresightEl: [20 as Degrees, 20 as Degrees],
  fieldOfView: {
    halfAngle: 60 as Degrees, // required
    minRange: 200 as Kilometers,
    maxRange: 5556 as Kilometers,
    minElevation: 3 as Degrees,
  },
});

station.addSensor(radar);
radar.setParent(station);

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const date = new Date('2024-01-28T12:00:00.000Z');

const rae = radar.getRae(iss, date); // look angles from the parent platform, or null
console.log(rae);
console.log(radar.canObserve(iss, date)); // inside the FOV right now?
if (rae) {
  console.log(radar.isInFov(rae)); // same test on a precomputed RAE
}
```

Other sensor classes follow the same pattern: `MechanicalRadar`, `OpticalSensor`,
`PassiveRFSensor`, `LaserRangingSensor` and `TtcAntenna`. Every one requires `id` (a number),
`name`, `sensorType` and a `fieldOfView` with `halfAngle`, `minRange` and `maxRange`; a missing
or non-finite `halfAngle` throws a `ValidationError`.

### Field of view

`FieldOfView` is a circular or elliptical cone around a boresight, limited by range, a global
minimum elevation and optional azimuth-dependent elevation masks.

```typescript
import { Degrees, FieldOfView, Kilometers } from 'ootk';

// Circular cone pointing north-east, 30 deg above the horizon
const cone = FieldOfView.circularCone(
  45 as Degrees, 30 as Degrees, 20 as Degrees, 100 as Kilometers, 3000 as Kilometers,
);

// Elliptical fan pointing straight up, long axis east-west
const fence = new FieldOfView({
  boresightAz: 90 as Degrees,
  boresightEl: 90 as Degrees,
  halfAngle: 70 as Degrees, // major half-angle
  minorHalfAngle: 0.5 as Degrees,
  rollAngle: 0 as Degrees,
  minRange: 0 as Kilometers,
  maxRange: 3000 as Kilometers,
});

// An all-sky hemisphere above 10 deg elevation
const allSky = FieldOfView.hemisphere(0 as Kilometers, 5000 as Kilometers, 10 as Degrees);

const target = { az: 90 as Degrees, el: 45 as Degrees, rng: 800 as Kilometers };

console.log(cone.contains(target), fence.contains(target), allSky.contains(target));
```

Roll convention: away from the zenith, roll 0 aligns the major axis with the local "up"
direction projected onto the plane across the boresight. At the zenith (`boresightEl` 90) ootk 8
uses the limit of that rule, so **roll 0 = major axis along the boresight azimuth**. ootk 7
measured zenith roll from North; convert old zenith configs with
`FieldOfView.migrateZenithRollFromV7(params)`, which applies
`newRoll = (oldRoll - boresightAz - 180) mod 360`. See the
[migration guide](./migration-v8.md#zenith-roll-convention) for a worked example.

### Mechanical radars

`MechanicalRadar.scanPeriod` is the time in seconds to sweep the azimuth extent of the field of
view at `scanRate` (deg/s): 360 deg when the cone contains the zenith, otherwise the azimuth width
of the cone.

```typescript
import { Degrees, DegreesPerSecond, Kilometers, MechanicalRadar, SensorType } from 'ootk';

const radar = new MechanicalRadar({
  id: 2,
  name: 'Scanning Radar',
  sensorType: SensorType.MECHANICAL_RADAR,
  beamwidth: 1 as Degrees,
  scanRate: 36 as DegreesPerSecond,
  fieldOfView: {
    boresightEl: 90 as Degrees,
    halfAngle: 90 as Degrees,
    minRange: 0 as Kilometers,
    maxRange: 2000 as Kilometers,
  },
});

console.log(radar.scanPeriod); // 10 s for a full 360 deg sweep
```

### Nadir swath geometry

`fovFromSwathWidth(widthKm, altKm)` returns the full sensor FOV (radians) that images a ground
swath of the given width from the given altitude. A swath wider than the visible horizon has no
line of sight, so the function returns `NaN`; clamp the width yourself if you want the
horizon-limited value.

```typescript
import { fovFromSwathWidth, swathWidthFromFov, RAD2DEG } from 'ootk';

const fov = fovFromSwathWidth(1000, 500); // radians
console.log((fov * RAD2DEG).toFixed(2), 'deg');
console.log(swathWidthFromFov(fov, 500).toFixed(1), 'km'); // round trip: 1000

console.log(fovFromSwathWidth(6000, 500)); // NaN: beyond the horizon at 500 km
```

---

## Pass Prediction

### Access windows

`AccessCalculator` finds the intervals when a target is visible from a ground object. It samples
every `stepMs` (default 10 s) and refines each rise and set edge to 1 ms.

```typescript
import { AccessCalculator, Degrees, GroundStation, Kilometers, Satellite, TleLine1, TleLine2 } from 'ootk';

const station = new GroundStation({
  name: 'Cape Cod',
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
});
const iss = new Satellite({
  name: 'ISS',
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const start = new Date('2024-01-28T12:00:00.000Z');
const end = new Date('2024-01-29T12:00:00.000Z');

const windows = AccessCalculator.calculateAccess(station, iss, start, end, {
  minElevation: 10 as Degrees,
});

for (const w of windows) {
  console.log(`${w.start.toISOString()} to ${w.end.toISOString()}, max el ${w.maxElevation.toFixed(1)} deg`);
}

// The next pass that starts at or after a time (passes already in progress are skipped)
const next = AccessCalculator.getNextAccess(station, iss, start, { minElevation: 10 as Degrees });
console.log(next?.toString());
```

Constraints also accept `maxRange`, `minRange`, `requireSunlit` and `requireObserverDark`.

### Sensor pass events

`Sensor.calculatePasses(target, planningIntervalSeconds, startDate)` steps once per second
through the interval and returns ENTER and EXIT events against the sensor's full field of view.

```typescript
import {
  Degrees, GroundStation, Kilometers, PassType, PhasedArrayRadar, Satellite, SensorType, TleLine1, TleLine2,
} from 'ootk';

const station = new GroundStation({ lat: 41.754785 as Degrees, lon: -70.539151 as Degrees, alt: 0.06 as Kilometers });
const radar = new PhasedArrayRadar({
  id: 1,
  name: 'Cape Cod Radar',
  sensorType: SensorType.PHASED_ARRAY_RADAR,
  beamwidth: 2 as Degrees,
  boresightAz: [47 as Degrees, 167 as Degrees],
  boresightEl: [20 as Degrees, 20 as Degrees],
  fieldOfView: { halfAngle: 60 as Degrees, minRange: 200 as Kilometers, maxRange: 5556 as Kilometers },
});

station.addSensor(radar);
radar.setParent(station);

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const events = radar.calculatePasses(iss, 6 * 3600, new Date('2024-01-28T12:00:00.000Z'));

for (const e of events) {
  const label = e.type === PassType.ENTER ? 'enter' : 'exit';

  console.log(`${label} ${e.time.toISOString()} az ${e.az.toFixed(1)} el ${e.el.toFixed(1)}`);
}
```

---

## Coordinate Systems

| Class | Frame | Notes |
|---|---|---|
| `J2000` | Earth-centered inertial, mean equator and equinox of J2000.0 | Numerical propagators work here |
| `TEME` | True equator, mean equinox | SGP4 output frame |
| `ITRF` | Earth-fixed | `toGeodetic()` gives WGS-84 lat/lon/alt |
| `Geodetic` | WGS-84 latitude, longitude (radians), altitude (km) | `fromDegrees`, `latDeg`, `lonDeg` |
| `ClassicalElements` | Keplerian elements (radians, km) | `*Degrees` getters |
| `EquinoctialElements` | Non-singular elements | |
| `RIC` | Radial, in-track, cross-track relative to an origin state | |
| `Hill` | Linearised relative motion (Clohessy-Wiltshire) | |

ootk models IAU 1976 precession and IAU 1980 nutation (106 terms), uses UTC as UT1 and does not apply
polar motion, so `ITRF` is close to a pseudo-Earth-fixed frame. Ignoring UT1-UTC alone can move
an equatorial point by up to about 400 m, so do not expect sub-metre agreement with a full IERS
reduction.

### State vectors

```typescript
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Vector3D } from 'ootk';

const state = new J2000(
  EpochUTC.fromDateTime(new Date('2024-01-28T12:00:00.000Z')),
  new Vector3D(6778 as Kilometers, 0 as Kilometers, 0 as Kilometers),
  new Vector3D(0 as KilometersPerSecond, 7.6686 as KilometersPerSecond, 0 as KilometersPerSecond),
);

const teme = state.toTEME();
const itrf = state.toITRF();
const geo = itrf.toGeodetic();

console.log(teme.position.toString());
console.log(`${geo.latDeg.toFixed(4)} deg, ${geo.lonDeg.toFixed(4)} deg, ${geo.alt.toFixed(2)} km`);
console.log(`Period ${state.period.toFixed(2)} min, a = ${state.semimajorAxis.toFixed(1)} km`);

// Back to J2000
console.log(teme.toJ2000().position.toString());
```

### Classical elements

The constructor takes **radians**. Convert degrees with `DEG2RAD`:

```typescript
import { ClassicalElements, DEG2RAD, EpochUTC, Kilometers, Radians, Satellite, Tle } from 'ootk';

const elements = new ClassicalElements({
  epoch: EpochUTC.fromDateTimeString('2024-01-28T00:00:00.000Z'),
  semimajorAxis: 8000 as Kilometers,
  eccentricity: 0.1,
  inclination: (45 * DEG2RAD) as Radians,
  rightAscension: (90 * DEG2RAD) as Radians,
  argPerigee: (30 * DEG2RAD) as Radians,
  trueAnomaly: 0 as Radians,
});

console.log(elements.inclinationDegrees); // 45
console.log(elements.period); // minutes
console.log(elements.apogee, elements.perigee); // altitudes above 6378.137 km

// To a state vector and back
const state = elements.toJ2000();
const roundTrip = state.toClassicalElements();
console.log(roundTrip.argPerigeeDegrees);

// To a TLE (osculating elements are treated as mean elements)
const tle = Tle.fromClassicalElements(elements);
const sat = new Satellite({ tle1: tle.line1, tle2: tle.line2 });
console.log(tle.line1, tle.line2, sat.period);
```

The properties are `semimajorAxis`, `eccentricity`, `inclination`, `rightAscension`, `argPerigee`
and `trueAnomaly`. `toEquinoctialElements()` converts to the non-singular set, and `propagate(epoch)`
advances a two-body orbit.

### Geodetic coordinates

```typescript
import { Degrees, EpochUTC, Geodetic, Kilometers } from 'ootk';

const site = Geodetic.fromDegrees(41.754785 as Degrees, -70.539151 as Degrees, 0.06 as Kilometers);
const other = Geodetic.fromDegrees(28.5 as Degrees, -80.6 as Degrees, 0 as Kilometers);

console.log(site.latDeg, site.lonDeg, site.alt);
console.log(`Great-circle distance ${site.distance(other).toFixed(1)} km`);

const itrf = site.toITRF(EpochUTC.fromDateTime(new Date('2024-01-28T12:00:00.000Z')));
console.log(itrf.position.toString());

const station = site.toGroundStation();
console.log(station.lat, station.lon); // degrees
```

`new Geodetic(lat, lon, alt)` takes radians; use `fromDegrees` for degrees.

### Relative motion (RIC)

`RIC.fromJ2000(state, origin)` expresses `state` relative to `origin`:

```typescript
import { Radians, RIC, Satellite, TleLine1, TleLine2 } from 'ootk';

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const chief = sat.toJ2000(new Date('2024-01-28T12:00:00.000Z'));

// A deputy 0.01 rad further along the same orbit
const deputyElements = chief.toClassicalElements();
deputyElements.trueAnomaly = (deputyElements.trueAnomaly + 0.01) as Radians;
const deputy = deputyElements.toJ2000();

const ric = RIC.fromJ2000(deputy, chief);

console.log(`R ${ric.position.x.toFixed(3)} km, I ${ric.position.y.toFixed(3)} km, C ${ric.position.z.toFixed(3)} km`);

// Back to J2000
console.log(ric.toJ2000(chief).position.toString());
```

The relative velocity is the inertial velocity difference rotated into RIC axes; it does not
include the rotating-frame term, so it is not the Hill-frame velocity.

### TLE parsing

```typescript
import { EpochUTC, Tle } from 'ootk';

const line1 = '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991';
const line2 = '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741';

const tle = new Tle(line1, line2);

console.log(tle.epoch.toString());
console.log(tle.inclinationDegrees); // degrees (tle.inclination is radians)
console.log(tle.apogee, tle.perigee); // altitudes above 6378.137 km

// SGP4 to a TEME state at an epoch (throws on propagation failure)
const teme = tle.propagate(EpochUTC.fromDateTimeString('2024-01-28T12:00:00.000Z'));
console.log(teme.position.toString());

// Static field parsers work on raw lines
const parsed = Tle.parse(tle.line1, tle.line2);
console.log(parsed.satNum, parsed.inclination);
```

---

## Low-Level Transforms

The functional transforms in `ootk` work on plain `{x, y, z}` and `{lat, lon, alt}` objects.
`eci` in these names means **TEME**: feed them `Satellite.eci()` output, not J2000 vectors, or the
longitude is off by the precession since 2000 (about 0.3 deg).

```typescript
import { calcGmst, ecef2eci, ecef2rae, eci2ecef, eci2lla, Degrees, Kilometers, lla2ecef, Satellite, TleLine1, TleLine2 } from 'ootk';

const date = new Date('2024-01-28T12:00:00.000Z');
const { gmst } = calcGmst(date); // radians

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const teme = sat.eci(date);

if (teme) {
  const ecef = eci2ecef(teme.position, gmst);
  const lla = eci2lla(teme.position, gmst); // degrees, km
  const site = { lat: 41.754785 as Degrees, lon: -70.539151 as Degrees, alt: 0.06 as Kilometers };
  const rae = ecef2rae(site, ecef); // km, degrees

  console.log(lla, rae);
  console.log(ecef2eci(ecef, gmst)); // back to TEME
  console.log(lla2ecef(site)); // site in ECEF, km
}
```

Names use `ecef` throughout (`eci2ecef`, `ecef2eci`, `ecef2rae`, `rae2ecef`); there are no
`ecf` variants. `lla2ecef` takes degrees; `llaRad2ecef` and `lla2eci` take radians.

### Phased-array sine space

`azel2uv(az, el)` converts an azimuth and elevation off boresight (radians) to direction cosines
`u = cos(el) sin(az)`, `v = sin(el)`; `uv2azel(u, v)` inverts it. The optional third argument is
a bound on the total off-boresight angle, not a scale factor.

```typescript
import { azel2uv, DEG2RAD, Radians, RAD2DEG, uv2azel } from 'ootk';

const { u, v } = azel2uv((10 * DEG2RAD) as Radians, (5 * DEG2RAD) as Radians);
console.log(u.toFixed(4), v.toFixed(4)); // 0.1730 0.0872

const { az, el } = uv2azel(u, v);
console.log((az * RAD2DEG).toFixed(2), (el * RAD2DEG).toFixed(2)); // 10.00 5.00
```

---

## Orbit Propagation

All propagators extend `Propagator` and return `J2000` states from `propagate(epoch)`.

### SGP4

```typescript
import { EpochUTC, Sgp4Propagator, Tle } from 'ootk';

const tle = new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
);
const prop = new Sgp4Propagator(tle);

const state = prop.propagate(EpochUTC.fromDateTimeString('2024-01-28T13:00:00.000Z')); // J2000
console.log(state.position.toString());
```

`Satellite.eci()` gives the raw TEME output; `Sgp4Propagator` converts each state to J2000 so it
can be mixed with the numerical propagators.

### Kepler (two-body)

```typescript
import { ClassicalElements, DEG2RAD, EpochUTC, KeplerPropagator, Kilometers, Radians, Seconds } from 'ootk';

const epoch = EpochUTC.fromDateTimeString('2024-01-28T00:00:00.000Z');
const elements = new ClassicalElements({
  epoch,
  semimajorAxis: 7000 as Kilometers,
  eccentricity: 0.01,
  inclination: (51.6 * DEG2RAD) as Radians,
  rightAscension: 0 as Radians,
  argPerigee: 0 as Radians,
  trueAnomaly: 0 as Radians,
});

const kepler = new KeplerPropagator(elements);
console.log(kepler.propagate(epoch.roll(3600 as Seconds)).position.toString());
```

### Numerical integrators

`RungeKutta4Propagator` (fixed step, default 15 s), `RungeKutta89Propagator` and
`DormandPrince54Propagator` (adaptive, default tolerance 1e-9) take an initial `J2000` state and
an optional `ForceModel` (default: point-mass Earth gravity).

```typescript
import {
  DormandPrince54Propagator, EpochUTC, ForceModel, RungeKutta4Propagator, RungeKutta89Propagator,
  Satellite, TleLine1, TleLine2,
} from 'ootk';

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const start = sat.toJ2000(new Date('2024-01-28T00:00:00.000Z'));
const stop = EpochUTC.fromDateTimeString('2024-01-28T06:00:00.000Z');

const forces = new ForceModel().setEarthGravity(8, 8).setThirdBodyGravity({ moon: true, sun: true });

const rk4 = new RungeKutta4Propagator(start, forces);
const rk89 = new RungeKutta89Propagator(start, forces);
const dp54 = new DormandPrince54Propagator(start, forces, 1e-9);

console.log(rk4.propagate(stop).position.toString());
console.log(rk89.propagate(stop).position.toString());
console.log(dp54.propagate(stop).position.toString());
```

`propagate()` continues from the cached state; `reset()` returns to the initial state, and
`checkpoint()` / `restore(index)` save and recall intermediate states.

### Ephemeris and event searches

```typescript
import { EpochUTC, Seconds, Sgp4Propagator, Tle } from 'ootk';

const prop = new Sgp4Propagator(new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
));
const start = EpochUTC.fromDateTimeString('2024-01-28T12:00:00.000Z');
const stop = start.roll(5400 as Seconds);

// Sampled every 60 s; the result interpolates between samples
const ephemeris = prop.ephemeris(start, stop, 60 as Seconds);
console.log(ephemeris.interpolate(start.roll(90 as Seconds))?.position.toString());

// Searches over one orbital period from the start epoch
console.log(prop.ascendingNodeEpoch(start).toString());
console.log(prop.perigeeEpoch(start).toString());
```

---

## Force Models

`ForceModel` setters return the model, so calls chain.

| Method | Force | Arguments |
|---|---|---|
| `setGravity(mu?)` | Point-mass central body | km^3/s^2, default `Earth.mu` |
| `setEarthGravity(degree, order)` | EGM96 spherical harmonics | both clamped to 0..36 |
| `setThirdBodyGravity({ moon, sun })` | Lunar and solar point masses | booleans |
| `setSolarRadiationPressure(mass, area, coeff?)` | Cannonball SRP with shadow | kg, m^2, Cr (default 1.2) |
| `setAtmosphericDrag(mass, area, coeff?, cosine?, f107?)` | Harris-Priester drag | kg, m^2, Cd (default 2.2), HP exponent n (default 4), F10.7 in SFU (default 150) |
| `loadManeuver(thrust)` / `clearManeuver()` | Finite burn | `Thrust` |

In `setAtmosphericDrag`, `cosine` is the exponent n in the Harris-Priester cos^n(psi/2) bulge
term (Montenbruck and Gill suggest 2 for low inclination, 6 for polar orbits), not an angle. The
F10.7 value scales the whole Harris-Priester density by a multiplicative factor that equals 1 at
150 SFU (the mean-activity table); the day/night bulge shape is not changed. The drag model is
marked work in progress.

```typescript
import { ForceModel, RungeKutta89Propagator, Satellite, TleLine1, TleLine2, EpochUTC } from 'ootk';

const forces = new ForceModel()
  .setEarthGravity(36, 36)
  .setThirdBodyGravity({ moon: true, sun: true })
  .setSolarRadiationPressure(420000, 1600, 1.3)
  .setAtmosphericDrag(420000, 1600, 2.2, 4, 180);

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const prop = new RungeKutta89Propagator(sat.toJ2000(new Date('2024-01-28T00:00:00.000Z')), forces);

console.log(prop.propagate(EpochUTC.fromDateTimeString('2024-01-28T01:00:00.000Z')).position.toString());
```

### Maneuvers with `Thrust`

`new Thrust(center, radial, intrack, crosstrack, durationRate?)` takes the burn center epoch
and the delta-v components in **m/s** in the RIC frame. `durationRate` (s per m/s) of 0 makes it
impulsive.

```typescript
import { EpochUTC, MetersPerSecond, RungeKutta89Propagator, Satellite, Seconds, Thrust, TleLine1, TleLine2 } from 'ootk';

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const start = sat.toJ2000(new Date('2024-01-28T00:00:00.000Z'));
const prop = new RungeKutta89Propagator(start);

const burn = new Thrust(start.epoch.roll(600 as Seconds), 0 as MetersPerSecond, 5 as MetersPerSecond, 0 as MetersPerSecond);
const states = prop.maneuver(burn, 60 as Seconds); // states through the burn

console.log(states.length, burn.magnitude, 'm/s');
console.log(prop.state.semimajorAxis.toFixed(2), 'km after the burn');
```

---

## Initial Orbit Determination

### Gibbs and Herrick-Gibbs

Both take three position vectors (km); Gibbs suits widely spaced points, Herrick-Gibbs closely
spaced ones (seconds to minutes apart).

```typescript
import { EpochUTC, GibbsIOD, HerrickGibbsIOD, Kilometers, Vector3D } from 'ootk';

const t1 = EpochUTC.fromDateTime(new Date(1704628462000));
const t2 = EpochUTC.fromDateTime(new Date(1704628492000));
const t3 = EpochUTC.fromDateTime(new Date(1704628522000));

const r1 = new Vector3D(-4901.84521484375 as Kilometers, -3592.527587890625 as Kilometers, 3322.875732421875 as Kilometers);
const r2 = new Vector3D(-4738.27734375 as Kilometers, -3707.9072265625 as Kilometers, 3431.36669921875 as Kilometers);
const r3 = new Vector3D(-4569.595703125 as Kilometers, -3819.285400390625 as Kilometers, 3536.144287109375 as Kilometers);

const gibbs = new GibbsIOD().solve(r1, r2, r3, t2, t3); // J2000 state at t2
const herrick = new HerrickGibbsIOD().solve(r1, t1, r2, t2, r3, t3); // J2000 state at t2

console.log(gibbs.velocity.toString());
console.log(herrick.velocity.toString());
```

### Lambert

`LambertIOD.estimate(p1, p2, t1, t2, { shortWay, nRev })` returns the `J2000` state at `t1`, or
`null` when the solver does not converge. `shortWay` (default `true`) selects the transfer angle
below 180 deg; `false` sweeps the long way. It does not choose prograde or retrograde motion.
ootk 7 called this option `posigrade`; the old key is ignored in ootk 8.

```typescript
import { EpochUTC, Kilometers, LambertIOD, Seconds, Vector3D } from 'ootk';

const lambert = new LambertIOD();
const t1 = EpochUTC.fromDateTimeString('2024-01-28T00:00:00.000Z');
const t2 = t1.roll(1800 as Seconds);

const p1 = new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D(0 as Kilometers, 7200 as Kilometers, 500 as Kilometers);

const shortArc = lambert.estimate(p1, p2, t1, t2, { shortWay: true });
const longArc = lambert.estimate(p1, p2, t1, t2, { shortWay: false });

if (shortArc && longArc) {
  console.log(shortArc.velocity.magnitude().toFixed(3), 'km/s short way');
  console.log(longArc.velocity.magnitude().toFixed(3), 'km/s long way');
}
```

### Gooding (angles only)

`GoodingIOD` determines an orbit from three optical observations. `estimate()` seeds the slant
ranges from Gauss IOD; `solve()` takes your own range guesses. This example builds the
observations from a known orbit so the answer can be checked; the remaining error of about 1 km
is the two-body Lambert arc against SGP4.

```typescript
import { Degrees, GoodingIOD, GroundStation, Kilometers, ObservationOptical, RadecTopocentric, Satellite, TleLine1, TleLine2 } from 'ootk';

const site = new GroundStation({ name: 'Observatory', lat: 41.754785 as Degrees, lon: -70.539151 as Degrees, alt: 0.06 as Kilometers });
const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Three angles-only observations two minutes apart during a pass (RA/Dec from the site)
const t0 = new Date('2024-01-29T00:09:00.000Z').getTime();
const [o1, o2, o3] = [0, 120, 240].map((dt) => {
  const date = new Date(t0 + dt * 1000);
  const siteState = site.toJ2000(date);

  return new ObservationOptical(siteState, RadecTopocentric.fromStateVector(sat.toJ2000(date), siteState));
});

const orbit = new GoodingIOD().estimate(o1, o2, o3); // J2000 state at the second observation
const truth = sat.toJ2000(new Date(t0 + 120000));

console.log(orbit.toClassicalElements().toString());
console.log(`Position error ${orbit.position.subtract(truth.position).magnitude().toFixed(3)} km`);
```

### Batch least squares

`BatchLeastSquaresOD` refines an a-priori state against observations. Check `converged` on the
result: it is `false` when `maxIter` was exhausted before the RMS settled. A normal matrix that
the observations cannot invert throws `SingularMatrixError`.

```typescript
import {
  BatchLeastSquaresOD, Degrees, GroundStation, Kilometers, ObservationRadar, RAE, Satellite, SingularMatrixError,
  TleLine1, TleLine2,
} from 'ootk';

const station = new GroundStation({ lat: 41.754785 as Degrees, lon: -70.539151 as Degrees, alt: 0.06 as Kilometers });
const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Synthetic radar observations every 30 s during a pass
const t0 = new Date('2024-01-28T22:43:00.000Z').getTime();
const observations = Array.from({ length: 10 }, (_, i) => {
  const date = new Date(t0 + i * 30000);
  const site = station.toJ2000(date);

  return new ObservationRadar(site, RAE.fromStateVector(sat.toJ2000(date), site));
});

try {
  const result = new BatchLeastSquaresOD(observations, sat.toJ2000(new Date(t0))).solve();

  console.log(`converged: ${result.converged}, weighted rms: ${result.rms.toFixed(3)}`);
  console.log(result.state.position.toString());
} catch (e) {
  if (e instanceof SingularMatrixError) {
    console.log('Observations do not determine the full state');
  } else {
    throw e;
  }
}
```

---

## Observations

### RAE

`RAE` stores range in km and angles in radians, with degree getters. `RAE.fromDegrees` takes
degrees.

```typescript
import { Degrees, EpochUTC, GroundStation, Kilometers, RAE } from 'ootk';

const date = new Date('2024-01-07T11:54:22.000Z');
const station = new GroundStation({ lat: 41.754785 as Degrees, lon: -70.539151 as Degrees, alt: 0.085 as Kilometers });

const obs = RAE.fromDegrees(EpochUTC.fromDateTime(date), 1599.89 as Kilometers, 174 as Degrees, 13.6 as Degrees);
console.log(obs.az, obs.el, obs.rng); // degrees, degrees, km

// Convert the look angles to an inertial position (J2000, km)
console.log(obs.position(station.toJ2000(date)).toString());
```

### Right ascension and declination

```typescript
import { Degrees, GroundStation, Kilometers, RadecGeocentric, RadecTopocentric, Satellite, TleLine1, TleLine2 } from 'ootk';

const date = new Date('2024-01-28T12:00:00.000Z');
const site = new GroundStation({ lat: 34.5 as Degrees, lon: -117.9 as Degrees, alt: 1.2 as Kilometers });
const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const satState = sat.toJ2000(date);
const topo = RadecTopocentric.fromStateVector(satState, site.toJ2000(date));
const geo = RadecGeocentric.fromStateVector(satState);

console.log(topo.rightAscensionDegrees, topo.declinationDegrees, topo.range);
console.log(geo.rightAscensionDegrees, geo.declinationDegrees, geo.range);
```

### Observation wrappers for OD

`ObservationRadar(site, rae, noise?)` and `ObservationOptical(site, radec, noise?)` pair a
measurement with the inertial site state; they are the inputs to `BatchLeastSquaresOD`,
`LevenbergMarquardtOD` and `GoodingIOD`. The default radar noise is 0.32 km in range and
0.015 deg in azimuth and elevation.

---

## Time Systems

`EpochUTC` is the main epoch type; it converts to TAI, TT, TDB and GPS.

```typescript
import { EpochUTC, Seconds } from 'ootk';

const utc = EpochUTC.fromDateTime(new Date('2024-01-28T12:00:00.000Z'));

console.log(utc.toTAI().toString()); // UTC + 37 s
console.log(utc.toTT().toString()); // TAI + 32.184 s
console.log(utc.toTDB().toString());
console.log(utc.toGPS().toString()); // week and seconds

console.log(utc.toJulianDate(), utc.toMjd());
console.log(utc.gmstAngleDegrees()); // Greenwich mean sidereal time

// Arithmetic is in seconds
const later = utc.roll(3600 as Seconds);
console.log(later.difference(utc)); // 3600
console.log(later.toDateTime().toISOString());

// Other constructors
console.log(EpochUTC.fromDateTimeString('2024-01-28T12:00:00.000Z').posix); // seconds since 1970
console.log(EpochUTC.fromDate({ year: 2024, month: 1, day: 28, hour: 12 }).toString());
```

`EpochUTC` has no `addMinutes`, `fromJulianDate` or `toMJD`; use `roll`, `toJulianDate` and
`toMjd`. `EpochWindow(start, end)` holds an interval. Leap seconds come from the built-in table.

For the GMST used by the functional transforms, `calcGmst(date)` returns `{ gmst, j }` with
`gmst` in radians. `jday(year, month, day, hour, minute, second)` returns a Julian date.

---

## Interpolation and Compression

`Propagator.ephemeris()` returns a `VerletBlendInterpolator`; it converts to cubic-spline and
Lagrange interpolators, and `ChebyshevCompressor` fits it with Chebyshev polynomials for compact
storage.

```typescript
import { ChebyshevCompressor, EpochUTC, Seconds, Sgp4Propagator, Tle } from 'ootk';

const prop = new Sgp4Propagator(new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
));
const start = EpochUTC.fromDateTimeString('2024-01-28T12:00:00.000Z');
const ephem = prop.ephemeris(start, start.roll(86400 as Seconds), 60 as Seconds);

const lagrange = ephem.toLagrange(10);
const spline = ephem.toCubicSpline();
const cheb = new ChebyshevCompressor(ephem).compress(21); // segment length defaults to one orbit

const t = start.roll(12345 as Seconds);
console.log(lagrange.interpolate(t)?.position.toString());
console.log(spline.interpolate(t)?.position.toString());
console.log(cheb.interpolate(t)?.position.toString());
console.log(`${ephem.sizeBytes} bytes -> ${cheb.sizeBytes} bytes`);
```

`interpolate()` returns `null` outside the interpolator's window.

---

## Mathematical Operations

### Vectors

```typescript
import { Kilometers, Vector3D } from 'ootk';

const a = new Vector3D(1 as Kilometers, 2 as Kilometers, 3 as Kilometers);
const b = new Vector3D(4 as Kilometers, 5 as Kilometers, 6 as Kilometers);

console.log(a.add(b).toString(), a.subtract(b).toString());
console.log(a.dot(b), a.cross(b).toString());
console.log(a.magnitude(), a.normalize().toString());
console.log(a.angleDegrees(b));
```

`normalize()` of the zero vector returns a new zero vector.

### Matrices

`Matrix.inverse()` uses Gauss-Jordan elimination with partial pivoting and throws
`SingularMatrixError` for a matrix that is singular to working precision; `tryInverse()` returns
`null` instead.

```typescript
import { Matrix, SingularMatrixError } from 'ootk';

const m = new Matrix([
  [4, 7],
  [2, 6],
]);

console.log(m.inverse().elements); // [[0.6, -0.7], [-0.2, 0.4]]
console.log(m.multiply(m.transpose()).elements);

const singular = new Matrix([
  [1, 2],
  [2, 4],
]);

console.log(singular.tryInverse()); // null

try {
  singular.inverse();
} catch (e) {
  console.log(e instanceof SingularMatrixError); // true
}
```

`Matrix.identity(n)`, `Matrix.zero(r, c)`, `Matrix.diagonal(d)` and `Matrix.rotX/rotY/rotZ`
build common matrices; `cholesky()`, `multiplyVector3D()` and `transpose()` round out the set.

### Quaternions and Euler angles

```typescript
import { Degrees, EulerAngles, Quaternion, Vector3D } from 'ootk';

const q = new Quaternion(0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)); // 90 deg about z
console.log(q.rotateVector3D(new Vector3D(1, 0, 0)).toString()); // ~ (0, 1, 0)
console.log(q.angle(Quaternion.one)); // pi / 2

const euler = EulerAngles.fromDegrees(10 as Degrees, 20 as Degrees, 30 as Degrees);
const dcm = euler.dcm321();
console.log(EulerAngles.fromDcm321(dcm).toString()); // round trip
```

### Random numbers

`Random` is a seeded uniform generator; `BoxMuller` and `RandomGaussianSource` produce Gaussian
samples.

```typescript
import { BoxMuller, Random, RandomGaussianSource } from 'ootk';

const rng = new Random(42);
console.log(rng.nextFloat(), rng.nextInt(10), rng.nextBool()); // nextInt(10) is an integer in 0..9

const gauss = new BoxMuller(0, 1, 42); // mean, sigma, seed
console.log(gauss.nextGauss());

const source = new RandomGaussianSource(42);
console.log(source.gaussVector(3).length); // 3
console.log(source.gaussSphere(1).magnitude()); // 1
```

---

## Optimization

```typescript
import { DownhillSimplex, GoldenSection, PolynomialRegression, SimpleLinearRegression } from 'ootk';

// Golden-section search for the minimum of a 1-D function
const xMin = GoldenSection.search((x) => (x - 2) ** 2, 0, 5, { tolerance: 1e-8 });
console.log(xMin.toFixed(6)); // 2.000000

// Nelder-Mead on a 2-D function
const cost = (x: Float64Array): number => (x[0] - 1) ** 2 + (x[1] + 3) ** 2;
const simplex = DownhillSimplex.generateSimplex(Float64Array.from([0, 0]), 0.5);
const best = DownhillSimplex.solveSimplex(cost, simplex, { xTolerance: 1e-10, fTolerance: 1e-12 });
console.log(best[0].toFixed(4), best[1].toFixed(4)); // 1.0000 -3.0000

// Linear regression
const lin = new SimpleLinearRegression([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]);
console.log(lin.slope.toFixed(3), lin.intercept.toFixed(3), lin.evaluate(6).toFixed(2));

// Polynomial regression (coefficients, highest power first)
const xs = Float64Array.from([0, 1, 2, 3, 4]);
const ys = Float64Array.from([1, 3, 9, 19, 33]); // 2x^2 + 1
const fit = PolynomialRegression.solve(xs, ys, 2);
console.log(Array.from(fit.coefficients).map((c) => c.toFixed(2)));
```

`GoldenSection.searchMin` and `searchMax` are shorthands for `search` with `solveMax` false or
true.

---

## Covariance

### StateCovariance

A `StateCovariance` is a 6x6 matrix (km^2, km^2/s, km^2/s^2) tagged with a frame.

```typescript
import { CovarianceFrame, StateCovariance } from 'ootk';

const cov = StateCovariance.fromSigmas([0.5, 1.5, 0.5, 0.001, 0.003, 0.001], CovarianceFrame.RIC);

console.log(cov.frame); // CovarianceFrame.RIC
console.log(cov.matrix.elements[0][0]); // 0.25 km^2 (a variance)
console.log(cov.sigmas().elements); // back to 1-sigma values
```

### From a TLE

TLEs carry no covariance, so these helpers build a plausible one from the TLE's quality and
orbit regime. The sigmas grow with the TLE's age relative to the state epoch (the TLE epoch
here), not relative to the current clock.

```typescript
import {
  cappedScreeningCovarianceFromTle, CovarianceFrame, createCovarianceFromTle, createSampleCovarianceFromTle,
} from 'ootk';

const line1 = '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991';
const line2 = '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741';

const ric = createCovarianceFromTle(line1, line2, CovarianceFrame.RIC);
console.log(ric.sigmas().elements);

const sampled = createSampleCovarianceFromTle(line1, line2); // sigma-point based, RIC by default
console.log(sampled.sigmas().elements);

// Screening covariance: 3-sigma, position sigmas capped at [R, I, C] km
const screening = cappedScreeningCovarianceFromTle(line1, line2, 3, [35, 71, 32]);
console.log(screening.frame); // CovarianceFrame.RIC
console.log(screening.matrix.elements[1][1]); // in-track VARIANCE in km^2
```

`cappedScreeningCovarianceFromTle` returns a real RIC covariance: variances on the diagonal (km^2
and km^2/s^2), axes in R, I, C order, frame `RIC`. The `caps` are 1-sigma limits in km in R, I, C
order and are squared internally; a capped axis has variance exactly cap^2 and correlations are
preserved.

### Covariance sampling

`CovarianceSample(state, covariance, tle?)` propagates a covariance through sigma points:

```typescript
import { CovarianceFrame, CovarianceSample, EpochUTC, Seconds, StateCovariance, Tle } from 'ootk';

const tle = new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
);
const state = tle.state.toJ2000();
const cov = StateCovariance.fromSigmas([0.1, 0.5, 0.1, 0.0001, 0.0005, 0.0001], CovarianceFrame.RIC);

const sample = new CovarianceSample(state, cov, tle);
sample.propagate(state.epoch.roll(3600 as Seconds) as EpochUTC);

console.log(sample.desampleRIC().sigmas().elements);
```

---

## Celestial Bodies

### Earth

```typescript
import { Earth, Kilometers } from 'ootk';

console.log(Earth.mu); // 398600.4415 km^3/s^2
console.log(Earth.radiusEquator); // 6378.1363 km
console.log(Earth.radiusPolar, Earth.flattening, Earth.j2);
console.log(Earth.rotation.z); // rotation rate, rad/s

// Drift of a circular equatorial orbit's sub-satellite longitude, rad per (86400 s) day
const a = 42464 as Kilometers; // 300 km above GEO
console.log(Earth.smaToDriftDegrees(a).toFixed(3), 'deg/day'); // negative: drifts west
console.log(Earth.driftDegreesToSma(-3.75).toFixed(1), 'km');
```

The Earth rotation vector is `Earth.rotation` (there is no `Earth.angularVelocity`). Some helper
code uses the WGS-84 value 6378.137 km for the equatorial radius; `Earth.radiusEquator` is the
EGM96 value 6378.1363 km.

### Sun

```typescript
import { Degrees, GroundStation, Kilometers, Sun } from 'ootk';

const date = new Date('2024-01-28T12:00:00.000Z');
const station = new GroundStation({ name: 'Cape Cod', lat: 41 as Degrees, lon: -71 as Degrees, alt: 0 as Kilometers });

console.log(Sun.eci(date).toString()); // J2000, km
console.log(Sun.getDistanceFromEarth(date)); // km
console.log(Sun.getAzEl(station, date)); // degrees, refraction applied by default

const { sunrise, sunset } = Sun.getSunriseSunset(station, new Date('2024-01-28T00:00:00.000Z'));
console.log(sunrise?.toISOString(), sunset?.toISOString());

const times = Sun.getTimes(date, 41 as Degrees, -71 as Degrees);
console.log(times.solarNoon.toISOString(), times.sunriseStart.toISOString());
```

### Moon

```typescript
import { Degrees, GroundStation, Kilometers, Moon, RAD2DEG } from 'ootk';

const date = new Date('2024-01-28T12:00:00.000Z');
const observer = new GroundStation({ name: 'Cape Cod', lat: 41 as Degrees, lon: -71 as Degrees, alt: 0 as Kilometers });

console.log(Moon.eci(date).toString()); // J2000, km
console.log(Moon.getDistanceFromEarth(date));

// Geocentric right ascension and declination in the J2000 frame (radians)
console.log(Moon.getRightAscension(date) * RAD2DEG, Moon.getDeclination(date) * RAD2DEG);

console.log(Moon.getPhase(date));
console.log(Moon.getIlluminationFraction(date));
console.log(Moon.getMoonTimes(date, observer, true));
```

`getRightAscension` and `getDeclination` are geocentric and in J2000, the same direction as
`eci()`; for an observer's view use `getAzEl`.

### Stars

`Star.rae(lla, date)` gives the geometric azimuth and elevation of a catalog star (J2000 RA/Dec,
precessed and nutated to date), with no atmospheric refraction, matching the geometric elevations
`Satellite.rae()` returns. The range is a fixed rendering distance of 250,000 km.

```typescript
import { Degrees, Kilometers, Radians, Star } from 'ootk';

const sirius = new Star({ name: 'Sirius', ra: 1.7677943 as Radians, dec: -0.2917512 as Radians });

console.log(sirius.rae({ lat: 41 as Degrees, lon: -71 as Degrees, alt: 0 as Kilometers }, new Date('2024-01-28T04:00:00.000Z')));
```

---

## Maneuvers

### Hohmann transfer

`TwoBurnOrbitTransfer.hohmannTransfer(rInit, rFinal)` takes orbit radii in km; velocities are in
km/s and the transfer time in seconds.

```typescript
import { EpochUTC, PlaneChangeBurn, RAD2DEG, TwoBurnOrbitTransfer } from 'ootk';

const transfer = TwoBurnOrbitTransfer.hohmannTransfer(6778, 42164);

console.log(`Burn 1: ${transfer.vTransA.toFixed(3)} km/s`);
console.log(`Burn 2: ${transfer.vTransB.toFixed(3)} km/s`);
console.log(`Total:  ${transfer.deltaV.toFixed(3)} km/s`);
console.log(`Time:   ${(transfer.tTrans / 3600).toFixed(2)} h`);

// The two burns as Thrust objects for a propagator
const [burnA, burnB] = transfer.toManeuvers(EpochUTC.fromDateTimeString('2024-01-28T00:00:00.000Z'));
console.log(burnA.magnitude, burnB.magnitude); // m/s

// Pure plane change at a node: 2 v cos(gamma) sin(di / 2)
const dv = PlaneChangeBurn.computeDeltaV(transfer.vFinal, 28.5 / RAD2DEG);
console.log(`Plane change at GEO: ${dv.toFixed(3)} km/s`);
```

`TwoBurnOrbitTransfer.hohmannTransferWithPlaneChange(rInit, rFinal, deltaIncRad)` splits a plane
change across the two burns, and `PlaneChangeBurn.compute` handles eccentric orbits using the
flight-path angle at the node.

---

## Conjunction Assessment

```typescript
import { ConjunctionAssessment, EpochUTC, Kilometers, Tle } from 'ootk';

const primary = new Tle(
  '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005',
  '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000',
);
const secondary = new Tle(
  '1 44691U 19074A   25019.50000000  .00016500  00000-0  10200-3 0  9006',
  '2 44691  51.6450 339.8050 0002600  90.5050 269.6050 15.50005000000000',
);

const assessment = new ConjunctionAssessment(
  { name: 'ISS', tle: primary, radius: 0.05 as Kilometers },
  { name: 'Secondary', tle: secondary, radius: 0.01 as Kilometers },
);
const event = assessment.assess({
  startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
  endTime: EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z'),
  propagateCovariance: true,
});

console.log(event.tca.toString());
console.log(`Miss ${event.missDistance.toFixed(3)} km`);
console.log(`R/I/C ${event.radialDistance.toFixed(3)} / ${event.intrackDistance.toFixed(3)} / ${event.crosstrackDistance.toFixed(3)} km`);
console.log(`Pc ${event.probabilityOfCollision}`);
```

The secondary covariance is rotated into the primary's RIC frame before the two are summed, and
the 2D probability of collision integrates the projected Gaussian over the hard-body disc
numerically (Foster and Estes), which matches Chan's series for isotropic covariances.

### Catalog screening

`CatalogScreener` runs a coarse apogee/perigee filter, then a full assessment on the survivors.
Two shells are rejected only when one lies above the other by more than `shellPad` (default
`DEFAULT_SHELL_PAD_KM`, 10 km), which absorbs the short-period variation of mean-element
apogee and perigee.

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
const catalog = [{
  tle: new Tle(
    '1 44691U 19074A   25019.50000000  .00016500  00000-0  10200-3 0  9006',
    '2 44691  51.6450 339.8050 0002600  90.5050 269.6050 15.50005000000000',
  ),
}];

const results = CatalogScreener.screenOneToMany(primary, catalog, {
  startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
  endTime: EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z'),
  shellPad: 20 as Kilometers,
});

for (const r of results) {
  console.log(r.secondaryId, r.event.missDistance.toFixed(3), r.riskScore.toFixed(3));
}
```

---

## Ephemeris and Message Files

### CCSDS CDM

`CdmParser.parse(text)` reads a Conjunction Data Message. Per CCSDS 508.0, the file gives miss
distance and relative position in **metres**, relative velocity in m/s and covariance in m^2;
the parser converts everything to ootk's km, km/s and km^2. `CdmExporter.export(event)` writes
metres. Files written by ootk 7 carry explicit `[km]` unit tags, which the parser still honours.

### CCSDS OEM

`OemParser.parse(text)` reads Orbit Ephemeris Messages written to the standard (no `DATA_START`
marker; ootk 7 required one, and it is still accepted). `EphemerisSatellite.fromParsedOem` turns
the result into an object with the usual `eci()`/`lla()` methods. `REF_FRAME` values EME2000,
J2000, ICRF and GCRF are treated as J2000, TEME is kept as TEME, Earth-fixed ITRF variants are
rotated into J2000, and any other frame throws.

```typescript
import { EphemerisSatellite, OemParser } from 'ootk';

// A synthetic circular orbit sampled every 60 s, written as a minimal OEM
const mu = 398600.4415;
const r = 6778;
const n = Math.sqrt(mu / r ** 3);
const lines: string[] = [];

for (let i = 0; i <= 10; i++) {
  const t = i * 60;
  const time = new Date(Date.UTC(2024, 0, 28, 0, 0, t)).toISOString().replace('Z', '');
  const c = Math.cos(n * t);
  const s = Math.sin(n * t);

  lines.push(`${time} ${r * c} ${r * s} 0 ${-r * n * s} ${r * n * c} 0`);
}

const oemText = [
  'CCSDS_OEM_VERS = 2.0',
  'CREATION_DATE = 2024-01-28T00:00:00',
  'ORIGINATOR = EXAMPLE',
  'META_START',
  'OBJECT_NAME = DEMO',
  'OBJECT_ID = 2024-000A',
  'CENTER_NAME = EARTH',
  'REF_FRAME = EME2000',
  'TIME_SYSTEM = UTC',
  'START_TIME = 2024-01-28T00:00:00',
  'STOP_TIME = 2024-01-28T00:10:00',
  'META_STOP',
  ...lines,
].join('\n');

const oem = OemParser.parse(oemText);
const sat = EphemerisSatellite.fromParsedOem(oem);

console.log(oem.dataBlocks[0].ephemeris.length); // 11
console.log(sat.lla(new Date('2024-01-28T00:05:00.000Z')));
```

---

## Utilities

### Decibels

`pow2db(x)` is `10 log10(x)` for a power ratio (ootk 7 called it `mag2db`, which suggested the
`20 log10` amplitude convention).

```typescript
import { pow2db } from 'ootk';

console.log(pow2db(100)); // 20
console.log(pow2db(1000)); // 30
```

### Radar cross section and magnitude

`estimateRcs(length, width, height, shape)` returns an orientation-averaged RCS in **m^2** (the
mean projected area, S/4 for a convex body of surface area S); dimensions are in metres.
`estimateVmagFromRcs(rcs, albedo?)` returns a **standard magnitude** (1000 km range, 90 deg solar
phase) for a diffuse sphere of that projected area and geometric albedo (default 0.2), clamped to
[-5, 15].

```typescript
import { estimateRcs, estimateVmagFromRcs } from 'ootk';

const rcs = estimateRcs(2, 2, 2, 'sphere'); // pi m^2 for a 2 m diameter sphere
console.log(rcs.toFixed(3));

console.log(estimateVmagFromRcs(1)?.toFixed(2)); // about 7.93 for 1 m^2 at albedo 0.2
console.log(estimateVmagFromRcs(1, 0.5)?.toFixed(2)); // brighter for a higher albedo
```

---

## Quick Reference

### Conversions

```typescript
import { DEG2RAD, RAD2DEG } from 'ootk';

const deg = 45;
const rad = deg * DEG2RAD;
console.log(rad, rad * RAD2DEG);

const periodMin = 92.68;
const revPerDay = 1440 / periodMin;
console.log(revPerDay);
```

### Constants

| Name | Value | Notes |
|---|---|---|
| `Earth.mu` | 398600.4415 km^3/s^2 | |
| `Earth.radiusEquator` | 6378.1363 km | EGM96; apogee/perigee altitudes use WGS-84 6378.137 km |
| `Earth.rotation.z` | rad/s | Earth rotation rate |
| `Earth.j2` | 1.08262668e-3 | |
| `DEG2RAD`, `RAD2DEG`, `TAU` | | angle conversion |
| `MINUTES_PER_DAY` | 1440 | |
| `DEFAULT_SHELL_PAD_KM` | 10 km | screening shell pad |

### Return value cheat sheet

| Call | Returns |
|---|---|
| `sat.eci(date)` | TEME `{ position, velocity }` in km and km/s, or null |
| `sat.lla(date)` | `{ lat, lon, alt }` in degrees and km, or null |
| `sat.rae(station, date)` | `{ rng, az, el }` in km and degrees, or null |
| `sat.toJ2000(date)` | `J2000` state |
| `sensor.canObserve(sat, date)` | boolean |
| `AccessCalculator.calculateAccess(...)` | `AccessWindow[]` |
| `lambert.estimate(...)` | `J2000` or null |
| `matrix.inverse()` | `Matrix`, throws `SingularMatrixError` |
| `matrix.tryInverse()` | `Matrix` or null |

## Support and Resources

- [Getting Started](./getting-started.md)
- [Examples](./examples/index.md)
- [Migration guide for ootk 8](./migration-v8.md)
- [GitHub issues](https://github.com/thkruz/ootk/issues)
