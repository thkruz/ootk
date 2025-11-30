# Field of View Design Document

**Version:** 1.0
**Status:** Implemented
**Last Updated:** November 2025

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

This document describes the boresight-centric elliptical cone Field of View (FOV) implementation for the sensor module. The new design replaces the legacy min/max azimuth/elevation approach with a more mathematically rigorous and flexible system that supports:

- Asymmetric FOV patterns (elliptical cones)
- Multi-face phased array radars
- Ground-based (topocentric) and space-based (body-frame) sensors
- Granular elevation masking for terrain/obstruction handling

---

## Problem Statement

### Legacy Approach Limitations

The original FieldOfView class used min/max azimuth and elevation ranges:

```typescript
// OLD - problematic approach
fieldOfView: {
  minAzimuth: 0,
  maxAzimuth: 120,
  minElevation: 5,
  maxElevation: 85
}
```

This approach had several issues:

1. **Cannot represent asymmetric patterns** - Phased array radars often have fan-shaped FOVs (e.g., 90° in one direction, 2° in another)
2. **Zenith singularity** - Az/El ranges behave poorly near zenith (el=90°)
3. **Multi-face complexity** - Required "secondary FOV" concept for multi-face radars
4. **Ground-centric assumption** - Math assumed sensors were on the ground in topocentric frame

### Real-World Requirements

- **Fan-shaped phased arrays**: Boresight pointing straight up with 90° coverage in two directions but only 2° in the perpendicular direction
- **Space-based sensors**: Sensors mounted on satellites with body-fixed orientation
- **Terrain masking**: Buildings and hills blocking specific azimuth/elevation regions

---

## Design Goals

1. **Boresight-centric geometry** - Define FOV relative to a boresight direction, not min/max bounds
2. **Elliptical cone support** - Major and minor half-angles for asymmetric patterns
3. **Reference frame flexibility** - Support both topocentric and body-fixed frames
4. **Modular multi-face support** - Each radar face gets its own FieldOfView instance
5. **Granular elevation masking** - Per-azimuth-sector elevation limits for obstructions
6. **Breaking change acceptable** - Clean API over backward compatibility

---

## Architecture Overview

### Key Components

```
FieldOfView
├── Boresight direction (az, el)
├── Half-angles (major, minor)
├── Roll angle (orientation of ellipse)
├── Range limits (min, max)
├── Minimum elevation
├── Elevation masks (array)
└── BoresightFrame (computed)

BoresightFrame
├── b: Vector3D (boresight direction)
├── u: Vector3D (major axis direction)
└── v: Vector3D (minor axis direction)
```

### Supporting Enums

```typescript
enum FovShape {
  ELLIPTICAL_CONE = 'ELLIPTICAL_CONE',
  CIRCULAR_CONE = 'CIRCULAR_CONE',
}

enum FovFrame {
  TOPOCENTRIC = 'TOPOCENTRIC',  // Ground sensors (default)
  BODY = 'BODY',                // Space sensors
}
```

---

## Core Concepts

### Boresight-Centric Model

Instead of defining FOV boundaries, define:

1. **Boresight direction**: Where the sensor is "pointing" (az, el in topocentric or body frame)
2. **Half-angles**: Angular extent from boresight (major for widest, minor for narrowest)
3. **Roll angle**: Rotation of the ellipse around the boresight axis

### BoresightFrame Construction

The `boresightFrameFromAzElRoll()` function creates an orthonormal basis:

```typescript
interface BoresightFrame {
  b: Vector3D;  // Boresight direction (unit vector)
  u: Vector3D;  // Major axis direction (perpendicular to b)
  v: Vector3D;  // Minor axis direction (perpendicular to b and u)
}
```

**Algorithm:**

1. Convert boresight az/el to ENU (East-North-Up) unit vector
2. Compute initial "up" reference (projection of +Z onto plane perpendicular to boresight)
3. Apply roll rotation around boresight axis
4. Cross product to get orthogonal minor axis

**Zenith Handling:** When boresight is near zenith (el ≈ 90°), the "up" direction becomes ambiguous. Roll angle of 0° means the major axis points North.

### Elliptical Cone Containment

To check if a target is within the FOV:

1. Convert target az/el to ENU unit vector `t`
2. Compute angular deviation from boresight: `θ = arccos(b · t)`
3. Project `t` onto the u-v plane to get direction `φ`
4. Apply ellipse equation:

```
(θ · cos(φ) / halfAngle)² + (θ · sin(φ) / minorHalfAngle)² ≤ 1
```

If the result is ≤ 1, the target is within the elliptical cone.

---

## Implementation Details

### FieldOfViewParams Interface

```typescript
interface FieldOfViewParams {
  // Boresight direction
  boresightAz?: Degrees;      // Default: 0° (North)
  boresightEl?: Degrees;      // Default: 90° (Zenith)

  // Cone geometry
  halfAngle: Degrees;         // Major half-angle (required)
  minorHalfAngle?: Degrees;   // Minor half-angle (defaults to halfAngle = circular)
  rollAngle?: Degrees;        // Ellipse orientation (default: 0°)

  // Range constraints
  minRange: Kilometers;       // Minimum observable range
  maxRange: Kilometers;       // Maximum observable range

  // Elevation constraints
  minElevation?: Degrees;     // Global minimum elevation (default: 0°)
  elevationMasks?: ElevationMask[];  // Azimuth-specific masks

  // Metadata
  shape?: FovShape;           // Auto-detected if not specified
  frame?: FovFrame;           // Default: TOPOCENTRIC
}
```

### ElevationMask Interface

```typescript
interface ElevationMask {
  startAz: Degrees;   // Start of masked azimuth sector
  stopAz: Degrees;    // End of masked azimuth sector (handles wraparound)
  minEl: Degrees;     // Minimum elevation in this sector
}
```

### Key Methods

```typescript
class FieldOfView {
  // Primary containment check
  contains(rae: RaeVec3<Kilometers, Degrees>): boolean;

  // Individual checks
  isInCone(az: Degrees, el: Degrees): boolean;
  isInRange(range: Kilometers): boolean;
  isAboveMinElevation(az: Degrees, el: Degrees): boolean;

  // Utility getters
  get isCircular(): boolean;
  get angularCoverage(): Degrees;  // 2 * halfAngle
}
```

---

## Multi-Face Phased Array Support

### Design Decision

Instead of a "secondary FOV" concept, multi-face phased arrays create a separate `FieldOfView` instance for each face:

```typescript
class PhasedArrayRadar extends RadarSensor {
  readonly faceFovs: FieldOfView[];  // One per face
  readonly faceCount: number;

  constructor(params: PhasedArrayRadarParams) {
    // ...
    this.faceFovs = params.boresightAz.map((az, i) =>
      new FieldOfView({
        ...baseFovParams,
        boresightAz: az,
        boresightEl: params.boresightEl[i],
      })
    );
  }

  override isInFov(rae: RaeVec3<Kilometers, Degrees>): boolean {
    return this.faceFovs.some((fov) => fov.contains(rae));
  }

  getFacesInFov(rae: RaeVec3<Kilometers, Degrees>): number[] {
    return this.faceFovs
      .map((fov, i) => fov.contains(rae) ? i : -1)
      .filter((i) => i >= 0);
  }
}
```

### Benefits

- Each face is fully independent with its own boresight and geometry
- Clean separation of concerns
- Easy to add/remove faces
- No special "secondary" logic needed

---

## Elevation Masking

### Use Case

Ground-based sensors often have terrain obstructions (buildings, hills) that block specific azimuth sectors at low elevations.

### Implementation

```typescript
// Example: Building blocks 30° to 60° azimuth below 15° elevation
const fov = new FieldOfView({
  halfAngle: 60 as Degrees,
  minRange: 100 as Kilometers,
  maxRange: 40000 as Kilometers,
  minElevation: 5 as Degrees,  // Global minimum
  elevationMasks: [
    { startAz: 30 as Degrees, stopAz: 60 as Degrees, minEl: 15 as Degrees }
  ]
});
```

### Azimuth Wraparound

The elevation mask logic handles azimuth wraparound (e.g., startAz=350°, stopAz=10°):

```typescript
private isAzimuthInMaskRange_(az: Degrees, mask: ElevationMask): boolean {
  if (mask.startAz <= mask.stopAz) {
    return az >= mask.startAz && az <= mask.stopAz;
  }
  // Wraparound case
  return az >= mask.startAz || az <= mask.stopAz;
}
```

---

## API Reference

### Creating a Circular Cone FOV

```typescript
const fov = new FieldOfView({
  boresightAz: 0 as Degrees,
  boresightEl: 45 as Degrees,
  halfAngle: 30 as Degrees,
  minRange: 100 as Kilometers,
  maxRange: 40000 as Kilometers,
});
```

### Creating an Elliptical Cone FOV

```typescript
// Fan-shaped: 90° wide, 2° tall
const fov = new FieldOfView({
  boresightAz: 0 as Degrees,
  boresightEl: 90 as Degrees,
  halfAngle: 90 as Degrees,      // Major (widest)
  minorHalfAngle: 2 as Degrees,  // Minor (narrowest)
  rollAngle: 0 as Degrees,       // Major axis points North
  minRange: 100 as Kilometers,
  maxRange: 40000 as Kilometers,
});
```

### Using the BoresightFrame Helper

```typescript
import { boresightFrameFromAzElRoll } from 'ootk/sensor';

const frame = boresightFrameFromAzElRoll(
  0 as Degrees,    // Azimuth
  45 as Degrees,   // Elevation
  0 as Degrees     // Roll
);

console.log(frame.b);  // Boresight unit vector
console.log(frame.u);  // Major axis direction
console.log(frame.v);  // Minor axis direction
```

### Checking FOV Containment

```typescript
const rae: RaeVec3<Kilometers, Degrees> = {
  rng: 1000 as Kilometers,
  az: 45 as Degrees,
  el: 30 as Degrees,
};

if (fov.contains(rae)) {
  console.log('Target is in FOV');
}
```

---

## Migration Guide

### From Legacy min/max FOV

**Before:**

```typescript
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
fieldOfView: {
  boresightAz: 60 as Degrees,    // Center of az range
  boresightEl: 45 as Degrees,    // Center of el range
  halfAngle: 60 as Degrees,      // Half the az range
  minorHalfAngle: 40 as Degrees, // Half the el range
  minRange: 100 as Kilometers,
  maxRange: 40000 as Kilometers,
  minElevation: 5 as Degrees,
}
```

### From Secondary FOV (Multi-Face)

**Before:**

```typescript
const sensor = new Sensor({
  fieldOfView: { /* face 1 */ },
  secondaryFov: { /* face 2 */ },  // Removed
});
```

**After:**

```typescript
const radar = new PhasedArrayRadar({
  fieldOfView: { halfAngle: 60, minRange: 100, maxRange: 40000 },
  boresightAz: [0, 180] as Degrees[],    // Face directions
  boresightEl: [45, 45] as Degrees[],
});
// radar.faceFovs[0] and radar.faceFovs[1] are auto-created
```

---

## Lessons Learned

### Mathematical Considerations

1. **Zenith singularity is real** - Traditional az/el representations break down at el=90°. The boresight frame approach with explicit roll angle handles this gracefully.

2. **Ellipse equation works in angular space** - The containment check uses angular deviation from boresight, not Cartesian coordinates. This makes the math cleaner.

3. **ENU frame simplifies ground sensors** - Using East-North-Up as the base coordinate system makes topocentric calculations intuitive.

### Design Decisions

1. **Composition over inheritance for multi-face** - Instead of complex inheritance with "primary" and "secondary" FOVs, using an array of independent FieldOfView instances is cleaner and more maintainable.

2. **Breaking changes are sometimes better** - Rather than maintaining backward compatibility with the legacy API, a clean break allowed a much simpler implementation.

3. **Defaults matter** - Choosing boresightEl=90° (zenith) as default with topocentric frame makes the most common ground sensor case trivial to configure.

4. **Roll convention must be documented** - The meaning of roll=0° (major axis points North for zenith boresight) is arbitrary but must be consistent and documented.

### Implementation Tips

1. **Cache computed values** - The BoresightFrame and radian conversions are cached in private readonly members to avoid recomputation.

2. **Validate early** - Constructor validation catches configuration errors immediately rather than at observation time.

3. **Use branded types** - TypeScript branded types (Degrees, Kilometers, Radians) prevent unit confusion at compile time.

### Future Considerations

1. **Body-frame sensors** - The FovFrame.BODY option is defined but not fully implemented. Space-based sensors will need additional coordinate transforms.

2. **Non-cone shapes** - FovShape enum allows for future rectangular or custom FOV shapes, though only elliptical/circular cones are currently implemented.

3. **Time-varying FOV** - Some sensors may have FOVs that change over time (scanning radars). The current design is static but could be extended.

---

## Questions & Design Decisions Log

| Question | Decision | Rationale |
|----------|----------|-----------|
| How to handle zenith? | Explicit roll angle | Avoids az/el singularity, provides deterministic behavior |
| Secondary FOV for multi-face? | Remove - use faceFovs array | Cleaner separation, more flexible |
| Hemisphere representation? | Circular cone with halfAngle=90° | No special case needed |
| Elevation masking granularity? | Array of az-sector masks | Handles complex terrain without overcomplicating simple cases |
| Roll convention at zenith? | Roll=0° means major axis points North | Arbitrary but consistent and documented |
| Backward compatibility? | Breaking change | Clean API more valuable than legacy support |

---
