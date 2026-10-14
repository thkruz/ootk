---
layout: home

hero:
  name: ootk
  text: Orbital Object Toolkit
  tagline: Satellite propagation, orbit determination, sensor modeling, and maneuver planning in type-safe TypeScript.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: Working Examples
      link: /examples/
    - theme: alt
      text: GitHub
      link: https://github.com/thkruz/ootk

features:
  - title: Satellite Tracking
    details: Propagate positions with SGP4, Kepler, Runge-Kutta (4 and 8(9)), and Dormand-Prince 5(4) propagators with configurable force models.
  - title: Sensor Operations
    details: Model ground sensors, compute look angles, check field-of-view constraints, and predict satellite passes.
  - title: Coordinate Systems
    details: Convert between J2000, TEME, ITRF, Geodetic, RIC, Hill, RAE, and SEZ with unit-safe types that prevent mixing degrees and radians.
  - title: Orbit Determination
    details: Determine orbits from observations with Lambert, Gibbs, Herrick-Gibbs, and Gooding angles-only methods, then refine them with batch least squares or Levenberg-Marquardt.
  - title: Mission Planning
    details: Plan Hohmann and two-burn transfers, compute delta-V budgets, and design constellations.
  - title: Uncertainty Analysis
    details: Build and propagate covariance matrices and run conjunction assessments with probability of collision.
---

## Quick Example

```typescript
import { Degrees, GroundStation, Kilometers, PhasedArrayRadar, Satellite, SensorType, TleLine1, TleLine2 } from 'ootk';

// Satellite from a TLE (SGP4 is accurate near the TLE epoch, so evaluate near it)
const iss = new Satellite({
  name: 'ISS',
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const date = new Date('2024-01-28T12:00:00Z');

// Geodetic position: degrees and km (null if SGP4 fails)
const lla = iss.lla(date);

if (lla) {
  console.log(`Lat: ${lla.lat.toFixed(2)}, Lon: ${lla.lon.toFixed(2)}, Alt: ${lla.alt.toFixed(1)} km`);
}

// Ground site, with a phased array radar attached as a sensor
const site = new GroundStation({
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
  boresightAz: [47 as Degrees, 167 as Degrees],
  boresightEl: [20 as Degrees, 20 as Degrees],
  fieldOfView: { halfAngle: 60 as Degrees, minRange: 200 as Kilometers, maxRange: 5556 as Kilometers, minElevation: 3 as Degrees },
});

site.addSensor(radar);
radar.setParent(site);

// Look angles and field-of-view check
const rae = radar.getRae(iss, date);

if (rae) {
  console.log(`Az: ${rae.az.toFixed(1)}, El: ${rae.el.toFixed(1)}, Range: ${rae.rng.toFixed(0)} km`);
}
console.log(`In field of view: ${radar.canObserve(iss, date)}`);

// ENTER/EXIT pass events over the next 24 hours, in 1 s steps
const passes = radar.calculatePasses(iss, 24 * 60 * 60, date);

console.log(`Found ${passes.length} pass events`);
```

Upgrading from ootk 7? See [Migrating to v8](/migration-v8).

## Installation

```bash
npm install ootk
```
