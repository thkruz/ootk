# OOTK Advanced Features Guide

## Beyond SGP4: Unlocking the Full Power of OOTK

While OOTK provides excellent SGP4 propagation capabilities, the library offers a comprehensive suite of advanced orbital mechanics features that go far beyond simple TLE-based propagation. This guide showcases the unique capabilities that make OOTK a complete orbital mechanics toolkit.

---

## Table of Contents

1. [High-Fidelity Numerical Propagation](#1-high-fidelity-numerical-propagation)
2. [Initial Orbit Determination (IOD)](#2-initial-orbit-determination-iod)
3. [Sensor Operations & Pass Prediction](#3-sensor-operations--pass-prediction)
4. [Astronomical Calculations](#4-astronomical-calculations)
5. [Advanced Coordinate Transformations](#5-advanced-coordinate-transformations)
6. [Force Modeling](#6-force-modeling)
7. [Maneuver Planning & Optimization](#7-maneuver-planning--optimization)
8. [Covariance & Uncertainty Analysis](#8-covariance--uncertainty-analysis)
9. [Multiple Time Systems](#9-multiple-time-systems)
10. [Relative Motion Analysis](#10-relative-motion-analysis)

---

## 1. High-Fidelity Numerical Propagation

OOTK includes multiple numerical integrators for high-precision orbit propagation with customizable force models.

### Available Propagators

- **KeplerPropagator** - Two-body Keplerian motion (fastest, ideal for short arcs)
- **RungeKutta4Propagator** - 4th order Runge-Kutta (good balance of speed/accuracy)
- **RungeKutta89Propagator** - 8th/9th order adaptive RK (high precision)
- **DormandPrince54Propagator** - 5th order adaptive RK with error control

### Example: High-Fidelity Propagation

```typescript
import {
  RungeKutta89Propagator,
  ForceModel,
  EpochUTC,
  Satellite,
  TleLine1,
  TleLine2,
} from 'ootk';

// Create satellite from TLE
const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Configure force model
const forceModel = new ForceModel();

// High-order Earth gravity (8x8 spherical harmonics)
forceModel.setEarthGravity(8, 8);

// Third-body perturbations (Sun and Moon)
forceModel.setThirdBodyGravity({
  moon: true,
  sun: true,
});

// Solar radiation pressure (mass: 1000 kg, area: 400 m²)
forceModel.setSolarRadiationPressure(1000, 400);

// Atmospheric drag (Harris-Priester model)
forceModel.setAtmosphericDrag(1000, 400);

// Create propagator with initial state
const start = new Date(2024, 0, 28, 0, 0, 0);
const propagator = new RungeKutta89Propagator(sat.toJ2000(start), forceModel);

// Propagate to target epoch
const stop = EpochUTC.fromDateTime(new Date(2024, 0, 29, 0, 0, 0));
const finalState = propagator.propagate(stop);

console.log('Position:', finalState.position);
console.log('Velocity:', finalState.velocity);
```

### When to Use Numerical Propagation

- **Long propagation arcs** where SGP4 accuracy degrades
- **High-precision applications** (collision avoidance, mission planning)
- **Maneuver modeling** with custom thrust profiles
- **Near-Earth objects** with significant perturbations
- **Research applications** requiring full force modeling

---

## 2. Initial Orbit Determination (IOD)

OOTK provides multiple IOD methods to determine orbits from observations - essential for tracking newly detected objects or recovering lost satellites.

### Available Methods

#### Lambert's Problem
Solves for the orbit between two position vectors at known times.

```typescript
import {
  LambertIOD,
  J2000,
  Vector3D,
  EpochUTC,
  Kilometers,
  KilometersPerSecond,
  Tle,
} from 'ootk';

const lambert = new LambertIOD();

// Two position observations (ECI coordinates)
const p1 = new J2000(
  EpochUTC.fromDateTime(new Date('2024-01-07T12:00:00Z')),
  new Vector3D(-4901.845 as Kilometers, -3592.528 as Kilometers, 3322.876 as Kilometers),
  Vector3D.origin as Vector3D<KilometersPerSecond>
);

const p2 = new J2000(
  EpochUTC.fromDateTime(new Date('2024-01-07T12:00:10Z')),
  new Vector3D(-4847.902 as Kilometers, -3631.425 as Kilometers, 3359.445 as Kilometers),
  Vector3D.origin as Vector3D<KilometersPerSecond>
);

// Solve for orbit
const orbit = lambert.estimate(p1.position, p2.position, p1.epoch, p2.epoch);

// Convert to classical orbital elements or TLE
const classicalElements = orbit.toClassicalElements();
const tle = Tle.fromClassicalElements(classicalElements);

console.log(tle.line1);
console.log(tle.line2);
```

#### Gibbs Method
Determines orbit from three coplanar position vectors.

```typescript
import { GibbsIOD, J2000, Vector3D, Kilometers, KilometersPerSecond } from 'ootk';

const gibbs = new GibbsIOD();

// Three position observations
const p1 = new J2000(epoch1, new Vector3D(x1, y1, z1), Vector3D.origin);
const p2 = new J2000(epoch2, new Vector3D(x2, y2, z2), Vector3D.origin);
const p3 = new J2000(epoch3, new Vector3D(x3, y3, z3), Vector3D.origin);

const orbit = gibbs.solve(p1.position, p2.position, p3.position, p2.epoch, p3.epoch);
```

#### Herrick-Gibbs Method
Improved method for closely-spaced observations.

```typescript
import { HerrickGibbsIOD } from 'ootk';

const hgibbs = new HerrickGibbsIOD();

const orbit = hgibbs.solve(
  p1.position, p1.epoch,
  p2.position, p2.epoch,
  p3.position, p3.epoch
);
```

#### Gooding's Angles-Only IOD
Determines orbit from optical angle observations (right ascension/declination).

```typescript
import { GoodingIOD, ModifiedGoodingIOD } from 'ootk';

// For optical observations where only angles are known
const gooding = new ModifiedGoodingIOD();
// Implementation for angle-only observations
```

### Converting Radar Observations to ECI

```typescript
import { RAE, J2000, Vector3D, Degrees, Kilometers, lla2eci, calcGmst } from 'ootk';

// Radar observation: Range, Azimuth, Elevation
const observation = {
  t: EpochUTC.fromDateTime(new Date('2024-01-07T12:00:00Z')),
  rng: 1599.89 as Kilometers,
  az: 174 as Degrees,
  el: 13.6 as Degrees,
};

// Sensor location
const sensor = {
  lat: (41.754785 * DEG2RAD) as Radians,
  lon: (-70.539151 * DEG2RAD) as Radians,
  alt: 0.085 as Kilometers,
};

// Convert sensor position to ECI
const gmst = calcGmst(observation.t.toDateTime());
const sensorEci = lla2eci(sensor, gmst.gmst);

// Convert RAE observation to ECI state vector
const rae = RAE.fromDegrees(observation.t, observation.rng, observation.az, observation.el);
const eciState = rae.toStateVector(
  new J2000(
    observation.t,
    new Vector3D(sensorEci.x, sensorEci.y, sensorEci.z),
    Vector3D.origin as Vector3D<KilometersPerSecond>
  )
);
```

---

## 3. Sensor Operations & Pass Prediction

OOTK includes comprehensive sensor modeling for ground-based tracking stations, radars, and telescopes.

### Creating a Sensor

```typescript
import { Sensor, SensorParams, SpaceObjectType, Degrees, Kilometers } from 'ootk';

const radar = new Sensor({
  name: 'Cape Cod Radar',
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
  // Field of view constraints
  minAz: 347 as Degrees,
  maxAz: 227 as Degrees,  // Wraps around (347° to 227° covers north)
  minEl: 3 as Degrees,
  maxEl: 85 as Degrees,
  minRng: 0 as Kilometers,
  maxRng: 5556 as Kilometers,
  type: SpaceObjectType.PHASED_ARRAY_RADAR,
});

// Simple sensor without FOV constraints
const opticalSensor = new Sensor({
  lat: 41 as Degrees,
  lon: -71 as Degrees,
  alt: 1 as Kilometers,
} as SensorParams);
```

### Calculating Satellite Position from Sensor

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const date = new Date('2024-01-28T12:00:00Z');

// Get range, azimuth, elevation from sensor to satellite
const rae = sat.rae(radar, date);

console.log(`Range: ${rae.rng} km`);
console.log(`Azimuth: ${rae.az}°`);
console.log(`Elevation: ${rae.el}°`);
```

### Checking Field of View

```typescript
// Check if satellite is within sensor's field of view
const isVisible = radar.isSatInFov(sat, date);

if (isVisible) {
  console.log('Satellite is visible from sensor');
}
```

### Pass Prediction

```typescript
// Calculate all passes over a time period
const startDate = new Date('2024-01-28T00:00:00Z');
const endDate = new Date('2024-01-29T00:00:00Z');

const passes = radar.calculatePasses(sat, startDate, endDate, 60); // 60 second interval

passes.forEach(pass => {
  console.log(`Pass Start: ${pass.start}`);
  console.log(`Pass End: ${pass.end}`);
  console.log(`Max Elevation: ${pass.maxEl}°`);
  console.log(`AOS Azimuth: ${pass.azimuthStart}°`);
  console.log(`LOS Azimuth: ${pass.azimuthEnd}°`);
});
```

### Doppler Shift Calculations

```typescript
// Calculate Doppler shift for RF tracking
const doppler = sat.applyDoppler(radar, date, 2200); // 2200 MHz frequency

console.log(`Doppler shifted frequency: ${doppler.frequency} MHz`);
console.log(`Doppler shift: ${doppler.shift} MHz`);
```

---

## 4. Astronomical Calculations

OOTK provides comprehensive astronomical calculations for the Sun, Moon, and Earth.

### Sun Calculations

```typescript
import { Sun, Degrees, Meters } from 'ootk';

const date = new Date('2024-06-21T12:00:00Z');
const latitude = 41 as Degrees;
const longitude = -71 as Degrees;
const altitude = 0 as Meters;

// Get all sun times for the day
const sunTimes = Sun.getTimes(date, latitude, longitude, altitude);

console.log('Sunrise:', sunTimes.sunrise);
console.log('Sunset:', sunTimes.sunset);
console.log('Solar Noon:', sunTimes.solarNoon);
console.log('Golden Hour (morning):', sunTimes.goldenHour);
console.log('Golden Hour End (evening):', sunTimes.goldenHourEnd);
console.log('Blue Hour (dawn):', sunTimes.blueHourDawn);
console.log('Blue Hour (dusk):', sunTimes.blueHourDusk);
console.log('Civil Dawn:', sunTimes.civilDawn);
console.log('Civil Dusk:', sunTimes.civilDusk);
console.log('Nautical Dawn:', sunTimes.nauticalDawn);
console.log('Nautical Dusk:', sunTimes.nauticalDusk);
console.log('Astronomical Dawn:', sunTimes.astronomicalDawn);
console.log('Astronomical Dusk:', sunTimes.astronomicalDusk);
```

#### Sun Position

```typescript
// Get Sun's position in ECI coordinates
const sunEci = Sun.eci(EpochUTC.fromDateTime(date));

console.log('Sun ECI Position:', sunEci.position);

// Get Sun's azimuth and elevation from observer
const sunPosition = Sun.azEl(date, latitude, longitude);

console.log(`Sun Azimuth: ${sunPosition.az}°`);
console.log(`Sun Elevation: ${sunPosition.el}°`);
```

#### Solar Illumination

```typescript
// Calculate satellite illumination
const illumination = Sun.getIllumination(sat, date);

console.log('Satellite in sunlight:', illumination.lit);
console.log('Illumination factor:', illumination.factor); // 0 = shadow, 1 = full sun
```

### Moon Calculations

```typescript
import { Moon } from 'ootk';

// Get Moon's position in ECI coordinates
const moonEci = Moon.eci(EpochUTC.fromDateTime(date));

// Moon phase information
const moonPhase = Moon.getPhase(date);

console.log('Moon Phase:', moonPhase.phase); // 'new', 'waxing_crescent', 'first_quarter', etc.
console.log('Illumination:', moonPhase.illumination); // 0 to 1

// Moon rise and set times
const moonTimes = Moon.getTimes(date, latitude, longitude);

console.log('Moonrise:', moonTimes.rise);
console.log('Moonset:', moonTimes.set);
```

### Eclipse Predictions

```typescript
// Check if satellite is in Earth's shadow
const inEclipse = sat.isInEclipse(date);

if (inEclipse) {
  console.log('Satellite is in Earth shadow');
}
```

---

## 5. Advanced Coordinate Transformations

OOTK supports 15+ coordinate systems with seamless transformations.

### Coordinate Systems Overview

| System | Description | Use Case |
|--------|-------------|----------|
| **J2000** | ECI at J2000 epoch | Standard inertial reference |
| **TEME** | True Equator Mean Equinox | TLE propagation (SGP4) |
| **ITRF** | Earth-fixed coordinates | Ground station positions |
| **Geodetic** | Lat/Lon/Alt | Geographic locations |
| **RIC** | Radial-Intrack-Crosstrack | Relative orbital motion |
| **RAE** | Range-Azimuth-Elevation | Sensor observations |
| **ENU** | East-North-Up | Local tangent plane |
| **SEZ** | South-East-Zenith | Local coordinates |

### Common Transformations

```typescript
import {
  Satellite,
  eci2lla,
  lla2eci,
  ecf2eci,
  eci2ecf,
  rae2eci,
  eci2rae,
  calcGmst,
  Degrees,
  Kilometers,
  Radians,
} from 'ootk';

const date = new Date('2024-01-28T12:00:00Z');
const sat = new Satellite({ tle1, tle2 });

// Satellite position in various frames
const j2000 = sat.toJ2000(date);        // ECI (J2000)
const itrf = sat.toITRF(date);          // Earth-fixed
const geodetic = sat.toGeodetic(date);  // Lat/Lon/Alt
const classical = sat.toClassicalElements(date); // Orbital elements

console.log('Latitude:', geodetic.lat);
console.log('Longitude:', geodetic.lon);
console.log('Altitude:', geodetic.alt);

// Manual transformations
const { gmst } = calcGmst(date);

// ECI to Lat/Lon/Alt
const lla = eci2lla(j2000.position, gmst);

// Lat/Lon/Alt to ECI
const eciPos = lla2eci(
  {
    lat: 41.754785 as Radians,
    lon: -70.539151 as Radians,
    alt: 0.085 as Kilometers,
  },
  gmst
);

// ECI to Earth-fixed (ECF/ITRF)
const ecf = eci2ecf(j2000.position, gmst);

// Earth-fixed to ECI
const eci = ecf2eci(ecf, gmst);
```

### Sensor-Centric Transformations

```typescript
import { Sensor, ecf2rae, rae2ecf, eci2rae } from 'ootk';

const sensor = new Sensor({
  lat: 41 as Degrees,
  lon: -71 as Degrees,
  alt: 1 as Kilometers,
});

// Convert satellite position to Range-Azimuth-Elevation
const rae = eci2rae(date, sat.eci(date), sensor);

console.log(`Range: ${rae.rng} km`);
console.log(`Azimuth: ${rae.az}°`);
console.log(`Elevation: ${rae.el}°`);

// Convert RAE back to ECF coordinates
const ecf = rae2ecf(sensor.lla(), rae);
```

### Relative Motion Coordinates

```typescript
// RIC (Radial-Intrack-Crosstrack) frame
const sat1 = new Satellite({ tle1: tle1a, tle2: tle2a });
const sat2 = new Satellite({ tle1: tle1b, tle2: tle2b });

// Get sat2's position relative to sat1 in RIC frame
const ricState = sat2.toRIC(sat1, date);

console.log('Radial offset:', ricState.position.x);      // Along radius vector
console.log('In-track offset:', ricState.position.y);    // Along velocity vector
console.log('Cross-track offset:', ricState.position.z); // Normal to orbit plane
```

---

## 6. Force Modeling

OOTK includes high-fidelity force models for precise orbit propagation.

### Available Force Models

```typescript
import { ForceModel } from 'ootk';

const forces = new ForceModel();

// 1. Earth Gravity (Spherical Harmonics)
// Parameters: degree, order (up to 8x8 with EGM96 coefficients)
forces.setEarthGravity(8, 8); // High precision
forces.setEarthGravity(4, 4); // Medium precision
forces.setEarthGravity(2, 0); // J2 only (fastest)

// 2. Third-Body Gravity
forces.setThirdBodyGravity({
  sun: true,   // Solar perturbations
  moon: true,  // Lunar perturbations
});

// 3. Solar Radiation Pressure
// Parameters: mass (kg), area (m²)
forces.setSolarRadiationPressure(
  1000,  // Satellite mass
  400    // Cross-sectional area
);

// 4. Atmospheric Drag (Harris-Priester model)
// Parameters: mass (kg), area (m²), Cd (drag coefficient)
forces.setAtmosphericDrag(
  1000,  // Satellite mass
  400,   // Cross-sectional area
  2.2    // Drag coefficient (optional, default: 2.2)
);

// 5. Custom Thrust Forces
import { Thrust, Vector3D } from 'ootk';

const thrust = new Thrust(
  new Vector3D(0.001, 0, 0), // Thrust vector in km/s²
  startEpoch,
  endEpoch
);

forces.addThrust(thrust);
```

### Force Model Usage

```typescript
import { RungeKutta89Propagator, ForceModel, Satellite } from 'ootk';

const sat = new Satellite({ tle1, tle2 });

// High-fidelity force model
const hiFiForces = new ForceModel();
hiFiForces.setEarthGravity(8, 8);
hiFiForces.setThirdBodyGravity({ sun: true, moon: true });
hiFiForces.setSolarRadiationPressure(1000, 400);
hiFiForces.setAtmosphericDrag(1000, 400);

const propagator = new RungeKutta89Propagator(
  sat.toJ2000(startDate),
  hiFiForces
);

// Propagate with full force model
const finalState = propagator.propagate(EpochUTC.fromDateTime(endDate));
```

### When to Use Each Force

| Force | Orbit Regime | Impact | Computational Cost |
|-------|--------------|--------|-------------------|
| **Earth Gravity (J2)** | All | High | Low |
| **Earth Gravity (8x8)** | All | Very High | Medium |
| **Third-Body (Moon)** | MEO/GEO | Medium | Medium |
| **Third-Body (Sun)** | GEO | Medium | Medium |
| **Atmospheric Drag** | LEO (<600 km) | Very High | Medium |
| **Solar Radiation** | GEO | Medium | Low |

---

## 7. Maneuver Planning & Optimization

OOTK provides tools for orbit maneuver design and trajectory optimization.

### Two-Burn Orbit Transfers

```typescript
import { TwoBurnOrbitTransfer, ClassicalElements, Kilometers } from 'ootk';

// Initial orbit (LEO)
const initialOrbit = new ClassicalElements({
  a: 6778 as Kilometers,  // Semi-major axis
  e: 0.001,               // Eccentricity
  i: 51.6 as Radians,     // Inclination
  // ... other elements
});

// Target orbit (GEO)
const targetOrbit = new ClassicalElements({
  a: 42164 as Kilometers,
  e: 0.0001,
  i: 0 as Radians,
  // ... other elements
});

const transfer = new TwoBurnOrbitTransfer(initialOrbit, targetOrbit);

// Calculate Hohmann transfer
const hohmann = transfer.calculateHohmann();

console.log('First burn ΔV:', hohmann.deltaV1);
console.log('Second burn ΔV:', hohmann.deltaV2);
console.log('Total ΔV:', hohmann.deltaVTotal);
console.log('Transfer time:', hohmann.transferTime);

// Calculate bi-elliptic transfer (more efficient for large ratio changes)
const biElliptic = transfer.calculateBiElliptic();
```

### Waypoint Targeting with Optimization

```typescript
import { Waypoint, Vector3D, Kilometers } from 'ootk';

// Define relative target position in RIC frame
const targetPosition = new Vector3D(
  0 as Kilometers,    // Radial
  100 as Kilometers,  // In-track
  0 as Kilometers     // Cross-track
);

const waypoint = new Waypoint(
  targetPosition,
  targetEpoch,
  currentState
);

// Optimize maneuver to reach waypoint
const maneuver = waypoint.optimize();

console.log('Optimal ΔV:', maneuver.deltaV);
console.log('Burn time:', maneuver.burnTime);
console.log('Burn direction:', maneuver.direction);
```

### Numerical Optimization Tools

```typescript
import { DownhillSimplex, GoldenSection } from 'ootk';

// Nelder-Mead simplex optimization
const simplex = new DownhillSimplex(
  objectiveFunction,
  initialGuess,
  tolerance
);

const optimum = simplex.optimize();

// Golden section search (1D optimization)
const golden = new GoldenSection(
  objectiveFunction,
  lowerBound,
  upperBound,
  tolerance
);

const minimum = golden.search();
```

---

## 8. Covariance & Uncertainty Analysis

OOTK supports covariance matrices for uncertainty quantification and propagation.

### Creating Covariance from TLE

```typescript
import { StateCovariance, Satellite, TleLine1, TleLine2 } from 'ootk';

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const date = new Date('2024-01-28T12:00:00Z');

// Create covariance from TLE age and mean motion derivative
const covariance = StateCovariance.fromTle(sat, date);

console.log('Position uncertainty (1-sigma):', covariance.positionSigma);
console.log('Velocity uncertainty (1-sigma):', covariance.velocitySigma);

// Get full 6x6 covariance matrix
const covMatrix = covariance.matrix;
```

### Sample-Based Covariance

```typescript
import { CovarianceSample, Vector3D, Kilometers, KilometersPerSecond } from 'ootk';

// Create sample generator
const sampler = new CovarianceSample(
  nominalPosition,
  nominalVelocity,
  positionSigma,  // 1-sigma uncertainty in position
  velocitySigma   // 1-sigma uncertainty in velocity
);

// Generate Monte Carlo samples
const samples = sampler.generate(1000); // 1000 samples

samples.forEach(sample => {
  // Propagate each sample to quantify uncertainty
  const propagated = propagator.propagate(sample, targetEpoch);
});
```

### Covariance in RIC Frame

```typescript
// Convert covariance to Radial-Intrack-Crosstrack frame
const ricCovariance = covariance.toRIC(referenceOrbit);

console.log('Radial uncertainty:', ricCovariance.radialSigma);
console.log('In-track uncertainty:', ricCovariance.intrackSigma);
console.log('Cross-track uncertainty:', ricCovariance.crosstrackSigma);
```

---

## 9. Multiple Time Systems

OOTK provides comprehensive support for different time standards used in astrodynamics.

### Available Time Systems

```typescript
import {
  EpochUTC,  // Coordinated Universal Time
  EpochGPS,  // GPS Time
  EpochTAI,  // International Atomic Time
  EpochTDB,  // Barycentric Dynamical Time
  EpochTT,   // Terrestrial Time
} from 'ootk';

const date = new Date('2024-01-28T12:00:00Z');

// Create epochs in different time systems
const utc = EpochUTC.fromDateTime(date);
const gps = EpochGPS.fromDateTime(date);
const tai = EpochTAI.fromDateTime(date);
const tdb = EpochTDB.fromDateTime(date);
const tt = EpochTT.fromDateTime(date);

// Convert between time systems
const utcFromGPS = gps.toUTC();
const taiFromUTC = utc.toTAI();
const ttFromUTC = utc.toTT();
```

### Leap Seconds

```typescript
// OOTK includes historical leap second data
const leapSeconds = utc.getLeapSeconds();

console.log('Leap seconds at epoch:', leapSeconds);

// Time system offsets
console.log('TAI - UTC:', tai.toUTC().offset); // ~37 seconds (as of 2024)
console.log('GPS - UTC:', gps.toUTC().offset); // ~18 seconds
```

### Time Windows

```typescript
import { EpochWindow, EpochUTC } from 'ootk';

const start = EpochUTC.fromDateTime(new Date('2024-01-28T00:00:00Z'));
const end = EpochUTC.fromDateTime(new Date('2024-01-29T00:00:00Z'));

const window = new EpochWindow(start, end);

console.log('Window duration:', window.duration); // in seconds

// Check if epoch is within window
const testEpoch = EpochUTC.fromDateTime(new Date('2024-01-28T12:00:00Z'));
const isInWindow = window.contains(testEpoch);
```

---

## 10. Relative Motion Analysis

Analyze relative motion between satellites using specialized coordinate frames.

### RIC (Radial-Intrack-Crosstrack) Frame

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

// Chief satellite
const chief = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Deputy satellite
const deputy = new Satellite({
  tle1: '1 25545U 98067B   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25545  51.6500 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

const date = new Date('2024-01-28T12:00:00Z');

// Get deputy's state in chief's RIC frame
const ricState = deputy.toRIC(chief, date);

console.log('Radial separation:', ricState.position.x, 'km');
console.log('In-track separation:', ricState.position.y, 'km');
console.log('Cross-track separation:', ricState.position.z, 'km');

console.log('Radial velocity:', ricState.velocity.x, 'km/s');
console.log('In-track velocity:', ricState.velocity.y, 'km/s');
console.log('Cross-track velocity:', ricState.velocity.z, 'km/s');
```

### Hill Frame

```typescript
import { RIC } from 'ootk';

// Convert between RIC and Hill frames for relative motion analysis
const hillState = ricState.toHill();
```

### Relative Range and Range Rate

```typescript
// Calculate range between satellites
const range = deputy.range(chief, date);

console.log('Separation distance:', range, 'km');

// Calculate range rate (closing velocity)
const rangeRate = deputy.rangeRate(chief, date);

console.log('Closing velocity:', rangeRate, 'km/s');
```

---

## Complete Example: Multi-Feature Integration

Here's a comprehensive example that combines multiple advanced features:

```typescript
import {
  Satellite,
  Sensor,
  Sun,
  RungeKutta89Propagator,
  ForceModel,
  StateCovariance,
  EpochUTC,
  SpaceObjectType,
  Degrees,
  Kilometers,
  TleLine1,
  TleLine2,
} from 'ootk';

// 1. Create satellite from TLE
const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// 2. Create sensor
const radar = new Sensor({
  name: 'Tracking Station',
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
  minAz: 0 as Degrees,
  maxAz: 360 as Degrees,
  minEl: 5 as Degrees,
  maxEl: 90 as Degrees,
  minRng: 0 as Kilometers,
  maxRng: 5000 as Kilometers,
  type: SpaceObjectType.PHASED_ARRAY_RADAR,
});

// 3. Calculate passes over next 24 hours
const startDate = new Date('2024-01-28T00:00:00Z');
const endDate = new Date('2024-01-29T00:00:00Z');
const passes = radar.calculatePasses(sat, startDate, endDate, 60);

console.log(`Found ${passes.length} passes in next 24 hours`);

passes.forEach((pass, i) => {
  console.log(`\nPass ${i + 1}:`);
  console.log(`  Start: ${pass.start}`);
  console.log(`  End: ${pass.end}`);
  console.log(`  Max Elevation: ${pass.maxEl}°`);

  // 4. Check if pass occurs during daylight
  const sunTimes = Sun.getTimes(pass.start, radar.lat, radar.lon, radar.alt);
  const isDaylight = pass.start > sunTimes.sunrise && pass.start < sunTimes.sunset;
  console.log(`  Daylight pass: ${isDaylight}`);

  // 5. Get satellite position at max elevation
  const midPassDate = new Date((pass.start.getTime() + pass.end.getTime()) / 2);
  const rae = sat.rae(radar, midPassDate);
  console.log(`  Range at max elevation: ${rae.rng.toFixed(1)} km`);

  // 6. Calculate Doppler shift
  const doppler = sat.applyDoppler(radar, midPassDate, 2200);
  console.log(`  Doppler shift: ${doppler.shift.toFixed(3)} MHz`);
});

// 7. High-fidelity propagation for next orbit
const forceModel = new ForceModel();
forceModel.setEarthGravity(8, 8);
forceModel.setThirdBodyGravity({ sun: true, moon: true });
forceModel.setAtmosphericDrag(419725, 916); // ISS approximate mass and area

const propagator = new RungeKutta89Propagator(
  sat.toJ2000(startDate),
  forceModel
);

const oneOrbitLater = EpochUTC.fromDateTime(
  new Date(startDate.getTime() + 92 * 60 * 1000) // ~92 minutes
);

const propagatedState = propagator.propagate(oneOrbitLater);

console.log('\nPropagated position (high-fidelity):');
console.log(`  X: ${propagatedState.position.x.toFixed(3)} km`);
console.log(`  Y: ${propagatedState.position.y.toFixed(3)} km`);
console.log(`  Z: ${propagatedState.position.z.toFixed(3)} km`);

// 8. Compare with SGP4
const sgp4State = sat.eci(oneOrbitLater.toDateTime());

console.log('\nSGP4 position:');
console.log(`  X: ${sgp4State.x.toFixed(3)} km`);
console.log(`  Y: ${sgp4State.y.toFixed(3)} km`);
console.log(`  Z: ${sgp4State.z.toFixed(3)} km`);

// 9. Uncertainty analysis
const covariance = StateCovariance.fromTle(sat, startDate);

console.log('\nPosition uncertainty (1-sigma):');
console.log(`  ${covariance.positionSigma.toFixed(3)} km`);
```

---

## Performance Considerations

### When to Use Each Propagator

| Propagator | Speed | Accuracy | Best For |
|------------|-------|----------|----------|
| **SGP4** | Fastest | Good (< 7 days) | Real-time tracking, short arcs |
| **Kepler** | Very Fast | Basic | Quick estimates, two-body motion |
| **RK4** | Fast | Good | Balance of speed/accuracy |
| **RK89** | Slow | Excellent | High-precision, long arcs |
| **DP54** | Medium | Very Good | Adaptive step, general purpose |

### Optimization Tips

1. **Use appropriate force models** - Don't include drag for GEO satellites
2. **Limit gravity field order** - 4x4 is often sufficient, 8x8 for high precision
3. **Choose propagator wisely** - SGP4 for < 7 days, numerical for longer
4. **Batch calculations** - Calculate multiple epochs in one propagation
5. **Coordinate frame** - Minimize transformations between frames

---

## Additional Resources

- **Examples Directory**: `/examples/` contains working code for all major features
- **Type Safety**: OOTK uses TypeScript unit types (Kilometers, Radians, etc.) to prevent errors
- **API Documentation**: Full API docs available in the repository
- **Test Suite**: `/test/` directory shows comprehensive usage examples

---

## Conclusion

OOTK is far more than an SGP4 library. It's a complete orbital mechanics toolkit offering:

- **Professional-grade propagation** with multiple numerical integrators
- **Initial orbit determination** from various observation types
- **Sensor modeling** with pass prediction and FOV checking
- **Astronomical calculations** for Sun, Moon, and celestial mechanics
- **Comprehensive coordinate systems** with seamless transformations
- **High-fidelity force modeling** including gravity harmonics, drag, and SRP
- **Maneuver planning** and trajectory optimization
- **Uncertainty quantification** with covariance analysis
- **Multiple time systems** with leap second support

Whether you're building a satellite tracking application, conducting orbital analysis, planning missions, or developing space situational awareness systems, OOTK provides the tools you need for professional-grade orbital mechanics computations.
