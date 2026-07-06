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
import { J2000, EpochUTC, Kilometers, KilometersPerSecond, Vector3D } from 'ootk';

const epoch = EpochUTC.fromDateTime(new Date());
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
import { Satellite } from 'ootk';

// Create satellite from TLE
const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741'
});

// SGP4 outputs TEME natively
const teme = sat.propagate(new Date());  // Returns TEME state

// Convert to J2000 for further calculations
const j2000 = teme.toJ2000();
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
import { J2000, ITRF, Geodetic, Degrees, Kilometers } from 'ootk';

// Convert J2000 to Earth-fixed
const j2000State = /* ... */;
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
import { Geodetic, Degrees, Kilometers } from 'ootk';

// Create from degrees (more intuitive)
const groundStation = Geodetic.fromDegrees(
  41.754785 as Degrees,   // latitude
  -70.539151 as Degrees,  // longitude
  0.060966 as Kilometers  // altitude
);

// Convert to ITRF for calculations
const itrf = groundStation.toITRF(epoch);

// Calculate distance to another point
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

#### When to Use

- **Conjunction assessments** and collision avoidance
- **Relative motion** analysis
- **Close approach** characterization
- **Covariance** representation for conjunction screening
- **Miss distance** calculations

#### Example

```typescript
import { J2000, RIC } from 'ootk';

// Two satellites at the same epoch
const reference = new J2000(epoch, refPosition, refVelocity);
const target = new J2000(epoch, targetPosition, targetVelocity);

// Get relative state in RIC
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
import { J2000, Hill, Kilometers, KilometersPerSecond, Seconds } from 'ootk';

// Create Hill state from reference orbit
const origin = new J2000(epoch, position, velocity);

// Method 1: From relative state components
const hill = Hill.fromState(
  origin,
  0.1 as Kilometers,           // radial offset
  1.0 as Kilometers,           // intrack offset
  0.001 as KilometersPerSecond, // cross-track velocity
  0 as Seconds                 // node offset time
);

// Method 2: From Natural Motion Coordinates
const hillNmc = Hill.fromNmc(
  origin,
  2.0 as Kilometers,           // major axis range
  0.001 as KilometersPerSecond, // node velocity
  0 as Seconds                 // node offset time
);

// Propagate using analytical equations (fast!)
const later = hill.propagate(newEpoch);

// Plan a maneuver to a waypoint
const waypoint = new Waypoint(/* ... */);
const maneuver = hill.solveManeuver(waypoint);

// Convert to J2000 for comparison with other data
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
| Inclination | i | Tilt relative to equator | rad/deg |
| RAAN | Ω | Longitude of ascending node | rad/deg |
| Argument of perigee | ω | Orientation within orbital plane | rad/deg |
| True anomaly | ν | Position along orbit | rad/deg |

#### When to Use

- **Orbit definition** and description
- **Mission design** and planning
- **TLE generation**
- **Orbit visualization** and understanding
- **Quick analytical propagation** (Kepler's equation)

#### Limitations

Classical elements have **singularities** for:

- Circular orbits (e = 0): Argument of perigee undefined
- Equatorial orbits (i = 0): RAAN undefined

#### Example

```typescript
import { ClassicalElements, Degrees, Kilometers, EpochUTC } from 'ootk';

const elements = new ClassicalElements({
  epoch: EpochUTC.fromDateTime(new Date()),
  semimajorAxis: 6778.137 as Kilometers,
  eccentricity: 0.001,
  inclination: 51.6418 as Degrees,
  rightAscension: 292.259 as Degrees,
  argOfPerigee: 167.5319 as Degrees,
  trueAnomaly: 252.046 as Degrees
});

// Get orbital characteristics
console.log(`Period: ${elements.period} minutes`);
console.log(`Apogee: ${elements.apogee} km`);
console.log(`Perigee: ${elements.perigee} km`);
console.log(`Regime: ${elements.getOrbitRegime()}`);

// Convert to position/velocity
const pv = elements.toPositionVelocity();

// Propagate analytically
const propagated = elements.propagate(newEpoch);

// Generate TLE
const tle = elements.toTLE({ intlDes: '98067A', epochYear: 24, epochDay: 28.5 });
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
import { EquinoctialElements, ClassicalElements } from 'ootk';

// Create from classical elements
const classical = new ClassicalElements({ /* ... */ });
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
// ECI to ECEF
const itrf = j2000.toITRF();

// ECEF to ECI
const j2000 = itrf.toJ2000();

// ECI to Geographic
const geodetic = j2000.toITRF().toGeodetic();

// Geographic to ECI
const j2000 = geodetic.toITRF(epoch).toJ2000();

// State vector to elements
const elements = j2000.toClassicalElements();

// Elements to state vector
const j2000 = J2000.fromClassicalElements(elements);

// TEME to J2000
const j2000 = teme.toJ2000();

// Absolute to relative
const ric = RIC.fromJ2000(target, reference);

// Relative to absolute
const target = ric.toJ2000(reference);
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
    └─► TLE format ─────────────────► Classical Elements
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
import { Satellite, Sensor, Degrees, Kilometers } from 'ootk';

// 1. Parse TLE (internally stored as TEME-compatible)
const sat = new Satellite({ tle1: '...', tle2: '...' });

// 2. Propagate to current time (SGP4 → TEME)
const teme = sat.propagate(new Date());

// 3. Convert to J2000 for standard processing
const j2000 = teme.toJ2000();

// 4. Convert to ITRF for ground-relative calculations
const itrf = j2000.toITRF();

// 5. Get lat/lon/alt
const geodetic = itrf.toGeodetic();
console.log(`Satellite at: ${geodetic.latDeg}°, ${geodetic.lonDeg}°`);
```

### Conjunction Assessment

```typescript
import { J2000, RIC } from 'ootk';

// Two satellites at time of closest approach
const primary = new J2000(epoch, pos1, vel1);
const secondary = new J2000(epoch, pos2, vel2);

// Calculate relative state
const ric = RIC.fromJ2000(secondary, primary);

// Analyze miss distance
console.log(`Miss distance: ${ric.range} km`);
console.log(`Radial: ${ric.position.x} km`);
console.log(`Intrack: ${ric.position.y} km`);
console.log(`Crosstrack: ${ric.position.z} km`);
console.log(`Closing velocity: ${ric.rangeRate} km/s`);
```

### Proximity Operations Planning

```typescript
import { J2000, Hill, Kilometers, KilometersPerSecond, Seconds } from 'ootk';

// Reference (target) spacecraft
const target = new J2000(epoch, targetPos, targetVel);

// Create chaser relative state
const hill = Hill.fromNmc(
  target,
  1.0 as Kilometers,            // 1 km relative orbit
  0.0 as KilometersPerSecond,   // no cross-track velocity
  0 as Seconds                  // at node
);

// Propagate relative motion (analytical - very fast)
const hillLater = hill.propagate(laterEpoch);

// Plan maneuver to approach
const waypoint = /* define approach waypoint */;
const maneuver = hill.solveManeuver(waypoint);
console.log(`Delta-V required: ${maneuver.deltaV} m/s`);
```

### Converting Between All Systems

```typescript
import {
  J2000, TEME, ITRF, Geodetic, RIC, Hill,
  ClassicalElements, EquinoctialElements
} from 'ootk';

// Start with J2000 state
const j2000 = new J2000(epoch, position, velocity);

// To other inertial frame
const teme = j2000.toTEME();

// To Earth-fixed
const itrf = j2000.toITRF();

// To geographic
const geodetic = itrf.toGeodetic();

// To orbital elements
const classical = j2000.toClassicalElements();
const equinoctial = classical.toEquinoctialElements();

// To relative frame (need reference)
const reference = new J2000(epoch, refPos, refVel);
const ric = RIC.fromJ2000(j2000, reference);

// Back to J2000
const j2000Recovered = ric.toJ2000(reference);
```

---

## API Method Reference: Which Frame Does Each Method Return?

Understanding which coordinate frame each method returns is critical for correct calculations. This section provides a quick reference.

### SpaceObject / Satellite Methods

| Method | Returns | Frame | Notes |
|--------|---------|-------|-------|
| `eci()` | `PosVel` | **TEME** | Native SGP4 output. Use for visualization, quick calculations |
| `ecef()` | `EcefVec3` | **pseudo-ECEF** | Simplified GMST rotation only. Use for quick Earth-fixed |
| `lla()` | `LlaVec3` | **Geodetic** | Via simplified ECEF. Use for ground track display |
| `toJ2000()` | `J2000` | **J2000** | Full transformation. Use for precise calculations |
| `toITRF()` | `ITRF` | **ITRF** | Full transformation. Use for precise Earth-fixed |
| `toGeodetic()` | `Geodetic` | **Geodetic** | Via J2000→ITRF. More precise than `lla()` |
| `toClassicalElements()` | `ClassicalElements` | **J2000-based** | Keplerian elements |

### Important: `eci()` Returns TEME, Not Generic ECI

The `eci()` method returns coordinates in the **TEME (True Equator Mean Equinox)** frame, which is the native output of SGP4/SDP4 propagation. This is an Earth-Centered Inertial frame, but it differs from J2000:

```typescript
// eci() returns TEME frame
const teme = satellite.eci(date);  // TemeVec3 position/velocity

// toJ2000() returns J2000 frame
const j2000 = satellite.toJ2000(date);  // J2000 state vector

// The difference matters for precise calculations
// TEME and J2000 can differ by hundreds of meters
```

### Simplified vs Precise Earth-Fixed Transformations

OOTK provides two levels of Earth-fixed coordinate transformations:

#### Simplified (GMST-only)

```typescript
// Quick transformation using GMST rotation only
const ecef = satellite.ecef(date);    // pseudo-ECEF
const lla = satellite.lla(date);       // via pseudo-ECEF
```

- Uses simple rotation by Greenwich Mean Sidereal Time
- Does NOT account for: precession, nutation, polar motion
- Accuracy: ~1 km for typical applications
- Speed: Faster computation

#### Precise (Full IAU transformation)

```typescript
// Full transformation via J2000 → ITRF
const itrf = satellite.toITRF(date);           // precise ITRF
const geodetic = satellite.toGeodetic(date);   // via precise ITRF
```

- Full transformation chain: TEME → J2000 → ITRF
- Accounts for: precession, nutation, Earth rotation (GMST + equation of equinoxes)
- Accuracy: Sub-meter for most applications
- Speed: Slower (more matrix operations)

### Low-Level Transform Functions

The `transforms.ts` module provides low-level functions that work with **TEME** coordinates:

| Function | Input Frame | Output Frame | Notes |
|----------|-------------|--------------|-------|
| `eci2ecef()` | TEME | pseudo-ECEF | GMST rotation only |
| `ecef2eci()` | pseudo-ECEF | TEME | GMST rotation only |
| `eci2lla()` | TEME | Geodetic | Via GMST rotation |
| `lla2eci()` | Geodetic | TEME | Via GMST rotation |
| `ecef2rae()` | pseudo-ECEF | RAE | Topocentric |
| `rae2ecef()` | RAE | pseudo-ECEF | Topocentric |

For precise transformations, use the class methods (`J2000.toITRF()`, `ITRF.toJ2000()`, etc.) instead of these low-level functions.

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

SIMPLIFIED PATH (less accurate but faster):
  satellite.eci() ──► TEME ──► ecef() ──► pseudo-ECEF ──► lla() ──► Geodetic
                           (GMST only)              (GMST only)
```

---

## Further Reading

- [User Guide](./user-guide.md) - Complete API documentation
- [Getting Started](./getting-started.md) - Tutorial for beginners
- Wikipedia: [Earth-centered inertial](https://en.wikipedia.org/wiki/Earth-centered_inertial)
- Wikipedia: [ECEF](https://en.wikipedia.org/wiki/Earth-centered,_Earth-fixed_coordinate_system)
- Wikipedia: [Orbital elements](https://en.wikipedia.org/wiki/Orbital_elements)
