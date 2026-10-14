# Getting Started with ootk

This guide walks through the basics of the Orbital Object Toolkit (ootk): loading a satellite
from a TLE, computing where it is, setting up a ground station and a sensor, finding look angles
and passes, and converting between the common coordinate frames. Every example is a complete
TypeScript file that compiles against ootk 8.

Upgrading from ootk 7 or earlier? Read the [v8 migration guide](./migration-v8.md) first.

## Table of Contents

1. [What is ootk?](#what-is-ootk)
2. [Installation](#installation)
3. [Your first satellite](#your-first-satellite)
4. [Units and branded types](#units-and-branded-types)
5. [Ground stations and sensors](#ground-stations-and-sensors)
6. [Finding passes](#finding-passes)
7. [Time](#time)
8. [Coordinate frames](#coordinate-frames)
9. [Troubleshooting](#troubleshooting)
10. [Next steps](#next-steps)

## What is ootk?

ootk is a TypeScript library for orbital mechanics. It covers:

- SGP4 propagation of TLE and OMM element sets
- Ground stations, sensors with fields of view, look angles and access windows
- Conversions between TEME, J2000, ITRF, geodetic, RIC and look-angle (RAE) coordinates
- Numerical propagation with configurable force models
- Initial orbit determination, batch least squares, maneuvers, covariance and conjunction assessment

It runs in Node.js and in browsers. Quantities carry branded unit types (`Degrees`, `Radians`,
`Kilometers`, ...) so that the compiler catches most unit mix-ups.

## Installation

You need Node.js 20 or newer (the package declares `"node": ">=20.0.0"`).

```bash
npm install ootk
```

ootk is published as an ES module with a CommonJS fallback, so both of these work:

```bash
# ESM (package.json has "type": "module", or the file ends in .mjs / .ts)
node my-script.mjs

# TypeScript, run directly
npx tsx my-script.ts
```

## Your first satellite

### Create a satellite from a TLE

TLEs are available from [CelesTrak](https://celestrak.org/) and
[Space-Track](https://www.space-track.org/). The two lines are branded as `TleLine1` and
`TleLine2`, so cast plain strings when you create a `Satellite`:

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  name: 'ISS (ZARYA)',
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

console.log(iss.name); // ISS (ZARYA)
console.log(iss.sccNum); // 25544
```

### Orbital parameters

The mean elements of the TLE are available as properties, in the units shown:

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

console.log(`Inclination:   ${iss.inclination} deg`); // 51.6418
console.log(`RAAN:          ${iss.rightAscension} deg`);
console.log(`Eccentricity:  ${iss.eccentricity}`);
console.log(`Arg. perigee:  ${iss.argOfPerigee} deg`);
console.log(`Mean motion:   ${iss.meanMotion} rev/day`);
console.log(`Period:        ${iss.period.toFixed(2)} min`); // about 92.9
console.log(`Semimajor axis ${iss.semiMajorAxis.toFixed(1)} km`);
// Altitudes above the WGS-84 equatorial radius (6378.137 km)
console.log(`Apogee:        ${iss.apogee.toFixed(1)} km`);
console.log(`Perigee:       ${iss.perigee.toFixed(1)} km`);
// Distances from the Earth's center
console.log(`Apogee radius: ${iss.apogeeRadius.toFixed(1)} km`);
```

`apogee` and `perigee` are altitudes above a sphere of radius 6378.137 km. `apogeeRadius` and
`perigeeRadius` are the geocentric distances `a (1 + e)` and `a (1 - e)`.

### Position and velocity

`eci(date)` runs SGP4 and returns position (km) and velocity (km/s) in the TEME frame, the native
output frame of SGP4. `lla(date)` returns geodetic latitude and longitude in degrees and altitude
in km. Both return `null` when SGP4 fails (for example a decayed orbit or an element set used
far from its epoch), so always check the result.

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Use a time close to the TLE epoch (2024-01-28). TLE accuracy degrades by kilometers per day.
const date = new Date('2024-01-28T12:00:00Z');

const eci = iss.eci(date);

if (eci) {
  const { x, y, z } = eci.position;
  const v = eci.velocity;

  console.log(`TEME position: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)} km`);
  console.log(`Speed: ${Math.hypot(v.x, v.y, v.z).toFixed(3)} km/s`); // about 7.66
}

const lla = iss.lla(date);

if (lla) {
  console.log(`Lat ${lla.lat.toFixed(3)} deg, Lon ${lla.lon.toFixed(3)} deg, Alt ${lla.alt.toFixed(1)} km`);
}
```

If you need an inertial state in J2000 (for numerical propagation or orbit determination), use
`toJ2000(date)`. It throws instead of returning `null` when propagation fails.

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const state = iss.toJ2000(new Date('2024-01-28T12:00:00Z'));

console.log(state.position.magnitude().toFixed(1), 'km from the Earth center');

const elements = state.toClassicalElements();

console.log(`Osculating inclination: ${elements.inclinationDegrees.toFixed(4)} deg`);
console.log(`Osculating period: ${elements.period.toFixed(2)} min`);
```

## Units and branded types

ootk uses branded number types. A `Degrees` value is a `number` at runtime, but the compiler will
not let you pass it where `Radians` is expected. Cast literals when you create them:

```typescript
import { DEG2RAD, Degrees, Kilometers, Radians, RAD2DEG } from 'ootk';

const lat = 41.75 as Degrees;
const alt = 0.06 as Kilometers;
const latRad = (lat * DEG2RAD) as Radians;

console.log(latRad, (latRad * RAD2DEG) as Degrees, alt);
```

Conventions used throughout the library:

| Quantity | Unit |
|---|---|
| Distance | km (`Kilometers`) |
| Velocity | km/s (`KilometersPerSecond`) |
| `Satellite.lla()`, `GroundStation` lat/lon, look angles | degrees |
| `ClassicalElements`, `Geodetic` constructor, `lla2eci` input | radians |
| `Satellite.period`, `ClassicalElements.period` | minutes |
| `EpochUTC.roll()`, `EpochUTC.difference()` | seconds |

When an API takes radians, convert explicitly with `DEG2RAD`; a `Degrees` value cast to `Radians`
compiles but gives a wrong answer.

## Ground stations and sensors

### Ground stations

A `GroundStation` is a fixed location on the Earth: latitude and longitude in degrees, altitude
in km. A satellite can give you look angles from any ground object directly:

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

const date = new Date('2024-01-28T12:00:00Z');
const rae = iss.rae(station, date);

if (rae) {
  console.log(`Azimuth ${rae.az.toFixed(2)} deg, elevation ${rae.el.toFixed(2)} deg, range ${rae.rng.toFixed(1)} km`);
  console.log(rae.el > 0 ? 'Above the horizon' : 'Below the horizon');
}
```

Azimuth is measured clockwise from north, elevation is the geometric angle above the local
horizon (no refraction), and range is the slant range in km.

### Sensors

A sensor is a component attached to a platform. `Sensor` itself is abstract; you create a concrete
type such as `PhasedArrayRadar`, `MechanicalRadar`, `OpticalSensor`, `PassiveRFSensor`,
`LaserRangingSensor` or `TtcAntenna`. Every sensor needs a numeric `id`, a `name`, a `sensorType`
and a `fieldOfView`. The field of view is a cone around a boresight direction; `halfAngle`,
`minRange` and `maxRange` are required, and a missing or invalid `halfAngle` throws a
`ValidationError`.

```typescript
import { Degrees, GroundStation, Kilometers, PhasedArrayRadar, Satellite, SensorType, TleLine1, TleLine2 } from 'ootk';

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
  boresightAz: [47 as Degrees, 167 as Degrees], // one entry per array face
  boresightEl: [20 as Degrees, 20 as Degrees],
  fieldOfView: {
    halfAngle: 60 as Degrees,
    minRange: 200 as Kilometers,
    maxRange: 5556 as Kilometers,
    minElevation: 3 as Degrees,
  },
});

// Attach the sensor to its platform (both calls are needed)
station.addSensor(radar);
radar.setParent(station);

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const date = new Date('2024-01-28T12:00:00Z');

// Look angles from the sensor's platform
const rae = radar.getRae(iss, date);

if (rae) {
  console.log(`Az ${rae.az.toFixed(1)}, El ${rae.el.toFixed(1)}, Rng ${rae.rng.toFixed(0)} km`);
}

// Full field-of-view test: cone, range limits and elevation limits
console.log(`In FOV: ${radar.canObserve(iss, date)}`);
```

The FOV parameters you may set:

| Field | Meaning |
|---|---|
| `halfAngle` (required) | Cone half-angle in degrees, in (0, 90]; the major half-angle for an elliptical cone |
| `minorHalfAngle` | Minor half-angle for an elliptical cone (defaults to `halfAngle`) |
| `boresightAz`, `boresightEl` | Boresight direction in degrees (defaults 0 and 90). A `PhasedArrayRadar` sets these per face from its own `boresightAz` / `boresightEl` arrays |
| `rollAngle` | Rotation of the ellipse about the boresight, degrees (default 0) |
| `minRange`, `maxRange` (required) | Range limits in km |
| `minElevation` | Global minimum elevation in degrees (default 0) |
| `elevationMasks` | Azimuth-dependent terrain masks |

For a boresight that is not at the zenith, roll 0 puts the major axis of an elliptical cone along
the local "up" direction projected onto the plane perpendicular to the boresight. For a boresight
pointing straight up (`boresightEl` 90), roll 0 puts the major axis along the boresight azimuth.
This zenith convention changed in ootk 8; see the [migration guide](./migration-v8.md) if you have
zenith-pointing fans configured for ootk 7.

## Finding passes

There are two tools for pass prediction.

`AccessCalculator.calculateAccess` works for any ground object and finds windows when a target
is above a minimum elevation and within range limits. It samples on a coarse step (default
10 s) and then bisects each rise and set edge to 1 ms.

```typescript
import { AccessCalculator, Degrees, GroundStation, Kilometers, Satellite, TleLine1, TleLine2 } from 'ootk';

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

const start = new Date('2024-01-28T12:00:00Z');
const end = new Date('2024-01-29T12:00:00Z');

const windows = AccessCalculator.calculateAccess(station, iss, start, end, { minElevation: 10 as Degrees });

for (const w of windows) {
  console.log(
    `${w.start.toISOString()} to ${w.end.toISOString()}, ` +
    `max el ${w.maxElevation.toFixed(1)} deg, ${(w.duration / 1000).toFixed(0)} s`,
  );
}

// The next pass that starts at or after a given time
const next = AccessCalculator.getNextAccess(station, iss, start, { minElevation: 10 as Degrees });

console.log(next ? `Next pass rises at ${next.start.toISOString()}` : 'No pass in the next 7 days');
```

`Sensor.calculatePasses(target, planningIntervalSeconds, startDate)` uses the sensor's full field
of view instead. It steps once per second and returns `Lookangle` events: an `ENTER` event when the
target enters the FOV and an `EXIT` event (with `maxElPass`) when it leaves.

```typescript
import {
  Degrees, GroundStation, Kilometers, PassType, PhasedArrayRadar, Satellite, SensorType, TleLine1, TleLine2,
} from 'ootk';

const station = new GroundStation({
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
});

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

// 12 hours, starting at a fixed date near the TLE epoch
const events = radar.calculatePasses(iss, 12 * 3600, new Date('2024-01-28T12:00:00Z'));

for (const event of events) {
  if (event.type === PassType.ENTER) {
    console.log(`Enter ${event.time.toISOString()} az ${event.az.toFixed(1)} el ${event.el.toFixed(1)}`);
  } else if (event.type === PassType.EXIT) {
    console.log(`Exit  ${event.time.toISOString()} max el ${event.maxElPass?.toFixed(1)}`);
  }
}
```

Because it samples every second, `calculatePasses` costs one propagation per second of the
interval. For long spans prefer `AccessCalculator`.

## Time

`EpochUTC` is the library's time type. It is created from a JavaScript `Date` or an ISO string,
and converts to the other time scales:

```typescript
import { EpochUTC, Seconds } from 'ootk';

const epoch = EpochUTC.fromDateTime(new Date('2024-01-28T12:00:00Z'));
const same = EpochUTC.fromDateTimeString('2024-01-28T12:00:00.000Z');

console.log(epoch.toJulianDate()); // 2460338
console.log(epoch.toMjd()); // 60337.5
console.log(epoch.toTAI().toString()); // UTC + 37 s
console.log(epoch.toTT().toString()); // TAI + 32.184 s
console.log(epoch.toGPS().toString()); // GPS week and seconds of week

// roll() and difference() work in seconds
const later = epoch.roll(3600 as Seconds);

console.log(later.difference(same)); // 3600
console.log(later.toDateTime().toISOString());
```

Most object methods (`Satellite.eci`, `lla`, `rae`, `toJ2000`, sensors) take a plain `Date`.
State vectors (`J2000`, `TEME`, `ITRF`) carry an `EpochUTC`.

## Coordinate frames

| Frame | Class | Description |
|---|---|---|
| TEME | `TEME` | True equator, mean equinox. SGP4 output, returned by `Satellite.eci()` |
| J2000 | `J2000` | Inertial frame (EME2000). Used by numerical propagators and orbit determination |
| ITRF | `ITRF` | Earth-fixed frame (no polar motion is applied, so it is the pseudo Earth-fixed frame) |
| Geodetic | `Geodetic` | Latitude, longitude (radians internally) and altitude above the WGS-84 ellipsoid |
| RAE | `RAE` | Range, azimuth, elevation from an observer |
| RIC | `RIC` | Radial, in-track, cross-track relative to a reference orbit |

The state-vector classes chain into each other:

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const j2000 = iss.toJ2000(new Date('2024-01-28T12:00:00Z'));
const teme = j2000.toTEME();
const itrf = j2000.toITRF();
const geodetic = itrf.toGeodetic();

console.log(teme.position.toString());
console.log(itrf.position.toString());
console.log(`${geodetic.latDeg.toFixed(4)} deg, ${geodetic.lonDeg.toFixed(4)} deg, ${geodetic.alt.toFixed(2)} km`);
```

The low-level functions in `transforms` work on plain `{x, y, z}` objects. The ECI inputs of
`eci2lla`, `eci2ecef` and `eci2rae` are TEME (the frame that `Satellite.eci()` returns), rotated
to Earth-fixed with Greenwich mean sidereal time. Feeding them a J2000 vector introduces an error
of about a third of a degree in longitude today, from precession since 2000.

```typescript
import { calcGmst, eci2ecef, eci2lla, ecef2eci, Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const date = new Date('2024-01-28T12:00:00Z');
const eci = iss.eci(date); // TEME

if (eci) {
  const { gmst } = calcGmst(date);
  const ecef = eci2ecef(eci.position, gmst);
  const lla = eci2lla(eci.position, gmst); // degrees and km
  const back = ecef2eci(ecef, gmst);

  console.log(ecef, lla, back);
}
```

`lla2eci` goes the other way, but takes latitude and longitude in radians:

```typescript
import { calcGmst, DEG2RAD, Kilometers, lla2eci, Radians } from 'ootk';

const { gmst } = calcGmst(new Date('2024-01-28T12:00:00Z'));
const teme = lla2eci(
  { lat: (41.75 * DEG2RAD) as Radians, lon: (-70.54 * DEG2RAD) as Radians, alt: 0.06 as Kilometers },
  gmst,
);

console.log(teme); // km, TEME
```

`Geodetic` also takes radians in its constructor; use `Geodetic.fromDegrees` for degree input:

```typescript
import { Degrees, Geodetic, Kilometers } from 'ootk';

const boston = Geodetic.fromDegrees(42.36 as Degrees, -71.06 as Degrees, 0 as Kilometers);
const london = Geodetic.fromDegrees(51.51 as Degrees, -0.13 as Degrees, 0 as Kilometers);

console.log(`${boston.distance(london).toFixed(0)} km great-circle distance`);
```

## Troubleshooting

**`lla()` or `eci()` returns `null`.** SGP4 failed. The most common cause is propagating a TLE
far from its epoch (a 2024 ISS TLE used in 2026, for example, has decayed in the model). Fetch a
current TLE, or pass a date close to the TLE epoch. `iss.ageOfElset(date)` gives the TLE age in
days.

**TypeScript rejects a number.** Cast it to the branded type: `41.7 as Degrees`, `500 as Kilometers`.
A TLE string needs `as TleLine1` / `as TleLine2`.

**`ValidationError: Half angle must be between 0 and 90 degrees`.** Every sensor `fieldOfView`
needs a `halfAngle`. For an all-sky sensor use `halfAngle: 90` with the default zenith boresight,
or `FieldOfView.hemisphere(minRange, maxRange, minEl)`.

**Sensor methods throw about a missing parent.** Call both `station.addSensor(sensor)` and
`sensor.setParent(station)`.

**No passes found.** Widen the time span, lower `minElevation`, raise `maxRange`, and check the
orbit: a geostationary satellite never rises or sets.

**Positions look wrong by a fraction of a degree.** Check which frame you are in. `Satellite.eci()`
is TEME; `Satellite.toJ2000()` is J2000. The low-level `eci2*` transforms expect TEME.

## Next steps

- [User Guide](./user-guide.md): reference for all modules
- [Advanced Features](./advanced-features-guide.md): numerical propagation, orbit determination,
  maneuvers, covariance and conjunction assessment
- [Examples](./examples/index.md): runnable scripts with their output
- [v8 migration guide](./migration-v8.md): breaking changes since ootk 7
- Issues: <https://github.com/thkruz/ootk/issues>

ootk is licensed under AGPL-3.0-or-later.
