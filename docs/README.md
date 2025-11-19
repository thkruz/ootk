# OOTK Documentation

Welcome to the OOTK (Orbital Object Toolkit) documentation!

## Documentation Structure

### For New Users

**[Getting Started Guide](./getting-started.md)** - Start here if you're new to OOTK!

This guide covers:
- Installation and setup
- Your first satellite tracking program
- Understanding coordinate systems
- Working with ground sensors
- Common use cases with complete examples
- Troubleshooting tips

Perfect for: Beginners, developers new to orbital mechanics, quick start tutorials

### For All Users

**[User Guide](./user-guide.md)** - Comprehensive reference for all OOTK features

This guide covers:
- All modules and their functionality
- Detailed API documentation
- Advanced features
- Code examples for every feature
- Performance optimization tips
- Complete reference material

Perfect for: Intermediate to advanced users, comprehensive feature documentation

## Quick Links

### Getting Started
- [Installation](./getting-started.md#installation)
- [Your First Satellite](./getting-started.md#your-first-satellite)
- [Understanding Coordinates](./getting-started.md#understanding-coordinates)
- [Working with Sensors](./getting-started.md#working-with-sensors)
- [Common Use Cases](./getting-started.md#common-use-cases)

### Core Features
- [Satellite Operations](./user-guide.md#satellite-operations)
- [Sensor Operations](./user-guide.md#sensor-operations)
- [Coordinate Systems](./user-guide.md#coordinate-systems)
- [Orbit Propagation](./user-guide.md#orbit-propagation)
- [Time Systems](./user-guide.md#time-systems)

### Advanced Features
- [Force Models](./user-guide.md#force-models)
- [Initial Orbit Determination](./user-guide.md#initial-orbit-determination)
- [Interpolation](./user-guide.md#interpolation)
- [Maneuvers](./user-guide.md#maneuvers)
- [Covariance](./user-guide.md#covariance)

## What is OOTK?

OOTK is a comprehensive TypeScript/JavaScript library for orbital mechanics calculations. It provides:

- **Satellite Tracking**: Propagate satellite positions using SGP4 and numerical integrators
- **Sensor Operations**: Calculate visibility and predict satellite passes
- **Coordinate Transformations**: Convert between ECI, ECF, geodetic, and other systems
- **Orbit Determination**: Determine orbits from observations
- **Mission Planning**: Calculate maneuvers and delta-v requirements
- **High-Precision Propagation**: Model perturbations including gravity harmonics, drag, SRP

## Key Features

- **Type-Safe**: Written in TypeScript with comprehensive type definitions
- **Unit Types**: Prevents mixing incompatible units (degrees/radians, km/meters)
- **Browser & Node.js**: Works in both environments
- **Multiple Propagators**: SGP4, Kepler, Runge-Kutta (multiple orders), Dormand-Prince
- **Extensive Coordinate Systems**: J2000, TEME, ITRF, Geodetic, RIC, Hill, and more
- **Battle-Tested**: Originally developed for [KeepTrack](https://github.com/thkruz/keeptrack.space)

## Installation

```bash
npm install ootk
```

## Quick Example

```typescript
import { Satellite, Sensor, Degrees, Kilometers } from 'ootk';

// Create satellite from TLE
const satellite = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741'
});

// Get current position
const lla = satellite.lla();
console.log(`Lat: ${lla.lat}°, Lon: ${lla.lon}°, Alt: ${lla.alt} km`);

// Create ground sensor
const sensor = new Sensor({
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
  minEl: 5 as Degrees,
  maxEl: 85 as Degrees
});

// Check if satellite is visible
if (sensor.isSatInFov(satellite)) {
  const rae = sensor.rae(satellite);
  console.log(`Visible! Az: ${rae.az}°, El: ${rae.el}°, Range: ${rae.rng} km`);
}

// Predict passes
const passes = sensor.calculatePasses(30, satellite);
console.log(`Found ${passes.length} passes`);
```

## Support

- **GitHub Repository**: https://github.com/thkruz/ootk
- **Issues**: https://github.com/thkruz/ootk/issues
- **NPM Package**: https://www.npmjs.com/package/ootk
- **Examples**: Check the `/examples` directory

## License

AGPL-3.0

## Version

5.1.1
