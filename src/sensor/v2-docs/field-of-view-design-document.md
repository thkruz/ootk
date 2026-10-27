# Field of View Design Document

**Version:** 2.0 (ootk 8)
**Status:** Implemented
**Last Updated:** October 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Design Goals](#design-goals)
4. [Architecture Overview](#architecture-overview)
5. [Core Concepts](#core-concepts)
6. [Implementation Details](#implementation-details)
7. [Multi-Face Phased Array Support](#multi-face-phased-array-support)
8. [Elevation Masking](#elevation-masking)
9. [API Reference](#api-reference)
10. [Migration Guide](#migration-guide)
11. [Lessons Learned](#lessons-learned)

---

## Executive Summary

This document describes the boresight-centric elliptical cone Field of View (FOV) used by the
sensor module (`src/sensor/FieldOfView.ts`). It replaced the legacy min/max azimuth/elevation
box and supports:

- Asymmetric FOV patterns (elliptical cones, for example fence radars)
- Multi-face phased array radars (one `FieldOfView` per face)
- A direction-vector containment test for callers that work in a body frame
- Azimuth-dependent elevation masks, as step sectors or as an interpolated horizon profile

---

## Problem Statement

### Legacy Approach Limitations

The original field of view used min/max azimuth and elevation ranges. These keys no longer exist
and are not accepted by `FieldOfViewParams`:

```text
// OLD (removed): box in azimuth and elevation
fieldOfView: {
  minAzimuth: 0,
  maxAzimuth: 120,
  minElevation: 5,
  maxElevation: 85
}
```

This approach had several issues:

1. **Cannot represent asymmetric patterns**: phased array radars often have fan-shaped FOVs (for
   example 80 deg in one direction, 1 deg in the other) that are not aligned with azimuth and
   elevation.
2. **Zenith singularity**: azimuth ranges degenerate near the zenith (el = 90 deg).
3. **Multi-face complexity**: multi-face radars needed a "secondary FOV" concept.

### Real-World Requirements

- **Fan-shaped phased arrays**: a boresight pointing straight up with a wide extent along one
  line and a narrow extent across it (Space Fence style)
- **Terrain masking**: buildings and hills blocking specific azimuth sectors at low elevation

---

## Design Goals

1. **Boresight-centric geometry**: define the FOV relative to a boresight direction, not
   min/max bounds
2. **Elliptical cone support**: major and minor half-angles for asymmetric patterns
3. **Modular multi-face support**: each radar face gets its own `FieldOfView` instance
4. **Granular elevation masking**: per-azimuth elevation limits for obstructions
5. **Fail fast**: invalid parameters throw `ValidationError` in the constructor

---

## Architecture Overview

### Key Components

```text
FieldOfView
|-- Boresight direction (boresightAz, boresightEl, degrees)
|-- Half-angles (halfAngle = major, minorHalfAngle = minor, degrees)
|-- Roll angle (orientation of the ellipse around the boresight, degrees)
|-- Range limits (minRange, maxRange, km)
|-- Global minimum elevation (minElevation, degrees)
|-- Elevation masks (step sectors or interpolated vertices)
`-- BoresightFrame (computed once in the constructor)

BoresightFrame
|-- b: Vector3D (boresight unit vector, ENU)
|-- u: Vector3D (major axis unit vector, perpendicular to b)
`-- v: Vector3D (minor axis unit vector, perpendicular to b and u)
```

### Supporting Enums

```typescript
import { FovFrame, FovShape } from 'ootk';

// FovShape.ELLIPTICAL_CONE (the default) and FovShape.CIRCULAR_CONE
// FovFrame.TOPOCENTRIC (the default) and FovFrame.BODY
console.log(FovShape.ELLIPTICAL_CONE, FovShape.CIRCULAR_CONE, FovFrame.TOPOCENTRIC, FovFrame.BODY);
```

`shape` is not auto-detected. It defaults to `ELLIPTICAL_CONE`; with that shape, a FOV whose
`minorHalfAngle` equals `halfAngle` (or is omitted) is tested as a circle anyway. Setting
`CIRCULAR_CONE` forces the circular test on `halfAngle` and ignores `minorHalfAngle`.

`frame` is stored and serialized but does not change any computation. `contains()` always
interprets its input as topocentric azimuth/elevation; a body-frame caller transforms the target
direction into the frame the boresight is expressed in and uses `containsDirection()`.

---

## Core Concepts

### Boresight-Centric Model

Instead of defining FOV boundaries, define:

1. **Boresight direction**: where the sensor points (azimuth from North through East, elevation
   above the horizon, both in degrees)
2. **Half-angles**: off-boresight angular extent along the major axis (`halfAngle`) and the minor
   axis (`minorHalfAngle`)
3. **Roll angle**: rotation of the ellipse around the boresight axis

A half-angle is an angle measured from the boresight on the sky, not a difference in azimuth.
These differ away from the horizon: for a boresight at elevation e, a target at the same
elevation and azimuth offset d is `2 asin(cos(e) sin(d / 2))` off boresight. At e = 45 deg an
azimuth offset of 60 deg is only 41.4 deg off boresight.

### BoresightFrame Construction

`boresightFrameFromAzElRoll(az, el, roll)` takes **radians** and returns an orthonormal basis in
ENU (x = East, y = North, z = Up):

```text
b = (cos el sin az, cos el cos az, sin el)

General branch (el != 90 deg):
  v0 = normalize(up x b)        horizontal, to the left of the boresight (West for a North boresight)
  u0 = b x v0                   the projection of "up" onto the plane normal to b
  u  = cos(roll) u0 + sin(roll) v0
  v  = cos(roll) v0 - sin(roll) u0

Zenith branch (|el - 90 deg| < 1e-10 rad), the limit of the general branch as el -> 90 deg
along azimuth az:
  A = (-sin az, -cos az, 0)     back-azimuth direction
  B = (-cos az,  sin az, 0)     A rotated 90 deg clockwise
  u = cos(roll) A + sin(roll) B
  v = -sin(roll) A + cos(roll) B
```

Properties (both branches):

- **Handedness**: u x v = -b. Positive roll rotates u toward v.
- **Roll 0 off the zenith**: the major axis lies in the vertical plane through the boresight
  (u points "up" relative to the boresight). A fan that is wide in azimuth therefore needs
  roll 90 deg (or the wide extent put in `minorHalfAngle`).
- **Roll 0 at the zenith (ootk 8)**: the major axis lies along the boresight azimuth line (both
  directions, since the ellipse is symmetric). A fan pointing straight up with boresightAz 270
  and roll 0 is an east-west fan.
- **Continuity**: the zenith branch equals the general branch evaluated at el = 89.99999 deg to
  about 2e-7, so a FOV no longer jumps when its boresight elevation crosses 90 deg.

ootk 7 measured zenith roll from North instead (roll 0 = major axis North-South for every
azimuth), which was discontinuous with the general branch. Convert v7 zenith configs with
`FieldOfView.migrateZenithRollFromV7` (see [Migration Guide](#migration-guide)).

### Elliptical Cone Containment

`contains(rae)` checks, in this order (all are required, so the order only affects cost):

1. `minRange <= rng <= maxRange`
2. `el >= minElevation`
3. Cone geometry (below)
4. `el >= getMinElevation(az)`, only when elevation masks are present

Cone geometry for a target unit vector `t` (ENU):

1. Off-boresight angle `theta = angle(b, t)`. `theta` below 1e-10 rad is inside; `theta` above
   90 deg is outside.
2. Circular case (`isCircular` or `shape === CIRCULAR_CONE`):
   `theta <= halfAngle * (1 + BOUNDARY_TOL)`.
3. Elliptical case: project `t` onto the plane normal to `b`, take the position angle
   `phi = atan2(t . v, t . u)`, and test

```text
(theta cos(phi) / halfAngle)^2 + (theta sin(phi) / minorHalfAngle)^2 <= 1 + 2 BOUNDARY_TOL
```

`BOUNDARY_TOL = 1e-10` is a relative round-off allowance so a direction generated exactly on the
boundary (for example by `directionAt(t, 1)`) counts as inside. The ellipse is defined in
angular, azimuthal-equidistant coordinates around the boresight (the radial coordinate is the
off-boresight angle itself), not in a gnomonic (tangent-plane) projection.

`containsDirection(direction, range)` applies the range check and the cone geometry to a
direction vector. A zero or non-finite vector has no direction and is never contained. It does
not apply `minElevation` or masks.

---

## Implementation Details

### FieldOfViewParams Interface

```typescript
import { Degrees, FieldOfViewParams, FovFrame, FovShape, Kilometers } from 'ootk';

const params: FieldOfViewParams = {
  boresightAz: 0 as Degrees,       // optional, default 0 (North), must be in [0, 360)
  boresightEl: 90 as Degrees,      // optional, default 90 (zenith), must be in [-90, 90]
  halfAngle: 45 as Degrees,        // REQUIRED, finite, in (0, 90]
  minorHalfAngle: 10 as Degrees,   // optional, defaults to halfAngle, finite, in (0, 90]
  rollAngle: 0 as Degrees,         // optional, default 0
  minRange: 100 as Kilometers,     // required, >= 0 and <= maxRange
  maxRange: 5000 as Kilometers,    // required, > 0
  minElevation: 0 as Degrees,      // optional, default 0, in [-90, 90]
  elevationMasks: [],              // optional, see Elevation Masking
  interpolate: false,              // optional, treat masks as horizon vertices
  shape: FovShape.ELLIPTICAL_CONE, // optional, default ELLIPTICAL_CONE (not auto-detected)
  frame: FovFrame.TOPOCENTRIC,     // optional, default TOPOCENTRIC (metadata only)
};

console.log(params);
```

### Validation

The constructor throws `ValidationError` when:

- `halfAngle` is missing, NaN, non-finite, at or below 0, or above 90 deg (ootk 8: a missing
  `halfAngle` used to produce a FOV that silently saw nothing)
- `minorHalfAngle` is given and is non-finite, at or below 0, or above 90 deg
- `boresightAz` is outside [0, 360) or `boresightEl` outside [-90, 90]
- `minRange < 0`, `maxRange <= 0` or `minRange > maxRange`
- `minElevation` is outside [-90, 90]
- a step mask has `startAz` or `stopAz` outside [0, 360) or `minEl` outside [-90, 90]
- an interpolated mask does not have 2 to 72 vertices with unique azimuths in [0, 360) and
  elevations in [0, 89]

`minorHalfAngle` larger than `halfAngle` is accepted; the "major" axis u is then the narrow one.

### ElevationMask Interface

```typescript
import { Degrees, ElevationMask } from 'ootk';

const mask: ElevationMask = {
  startAz: 350 as Degrees, // start of the sector (inclusive); the vertex azimuth when interpolated
  stopAz: 10 as Degrees,   // end of the sector (inclusive, wraps through 0); ignored when interpolated
  minEl: 15 as Degrees,    // minimum elevation in this sector, or at this vertex
};

console.log(mask);
```

### Public Members

| Member | Purpose |
|---|---|
| `contains(rae)` | Full check: range, `minElevation`, cone, masks. `rae` is `{ rng, az, el }` in km and degrees |
| `containsDirection(direction, range)` | Range and cone only, for a direction vector |
| `directionAt(t, radialFraction = 1)` | Unit vector on (fraction 1) or inside the cone at parametric ellipse angle `t` (radians) |
| `getMinElevation(az)` | Effective minimum elevation at an azimuth, never below `minElevation` |
| `angularOffset(az, el)` | Off-boresight angle of a direction, degrees |
| `boresightVector` | Boresight unit vector (ENU) |
| `isCircular` | True when `halfAngle` equals `minorHalfAngle` |
| `angularCoverage` | `2 * halfAngle`, a cone width (not an azimuth span) |
| `isDeepSpace()` / `isNearEarth()` | `maxRange` above / at or below 6000 km |
| `serialize()` / `toString()` | Parameters out / human-readable summary |
| `FieldOfView.hemisphere(minRange, maxRange, minEl?)` | Zenith cone with `halfAngle` 90 |
| `FieldOfView.circularCone(az, el, halfAngle, minRange, maxRange)` | `CIRCULAR_CONE` factory |
| `FieldOfView.migrateZenithRollFromV7(params)` | Converts a v7 zenith roll to the v8 convention |

There are no separate `isInCone`, `isInRange` or `isAboveMinElevation` methods; the individual
tests are private and reached through `contains()`.

---

## Multi-Face Phased Array Support

### Design Decision

Instead of a "secondary FOV" concept, `PhasedArrayRadar` creates a separate `FieldOfView` for
each face. The constructor copies `fieldOfView` and overrides `boresightAz` and `boresightEl`
per face; `faceFovs`, `faceCount`, `isInFov(rae)` (true if any face contains the target) and
`getFacesInFov(rae)` (indices of the faces that do) are public.

```typescript
import { Degrees, Kilometers, PhasedArrayRadar, SensorType } from 'ootk';

const radar = new PhasedArrayRadar({
  id: 1,
  name: 'Two-face radar',
  sensorType: SensorType.PHASED_ARRAY_RADAR,
  beamwidth: 2 as Degrees,
  boresightAz: [0 as Degrees, 180 as Degrees], // one entry per face
  boresightEl: [45 as Degrees, 45 as Degrees],
  fieldOfView: { halfAngle: 60 as Degrees, minRange: 100 as Kilometers, maxRange: 5556 as Kilometers },
});

const rae = { rng: 1000 as Kilometers, az: 10 as Degrees, el: 40 as Degrees };

console.log(radar.faceCount, radar.isInFov(rae), radar.getFacesInFov(rae)); // 2 true [ 0 ]
```

---

## Elevation Masking

### Use Case

Ground sensors often have terrain obstructions (buildings, hills) that block specific azimuth
sectors at low elevations. Masks can only raise the floor above `minElevation`.

### Step Sectors (default)

Each entry is a sector from `startAz` to `stopAz`, inclusive, wrapping through 0 when
`startAz > stopAz`. The target azimuth is normalized to [0, 360) first. Where sectors overlap,
the highest `minEl` wins.

```typescript
import { Degrees, FieldOfView, Kilometers } from 'ootk';

// Building blocks 30 deg to 60 deg azimuth below 15 deg elevation
const fov = new FieldOfView({
  halfAngle: 90 as Degrees,
  minRange: 100 as Kilometers,
  maxRange: 40000 as Kilometers,
  minElevation: 5 as Degrees, // global minimum
  elevationMasks: [{ startAz: 30 as Degrees, stopAz: 60 as Degrees, minEl: 15 as Degrees }],
});

console.log(fov.getMinElevation(45 as Degrees)); // 15
console.log(fov.getMinElevation(90 as Degrees)); // 5
```

### Interpolated Horizon (`interpolate: true`)

Each entry is a vertex at (`startAz`, `minEl`); the floor is the straight line between the
neighbouring vertices, wrapping at 360 deg. `stopAz` is ignored. The constructor sorts the
vertices by azimuth once (`sortElevationMasks`), so lookups are a binary search with no
allocation.

Both modes store a copy of the caller's array and of each entry, so mutating the input after
construction has no effect on the FOV.

---

## API Reference

### Creating a Circular Cone FOV

```typescript
import { Degrees, FieldOfView, Kilometers } from 'ootk';

const fov = new FieldOfView({
  boresightAz: 0 as Degrees,
  boresightEl: 45 as Degrees,
  halfAngle: 30 as Degrees,
  minRange: 100 as Kilometers,
  maxRange: 40000 as Kilometers,
});

console.log(fov.isCircular); // true
```

### Creating an Elliptical Cone FOV

```typescript
import { Degrees, FieldOfView, Kilometers } from 'ootk';

// Fence-style fan pointing straight up: 80 deg along the boresight azimuth line, 1 deg across it.
// At the zenith, roll 0 puts the major axis along the boresight azimuth, so boresightAz 270 with
// roll 0 is an east-west fan.
const fan = new FieldOfView({
  boresightAz: 270 as Degrees,
  boresightEl: 90 as Degrees,
  halfAngle: 80 as Degrees,
  minorHalfAngle: 1 as Degrees,
  rollAngle: 0 as Degrees,
  minRange: 100 as Kilometers,
  maxRange: 40000 as Kilometers,
});

console.log(fan.contains({ rng: 1000 as Kilometers, az: 90 as Degrees, el: 45 as Degrees })); // true (east)
console.log(fan.contains({ rng: 1000 as Kilometers, az: 0 as Degrees, el: 45 as Degrees })); // false (north)
```

### Using the BoresightFrame Helper

`boresightFrameFromAzElRoll` takes radians, unlike `FieldOfViewParams`, which takes degrees.

```typescript
import { boresightFrameFromAzElRoll, Radians } from 'ootk';

const DEG2RAD = Math.PI / 180;
const frame = boresightFrameFromAzElRoll(
  (0 * DEG2RAD) as Radians, // azimuth
  (45 * DEG2RAD) as Radians, // elevation
  0 as Radians, // roll
);

console.log(frame.b); // boresight unit vector (ENU)
console.log(frame.u); // major axis: toward "up" when roll is 0 and el is below 90 deg
console.log(frame.v); // minor axis: u x v = -b
```

### Checking FOV Containment

```typescript
import { Degrees, FieldOfView, Kilometers, RaeVec3 } from 'ootk';

const fov = FieldOfView.circularCone(0 as Degrees, 45 as Degrees, 30 as Degrees, 100 as Kilometers, 40000 as Kilometers);
const rae: RaeVec3<Kilometers, Degrees> = {
  rng: 1000 as Kilometers,
  az: 10 as Degrees,
  el: 40 as Degrees,
};

if (fov.contains(rae)) {
  console.log('Target is in FOV');
}
```

---

## Migration Guide

### From Legacy min/max FOV

An azimuth/elevation box cannot be represented exactly by an ellipse, and half-angles are
off-boresight angles, not azimuth differences. To approximate a box of azimuth 0 to 120 deg and
elevation 5 to 85 deg:

- Boresight at the box center: az 60, el 45.
- Azimuth half-width: a target at el 45 and 60 deg of azimuth from the boresight is
  `2 asin(cos 45 sin 30) = 41.4 deg` off boresight. That point is not exactly on the major axis
  (a line of constant elevation is not a great circle), so round up slightly; 42 deg works here.
  Using 60 would reach out to about azimuth -30 to 150 deg at el 45.
- Elevation half-width: 40 deg (5 to 85).
- Off the zenith, roll 0 puts the major axis vertical, so put the azimuth extent on the major
  axis with roll 90 (or swap the two half-angles and keep roll 0).
- Keep `minElevation` to clip the bottom of the cone. The corners of the old box (for example
  az 0, el 10) fall outside the ellipse.

**Before (removed):**

```text
fieldOfView: {
  minAzimuth: 0,
  maxAzimuth: 120,
  minElevation: 5,
  maxElevation: 85,
  minRange: 100,
  maxRange: 40000,
}
```

**After:**

```typescript
import { Degrees, FieldOfView, Kilometers } from 'ootk';

const fov = new FieldOfView({
  boresightAz: 60 as Degrees, // center of the azimuth range
  boresightEl: 45 as Degrees, // center of the elevation range
  halfAngle: 42 as Degrees, // covers az 0 and az 120 at el 45 (41.4 deg off boresight, see above)
  minorHalfAngle: 40 as Degrees, // half the elevation range
  rollAngle: 90 as Degrees, // major axis horizontal
  minRange: 100 as Kilometers,
  maxRange: 40000 as Kilometers,
  minElevation: 5 as Degrees,
});

console.log(fov.contains({ rng: 1000 as Kilometers, az: 0 as Degrees, el: 45 as Degrees })); // true
console.log(fov.contains({ rng: 1000 as Kilometers, az: 0 as Degrees, el: 10 as Degrees })); // false (box corner)
```

### From Secondary FOV (Multi-Face)

The `secondaryFov` sensor parameter was removed. Use `PhasedArrayRadar` with one boresight per
face, as in [Multi-Face Phased Array Support](#multi-face-phased-array-support). `Sensor` is
abstract; construct a concrete class (`PhasedArrayRadar`, `MechanicalRadar`, `OpticalSensor`,
`PassiveRFSensor`, `LaserRangingSensor`, `TtcAntenna`) with a numeric `id`, a `name`, a
`sensorType` and a `fieldOfView` that includes `halfAngle`.

### From ootk 7 Zenith Roll (ootk 8)

ootk 7 measured roll at the zenith from North; ootk 8 measures it from the boresight azimuth
line (roll 0 = major axis along the boresight azimuth). Only zenith (`boresightEl` 90),
non-circular FOVs are affected; every other configuration keeps its meaning.

```text
newRoll = (oldRoll - boresightAz - 180) mod 360
```

Because the ellipse is symmetric under u -> -u, `(oldRoll - boresightAz) mod 180` is equivalent.
For the Space Fence configuration (az 270, el 90, v7 roll 90): (90 - 270 - 180) mod 360 = 0.

```typescript
import { Degrees, FieldOfView, Kilometers } from 'ootk';

const v8Params = FieldOfView.migrateZenithRollFromV7({
  boresightAz: 270 as Degrees,
  boresightEl: 90 as Degrees,
  halfAngle: 80 as Degrees,
  minorHalfAngle: 1 as Degrees,
  rollAngle: 90 as Degrees, // v7 convention
  minRange: 0 as Kilometers,
  maxRange: 5000 as Kilometers,
});

console.log(v8Params.rollAngle); // 0
```

`migrateZenithRollFromV7` returns an unchanged copy for non-zenith or circular parameters (a
missing `boresightEl` counts as the default 90), so it is safe to run over a whole catalog once.
Do not run it on configs that are already in the v8 convention.

For a default zenith config (az 0, roll 0) the v8 frame is the v7 frame rotated 180 deg
(u = (0, -1, 0) instead of (0, 1, 0)). Containment is identical, but `directionAt(t)` returns
what v7 returned at `t + 180 deg`, so boundary samples start on the opposite side.

---

## Lessons Learned

### Mathematical Considerations

1. **Zenith singularity is real**: az/el representations break down at el = 90 deg. The
   boresight frame with an explicit roll angle handles it, but only if the zenith branch is the
   limit of the general branch. The v7 branch (roll from North) was not, and a fan at el 89.9
   and el 90 pointed 90 deg apart; v8 fixed this.
2. **The ellipse lives in angular space**: the containment check uses the off-boresight angle
   and position angle (azimuthal-equidistant), not Cartesian tangent-plane coordinates.
3. **Half-angles are not azimuth spans**: off the horizon an azimuth offset is a smaller angle
   on the sky; convert with `2 asin(cos(e) sin(d / 2))`.

### Design Decisions

1. **Composition over inheritance for multi-face**: an array of independent `FieldOfView`
   instances replaced primary/secondary FOVs.
2. **Defaults matter**: boresightEl 90 (zenith) with a topocentric frame makes the all-sky
   ground sensor trivial to configure. `halfAngle` has no default and is required.
3. **Roll convention must be documented**: off the zenith roll 0 puts the major axis vertical;
   at the zenith roll 0 puts it along the boresight azimuth.

### Implementation Tips

1. **Cache computed values**: the BoresightFrame and radian half-angles are computed once in
   the constructor.
2. **Validate early**: constructor validation rejects configuration errors immediately.
3. **Use branded types**: `Degrees`, `Radians` and `Kilometers` catch unit mix-ups at compile
   time, for example passing degrees to `boresightFrameFromAzElRoll`.

### Future Considerations

1. **Body-frame sensors**: `FovFrame.BODY` is metadata only; there is no attitude model, so the
   caller supplies body-frame directions to `containsDirection()`.
2. **Non-cone shapes**: only elliptical and circular cones exist.
3. **Time-varying FOV**: the FOV is static; scanning is modeled separately
   (`MechanicalRadar.scanPeriod`).

---

## Questions & Design Decisions Log

| Question | Decision | Rationale |
|----------|----------|-----------|
| How to handle zenith? | Explicit roll angle | Avoids the az/el singularity |
| Roll convention at zenith? | Roll 0 = major axis along the boresight azimuth (v8) | Limit of the general branch, so the frame is continuous through el 90; v7 used North |
| Secondary FOV for multi-face? | Removed; use `faceFovs` | Cleaner separation |
| Hemisphere representation? | Zenith cone with halfAngle 90 (`FieldOfView.hemisphere`) | No special case needed |
| Elevation masking granularity? | Step sectors or interpolated vertices | Handles terrain without complicating simple cases |
| Missing `halfAngle`? | Throw `ValidationError` (v8) | v7 accepted it and the sensor silently saw nothing |
| Backward compatibility? | Breaking changes allowed, with migration helpers | Correct geometry over legacy behavior |

---
