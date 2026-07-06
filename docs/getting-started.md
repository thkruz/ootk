# Getting Started with OOTK

Welcome to the Orbital Object Toolkit (OOTK)! This guide will help you get started with orbital mechanics programming, whether you're a beginner or an experienced developer new to this library.

---

## Table of Contents

1. [What is OOTK?](#what-is-ootk)
2. [Installation](#installation)
3. [Your First Satellite](#your-first-satellite)
4. [Understanding Coordinates](#understanding-coordinates)
5. [Working with Sensors](#working-with-sensors)
6. [Common Use Cases](#common-use-cases)
7. [Next Steps](#next-steps)

---

## What is OOTK?

OOTK (Orbital Object Toolkit) is a comprehensive library for orbital mechanics calculations in TypeScript/JavaScript. Think of it as your Swiss Army knife for:

- **Tracking satellites** from TLE data
- **Predicting satellite passes** over ground stations
- **Converting between coordinate systems** (latitude/longitude, ECI, ECF)
- **Calculating orbital parameters** (altitude, velocity, period)
- **Determining orbits from observations**
- **Planning orbital maneuvers**

### Who is this for?

- Web developers building satellite tracking applications
- Researchers doing orbital mechanics analysis
- Students learning astrodynamics
- Hobbyists interested in space and satellites

### What makes OOTK different?

- **Type-safe**: Uses TypeScript for catching errors at compile time
- **Unit types**: Prevents mixing degrees with radians, kilometers with meters
- **Browser-friendly**: Works in web browsers and Node.js
- **Comprehensive**: Everything from simple tracking to advanced orbit determination

---

## Installation

### Prerequisites

You'll need:

- **Node.js** (version 14 or higher)
- **npm** (comes with Node.js)

### Install OOTK

```bash
npm install ootk
```

### Verify Installation

Create a test file `test.js`:

```javascript
import { Earth } from 'ootk';
console.log('Earth radius:', Earth.radiusMean, 'km');
```

Run it:

```bash
node test.js
```

You should see: `Earth radius: 6371 km`

### TypeScript Setup (Optional but Recommended)

If using TypeScript:

```bash
npm install --save-dev typescript @types/node
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true
  }
}
```

---

## Your First Satellite

Let's track the International Space Station (ISS)!

### Step 1: Get TLE Data

TLE (Two-Line Element) sets describe a satellite's orbit. You can get them from:

- <https://celestrak.org/>
- <https://www.space-track.org/>
- <https://api.keeptrack.space/>

Example ISS TLE:

```
ISS (ZARYA)
1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991
2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741
```

### Step 2: Create a Satellite Object

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

// ISS TLE data
const tle1 = '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1;
const tle2 = '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2;

// Create satellite object
const iss = new Satellite({ tle1, tle2 });

console.log('ISS created successfully!');
```

### Step 3: Get Current Position

```typescript
// Get position now
const eci = iss.eci();

console.log('Position (ECI):');
console.log('  X:', eci.position.x, 'km');
console.log('  Y:', eci.position.y, 'km');
console.log('  Z:', eci.position.z, 'km');

console.log('Velocity (ECI):');
console.log('  X:', eci.velocity.x, 'km/s');
console.log('  Y:', eci.velocity.y, 'km/s');
console.log('  Z:', eci.velocity.z, 'km/s');
```

**Output Example:**

```
Position (ECI):
  X: 3590.123 km
  Y: -5234.789 km
  Z: 2100.456 km
Velocity (ECI):
  X: 4.567 km/s
  Y: 3.210 km/s
  Z: 5.432 km/s
```

### Step 4: Get Latitude/Longitude

```typescript
const lla = iss.lla();

console.log('Latitude:', lla.lat, '°');
console.log('Longitude:', lla.lon, '°');
console.log('Altitude:', lla.alt, 'km');
```

**Output Example:**

```
Latitude: 23.456 °
Longitude: -45.678 °
Altitude: 418.234 km
```

### Step 5: Get Orbital Parameters

```typescript
console.log('Orbital Parameters:');
console.log('  Inclination:', iss.inclination, '°');
console.log('  Eccentricity:', iss.eccentricity);
console.log('  Period:', iss.period, 'minutes');
console.log('  Apogee:', iss.apogee, 'km');
console.log('  Perigee:', iss.perigee, 'km');
```

**Congratulations!** You've just tracked your first satellite with OOTK!

---

## Understanding Coordinates

OOTK uses several coordinate systems. Here's a simple explanation:

### 1. Geodetic (Latitude/Longitude/Altitude)

**What**: The coordinates you're familiar with from maps.

**When to use**: Displaying positions on a map, human-readable locations.

```typescript
const lla = iss.lla();
// { lat: 23.456°, lon: -45.678°, alt: 418 km }
```

### 2. ECI (Earth-Centered Inertial)

**What**: X, Y, Z coordinates in a non-rotating reference frame.

**When to use**: Physics calculations, propagating orbits.

```typescript
const eci = iss.eci();
// { position: {x, y, z}, velocity: {x, y, z} }
```

### 3. ECF (Earth-Centered Fixed)

**What**: X, Y, Z coordinates that rotate with Earth.

**When to use**: Ground station calculations, terrain modeling.

```typescript
const ecf = iss.ecf();
// { position: {x, y, z}, velocity: {x, y, z} }
```

### Quick Conversions

```typescript
// Satellite gives you all of them:
const lla = satellite.lla();      // Geodetic
const eci = satellite.eci();      // ECI
const ecf = satellite.ecf();      // ECF
const j2000 = satellite.toJ2000(); // J2000 (specific ECI frame)
```

---

## Working with Sensors

A "sensor" in OOTK is a ground station or observation point that tracks satellites.

### Create a Sensor

Let's create a sensor for Cape Cod:

```typescript
import { Sensor, Degrees, Kilometers } from 'ootk';

const capeCod = new Sensor({
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
  minEl: 5 as Degrees,     // Don't track below 5° elevation
  maxEl: 85 as Degrees,    // Don't track above 85°
  minRng: 0 as Kilometers,
  maxRng: 5000 as Kilometers  // Maximum tracking range
});
```

**Note**: The `as Degrees` and `as Kilometers` are TypeScript type casts that ensure you're using the right units.

### Calculate Look Angles

Get Range, Azimuth, Elevation from sensor to satellite:

```typescript
const rae = capeCod.rae(iss);

console.log('Range:', rae.rng, 'km');
console.log('Azimuth:', rae.az, '° (0=North, 90=East)');
console.log('Elevation:', rae.el, '° (0=horizon, 90=zenith)');
console.log('Range Rate:', rae.rngRate, 'km/s');
```

**Interpretation**:

- **Range**: Distance to satellite
- **Azimuth**: Which direction to point (compass heading)
- **Elevation**: How high to look up
- **Range Rate**: How fast distance is changing (negative = approaching)

### Check Visibility

```typescript
const isVisible = capeCod.isSatInFov(iss);

if (isVisible) {
  console.log('ISS is currently visible from Cape Cod!');
  const rae = capeCod.rae(iss);
  console.log('Look', rae.az.toFixed(1), '° at', rae.el.toFixed(1), '° elevation');
} else {
  console.log('ISS is not visible right now.');
}
```

### Predict Passes

Find when satellite will be visible:

```typescript
// Calculate passes over next 24 hours, checking every 10 seconds
const passes = capeCod.calculatePasses(10, iss, {
  startDate: new Date(),
  lengthDays: 1
});

console.log(`Found ${passes.length} passes in the next 24 hours:`);

passes.forEach((pass, index) => {
  console.log(`\nPass ${index + 1}:`);
  console.log('  Rise:', pass.rise.toLocaleString());
  console.log('  Peak:', pass.culmination.toLocaleString());
  console.log('  Set:', pass.set.toLocaleString());
  console.log('  Max Elevation:', pass.maxEl.toFixed(1), '°');
  console.log('  Duration:', (pass.duration / 60).toFixed(1), 'minutes');
});
```

**Output Example**:

```
Found 3 passes in the next 24 hours:

Pass 1:
  Rise: 1/28/2024, 6:23:45 PM
  Peak: 1/28/2024, 6:28:12 PM
  Set: 1/28/2024, 6:32:51 PM
  Max Elevation: 45.3 °
  Duration: 9.1 minutes

Pass 2:
  Rise: 1/28/2024, 8:01:23 PM
  Peak: 1/28/2024, 8:05:45 PM
  Set: 1/28/2024, 8:10:12 PM
  Max Elevation: 78.6 °
  Duration: 8.8 minutes
...
```

---

## Common Use Cases

### 1. Real-Time Satellite Tracker

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

class SatelliteTracker {
  private satellite: Satellite;

  constructor(tle1: TleLine1, tle2: TleLine2) {
    this.satellite = new Satellite({ tle1, tle2 });
  }

  getCurrentPosition() {
    const lla = this.satellite.lla();
    return {
      latitude: lla.lat,
      longitude: lla.lon,
      altitude: lla.alt
    };
  }

  getVelocity() {
    const eci = this.satellite.eci();
    const speed = Math.sqrt(
      eci.velocity.x ** 2 +
      eci.velocity.y ** 2 +
      eci.velocity.z ** 2
    );
    return speed;  // km/s
  }
}

// Usage
const tracker = new SatelliteTracker(tle1, tle2);

setInterval(() => {
  const pos = tracker.getCurrentPosition();
  const speed = tracker.getVelocity();

  console.log(
    `Lat: ${pos.latitude.toFixed(2)}°, ` +
    `Lon: ${pos.longitude.toFixed(2)}°, ` +
    `Alt: ${pos.altitude.toFixed(1)} km, ` +
    `Speed: ${speed.toFixed(2)} km/s`
  );
}, 1000);  // Update every second
```

### 2. Ground Station Pass Predictor

```typescript
import { Sensor, Satellite, Degrees, Kilometers } from 'ootk';

function predictPasses(
  sensorLat: number,
  sensorLon: number,
  sensorAlt: number,
  tle1: TleLine1,
  tle2: TleLine2,
  days: number = 7
) {
  const sensor = new Sensor({
    lat: sensorLat as Degrees,
    lon: sensorLon as Degrees,
    alt: sensorAlt as Kilometers,
    minEl: 10 as Degrees,  // Only show passes above 10°
    maxEl: 90 as Degrees,
    minRng: 0 as Kilometers,
    maxRng: 5000 as Kilometers
  });

  const satellite = new Satellite({ tle1, tle2 });

  const passes = sensor.calculatePasses(30, satellite, {
    startDate: new Date(),
    lengthDays: days
  });

  return passes.map(pass => ({
    riseTime: pass.rise,
    setTime: pass.set,
    peakTime: pass.culmination,
    maxElevation: pass.maxEl,
    durationMinutes: pass.duration / 60
  }));
}

// Usage
const myPasses = predictPasses(
  40.7128,   // New York City latitude
  -74.0060,  // longitude
  0.010,     // altitude (km)
  isstle1,
  isstle2,
  7  // next 7 days
);

console.log('Upcoming passes:', myPasses);
```

### 3. Multi-Satellite Tracker

```typescript
class MultiSatelliteTracker {
  private satellites: Map<string, Satellite> = new Map();

  addSatellite(name: string, tle1: TleLine1, tle2: TleLine2) {
    this.satellites.set(name, new Satellite({ tle1, tle2 }));
  }

  getAllPositions() {
    const positions = {};
    this.satellites.forEach((sat, name) => {
      const lla = sat.lla();
      positions[name] = {
        lat: lla.lat,
        lon: lla.lon,
        alt: lla.alt
      };
    });
    return positions;
  }

  findVisible(sensorLat: number, sensorLon: number) {
    const sensor = new Sensor({
      lat: sensorLat as Degrees,
      lon: sensorLon as Degrees,
      alt: 0 as Kilometers,
      minEl: 5 as Degrees,
      maxEl: 85 as Degrees,
      minRng: 0 as Kilometers,
      maxRng: 5000 as Kilometers
    });

    const visible = [];
    this.satellites.forEach((sat, name) => {
      if (sensor.isSatInFov(sat)) {
        const rae = sensor.rae(sat);
        visible.push({
          name,
          azimuth: rae.az,
          elevation: rae.el,
          range: rae.rng
        });
      }
    });

    return visible;
  }
}

// Usage
const tracker = new MultiSatelliteTracker();
tracker.addSatellite('ISS', isstle1, isstle2);
tracker.addSatellite('HUBBLE', hubbleTle1, hubbleTle2);
tracker.addSatellite('GPS-1', gpsTle1, gpsTle2);

// Get all positions
const allPositions = tracker.getAllPositions();
console.log(allPositions);

// Find what's visible from your location
const visibleSats = tracker.findVisible(40.7128, -74.0060);
console.log('Currently visible:', visibleSats);
```

### 4. Satellite Position at Specific Time

```typescript
import { Satellite, EpochUTC } from 'ootk';

const satellite = new Satellite({ tle1, tle2 });

// Position at a specific time
const specificDate = new Date('2024-12-31T00:00:00Z');
const eci = satellite.eci(specificDate);
const lla = satellite.lla(specificDate);

console.log('Position on New Year 2024:');
console.log('  Lat:', lla.lat, '°');
console.log('  Lon:', lla.lon, '°');
console.log('  Alt:', lla.alt, 'km');
```

### 5. Calculate Orbit Period

```typescript
function analyzeSatellite(tle1: TleLine1, tle2: TleLine2) {
  const sat = new Satellite({ tle1, tle2 });

  console.log('Orbital Analysis:');
  console.log('  Period:', sat.period.toFixed(2), 'minutes');
  console.log('  Apogee:', sat.apogee.toFixed(1), 'km');
  console.log('  Perigee:', sat.perigee.toFixed(1), 'km');
  console.log('  Inclination:', sat.inclination.toFixed(2), '°');
  console.log('  Eccentricity:', sat.eccentricity.toFixed(6));

  // Classify orbit
  const avgAlt = (sat.apogee + sat.perigee) / 2;
  let orbitType;
  if (avgAlt < 2000) orbitType = 'LEO (Low Earth Orbit)';
  else if (avgAlt < 35786) orbitType = 'MEO (Medium Earth Orbit)';
  else if (Math.abs(avgAlt - 35786) < 100) orbitType = 'GEO (Geostationary)';
  else orbitType = 'HEO (High Earth Orbit)';

  console.log('  Classification:', orbitType);

  // Orbits per day
  const orbitsPerDay = (24 * 60) / sat.period;
  console.log('  Orbits per day:', orbitsPerDay.toFixed(2));
}

analyzeSatellite(isstle1, isstle2);
```

---

## Next Steps

### Beginner Level

Now that you understand the basics:

1. **Try different satellites**: Get TLEs from <https://celestrak.org/>
2. **Change sensor locations**: Track from your city
3. **Experiment with times**: Look at positions in the past or future
4. **Build a web interface**: Display positions on a map

### Intermediate Level

Ready for more? Explore:

1. **Different propagators**: Try `RungeKutta4Propagator` for higher accuracy
2. **Coordinate transformations**: Convert between J2000, TEME, ITRF
3. **Time systems**: Work with UTC, GPS time, Julian dates
4. **Force models**: Add gravity harmonics, drag, solar radiation pressure

See the [User Guide](./user-guide.md) sections:

- [Orbit Propagation](./user-guide.md#orbit-propagation)
- [Coordinate Systems](./user-guide.md#coordinate-systems)
- [Time Systems](./user-guide.md#time-systems)

### Advanced Level

For advanced orbital mechanics:

1. **Initial Orbit Determination**: Determine orbits from observations
2. **Maneuver Planning**: Calculate delta-v for orbit changes
3. **Covariance Propagation**: Track uncertainty in orbits
4. **Custom Propagators**: Create your own propagation methods

See the [User Guide](./user-guide.md) sections:

- [Initial Orbit Determination](./user-guide.md#initial-orbit-determination)
- [Maneuvers](./user-guide.md#maneuvers)
- [Force Models](./user-guide.md#force-models)
- [Advanced Topics](./user-guide.md#advanced-topics)

---

## Troubleshooting

### Common Issues

#### 1. "Cannot find module 'ootk'"

**Problem**: Import error

**Solution**: Make sure you've installed OOTK:

```bash
npm install ootk
```

And that your `package.json` has `"type": "module"` for ES modules.

#### 2. Type errors with numbers

**Problem**: TypeScript complains about number types

**Solution**: Cast to appropriate types:

```typescript
// Wrong
const lat = 41.7;

// Correct
const lat = 41.7 as Degrees;
```

#### 3. Satellite position seems wrong

**Problem**: Position doesn't match expected values

**Solutions**:

- Check TLE is current (TLEs expire quickly, especially for LEO)
- Verify the time (use `new Date()` for current time)
- Ensure TLE lines are correct (no extra spaces or truncation)

#### 4. No passes found

**Problem**: `calculatePasses()` returns empty array

**Solutions**:

- Increase `lengthDays` parameter (satellite may not pass for several days)
- Lower `minEl` on sensor (try 0 degrees)
- Increase `maxRng` on sensor
- Check satellite orbit (geostationary satellites don't "pass")

### Getting Help

- **Documentation**: See [User Guide](./user-guide.md)
- **Examples**: Check `/examples` folder in repository
- **Issues**: <https://github.com/thkruz/ootk/issues>
- **Discussions**: <https://github.com/thkruz/ootk/discussions>

---

## Quick Reference

### Essential Imports

```typescript
// Basic tracking
import { Satellite, TleLine1, TleLine2 } from 'ootk';

// Sensors
import { Sensor, Degrees, Kilometers } from 'ootk';

// Advanced
import {
  Satellite,
  Sensor,
  EpochUTC,
  J2000,
  ClassicalElements,
  RungeKutta4Propagator,
  ForceModel
} from 'ootk';
```

### Common Patterns

```typescript
// Create satellite
const sat = new Satellite({ tle1, tle2 });

// Get position now
const lla = sat.lla();
const eci = sat.eci();

// Get position at specific time
const date = new Date('2024-12-31T00:00:00Z');
const llaFuture = sat.lla(date);

// Create sensor
const sensor = new Sensor({
  lat: latitude as Degrees,
  lon: longitude as Degrees,
  alt: altitude as Kilometers,
  minEl: 5 as Degrees,
  maxEl: 85 as Degrees,
  minRng: 0 as Kilometers,
  maxRng: 5000 as Kilometers
});

// Check visibility
const visible = sensor.isSatInFov(sat);

// Get look angles
const rae = sensor.rae(sat);

// Find passes
const passes = sensor.calculatePasses(30, sat, {
  startDate: new Date(),
  lengthDays: 7
});
```

---

## Example Projects to Build

### 1. ISS Notifier

Build a program that alerts you when the ISS will pass overhead.

**Skills**: Satellite tracking, pass prediction, notifications

### 2. Satellite Constellation Visualizer

Display multiple satellites on a map in real-time.

**Skills**: Multi-satellite tracking, web development, visualization

### 3. Ground Station Planner

Determine the best location for a ground station to maximize satellite contact time.

**Skills**: Sensor placement, pass analysis, optimization

### 4. Orbit Comparator

Compare different satellites' orbits and find close approaches.

**Skills**: Coordinate transformations, distance calculations

### 5. TLE Age Checker

Monitor a catalog of TLEs and alert when they're getting old.

**Skills**: TLE parsing, date handling, automation

---

## Resources

### Where to Get TLE Data

- **CelesTrak**: <https://celestrak.org/> (free, no account needed)
- **Space-Track**: <https://www.space-track.org/> (free account required)
- **KeepTrack API**: <https://api.keeptrack.space/> (simple REST API)

### Learning More

- **Orbital Mechanics**: "Fundamentals of Astrodynamics" by Bate, Mueller, White
- **SGP4**: "Revisiting Spacetrack Report #3" by Vallado et al.
- **OOTK Repository**: <https://github.com/thkruz/ootk>
- **Full Documentation**: [User Guide](./user-guide.md)

### Related Projects

- **KeepTrack**: <https://github.com/thkruz/keeptrack.space>
- **satellite.js**: Alternative JavaScript satellite library
- **Skyfield**: Python satellite library

---

## Congratulations

You're now ready to start building with OOTK. Start simple with satellite tracking, then explore more advanced features as you need them.

**Happy coding!**

If you build something cool with OOTK, consider sharing it with the community!

---

**License**: AGPL-3.0

**Version**: 5.1.1

**Last Updated**: January 2024
