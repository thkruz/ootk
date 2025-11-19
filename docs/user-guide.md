# OOTK User Guide

**Orbital Object Toolkit (ootk)** - Comprehensive Documentation

Version: 5.1.1

---

## Table of Contents

1. [Introduction](#introduction)
2. [Core Concepts](#core-concepts)
3. [Satellite Operations](#satellite-operations)
4. [Sensor Operations](#sensor-operations)
5. [Coordinate Systems](#coordinate-systems)
6. [Orbit Propagation](#orbit-propagation)
7. [Force Models](#force-models)
8. [Initial Orbit Determination](#initial-orbit-determination)
9. [Observations](#observations)
10. [Time Systems](#time-systems)
11. [Interpolation](#interpolation)
12. [Mathematical Operations](#mathematical-operations)
13. [Optimization](#optimization)
14. [Covariance](#covariance)
15. [Celestial Bodies](#celestial-bodies)
16. [Maneuvers](#maneuvers)
17. [Advanced Topics](#advanced-topics)

---

## Introduction

OOTK is a comprehensive TypeScript/JavaScript library for orbital mechanics calculations. Originally developed for the [KeepTrack](https://github.com/thkruz/keeptrack.space) satellite tracking application, it provides a complete toolkit for working with satellites, orbital objects, sensors, and celestial mechanics.

### What Can OOTK Do?

- **Satellite Tracking**: Parse TLE data and propagate satellite positions using SGP4 or numerical integrators
- **Sensor Operations**: Calculate visibility, field-of-view, and predict satellite passes
- **Orbit Determination**: Determine orbits from observations using multiple IOD methods
- **Coordinate Transformations**: Convert between ECI, ECF, geodetic, and other coordinate systems
- **High-Precision Propagation**: Model perturbations including gravity harmonics, third-body effects, solar radiation pressure, and atmospheric drag
- **Mission Planning**: Calculate orbital maneuvers, transfers, and delta-v requirements
- **Time Systems**: Handle multiple time systems (UTC, TAI, TT, GPS, TDB) with conversions

### Key Features

- **Type-Safe**: Written in TypeScript with comprehensive type definitions
- **Unit Types**: Distinct types for Degrees, Radians, Kilometers, Meters, etc.
- **Multiple Propagators**: SGP4, Kepler, Runge-Kutta (4th, 8/9th order), Dormand-Prince
- **Coordinate Systems**: J2000, TEME, ITRF, Geodetic, RIC, Hill, and more
- **Browser & Node.js**: Works in both environments

---

## Core Concepts

### Type Safety with Units

OOTK uses TypeScript's type system to enforce unit safety:

```typescript
import { Degrees, Radians, Kilometers, Meters } from 'ootk';

// Type-safe units prevent mixing incompatible values
const latitude = 41.754785 as Degrees;
const altitude = 0.060966 as Kilometers;

// Compilation error if you try to mix units incorrectly
// const wrong = latitude + altitude; // Error!
```

**Available Unit Types:**
- **Angular**: `Degrees`, `Radians`
- **Distance**: `Kilometers`, `Meters`
- **Time**: `Seconds`, `Minutes`, `Hours`, `Days`
- **Velocity**: `KilometersPerSecond`, `MetersPerSecond`
- **Angular Velocity**: `RadiansPerSecond`

### Vector Types

OOTK provides specialized vector types for different coordinate systems:

```typescript
import { EciVec3, EcfVec3, LlaVec3, RaeVec3 } from 'ootk';

// ECI (Earth-Centered Inertial) vector
const eciPos: EciVec3 = { x: 6778.137, y: 0, z: 0 } as EciVec3<Kilometers>;

// Geodetic coordinates
const lla: LlaVec3 = {
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers
};

// Range, Azimuth, Elevation
const rae: RaeVec3 = {
  rng: 1000 as Kilometers,
  az: 180 as Degrees,
  el: 45 as Degrees
};
```

### Enumerations

Type-safe enums for common values:

```typescript
import { OrbitRegime, SpaceObjectType, Sgp4OpsMode } from 'ootk';

const regime = OrbitRegime.LEO;  // LEO, MEO, GEO, VHEO, DEEP
const type = SpaceObjectType.PAYLOAD;
const opsMode = Sgp4OpsMode.AFSPC;  // AFSPC or IMPROVED
```

---

## Satellite Operations

### Creating Satellites

#### From TLE (Two-Line Elements)

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const satellite = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2
});
```

#### From Orbital Elements

```typescript
import { Satellite, ClassicalElements, Degrees, Kilometers } from 'ootk';

const elements = new ClassicalElements({
  epoch: EpochUTC.fromDateTime(new Date()),
  semimajorAxis: 6778.137 as Kilometers,
  eccentricity: 0.001,
  inclination: 51.6418 as Degrees,
  rightAscension: 292.259 as Degrees,
  argOfPerigee: 167.5319 as Degrees,
  trueAnomaly: 252.046 as Degrees
});

const tle = elements.toTLE({
  intlDes: '98067A',
  epochYear: 24,
  epochDay: 28.54545847
});

const satellite = new Satellite({ tle1: tle.line1, tle2: tle.line2 });
```

#### DetailedSatellite

For additional metadata:

```typescript
import { DetailedSatellite } from 'ootk';

const satellite = new DetailedSatellite({
  tle1: line1,
  tle2: line2,
  id: 25544,
  name: 'ISS (ZARYA)',
  country: 'US',
  launchDate: new Date('1998-11-20'),
  mass: 419700,  // kg
  shape: 'Composite',
  period: 92.91,  // minutes
  apogee: 422.7,  // km
  perigee: 418.9  // km
});
```

### Getting Satellite Position

#### ECI (Earth-Centered Inertial)

```typescript
// Current time
const eci = satellite.eci();
console.log(eci.position);  // { x, y, z } in km
console.log(eci.velocity);  // { x, y, z } in km/s

// Specific time
const date = new Date('2024-01-28T12:00:00Z');
const eciAtTime = satellite.eci(date);
```

#### Geodetic (Latitude/Longitude/Altitude)

```typescript
const lla = satellite.lla();
console.log(lla.lat);  // Latitude in degrees
console.log(lla.lon);  // Longitude in degrees
console.log(lla.alt);  // Altitude in kilometers
```

#### ECF (Earth-Centered Fixed)

```typescript
const ecf = satellite.ecf();
console.log(ecf.position);  // { x, y, z } in Earth-fixed frame
```

### Orbital Parameters

Access Keplerian orbital elements:

```typescript
console.log(satellite.inclination);      // Degrees
console.log(satellite.eccentricity);     // 0-1
console.log(satellite.period);           // Minutes
console.log(satellite.apogee);           // Kilometers
console.log(satellite.perigee);          // Kilometers
console.log(satellite.semiMajorAxis);    // Kilometers
console.log(satellite.semiMinorAxis);    // Kilometers
console.log(satellite.rightAscension);   // Degrees
console.log(satellite.argOfPerigee);     // Degrees
console.log(satellite.meanMotion);       // Revolutions per day
```

### Coordinate Conversions

```typescript
// Convert to J2000 coordinate system
const j2000 = satellite.toJ2000(date);
console.log(j2000.position);
console.log(j2000.velocity);

// Convert to ITRF (Earth-fixed)
const itrf = satellite.toITRF(date);

// Get classical orbital elements
const elements = satellite.getClassicalElements();
```

### Satellite Visibility

```typescript
// Check if satellite is in sunlight
const inSunlight = satellite.isInSunlight(date);

// Get illumination (0 = shadowed, 1 = fully illuminated)
const illumination = satellite.getIllumination(date);
```

---

## Sensor Operations

### Creating Sensors

#### Basic Sensor

```typescript
import { Sensor, Degrees, Kilometers } from 'ootk';

const sensor = new Sensor({
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
  minEl: 3 as Degrees,      // Minimum elevation angle
  maxEl: 85 as Degrees,     // Maximum elevation angle
  minRng: 0 as Kilometers,   // Minimum range
  maxRng: 5556 as Kilometers // Maximum range
});
```

#### DetailedSensor

For ground stations with additional metadata:

```typescript
import { DetailedSensor, SpaceObjectType } from 'ootk';

const sensor = new DetailedSensor({
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
  minAz: 347 as Degrees,
  maxAz: 227 as Degrees,
  minEl: 3 as Degrees,
  maxEl: 85 as Degrees,
  minRng: 0 as Kilometers,
  maxRng: 5556 as Kilometers,
  name: 'Cape Cod Space Force Station',
  type: SpaceObjectType.PHASED_ARRAY_RADAR,
  country: 'United States',
  freqBand: 'UHF',
  operator: 'USSF'
});
```

#### RF Sensor

For RF sensors with phased array capabilities:

```typescript
import { RfSensor } from 'ootk';

const rfSensor = new RfSensor({
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
  minEl: 3 as Degrees,
  maxEl: 85 as Degrees,
  beamwidth: 2 as Degrees,  // Antenna beamwidth
  frequency: 420 // MHz
});
```

### Range, Azimuth, Elevation (RAE)

Calculate look angles from sensor to satellite:

```typescript
const rae = sensor.rae(satellite);

console.log(rae.rng);  // Range in kilometers
console.log(rae.az);   // Azimuth in degrees (0-360)
console.log(rae.el);   // Elevation in degrees (-90 to 90)
console.log(rae.rngRate);  // Range rate (km/s)

// At a specific time
const raeAtTime = sensor.rae(satellite, date);
```

### Field of View

Check if satellite is visible:

```typescript
// Check if satellite is in sensor's field of view
const isVisible = sensor.isSatInFov(satellite);
console.log(isVisible);  // true or false

// At a specific time
const isVisibleAtTime = sensor.isSatInFov(satellite, date);
```

### Pass Predictions

Calculate when satellite will be visible:

```typescript
// Calculate passes over next 7 days in 30-second intervals
const passes = sensor.calculatePasses(30, satellite, {
  startDate: new Date(),
  lengthDays: 7
});

passes.forEach(pass => {
  console.log('Rise time:', pass.rise);
  console.log('Culmination time:', pass.culmination);
  console.log('Set time:', pass.set);
  console.log('Max elevation:', pass.maxEl);
  console.log('Duration:', pass.duration);  // seconds
});
```

### Sensor Position in ECI

```typescript
// Get sensor position in J2000 ECI coordinates
const j2000 = sensor.toJ2000();
console.log(j2000.position);

// At a specific time
const j2000AtTime = sensor.toJ2000(date);
```

---

## Coordinate Systems

OOTK supports multiple coordinate systems with easy conversions between them.

### Earth-Centered Inertial (ECI)

#### J2000

Standard inertial frame at epoch J2000.0:

```typescript
import { J2000, Kilometers, KilometersPerSecond } from 'ootk';

const j2000 = new J2000(
  epoch,
  { x: 6778.137, y: 0, z: 0 } as EciVec3<Kilometers>,
  { x: 0, y: 7.67, z: 0 } as EciVec3<KilometersPerSecond>
);

// Convert to other frames
const teme = j2000.toTEME();
const itrf = j2000.toITRF();
```

#### TEME (True Equator Mean Equinox)

Used by SGP4 propagator:

```typescript
import { TEME } from 'ootk';

const teme = new TEME(epoch, position, velocity);

// Convert to J2000
const j2000 = teme.toJ2000();
```

### Earth-Centered Fixed (ECF)

#### ITRF (International Terrestrial Reference Frame)

Earth-fixed frame that rotates with Earth:

```typescript
import { ITRF } from 'ootk';

const itrf = new ITRF(epoch, position, velocity);

// Convert to inertial
const j2000 = itrf.toJ2000();
```

### Geodetic Coordinates

Latitude, Longitude, Altitude:

```typescript
import { Geodetic } from 'ootk';

const geodetic = new Geodetic(
  41.754785 as Degrees,
  -70.539151 as Degrees,
  0.060966 as Kilometers
);

// Convert to ECF
const itrf = geodetic.toITRF();

// Convert to ECI
const j2000 = geodetic.toJ2000(epoch);
```

### Classical Orbital Elements

```typescript
import { ClassicalElements } from 'ootk';

const elements = new ClassicalElements({
  epoch: epoch,
  semimajorAxis: 6778.137 as Kilometers,
  eccentricity: 0.001,
  inclination: 51.6418 as Degrees,
  rightAscension: 292.259 as Degrees,
  argOfPerigee: 167.5319 as Degrees,
  trueAnomaly: 252.046 as Degrees
});

// Convert to position/velocity
const pv = elements.toPositionVelocity();

// Generate TLE
const tle = elements.toTLE({
  intlDes: '98067A',
  epochYear: 24,
  epochDay: 28.54545847
});
```

### Equinoctial Elements

Non-singular orbital elements:

```typescript
import { EquinoctialElements } from 'ootk';

const equinoctial = new EquinoctialElements(
  epoch,
  a,  // semi-major axis
  h,  // h = e * sin(ω + Ω)
  k,  // k = e * cos(ω + Ω)
  p,  // p = tan(i/2) * sin(Ω)
  q,  // q = tan(i/2) * cos(Ω)
  λ   // mean longitude
);

// Convert to classical elements
const classical = equinoctial.toClassicalElements();
```

### Relative Frames

#### RIC (Radial-In-track-Cross-track)

```typescript
import { RIC } from 'ootk';

// Create RIC frame relative to a reference satellite
const ric = RIC.fromJ2000(referenceState, targetState);

console.log(ric.position.x);  // Radial component
console.log(ric.position.y);  // In-track component
console.log(ric.position.z);  // Cross-track component
```

#### Hill Frame

Similar to RIC but with different conventions:

```typescript
import { Hill } from 'ootk';

const hill = Hill.fromJ2000(referenceState, targetState);
```

### TLE (Two-Line Element)

Parse and create TLE data:

```typescript
import { Tle } from 'ootk';

// Parse existing TLE
const tle = new Tle(line1, line2);
console.log(tle.inclination);
console.log(tle.eccentricity);
console.log(tle.meanMotion);

// Create from classical elements
const newTle = ClassicalElements.toTLE(elements, metadata);
```

---

## Orbit Propagation

### SGP4 Propagator

Standard propagator for TLE data:

```typescript
import { Satellite, Sgp4Propagator, EpochUTC } from 'ootk';

const satellite = new Satellite({ tle1, tle2 });
const propagator = new Sgp4Propagator(satellite);

// Propagate to a specific time
const futureEpoch = EpochUTC.fromDateTime(new Date('2024-12-31'));
const state = propagator.propagate(futureEpoch);

console.log(state.position);  // TEME coordinates
console.log(state.velocity);
```

**SGP4 Operation Modes:**

```typescript
import { Sgp4OpsMode } from 'ootk';

// AFSPC mode (original)
const propagatorAFSPC = new Sgp4Propagator(satellite, Sgp4OpsMode.AFSPC);

// Improved mode (recommended)
const propagatorImproved = new Sgp4Propagator(satellite, Sgp4OpsMode.IMPROVED);
```

### Kepler Propagator

Simple two-body propagation (fastest, least accurate):

```typescript
import { KeplerPropagator } from 'ootk';

const initialState = satellite.toJ2000();
const propagator = new KeplerPropagator(initialState);

const futureState = propagator.propagate(futureEpoch);
```

### Runge-Kutta 4 Propagator

4th-order Runge-Kutta numerical integration:

```typescript
import { RungeKutta4Propagator, ForceModel } from 'ootk';

const forceModel = new ForceModel();
forceModel.setEarthGravity(4, 4);  // 4x4 gravity field

const propagator = new RungeKutta4Propagator(
  initialState,
  forceModel,
  { stepSize: 60 }  // 60 second steps
);

const futureState = propagator.propagate(futureEpoch);
```

### Runge-Kutta 89 Propagator

8/9th-order with adaptive step size (high accuracy):

```typescript
import { RungeKutta89Propagator } from 'ootk';

const propagator = new RungeKutta89Propagator(
  initialState,
  forceModel,
  {
    minStepSize: 0.01,  // seconds
    maxStepSize: 600,   // seconds
    tolerance: 1e-9     // error tolerance
  }
);

const futureState = propagator.propagate(futureEpoch);
```

### Dormand-Prince 5(4) Propagator

Adaptive Runge-Kutta method:

```typescript
import { DormandPrince54Propagator } from 'ootk';

const propagator = new DormandPrince54Propagator(
  initialState,
  forceModel,
  {
    minStepSize: 0.01,
    maxStepSize: 600,
    tolerance: 1e-9
  }
);

const futureState = propagator.propagate(futureEpoch);
```

### Propagator Comparison

| Propagator | Accuracy | Speed | Use Case |
|------------|----------|-------|----------|
| SGP4 | Good | Very Fast | TLE propagation, Earth orbits |
| Kepler | Low | Fastest | Quick estimates, educational |
| RK4 | High | Moderate | General purpose |
| RK89 | Very High | Slower | High-precision requirements |
| Dormand-Prince | High | Moderate | Balanced accuracy/speed |

---

## Force Models

For high-precision propagation, configure perturbation forces:

### Creating a Force Model

```typescript
import { ForceModel } from 'ootk';

const forceModel = new ForceModel();
```

### Earth Gravity

Include gravitational harmonics:

```typescript
// Point mass gravity (fastest)
forceModel.setEarthGravity(0, 0);

// J2 perturbation only
forceModel.setEarthGravity(2, 0);

// 8x8 gravity field (recommended for LEO)
forceModel.setEarthGravity(8, 8);

// 20x20 gravity field (high precision)
forceModel.setEarthGravity(20, 20);
```

**Degree/Order Guide:**
- `(0, 0)` - Point mass only
- `(2, 0)` - J2 oblateness
- `(4, 4)` - Basic harmonics
- `(8, 8)` - Good for most applications
- `(20, 20)` - High precision
- `(70, 70)` - Maximum precision (slow)

### Third-Body Gravity

Sun and Moon perturbations:

```typescript
forceModel.setThirdBodyGravity({
  sun: true,
  moon: true
});
```

### Solar Radiation Pressure

```typescript
// Basic SRP
forceModel.setSolarRadiationPressure(
  1000,  // mass in kg
  10,    // cross-sectional area in m²
  1.5    // radiation pressure coefficient (typically 1.0-2.0)
);
```

### Atmospheric Drag

```typescript
forceModel.setAtmosphericDrag(
  1000,  // mass in kg
  10,    // cross-sectional area in m²
  2.2    // drag coefficient (typically 2.0-2.5)
);
```

### Thrust

For maneuvers:

```typescript
import { Thrust, Vector3D } from 'ootk';

const thrust = new Thrust(
  new Vector3D(100, 0, 0),  // thrust vector in Newtons
  startEpoch,
  endEpoch
);

forceModel.addThrust(thrust);
```

### Complete Example

```typescript
const forceModel = new ForceModel();

// Configure all perturbations
forceModel.setEarthGravity(20, 20);
forceModel.setThirdBodyGravity({ sun: true, moon: true });
forceModel.setSolarRadiationPressure(500, 15, 1.5);
forceModel.setAtmosphericDrag(500, 15, 2.2);

// Use with propagator
const propagator = new RungeKutta89Propagator(
  initialState,
  forceModel,
  { tolerance: 1e-12 }
);
```

---

## Initial Orbit Determination

Determine orbits from observations using various IOD methods.

### Gibbsmethod

Determine orbit from 3 position vectors:

```typescript
import { GibbsIOD, Vector3D, EpochUTC } from 'ootk';

const iod = new GibbsIOD();

const r1 = new Vector3D(6778, 0, 0);
const r2 = new Vector3D(0, 6778, 0);
const r3 = new Vector3D(-6778, 0, 0);

const result = iod.estimate(r1, r2, r3);

console.log(result.velocity);  // Determined velocity
console.log(result.orbit);     // Orbital elements
```

### Herrick-Gibbs IOD

Improved Gibbs method using observation times:

```typescript
import { HerrickGibbsIOD } from 'ootk';

const iod = new HerrickGibbsIOD();

const result = iod.estimate(
  r1, epoch1,
  r2, epoch2,
  r3, epoch3
);
```

### Gooding IOD

Advanced method with better handling of short arcs:

```typescript
import { GoodingIOD } from 'ootk';

const iod = new GoodingIOD();

const result = iod.estimate(
  r1, epoch1,
  r2, epoch2,
  r3, epoch3
);
```

### Modified Gooding IOD

Enhanced Gooding method:

```typescript
import { ModifiedGoodingIOD } from 'ootk';

const iod = new ModifiedGoodingIOD();

const result = iod.estimate(
  r1, epoch1,
  r2, epoch2,
  r3, epoch3
);
```

### Lambert IOD

Solve Lambert's problem (two positions, time of flight):

```typescript
import { LambertIOD } from 'ootk';

const iod = new LambertIOD();

const result = iod.estimate(
  r1, epoch1,
  r2, epoch2
);

console.log(result.v1);  // Velocity at first position
console.log(result.v2);  // Velocity at second position
```

### Batch Least Squares

Fit orbit to multiple observations:

```typescript
import { BatchLeastSquaresOD, ObservationOptical } from 'ootk';

const observations = [
  new ObservationOptical(epoch1, ra1, dec1, sensor1),
  new ObservationOptical(epoch2, ra2, dec2, sensor2),
  new ObservationOptical(epoch3, ra3, dec3, sensor3),
  // ... more observations
];

const iod = new BatchLeastSquaresOD();
const result = iod.estimate(observations, initialGuess);

console.log(result.state);      // Final state estimate
console.log(result.covariance); // Uncertainty
console.log(result.residuals);  // Observation residuals
```

### From Sensor Observations

Practical example using sensor angle measurements:

```typescript
import { Sensor, RAE } from 'ootk';

const sensor = new Sensor({ lat, lon, alt, minEl, maxEl });

// Get three observations
const obs1 = new RAE(epoch1, range1, azimuth1, elevation1);
const obs2 = new RAE(epoch2, range2, azimuth2, elevation2);
const obs3 = new RAE(epoch3, range3, azimuth3, elevation3);

// Convert to position vectors
const r1 = sensor.raeToECI(obs1);
const r2 = sensor.raeToECI(obs2);
const r3 = sensor.raeToECI(obs3);

// Run IOD
const iod = new GoodingIOD();
const orbit = iod.estimate(r1, epoch1, r2, epoch2, r3, epoch3);
```

---

## Observations

### Range, Azimuth, Elevation (RAE)

Radar or optical tracking station measurements:

```typescript
import { RAE, Degrees, Kilometers } from 'ootk';

const observation = new RAE(
  epoch,
  1000 as Kilometers,      // range
  180 as Degrees,           // azimuth (0-360)
  45 as Degrees,            // elevation (-90 to 90)
  0.5 as KilometersPerSecond  // range rate (optional)
);

// Convert to topocentric coordinates
const topocentric = observation.toTopocentric(sensor);

// Convert to ECI
const eci = observation.toECI(sensor);
```

### Right Ascension / Declination

Optical observations in celestial coordinates:

#### Geocentric

```typescript
import { RadecGeocentric } from 'ootk';

const observation = new RadecGeocentric(
  epoch,
  15.5 as Degrees,   // right ascension (0-360)
  45.2 as Degrees,   // declination (-90 to 90)
  1000 as Kilometers // range (optional)
);
```

#### Topocentric

From a ground station:

```typescript
import { RadecTopocentric } from 'ootk';

const observation = new RadecTopocentric(
  epoch,
  ra,
  dec,
  sensor  // observer location
);

// Convert to geocentric
const geocentric = observation.toGeocentric();
```

### Radar Observations

```typescript
import { ObservationRadar } from 'ootk';

const observation = new ObservationRadar(
  epoch,
  range,
  azimuth,
  elevation,
  rangeRate,
  sensor
);
```

### Optical Observations

```typescript
import { ObservationOptical } from 'ootk';

const observation = new ObservationOptical(
  epoch,
  ra,
  dec,
  sensor
);
```

---

## Time Systems

### Epoch Types

OOTK supports multiple time systems:

```typescript
import {
  EpochUTC,
  EpochTAI,
  EpochTT,
  EpochGPS,
  EpochTDB
} from 'ootk';

// UTC (Coordinated Universal Time)
const utc = EpochUTC.fromDateTime(new Date('2024-01-28T12:00:00Z'));

// TAI (International Atomic Time)
const tai = EpochTAI.fromDateTime(new Date('2024-01-28T12:00:00Z'));

// TT (Terrestrial Time)
const tt = EpochTT.fromDateTime(new Date('2024-01-28T12:00:00Z'));

// GPS Time
const gps = EpochGPS.fromDateTime(new Date('2024-01-28T12:00:00Z'));

// TDB (Barycentric Dynamical Time)
const tdb = EpochTDB.fromDateTime(new Date('2024-01-28T12:00:00Z'));
```

### Creating Epochs

#### From JavaScript Date

```typescript
const epoch = EpochUTC.fromDateTime(new Date());
```

#### From Julian Date

```typescript
const epoch = EpochUTC.fromJulianDate(2451545.0);
```

#### From Modified Julian Date

```typescript
const epoch = EpochUTC.fromMJD(51544.5);
```

#### From Components

```typescript
const epoch = EpochUTC.fromDateTimeComponents(
  2024,  // year
  1,     // month
  28,    // day
  12,    // hour
  0,     // minute
  0      // second
);
```

### Time Conversions

```typescript
const utc = EpochUTC.fromDateTime(new Date());

// Convert between time systems
const tai = utc.toTAI();
const tt = utc.toTT();
const gps = utc.toGPS();
const tdb = utc.toTDB();

// Get Julian dates
console.log(utc.toJulianDate());
console.log(utc.toMJD());

// Get as JavaScript Date
console.log(utc.toDateTime());
```

### Time Windows

Define time intervals:

```typescript
import { EpochWindow } from 'ootk';

const window = new EpochWindow(startEpoch, endEpoch);

// Check if epoch is in window
const isInWindow = window.contains(testEpoch);

// Get duration
const durationSeconds = window.duration();
```

### Time Arithmetic

```typescript
// Add seconds
const future = epoch.addSeconds(3600);  // +1 hour

// Add days
const tomorrow = epoch.addDays(1);

// Difference between epochs
const deltaSeconds = epoch2.difference(epoch1);

// Compare epochs
const isAfter = epoch2.isAfter(epoch1);
const isBefore = epoch2.isBefore(epoch1);
```

### Greenwich Mean Sidereal Time

```typescript
import { EpochUTC } from 'ootk';

const epoch = EpochUTC.fromDateTime(new Date());

// Get GMST in radians
const gmst = epoch.gmst();

// Get GMST in degrees
const gmstDeg = epoch.gmstDegrees();
```

---

## Interpolation

Interpolate state vectors for smooth trajectories.

### Chebyshev Interpolation

Efficient for smooth functions:

```typescript
import { ChebyshevInterpolator, EpochUTC } from 'ootk';

// Generate sample states
const states = [];
for (let i = 0; i < 10; i++) {
  const epoch = startEpoch.addSeconds(i * 60);
  const state = propagator.propagate(epoch);
  states.push({ epoch, state });
}

// Create interpolator
const interpolator = new ChebyshevInterpolator(states, 8);  // 8th order

// Interpolate at arbitrary time
const interpEpoch = startEpoch.addSeconds(135);  // Between samples
const interpState = interpolator.interpolate(interpEpoch);
```

### Lagrange Interpolation

Classic polynomial interpolation:

```typescript
import { LagrangeInterpolator } from 'ootk';

const interpolator = new LagrangeInterpolator(states, 5);  // 5th order
const interpState = interpolator.interpolate(interpEpoch);
```

### Cubic Spline Interpolation

Smooth curves through points:

```typescript
import { CubicSplineInterpolator } from 'ootk';

const interpolator = new CubicSplineInterpolator(states);
const interpState = interpolator.interpolate(interpEpoch);
```

### Verlet Blend Interpolation

Optimized for orbital mechanics:

```typescript
import { VerletBlendInterpolator } from 'ootk';

const interpolator = new VerletBlendInterpolator(states);
const interpState = interpolator.interpolate(interpEpoch);
```

### State Interpolator

Generic state interpolation:

```typescript
import { StateInterpolator } from 'ootk';

const interpolator = new StateInterpolator(states, 'chebyshev');
const interpState = interpolator.interpolate(interpEpoch);
```

### Compression

Reduce ephemeris data size:

```typescript
import { ChebyshevCompressor } from 'ootk';

// Generate dense ephemeris
const ephemeris = [];
for (let i = 0; i < 1000; i++) {
  ephemeris.push(propagator.propagate(epoch.addSeconds(i * 10)));
}

// Compress to coefficients
const compressor = new ChebyshevCompressor(ephemeris, 12);  // 12th order
const coefficients = compressor.compress();

// Reconstruct with interpolation
const reconstructed = compressor.evaluate(testEpoch);
```

---

## Mathematical Operations

### Vector3D

3D vector operations:

```typescript
import { Vector3D } from 'ootk';

const v1 = new Vector3D(1, 2, 3);
const v2 = new Vector3D(4, 5, 6);

// Basic operations
const sum = v1.add(v2);
const diff = v1.subtract(v2);
const scaled = v1.scale(2.5);

// Dot product
const dot = v1.dot(v2);

// Cross product
const cross = v1.cross(v2);

// Magnitude
const mag = v1.magnitude();

// Normalize
const unit = v1.normalize();

// Distance
const dist = v1.distance(v2);

// Angle between vectors
const angle = v1.angle(v2);  // radians
```

### Vector

N-dimensional vectors:

```typescript
import { Vector } from 'ootk';

const v = new Vector([1, 2, 3, 4, 5]);

// Operations
const doubled = v.scale(2);
const sum = v.add(new Vector([1, 1, 1, 1, 1]));

// Norms
const norm2 = v.norm();      // L2 norm
const norm1 = v.norm(1);     // L1 norm
const normInf = v.norm(Infinity);  // L-infinity norm
```

### Matrix

Matrix operations:

```typescript
import { Matrix } from 'ootk';

const m = new Matrix([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]
]);

// Multiply matrices
const product = m.multiply(otherMatrix);

// Multiply by vector
const result = m.multiplyVector(vector);

// Transpose
const transposed = m.transpose();

// Determinant
const det = m.determinant();

// Inverse
const inverse = m.inverse();

// Identity matrix
const identity = Matrix.identity(3);

// Zero matrix
const zeros = Matrix.zeros(3, 3);
```

### Quaternion

Rotation representation:

```typescript
import { Quaternion, Vector3D } from 'ootk';

// Create from axis-angle
const axis = new Vector3D(0, 0, 1);
const angle = Math.PI / 4;  // 45 degrees
const q = Quaternion.fromAxisAngle(axis, angle);

// Quaternion operations
const product = q1.multiply(q2);
const conjugate = q.conjugate();
const inverse = q.inverse();

// Rotate vector
const rotated = q.rotateVector(vector);

// Convert to rotation matrix
const rotMatrix = q.toRotationMatrix();

// Interpolation (SLERP)
const interpolated = Quaternion.slerp(q1, q2, 0.5);  // 50% between
```

### Euler Angles

```typescript
import { EulerAngles } from 'ootk';

const euler = new EulerAngles(
  0.1,   // roll (radians)
  0.2,   // pitch
  0.3    // yaw
);

// Convert to quaternion
const quat = euler.toQuaternion();

// Convert to rotation matrix
const matrix = euler.toRotationMatrix();
```

### Random Number Generation

```typescript
import { Random } from 'ootk';

// Uniform random in [0, 1)
const r = Random.uniform();

// Uniform in range
const r2 = Random.uniformRange(-1, 1);

// Gaussian (normal) distribution
const gaussian = Random.gaussian(0, 1);  // mean=0, stddev=1

// Random unit vector
const unitVec = Random.unitVector3D();
```

### Box-Muller Transform

Gaussian random numbers:

```typescript
import { BoxMuller } from 'ootk';

const generator = new BoxMuller();

// Generate pair of independent Gaussian random numbers
const [z1, z2] = generator.generate();
```

---

## Optimization

### Golden Section Search

1D optimization:

```typescript
import { GoldenSection } from 'ootk';

// Find minimum of function
const optimizer = new GoldenSection(
  func,        // function to minimize
  lowerBound,  // search range start
  upperBound,  // search range end
  tolerance    // convergence tolerance
);

const result = optimizer.optimize();
console.log(result.x);       // Optimal value
console.log(result.fval);    // Function value at optimum
console.log(result.iterations);
```

### Downhill Simplex (Nelder-Mead)

Multi-dimensional optimization:

```typescript
import { DownhillSimplex } from 'ootk';

// Minimize function of multiple variables
const optimizer = new DownhillSimplex(
  func,           // function to minimize
  initialGuess,   // starting point
  {
    tolerance: 1e-6,
    maxIterations: 1000
  }
);

const result = optimizer.optimize();
console.log(result.x);       // Optimal parameters
console.log(result.fval);    // Final function value
console.log(result.converged);
```

### Polynomial Regression

Fit polynomial to data:

```typescript
import { PolynomialRegression } from 'ootk';

const x = [1, 2, 3, 4, 5];
const y = [2.1, 3.9, 6.2, 8.1, 9.9];

// Fit 2nd degree polynomial
const regression = new PolynomialRegression(x, y, 2);

// Get coefficients
const coeffs = regression.getCoefficients();

// Predict
const yPred = regression.predict(3.5);

// R-squared
const r2 = regression.rSquared();
```

### Simple Linear Regression

```typescript
import { SimpleLinearRegression } from 'ootk';

const regression = new SimpleLinearRegression(x, y);

console.log(regression.slope);
console.log(regression.intercept);
console.log(regression.rSquared);

const predicted = regression.predict(newX);
```

---

## Covariance

Track state uncertainty for orbit determination and propagation.

### State Covariance

```typescript
import { StateCovariance, Matrix } from 'ootk';

// Create 6x6 covariance matrix (position + velocity)
const covMatrix = new Matrix([
  [100, 0, 0, 0, 0, 0],     // σ²_x
  [0, 100, 0, 0, 0, 0],     // σ²_y
  [0, 0, 100, 0, 0, 0],     // σ²_z
  [0, 0, 0, 0.01, 0, 0],    // σ²_vx
  [0, 0, 0, 0, 0.01, 0],    // σ²_vy
  [0, 0, 0, 0, 0, 0.01]     // σ²_vz
]);

const covariance = new StateCovariance(epoch, state, covMatrix);

// Propagate covariance
const futureCov = covariance.propagate(futureEpoch, propagator);

// Get position uncertainty
const posUncertainty = covariance.getPositionUncertainty();  // km

// Get velocity uncertainty
const velUncertainty = covariance.getVelocityUncertainty();  // km/s

// Get standard deviations
const stdDevs = covariance.getStandardDeviations();
console.log('X uncertainty:', stdDevs.position.x, 'km');
```

### Covariance from TLE

Estimate uncertainty from TLE:

```typescript
import { Satellite } from 'ootk';

const satellite = new Satellite({ tle1, tle2 });
const covariance = satellite.getCovariance();
```

### Covariance Sampling

Generate samples from distribution:

```typescript
import { CovarianceSample } from 'ootk';

const samples = CovarianceSample.generate(
  state,
  covariance,
  1000  // number of samples
);

// Use samples for Monte Carlo analysis
samples.forEach(sample => {
  const propagated = propagator.propagate(futureEpoch);
  // ... analyze
});
```

---

## Celestial Bodies

### Earth

Earth properties and models:

```typescript
import { Earth } from 'ootk';

// Physical constants
console.log(Earth.radiusEquator);   // km
console.log(Earth.radiusPolar);     // km
console.log(Earth.radiusMean);      // km
console.log(Earth.flattening);
console.log(Earth.mu);              // Gravitational parameter
console.log(Earth.angularVelocity); // rad/s

// Gravitational harmonics
console.log(Earth.j2);
console.log(Earth.j3);
console.log(Earth.j4);
console.log(Earth.j5);

// Precession and nutation
const precession = Earth.precession(epoch);
const nutation = Earth.nutation(epoch);
```

### Moon

Lunar position and properties:

```typescript
import { Moon } from 'ootk';

// Moon position in ECI
const moonPos = Moon.position(epoch);
console.log(moonPos);  // { x, y, z } in km

// Moon velocity
const moonVel = Moon.velocity(epoch);

// Illumination angles
const illum = Moon.illumination(epoch, observerPos);
console.log(illum.phase);      // 0-1 (0=new, 0.5=full)
console.log(illum.angle);      // Phase angle
console.log(illum.fraction);   // Illuminated fraction

// Physical constants
console.log(Moon.radius);
console.log(Moon.mu);
```

### Sun

Solar position and calculations:

```typescript
import { Sun } from 'ootk';

// Sun position in ECI
const sunPos = Sun.position(epoch);
console.log(sunPos);  // { x, y, z } in km

// Sun velocity
const sunVel = Sun.velocity(epoch);

// Check if position is in Earth's shadow
const inShadow = Sun.isInEarthShadow(satellitePos, epoch);

// Eclipse calculations
const eclipse = Sun.getEclipse(satellitePos, epoch);
console.log(eclipse.umbra);     // In umbra (total shadow)
console.log(eclipse.penumbra);  // In penumbra (partial shadow)
console.log(eclipse.sunlit);    // In sunlight

// Solar radiation pressure magnitude
const srp = Sun.radiationPressure(
  area,   // m²
  mass,   // kg
  coeff   // radiation coefficient
);
```

---

## Maneuvers

Plan and execute orbital maneuvers.

### Hohmann Transfer

Classic two-burn transfer:

```typescript
import { TwoBurnOrbitTransfer, Kilometers } from 'ootk';

// Transfer from LEO to GEO
const r1 = 6778 as Kilometers;   // LEO radius
const r2 = 42164 as Kilometers;  // GEO radius

const transfer = TwoBurnOrbitTransfer.hohmannTransfer(r1, r2);

console.log(transfer.deltaV1);      // First burn Δv (km/s)
console.log(transfer.deltaV2);      // Second burn Δv
console.log(transfer.totalDeltaV);  // Total Δv required
console.log(transfer.transferTime); // Transfer duration (seconds)

// Convert to maneuver objects
const maneuvers = transfer.toManeuvers(startEpoch);
```

### Bi-elliptic Transfer

Three-burn transfer (sometimes more efficient):

```typescript
const transfer = TwoBurnOrbitTransfer.biellipticTransfer(
  r1,    // Initial radius
  r2,    // Final radius
  rb     // Apoapsis of first transfer ellipse
);
```

### Maneuver Object

Individual maneuver:

```typescript
import { Maneuver, Vector3D } from 'ootk';

const maneuver = new Maneuver({
  epoch: burnEpoch,
  deltaV: new Vector3D(0.5, 0.1, 0),  // Δv vector in km/s
  duration: 60,  // Burn duration in seconds
  direction: 'prograde'  // or 'retrograde', 'normal', 'radial'
});

// Apply to state
const newState = maneuver.apply(currentState);
```

### Plane Change

```typescript
import { planeChange } from 'ootk';

// Calculate Δv for plane change
const deltaV = planeChange(
  velocity,      // Current velocity (km/s)
  angleChange    // Angle to change (radians)
);
```

### Inclination Change

```typescript
const deltaV = inclinationChange(
  velocity,
  currentInclination,
  targetInclination
);
```

---

## Advanced Topics

### Custom Propagators

Create custom propagator:

```typescript
import { Propagator, J2000, EpochUTC } from 'ootk';

class MyPropagator extends Propagator {
  propagate(epoch: EpochUTC): J2000 {
    // Your custom propagation logic
    return new J2000(epoch, position, velocity);
  }
}
```

### Gravity Field Models

Use custom gravity coefficients:

```typescript
import { EarthGravity } from 'ootk';

const gravity = new EarthGravity(20, 20);  // 20x20 field

// Set custom coefficients
gravity.setCoefficient(2, 0, customJ2);
gravity.setCoefficient(3, 0, customJ3);
```

### Ephemeris Generation

Generate ephemeris table:

```typescript
const startEpoch = EpochUTC.fromDateTime(new Date());
const ephemeris = [];

for (let i = 0; i < 1440; i++) {  // 24 hours, 1-minute intervals
  const epoch = startEpoch.addMinutes(i);
  const state = propagator.propagate(epoch);

  ephemeris.push({
    epoch: epoch.toDateTime(),
    position: state.position,
    velocity: state.velocity,
    lla: state.toGeodetic()
  });
}

// Save or use ephemeris
```

### Sensor Network

Multiple sensor visibility:

```typescript
const sensors = [sensor1, sensor2, sensor3];

const visibility = sensors.map(sensor => ({
  sensor: sensor.name,
  visible: sensor.isSatInFov(satellite),
  rae: sensor.rae(satellite)
}));

// Find which sensors can see satellite
const visibleFrom = visibility.filter(v => v.visible);
```

### Collision Detection

Check for close approaches:

```typescript
// Propagate both objects
const state1 = satellite1.toJ2000(epoch);
const state2 = satellite2.toJ2000(epoch);

// Calculate distance
const distance = state1.position.distance(state2.position);

if (distance < threshold) {
  console.warn('Close approach detected!');
  console.log('Distance:', distance, 'km');
  console.log('Relative velocity:',
    state1.velocity.subtract(state2.velocity).magnitude());
}
```

### Catalog Management

Work with satellite catalogs:

```typescript
import { Satellite } from 'ootk';

const catalog = [];

// Load TLEs
tleData.forEach(tle => {
  const sat = new Satellite({
    tle1: tle.line1,
    tle2: tle.line2
  });
  catalog.push(sat);
});

// Find satellites by criteria
const leoSats = catalog.filter(sat =>
  sat.apogee < 2000 && sat.perigee > 200
);

const highInclination = catalog.filter(sat =>
  sat.inclination > 80
);
```

### State Vector Manipulation

```typescript
import { StateVector } from 'ootk';

const state = new StateVector(epoch, position, velocity);

// Transform coordinate systems
const j2000 = state.toJ2000();
const itrf = state.toITRF();

// Get orbital elements
const elements = state.toClassicalElements();

// Add relative motion
const ricDelta = { x: 10, y: 0, z: 0 };  // 10 km radial
const newState = state.addRIC(ricDelta);
```

### Performance Optimization

Tips for optimal performance:

```typescript
// 1. Reuse propagators
const propagator = new Sgp4Propagator(satellite);
for (let i = 0; i < 1000; i++) {
  const state = propagator.propagate(epochs[i]);  // Fast
}

// 2. Batch operations
const states = epochs.map(epoch => propagator.propagate(epoch));

// 3. Use appropriate propagator
// - SGP4 for TLE data (fastest)
// - Kepler for quick estimates
// - RK4 for balanced precision/speed
// - RK89 only when high precision needed

// 4. Reduce gravity field degree for distant objects
const forceModel = distance > 10000
  ? new ForceModel().setEarthGravity(4, 4)
  : new ForceModel().setEarthGravity(20, 20);

// 5. Cache calculations
const cached = new Map();
function getState(satellite, epoch) {
  const key = `${satellite.id}-${epoch.toJulianDate()}`;
  if (!cached.has(key)) {
    cached.set(key, satellite.eci(epoch.toDateTime()));
  }
  return cached.get(key);
}
```

---

## Appendix: Quick Reference

### Common Conversions

```typescript
import { DEG2RAD, RAD2DEG, MINUTES_PER_DAY } from 'ootk';

const radians = degrees * DEG2RAD;
const degrees = radians * RAD2DEG;

// Mean motion to period
const period = MINUTES_PER_DAY / meanMotion;

// Period to semi-major axis
const a = Math.cbrt((Earth.mu * (period * 60)**2) / (4 * Math.PI**2));
```

### Useful Constants

```typescript
import { Earth } from 'ootk';

Earth.radiusEquator;   // 6378.137 km
Earth.radiusMean;      // 6371.0 km
Earth.mu;              // 398600.4418 km³/s²
Earth.j2;              // 0.00108263
Earth.angularVelocity; // 7.2921159e-5 rad/s
```

### Type Casting

```typescript
// Always cast numeric literals to appropriate types
const lat = 41.754785 as Degrees;
const alt = 400 as Kilometers;
const vel = 7.8 as KilometersPerSecond;
```

---

## Support and Resources

- **GitHub**: https://github.com/thkruz/ootk
- **Issues**: https://github.com/thkruz/ootk/issues
- **NPM**: https://www.npmjs.com/package/ootk
- **Examples**: `/examples` directory in repository

For questions or contributions, please open an issue on GitHub.

---

**License**: AGPL-3.0

**Author**: Theodore Kruczek

**Version**: 5.1.1
