# Coordinate Systems Guide

This guide provides a comprehensive overview of the coordinate systems available in OOTK, explaining their differences, relationships, and when to use each one.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Reference](#quick-reference)
3. [Inertial Reference Frames (ECI)](#inertial-reference-frames-eci)
   - [J2000](#j2000)
   - [TEME](#teme)
4. [Earth-Fixed Reference Frames (ECEF)](#earth-fixed-reference-frames-ecef)
   - [ITRF](#itrf)
   - [Geodetic](#geodetic)
5. [Relative Motion Frames](#relative-motion-frames)
   - [RIC](#ric-radial-intrack-crosstrack)
   - [Hill](#hill-frame)
6. [Orbital Element Representations](#orbital-element-representations)
   - [Classical Elements](#classical-elements)
   - [Equinoctial Elements](#equinoctial-elements)
7. [Coordinate Transformations](#coordinate-transformations)
8. [When to Use Each System](#when-to-use-each-system)
9. [Common Workflows](#common-workflows)

---

## Overview

OOTK provides multiple coordinate systems to represent positions and velocities of objects in space. Choosing the right coordinate system is essential for efficient and accurate calculations.

### Key Concepts

**Inertial Frames**: Fixed relative to distant stars; Newton's laws apply directly. Use for orbit propagation and mechanics calculations.

**Non-Inertial Frames**: Rotate or accelerate relative to inertial space; require accounting for fictitious forces. Use for Earth-fixed applications.

**Relative Frames**: Defined relative to another orbiting object. Use for proximity operations and formation flying.

---

## Quick Reference

| System | Type | Inertial | Primary Use |
|--------|------|----------|-------------|
| **J2000** | ECI | Yes | General orbit propagation, high-precision calculations |
| **TEME** | ECI | Yes | SGP4 propagation, TLE-based tracking |
| **ITRF** | ECEF | No | Ground station calculations, Earth-fixed applications |
| **Geodetic** | Geographic | No | Location data (lat/lon/alt) |
| **RIC** | Relative | No | Conjunction analysis, relative motion |
| **Hill** | Relative | No | Proximity operations, rendezvous planning |
| **Classical** | Elements | - | Orbit definition, mission design |
| **Equinoctial** | Elements | - | Numerical propagation, avoiding singularities |

---

## Inertial Reference Frames (ECI)

Earth-Centered Inertial (ECI) frames have their origin at Earth's center and do not rotate with Earth. These are essential for orbit propagation because Newton's laws of motion apply directly.

### J2000

The **J2000** coordinate system is the standard inertial reference frame defined at epoch J2000.0 (January 1, 2000, 12:00 TT).

#### Definition

- **Origin**: Center of Earth
- **X-axis**: Aligned with the mean vernal equinox at J2000.0
- **Z-axis**: Aligned with Earth's mean rotation axis (celestial North Pole) at J2000.0
- **Y-axis**: Completes the right-handed system (90° East along the celestial equator)

#### When to Use

- **General orbit propagation** with numerical integrators
- **High-precision calculations** requiring a stable reference
- **Interoperability** with other systems (J2000 is widely used)
- **Long-duration** orbit predictions
- **Force modeling** (gravity, drag, SRP)

#### Example

```typescript
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Vector3D } from 'ootk';

const epoch = EpochUTC.fromDateTime(new Date('2024-01-28T13:00:00Z'));
const position = new Vector3D(6778.137 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const velocity = new Vector3D(0 as KilometersPerSecond, 7.67 as KilometersPerSecond, 0 as KilometersPerSecond);

const state = new J2000(epoch, position, velocity);

// Convert to other frames
const teme = state.toTEME();
const itrf = state.toITRF();
const elements = state.toClassicalElements();
```

---

### TEME

**True Equator Mean Equinox (TEME)** is an inertial frame specifically used by the SGP4 propagator.

#### Definition

- **Origin**: Center of Earth
- **Equator**: Earth's true equator of date
- **Equinox**: Mean equinox of date
- **Purpose**: Native output frame for SGP4/SDP4 propagation

#### When to Use

- **SGP4 propagation** from TLE data
- **TLE-based** satellite tracking
- **Compatibility** with NORAD catalog data
- When working with **Two-Line Elements**

#### Key Difference from J2000

TEME accounts for precession and nutation differently than J2000. While both are inertial, TEME is defined relative to the true equator and mean equinox *of date*, whereas J2000 is fixed to the epoch J2000.0. This makes TEME the natural output of SGP4 but requires conversion for use with most other tools.

#### Example

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

// Create satellite from TLE
const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const date = new Date('2024-01-28T13:00:00Z');

// SGP4 outputs TEME natively: eci() returns { position, velocity } in TEME (km, km/s),
// or null if SGP4 fails (for example a decayed orbit or a date far from the TLE epoch)
const temePosVel = sat.eci(date);

// toJ2000() runs SGP4 and rotates TEME to J2000 (precession + nutation)
const j2000 = sat.toJ2000(date);

// A TEME state object, when you need one
const teme = j2000.toTEME();
```

---

## Earth-Fixed Reference Frames (ECEF)

Earth-Centered Earth-Fixed (ECEF) frames rotate with Earth. These are essential for ground-based applications.

### ITRF

The **International Terrestrial Reference Frame (ITRF)** is the standard Earth-fixed Cartesian coordinate system.

#### Definition

- **Origin**: Center of Earth
- **X-axis**: Passes through 0° latitude, 0° longitude (intersection of equator and prime meridian)
- **Y-axis**: Passes through 0° latitude, 90° East longitude
- **Z-axis**: Passes through the North Pole
- **Rotation**: Rotates with Earth (~15°/hour)

#### When to Use

- **Ground station** position calculations
- **Satellite sub-point** determination
- **Surface-relative** measurements
- Converting between **geographic** and **Cartesian** coordinates
- **Look angle** calculations from ground sites

#### Example

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Convert J2000 to Earth-fixed
const j2000State = sat.toJ2000(new Date('2024-01-28T13:00:00Z'));
const itrf = j2000State.toITRF();

// Get latitude/longitude/altitude
const geodetic = itrf.toGeodetic();
console.log(`Lat: ${geodetic.latDeg}°, Lon: ${geodetic.lonDeg}°, Alt: ${geodetic.alt} km`);
```

---

### Geodetic

**Geodetic** coordinates represent positions on or near Earth's surface using latitude, longitude, and altitude.

#### Definition

- **Latitude**: Angle from equatorial plane (-90° to +90°)
- **Longitude**: Angle from prime meridian (-180° to +180°)
- **Altitude**: Height above the WGS84 reference ellipsoid

#### When to Use

- **Ground station** locations
- **Sensor** and observer positions
- **Geographic** data input/output
- **Human-readable** location representation
- **Visibility** calculations from ground

#### Example

```typescript
import { Degrees, EpochUTC, Geodetic, Kilometers } from 'ootk';

// The constructor takes radians; fromDegrees takes degrees
const groundStation = Geodetic.fromDegrees(
  41.754785 as Degrees, // latitude
  -70.539151 as Degrees, // longitude
  0.060966 as Kilometers, // altitude above the WGS84 ellipsoid
);

// Convert to ITRF for calculations (an Earth-fixed state needs an epoch)
const itrf = groundStation.toITRF(EpochUTC.fromDateTime(new Date('2024-01-28T13:00:00Z')));

// Great-circle surface distance to another point (haversine by default)
const otherStation = Geodetic.fromDegrees(40.0 as Degrees, -75.0 as Degrees, 0 as Kilometers);
const distance = groundStation.distance(otherStation);
```

---

## Relative Motion Frames

Relative frames describe the position and velocity of one object relative to another orbiting object. These are essential for proximity operations.

### RIC (Radial-Intrack-Crosstrack)

**RIC** coordinates describe relative motion using a frame attached to a reference satellite.

#### Definition

- **R (Radial)**: Along the radius vector from Earth center through the reference satellite (positive outward)
- **I (Intrack)**: Along the velocity direction of the reference satellite (positive in direction of motion)
- **C (Crosstrack)**: Perpendicular to both R and I, completing the right-handed system (positive toward angular momentum)

#### Velocity convention

`RIC.fromJ2000(state, origin)` rotates the inertial position and velocity differences into the origin's RIC axes. No omega x rho term is removed, so the RIC velocity is not the rotating-frame (Hill / Clohessy-Wiltshire) relative velocity: two co-orbiting objects 10 km apart in-track show about 11 m/s of radial velocity. Use `Hill` for rotating-frame relative motion.

#### When to Use

- **Conjunction assessments** and collision avoidance
- **Relative motion** analysis
- **Close approach** characterization
- **Covariance** representation for conjunction screening
- **Miss distance** calculations

#### Example

```typescript
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, RIC, Satellite, TleLine1, TleLine2, Vector3D } from 'ootk';

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Two objects at the same epoch: the ISS and a point about 1.9 km away moving 1 m/s faster
const reference = sat.toJ2000(new Date('2024-01-28T13:00:00Z'));
const target = new J2000(
  reference.epoch,
  reference.position.add(new Vector3D(1 as Kilometers, 1.5 as Kilometers, 0.5 as Kilometers)),
  reference.velocity.add(new Vector3D(0 as KilometersPerSecond, 0.001 as KilometersPerSecond, 0 as KilometersPerSecond)),
);

// Relative state of target in the reference's RIC frame: RIC.fromJ2000(state, origin)
const ric = RIC.fromJ2000(target, reference);

console.log(`Radial separation: ${ric.position.x} km`);
console.log(`Intrack separation: ${ric.position.y} km`);
console.log(`Crosstrack separation: ${ric.position.z} km`);
console.log(`Total range: ${ric.range} km`);
console.log(`Range rate: ${ric.rangeRate} km/s`);

// Convert back to J2000
const targetRecovered = ric.toJ2000(reference);
```

---

### Hill Frame

The **Hill** frame (also called Clohessy-Wiltshire or LVLH frame) is optimized for proximity operations and uses analytical equations of relative motion.

#### Definition

Similar to RIC but specifically designed for proximity operations:

- **X (Radial)**: Radial direction (positive outward from Earth)
- **Y (Intrack)**: Along-track direction (positive in velocity direction)
- **Z (Crosstrack)**: Cross-track direction (completes right-handed system)

#### Key Features

- **Analytical propagation**: Uses Hill/Clohessy-Wiltshire equations (no numerical integration needed)
- **Maneuver planning**: Built-in methods for computing delta-v requirements
- **Natural Motion Coordinates**: Support for NMC-based relative orbits
- **State transition matrix**: Closed-form solution for relative motion

#### When to Use

- **Rendezvous and proximity operations** (RPO)
- **Formation flying** design and maintenance
- **Relative orbit** planning
- **Maneuver optimization** for proximity operations
- **Quick relative motion** predictions (analytical, no integration)

#### Example

```typescript
import { Hill, Kilometers, KilometersPerSecond, Satellite, Seconds, TleLine1, TleLine2, Vector3D, Waypoint } from 'ootk';

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Reference (origin) orbit: the ISS
const origin = sat.toJ2000(new Date('2024-01-28T13:00:00Z'));

// Method 1: from relative state components (x radial, y in-track, z cross-track)
const hill = Hill.fromState(
  origin,
  0.1 as Kilometers, // radial offset
  1.0 as Kilometers, // in-track offset
  0.001 as KilometersPerSecond, // cross-track velocity at the node
  0 as Seconds, // node offset time
);

// Method 2: from Natural Motion Coordinates (a closed 2:1 relative ellipse)
const hillNmc = Hill.fromNmc(
  origin,
  2.0 as Kilometers, // major axis range
  0.001 as KilometersPerSecond, // node velocity
  0 as Seconds, // node offset time
);

// Propagate with the Clohessy-Wiltshire state transition matrix (no numerical integration)
const later = hill.propagate(origin.epoch.roll(600 as Seconds));

// Solve the single impulse, applied at the Hill epoch, that reaches a relative position (km) 30 minutes later
const waypoint = new Waypoint(origin.epoch.roll(1800 as Seconds), new Vector3D(0 as Kilometers, -0.5 as Kilometers, 0 as Kilometers));
const burn = hill.solveManeuver(waypoint); // Thrust: deltaV in km/s in RIC axes
console.log(`Delta-V: ${(burn.deltaV.magnitude() * 1000).toFixed(2)} m/s`);

// Convert to J2000 using the origin's state at the Hill epoch
const j2000State = hill.toJ2000(origin);
```

---

## Orbital Element Representations

Orbital elements describe the shape and orientation of an orbit rather than instantaneous position/velocity.

### Classical Elements

**Classical (Keplerian) elements** are the traditional six parameters describing an orbit.

#### Elements

| Element | Symbol | Description | Units |
|---------|--------|-------------|-------|
| Semi-major axis | a | Size of orbit | km |
| Eccentricity | e | Shape (0=circular, 1=parabolic) | - |
| Inclination | i | Tilt relative to equator | rad (`inclinationDegrees` getter for deg) |
| RAAN | Ω | Longitude of ascending node (`rightAscension`) | rad (`rightAscensionDegrees`) |
| Argument of perigee | ω | Orientation within orbital plane (`argPerigee`) | rad (`argPerigeeDegrees`) |
| True anomaly | ν | Position along orbit | rad (`trueAnomalyDegrees`) |

#### When to Use

- **Orbit definition** and description
- **Mission design** and planning
- **TLE generation**
- **Orbit visualization** and understanding
- **Quick analytical propagation** (Kepler's equation)

#### Limitations

Classical elements have **singularities** for:

- Circular orbits (e = 0): Argument of perigee undefined
- Equatorial orbits (i = 0 or 180 deg): RAAN undefined

`ClassicalElements.fromStateVector` handles these with the Vallado Algorithm 9 conventions (argument of latitude, true longitude of periapsis or true longitude stored in the remaining angles), so a state survives the round trip to elements and back.

`apogee` and `perigee` are altitudes above the WGS84 equatorial radius (6378.137 km); `apogeeRadius` and `perigeeRadius` are the geocentric distances. `getOrbitRegime()` returns an `OrbitRegime` (LEO, MEO, HEO, GEO or OTHER); MEO is e at most 0.25 with perigee and apogee altitudes both between 2,000 and 31,570 km, which covers GPS, GLONASS, BeiDou, Galileo and O3b.

#### Example

```typescript
import { ClassicalElements, DEG2RAD, EpochUTC, Kilometers, Radians, Seconds, Tle } from 'ootk';

// Angles are RADIANS. Convert degrees with DEG2RAD; casting a degree value to Radians is a bug.
const elements = new ClassicalElements({
  epoch: EpochUTC.fromDateTime(new Date('2024-01-28T13:00:00Z')),
  semimajorAxis: 6798.137 as Kilometers,
  eccentricity: 0.0003,
  inclination: (51.6418 * DEG2RAD) as Radians,
  rightAscension: (292.259 * DEG2RAD) as Radians,
  argPerigee: (167.5319 * DEG2RAD) as Radians,
  trueAnomaly: (252.046 * DEG2RAD) as Radians,
});

// Get orbital characteristics
console.log(`Period: ${elements.period} minutes`);
console.log(`Apogee altitude: ${elements.apogee} km`); // above the 6378.137 km equatorial radius
console.log(`Perigee altitude: ${elements.perigee} km`);
console.log(`Apogee radius: ${elements.apogeeRadius} km`); // geocentric
console.log(`Inclination: ${elements.inclinationDegrees} deg`);
console.log(`Regime: ${elements.getOrbitRegime()}`); // OrbitRegime.LEO, 'Low Earth Orbit'

// Convert to position/velocity (km, km/s, in the inertial frame the elements were defined in)
const pv = elements.toPositionVelocity();

// Propagate analytically (two-body Kepler)
const propagated = elements.propagate(elements.epoch.roll(3600 as Seconds));

// Generate a TLE (osculating elements written as mean elements; catalog number and designator are placeholders)
const tle = Tle.fromClassicalElements(elements);
console.log(tle.line1);
console.log(tle.line2);
```

---

### Equinoctial Elements

**Equinoctial elements** are an alternative representation that avoids the singularities of classical elements.

#### Elements

| Element | Symbol | Description |
|---------|--------|-------------|
| Semi-major axis | a | Size of orbit |
| h | h = e·sin(ω + Ω) | Eccentricity vector component |
| k | k = e·cos(ω + Ω) | Eccentricity vector component |
| p | p = tan(i/2)·sin(Ω) | Ascending node component |
| q | q = tan(i/2)·cos(Ω) | Ascending node component |
| Mean longitude | λ | Combined mean anomaly + ω + Ω |
| Retrograde factor | I | +1 prograde, -1 retrograde |

#### When to Use

- **Numerical propagation** requiring smooth derivatives
- **Circular orbits** (avoids e=0 singularity)
- **Equatorial orbits** (avoids i=0 singularity)
- **Orbit determination** algorithms
- **Optimization** problems in astrodynamics

#### Example

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const date = new Date('2024-01-28T13:00:00Z');

// Classical elements from a J2000 state; equinoctial from classical
const classical = sat.toJ2000(date).toClassicalElements();
const equinoctial = classical.toEquinoctialElements();

// Or convert back
const classicalRecovered = equinoctial.toClassicalElements();

// Get position/velocity
const pv = equinoctial.toPositionVelocity();
```

---

## Coordinate Transformations

### Transformation Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INERTIAL FRAMES (ECI)                            │
│  ┌─────────┐                              ┌─────────┐               │
│  │  J2000  │◄────────────────────────────►│  TEME   │               │
│  └────┬────┘   toTEME() / toJ2000()       └────┬────┘               │
│       │                                        │                     │
│       │ toITRF()                               │                     │
│       │ toClassicalElements()                  │                     │
│       ▼                                        │                     │
└───────┼────────────────────────────────────────┼─────────────────────┘
        │                                        │
        │                                        │
┌───────┼────────────────────────────────────────┼─────────────────────┐
│       ▼                  EARTH-FIXED FRAMES                         │
│  ┌─────────┐                              ┌──────────┐              │
│  │  ITRF   │◄────────────────────────────►│ Geodetic │              │
│  └─────────┘   toGeodetic() / toITRF()    └──────────┘              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                      RELATIVE FRAMES                                 │
│  ┌─────────┐                              ┌─────────┐               │
│  │   RIC   │                              │  Hill   │               │
│  └────┬────┘                              └────┬────┘               │
│       │                                        │                     │
│       │ fromJ2000(target, reference)           │ toJ2000(origin)    │
│       │ toJ2000(reference)                     │                     │
│       ▼                                        ▼                     │
│           Both convert to/from J2000 frame                          │
└──────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                    ORBITAL ELEMENTS                                  │
│  ┌─────────────────┐              ┌─────────────────────┐           │
│  │    Classical    │◄────────────►│    Equinoctial      │           │
│  └────────┬────────┘              └─────────────────────┘           │
│           │                                                          │
│           │ toPositionVelocity()                                    │
│           │ fromStateVector()                                       │
│           ▼                                                          │
│       StateVector (J2000/TEME)                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Common Conversions

```typescript
import { ClassicalElements, EpochUTC, Geodetic, J2000, RIC, Satellite, TleLine1, TleLine2 } from 'ootk';

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const date = new Date('2024-01-28T13:00:00Z');
const j2000 = sat.toJ2000(date);

// ECI to ECEF
const itrf = j2000.toITRF();

// ECEF to ECI
const j2000Again = itrf.toJ2000();

// ECI to geographic
const geodetic: Geodetic = j2000.toITRF().toGeodetic();

// Geographic to ECI (a ground point at rest on the Earth)
const site = geodetic.toITRF(EpochUTC.fromDateTime(date)).toJ2000();

// State vector to elements
const elements: ClassicalElements = j2000.toClassicalElements();

// Elements to state vector
const fromElements = J2000.fromClassicalElements(elements);

// J2000 to TEME and back
const teme = j2000.toTEME();
const j2000FromTeme = teme.toJ2000();

// Absolute to relative (state, origin)
const ric = RIC.fromJ2000(fromElements, j2000);

// Relative to absolute
const recovered = ric.toJ2000(j2000);
```

---

## When to Use Each System

### Decision Guide

```
What are you trying to do?
│
├─► Propagate an orbit?
│   ├─► From TLE data ──────────────► TEME (SGP4 native)
│   └─► Numerical integration ──────► J2000
│
├─► Work with ground stations?
│   ├─► Location input ─────────────► Geodetic
│   └─► Position calculations ──────► ITRF
│
├─► Analyze close approaches?
│   └─► Conjunction/miss distance ──► RIC
│
├─► Plan proximity operations?
│   ├─► Rendezvous maneuvers ───────► Hill
│   └─► Formation flying ───────────► Hill
│
├─► Define or describe an orbit?
│   ├─► Human-readable ─────────────► Classical Elements
│   └─► Numerical algorithms ───────► Equinoctial Elements
│
└─► Store/exchange data?
    ├─► With other systems ─────────► J2000 (most common standard)
    └─► TLE format ─────────────────► Tle.fromClassicalElements()
```

### Summary Table

| Task | Recommended System | Reason |
|------|-------------------|--------|
| SGP4/TLE propagation | TEME | Native SGP4 output |
| Numerical propagation | J2000 | Stable inertial frame |
| Ground station work | Geodetic → ITRF | Human-readable input, Cartesian math |
| Satellite sub-point | ITRF → Geodetic | Earth-fixed for ground track |
| Collision avoidance | RIC | Standard for conjunction screening |
| Rendezvous planning | Hill | Analytical relative motion |
| Formation flying | Hill | Closed-form propagation |
| Orbit definition | Classical Elements | Intuitive orbital parameters |
| Numerical algorithms | Equinoctial Elements | No singularities |
| Data exchange | J2000 | Widely used standard |

---

## Common Workflows

### Satellite Tracking from TLE

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

// 1. Parse the TLE
const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const date = new Date('2024-01-28T13:00:00Z');

// 2. Propagate with SGP4 and rotate TEME to J2000
const j2000 = sat.toJ2000(date);

// 3. Convert to ITRF for ground-relative calculations
const itrf = j2000.toITRF();

// 4. Get lat/lon/alt
const geodetic = itrf.toGeodetic();
console.log(`Satellite at: ${geodetic.latDeg}°, ${geodetic.lonDeg}°`);

// Shortcuts on Satellite: toITRF(date), toGeodetic(date), and the GMST-only lla(date)
const lla = sat.lla(date); // { lat, lon } in degrees, alt in km, or null
```

### Conjunction Assessment

```typescript
import { RIC, Satellite, TleLine1, TleLine2 } from 'ootk';

const primary = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const secondary = new Satellite({
  tle1: '1 20580U 90037B   24028.50123227  .00000825  00000-0  39644-4 0  9997' as TleLine1,
  tle2: '2 20580  28.4696 273.2640 0002975 297.7865 189.2151 15.09696656316758' as TleLine2,
});
const tca = new Date('2024-01-28T13:00:00Z'); // use the time of closest approach in practice

// Relative state of the secondary in the primary's RIC frame
const ric = RIC.fromJ2000(secondary.toJ2000(tca), primary.toJ2000(tca));
// Equivalent shortcut: secondary.toRIC(primary, tca)

console.log(`Miss distance: ${ric.range} km`);
console.log(`Radial: ${ric.position.x} km`);
console.log(`Intrack: ${ric.position.y} km`);
console.log(`Crosstrack: ${ric.position.z} km`);
console.log(`Range rate: ${ric.rangeRate} km/s`);
```

### Proximity Operations Planning

```typescript
import { Hill, Kilometers, KilometersPerSecond, Satellite, Seconds, TleLine1, TleLine2, Vector3D, Waypoint } from 'ootk';

const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Reference (target) spacecraft
const target = sat.toJ2000(new Date('2024-01-28T13:00:00Z'));

// Chaser on a 1 km natural-motion relative ellipse
const hill = Hill.fromNmc(
  target,
  1.0 as Kilometers, // major axis range
  0.0 as KilometersPerSecond, // no cross-track motion
  0 as Seconds, // at node
);

// Propagate relative motion one quarter period (analytical, Clohessy-Wiltshire)
const hillLater = hill.propagate(target.epoch.roll((hill.period / 4) as Seconds));

// Burn now to be 200 m behind the target 20 minutes later
const approach = new Waypoint(target.epoch.roll(1200 as Seconds), new Vector3D(0 as Kilometers, -0.2 as Kilometers, 0 as Kilometers));
const maneuver = hill.solveManeuver(approach);
console.log(`Delta-V required: ${(maneuver.deltaV.magnitude() * 1000).toFixed(2)} m/s`); // deltaV is km/s
```

---

## API Method Reference: Which Frame Does Each Method Return?

Understanding which coordinate frame each method returns is critical for correct calculations. This section provides a quick reference.

### SpaceObject / Satellite Methods

| Method | Returns | Frame | Notes |
|--------|---------|-------|-------|
| `eci()` | `PosVel` | **TEME** | Native SGP4 output. Use for visualization, quick calculations |
| `ecef()` | `EcefVec3` | **PEF (Earth-fixed)** | TEME rotated by GMST. Use for quick Earth-fixed |
| `lla()` | `LlaVec3` | **Geodetic** | Via `ecef()`; degrees and km. Use for ground track display |
| `toJ2000()` | `J2000` | **J2000** | Full transformation. Use for precise calculations |
| `toITRF()` | `ITRF` | **ITRF** | Full transformation. Use for precise Earth-fixed |
| `toGeodetic()` | `Geodetic` | **Geodetic** | Via J2000→ITRF; radians internally, `latDeg`/`lonDeg` getters |
| `toClassicalElements()` | `ClassicalElements` | **J2000-based** | Keplerian elements |

### Important: `eci()` Returns TEME, Not Generic ECI

The `eci()` method returns coordinates in the **TEME (True Equator Mean Equinox)** frame, which is the native output of SGP4/SDP4 propagation. This is an Earth-Centered Inertial frame, but it differs from J2000 by the precession and nutation accumulated since 2000 (about 0.33 deg in 2024), which is tens of kilometres at LEO:

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const satellite = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const date = new Date('2024-01-28T13:00:00Z');

// eci() returns the TEME frame (or null if SGP4 fails)
const teme = satellite.eci(date);

// toJ2000() returns the J2000 frame
const j2000 = satellite.toJ2000(date);

// The two position vectors differ by the precession and nutation since 2000:
// 29.2 km for the ISS at this date (the angle grows by about 50 arcsec per year)
```

### Simplified vs Precise Earth-Fixed Transformations

OOTK provides two levels of Earth-fixed coordinate transformations:

#### Simplified (GMST-only)

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const satellite = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const date = new Date('2024-01-28T13:00:00Z');

// TEME rotated by GMST (the standard SGP4 TEME-to-PEF step)
const ecef = satellite.ecef(date); // Earth-fixed, km
const lla = satellite.lla(date); // lat/lon in degrees, alt in km
```

- Rotates TEME by Greenwich Mean Sidereal Time (IAU 1982). This is the standard TEME to PEF step of Vallado et al., "Revisiting Spacetrack Report #3" (AIAA 2006-6753), not an approximation of the precise path
- No polar motion, and UTC stands in for UT1
- Faster: one rotation

#### Precise (Full IAU transformation)

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const satellite = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const date = new Date('2024-01-28T13:00:00Z');

// TEME -> J2000 -> ITRF, through the IAU 1976/1980 precession and nutation matrices
const itrf = satellite.toITRF(date);
const geodetic = satellite.toGeodetic(date);
```

- Transformation chain: TEME → J2000 → ITRF (IAU 1976 precession, the full 106-term IAU 1980 nutation, GAST)
- Also no polar motion (so the result is strictly PEF rather than ITRF) and no UT1-UTC correction
- In practice the two paths agree closely: for the ISS example above, `ecef()` and `toITRF()` differ by 2.4 cm and `lla()` and `toGeodetic()` by under 1 m in altitude. Both are limited by the missing UT1-UTC (up to 0.9 s, about 420 m along the equator) and polar motion (about 10 m), not by the choice of path
- Use it when you need `J2000`/`ITRF` objects to feed other ootk APIs

### Low-Level Transform Functions

The `transforms.ts` module provides low-level functions that work with **TEME** coordinates:

| Function | Input Frame | Output Frame | Notes |
|----------|-------------|--------------|-------|
| `eci2ecef()` | TEME | PEF (Earth-fixed) | GMST rotation |
| `ecef2eci()` | PEF (Earth-fixed) | TEME | GMST rotation |
| `eci2lla()` | TEME | Geodetic (degrees) | Via GMST rotation |
| `lla2eci()` | Geodetic (lat/lon in **radians**) | TEME | Via GMST rotation |
| `ecef2rae(lla, ecef)` | Earth-fixed | RAE | Topocentric; observer `lla` in degrees |
| `rae2ecef(rae, lla)` | RAE | Earth-fixed | Topocentric; observer `lla` in degrees |

For `J2000`/`ITRF` state objects, use the class methods (`J2000.toITRF()`, `ITRF.toJ2000()`, etc.) instead of these low-level functions.

### Conversion Chain Summary

```text
┌────────────────────────────────────────────────────────────────┐
│ SGP4 Propagation Output                                        │
│                                                                 │
│  satellite.eci() ──► TEME (position/velocity)                  │
│        │                                                        │
│        │ .toJ2000() (precession + nutation)                    │
│        ▼                                                        │
│      J2000 ◄──────────────────────────────────────────────────►│
│        │                                                        │
│        │ .toITRF() (precession + nutation + Earth rotation)    │
│        ▼                                                        │
│      ITRF                                                       │
│        │                                                        │
│        │ .toGeodetic() (ellipsoidal conversion)                │
│        ▼                                                        │
│    Geodetic (lat/lon/alt)                                      │
└────────────────────────────────────────────────────────────────┘

GMST PATH (faster, agrees with the path above to centimetres in position):
  satellite.eci() ──► TEME ──► ecef() ──► PEF ──► lla() ──► Geodetic
                           (GMST rotation)
```

---

## Further Reading

- [User Guide](../../docs/user-guide.md) - Complete API documentation
- [Getting Started](../../docs/getting-started.md) - Tutorial for beginners
- Wikipedia: [Earth-centered inertial](https://en.wikipedia.org/wiki/Earth-centered_inertial)
- Wikipedia: [ECEF](https://en.wikipedia.org/wiki/Earth-centered,_Earth-fixed_coordinate_system)
- Wikipedia: [Orbital elements](https://en.wikipedia.org/wiki/Orbital_elements)
