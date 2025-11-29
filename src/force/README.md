# Force Module

This module provides force models for high-fidelity spacecraft propagation. Forces can be combined using `ForceModel` to create realistic orbital dynamics simulations.

## File Overview

| File | Description |
|------|-------------|
| [Force.ts](Force.ts) | Abstract base class defining the `acceleration(state: J2000)` interface for all perturbation forces |
| [ForceModel.ts](ForceModel.ts) | Composite force aggregator that combines multiple forces and computes total acceleration/derivative |
| [Gravity.ts](Gravity.ts) | Simple point-mass (spherical) gravity model using μ/r² |
| [EarthGravity.ts](EarthGravity.ts) | EGM-96 spherical harmonic geopotential model supporting degree/order up to 36 |
| [AtmosphericDrag.ts](AtmosphericDrag.ts) | Harris-Priester atmospheric drag with F10.7 solar activity scaling |
| [SolarRadiationPressure.ts](SolarRadiationPressure.ts) | Solar radiation pressure with shadow/lighting ratio for eclipse transitions |
| [ThirdBodyGravity.ts](ThirdBodyGravity.ts) | Third-body gravitational perturbations from the Moon and Sun |
| [Thrust.ts](Thrust.ts) | Spacecraft maneuver model with RIC (radial-intrack-crosstrack) components |

## Usage Example

```typescript
import { ForceModel } from './ForceModel';
import { Thrust } from './Thrust';

const forces = new ForceModel()
  .setGravity()                              // Point-mass Earth gravity
  .setEarthGravity(20, 20);                  // Or use EGM-96 to degree/order 20

forces.setThirdBodyGravity({ moon: true, sun: true });
forces.setSolarRadiationPressure(500, 10, 1.2);  // mass (kg), area (m²), Cr
forces.setAtmosphericDrag(500, 10, 2.2, 4);      // mass, area, Cd, cosine exp

// Get acceleration at a state
const accel = forces.acceleration(state);

// Get full derivative (velocity, acceleration) for integration
const deriv = forces.derivative(state);
```

## What This Library Does Well

### Modular Force Architecture
All forces implement a common `Force` interface, making it easy to compose and extend the force model. The `ForceModel` class cleanly aggregates forces and computes combined accelerations.

### EGM-96 Geopotential Model
The `EarthGravity` class implements spherical harmonic expansion up to degree and order 36, capturing:
- J2 oblateness (primary perturbation for LEO)
- Higher-order zonal harmonics (J3, J4, etc.)
- Sectoral and tesseral harmonics for longitude-dependent variations

### Harris-Priester Atmospheric Drag
Includes diurnal density variation with configurable:
- F10.7 solar radio flux (70-250 SFU for solar min/max)
- Cosine exponent for day/night transition modeling
- Atmospheric bulge lag (30° behind subsolar point)

### Solar Radiation Pressure
Accounts for shadow transitions using a lighting ratio, providing smooth acceleration changes during eclipse entry/exit rather than discontinuous on/off switching.

### Third-Body Gravity
Properly implements the indirect term (acceleration of Earth toward the third body) in addition to the direct term, which is critical for accurate long-term propagation.

### Thrust/Maneuver Support
The `Thrust` class supports both:
- Impulsive maneuvers (instantaneous delta-V)
- Finite-burn maneuvers with duration computed from delta-V magnitude

## What's Missing

### Atmospheric Models
- **NRLMSISE-00** - More accurate than Harris-Priester, includes composition data
- **JB2008** - Best accuracy for modern space weather indices
- **DTM-2020** - Latest generation thermospheric model
- Real-time space weather data ingestion (Kp, Ap, F10.7 observed vs predicted)

### Gravitational Effects
- **Solid Earth tides** - Time-varying deformations from lunar/solar tidal forces
- **Ocean tides** - Additional periodic gravity variations
- **Relativistic corrections** - Schwarzschild, Lense-Thirring, de Sitter effects
- **Other planetary perturbations** - Venus, Jupiter (important for GEO and beyond)

### Radiation Effects
- **Earth albedo radiation pressure** - Reflected sunlight from Earth
- **Earth thermal radiation** - Infrared emission from Earth
- **Attitude-dependent SRP** - Varying cross-section based on spacecraft orientation

### Other Physics
- **Magnetic field effects** - Lorentz force on charged spacecraft
- **Outgassing/venting** - Small but measurable for precision orbits
- **Gravity gradient torque** - For attitude dynamics coupling

### Multi-Body Support
- Currently Earth-centric only
- No Mars, Moon, or other central body gravity models
- No patched-conic or full n-body propagation

### Operational Features
- Coefficient files for multiple gravity models (EGM2008, GGM05S)
- Space weather prediction/interpolation
- Force model Jacobians for covariance propagation
