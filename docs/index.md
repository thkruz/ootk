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
    details: Propagate positions with SGP4, Kepler, Runge-Kutta (4/89), and Dormand-Prince propagators with configurable force models.
  - title: Sensor Operations
    details: Model ground sensors, compute look angles, check field-of-view constraints, and predict satellite passes.
  - title: Coordinate Systems
    details: Convert between J2000, TEME, ITRF, Geodetic, RIC, Hill, RAE, and SEZ with unit-safe types that prevent mixing degrees and radians.
  - title: Orbit Determination
    details: Determine orbits from observations with Lambert, Gibbs, Herrick-Gibbs, and Gooding angles-only methods.
  - title: Mission Planning
    details: Plan Hohmann and two-burn transfers, compute delta-V budgets, and design constellations.
  - title: Uncertainty Analysis
    details: Build and propagate covariance matrices and run conjunction assessments with probability of collision.
---

## Quick Example

```typescript
import { Satellite, Sensor, Degrees, Kilometers } from 'ootk';

// Create satellite from TLE
const satellite = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
});

// Get current position
const lla = satellite.lla();
console.log(`Lat: ${lla.lat}, Lon: ${lla.lon}, Alt: ${lla.alt} km`);

// Create ground sensor
const sensor = new Sensor({
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
  minEl: 5 as Degrees,
  maxEl: 85 as Degrees,
});

// Check if satellite is visible
if (sensor.isSatInFov(satellite)) {
  const rae = sensor.rae(satellite);
  console.log(`Visible! Az: ${rae.az}, El: ${rae.el}, Range: ${rae.rng} km`);
}

// Predict passes
const passes = sensor.calculatePasses(30, satellite);
console.log(`Found ${passes.length} passes`);
```

## Installation

```bash
npm install ootk
```
