# Optimize Module

This module provides numerical optimization and curve-fitting utilities for orbital mechanics applications. Each optimizer addresses specific computational challenges in satellite tracking, ephemeris processing, and orbital analysis.

## Optimizers

### SimpleLinearRegression

Fits a line (`y = mx + b`) to data points using ordinary least squares.

**When to Use:**

- Tracking satellite altitude decay over time
- Measuring orbital element drift rates
- Detecting trends in observation residuals

**Example: Predicting ISS Altitude Decay**

The ISS gradually loses altitude due to atmospheric drag. Fitting a line to altitude measurements lets you predict when reboost is needed.

```typescript
import { SimpleLinearRegression } from 'ootk';

// Daily altitude measurements (km)
const daysSinceEpoch = [0, 1, 2, 3, 4, 5, 6, 7];
const altitudes = [408.2, 407.9, 407.5, 407.2, 406.8, 406.5, 406.1, 405.8];

const regression = new SimpleLinearRegression(daysSinceEpoch, altitudes);

console.log(`Decay rate: ${regression.slope.toFixed(3)} km/day`);
// => Decay rate: -0.348 km/day

// Predict when altitude drops below 400 km
const daysUntil400km = (400 - regression.intercept) / regression.slope;
console.log(`Days until 400 km: ${daysUntil400km.toFixed(1)}`);
// => Days until 400 km: 23.6

// Predicted altitude on day 10
console.log(`Day 10: ${regression.evaluate(10).toFixed(2)} km`);
// => Day 10: 404.74 km

// Drop points whose residual exceeds 2x the standard error (returns a new regression)
const cleaned = regression.filterOutliers(2.0);
console.log(cleaned.length); // => 8
```

**Outcomes:**

- Decay rate in km/day for mission planning
- Predicted altitude at future dates
- Cleaned dataset with outliers removed

---

### GoldenSection

Finds the minimum or maximum of a single-variable function using golden ratio subdivision.

**When to Use:**

- Finding closest approach time between two objects
- Locating maximum elevation during a satellite pass
- Determining optimal maneuver timing within a window

**Example: Peak Elevation and Closest Approach During a Pass**

Golden-section search needs a bracket in which the function is unimodal, so find the pass with a coarse scan first, then refine. `search(f, lower, upper, { tolerance, solveMax })` returns the argument (here minutes), not the function value.

```typescript
import { Degrees, GoldenSection, GroundStation, Kilometers, Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const station = new GroundStation({
  name: 'Cape Cod',
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
});

// Minutes from this epoch; a coarse 1-minute scan found a pass between T+53 and T+66 min
const epochMs = Date.parse('2024-01-28T00:00:00Z');
const at = (minutes: number): Date => new Date(epochMs + minutes * 60_000);

const elevation = (minutes: number): number => iss.rae(station, at(minutes))?.el ?? -90;
const range = (minutes: number): number => iss.rae(station, at(minutes))?.rng ?? Infinity;

// Maximize elevation; tolerance is the final interval width in minutes (1e-4 min = 6 ms)
const peak = GoldenSection.search(elevation, 53, 66, { tolerance: 1e-4, solveMax: true });
console.log(`Peak elevation ${elevation(peak).toFixed(2)} deg at T+${peak.toFixed(4)} min`);
// => Peak elevation 84.56 deg at T+58.6609 min

// searchMin / searchMax are shorthands for the solveMax flag
const closest = GoldenSection.searchMin(range, 53, 66, 1e-4);
console.log(`Closest approach ${range(closest).toFixed(1)} km at T+${closest.toFixed(4)} min`);
// => Closest approach 423.0 km at T+58.6622 min
```

**Outcomes:**

- Precise time of closest approach (TCA) for conjunction screening
- Maximum elevation time for antenna scheduling
- Optimal transfer window timing

---

### DownhillSimplex

Multi-dimensional derivative-free optimizer using the Nelder-Mead algorithm.

**When to Use:**

- Fitting orbital elements to observations
- Optimizing multi-parameter maneuver sequences
- Solving orbit determination problems
- Minimizing any cost function without needing derivatives

**Example: Fitting a Ground-Track Model to Observed Latitudes**

Given sub-satellite latitudes, find the inclination, angular rate and phase that best reproduce them. The cost function receives a `Float64Array` of parameters and returns a scalar; `solveSimplex` returns the best parameter vector.

```typescript
import { DownhillSimplex, Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// Observed sub-satellite latitude (deg) every 2 minutes for 90 minutes
const epochMs = Date.parse('2024-01-28T12:00:00Z');
const samples = Array.from({ length: 46 }, (_, i) => {
  const minutes = 2 * i;

  return { minutes, lat: iss.lla(new Date(epochMs + minutes * 60_000))!.lat };
});

/*
 * Model: lat(t) = asin(sin(i) sin(n t + u0)) for a circular orbit on a spherical Earth,
 * with i the inclination, n the angular rate (rad/min) and u0 the argument of latitude at t = 0.
 * Cost: sum of squared latitude residuals (deg^2).
 */
const DEG = Math.PI / 180;
const cost = ([incDeg, n, u0]: Float64Array): number =>
  samples.reduce((sse, s) => {
    const model = Math.asin(Math.sin(incDeg * DEG) * Math.sin(n * s.minutes + u0)) / DEG;

    return sse + (model - s.lat) ** 2;
  }, 0);

// Initial guess: 45 deg, a 90-minute orbit, u0 = 0
const initialGuess = new Float64Array([45, (2 * Math.PI) / 90, 0]);
const simplex = DownhillSimplex.generateSimplex(initialGuess, 0.01);

const [incDeg, n, u0] = DownhillSimplex.solveSimplex(cost, simplex, {
  xTolerance: 1e-10,
  fTolerance: 1e-10,
  maxIter: 5000,
  adaptive: true,
});

console.log(`Inclination ${incDeg.toFixed(2)} deg, period ${((2 * Math.PI) / n).toFixed(2)} min`);
// => Inclination 51.84 deg, period 92.94 min
// (TLE: 51.64 deg and 92.94 min; the fit sees geodetic, not geocentric, latitude)
```

**Outcomes:**

- Fitted orbital elements matching observation data
- Solutions to any multi-dimensional minimization problem

---

### PolynomialRegression

Fits polynomial curves to data using Downhill Simplex optimization.

**When to Use:**

- Smoothing noisy ephemeris data
- Creating compact polynomial representations of trajectories
- Interpolating between sparse observation points
- Fitting non-linear trends in orbital parameters

**Example: Fitting a Quadratic**

```typescript
import { PolynomialRegression, evalPoly } from 'ootk';

// Altitude samples (km), one per minute
const times = new Float64Array([0, 1, 2, 3, 4, 5]); // minutes
const altitudes = new Float64Array([400.1, 400.8, 402.3, 404.6, 407.7, 411.6]);

// Fit a quadratic
const result = PolynomialRegression.solve(times, altitudes, 2);

console.log('Coefficients:', result.coefficients);
// => [0.4, 0.3, 400.1] (descending powers: y = a t^2 + b t + c)

console.log('Fit error (root sum of squares):', result.rss.toFixed(4), 'km');

// Interpolate at t = 2.5 minutes
const smoothedAlt = evalPoly(2.5, result.coefficients);
console.log(`Altitude at t=2.5 min: ${smoothedAlt.toFixed(2)} km`);
// => Altitude at t=2.5 min: 403.35 km
```

**Example: Automatic Polynomial Order Selection**

Let the algorithm determine the polynomial degree using the Bayesian Information Criterion.

```typescript
import { PolynomialRegression } from 'ootk';

const times = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7]); // minutes
const positions = new Float64Array([0.0, 1.2, 4.1, 9.3, 15.8, 25.4, 35.9, 49.1]); // km

// Fit polynomials from linear (order 1) to quartic (order 4); the lowest BIC wins
const result = PolynomialRegression.solveOrder(times, positions, 1, 4);

const selectedOrder = result.coefficients.length - 1;
console.log(`Optimal polynomial order: ${selectedOrder}`);
console.log(`BIC score: ${result.bic.toFixed(2)}`);
```

**Outcomes:**

- Smoothed trajectory free of measurement noise
- Polynomial coefficients for compact data storage
- Optimal model complexity balancing fit vs. overfitting

---

### ChebyshevCompressor

Compresses ephemeris data into Chebyshev polynomial coefficients.

**When to Use:**

- Reducing ephemeris file size for transmission or storage
- Creating fast-interpolating representations of trajectories
- Converting high-fidelity propagator output to compact format
- Mission planning software requiring quick position lookups

**Example: Compressing One Day of ISS Ephemeris**

`compress(cpr = 21, segmentDuration?)` fits `cpr` coefficients per axis to each segment. Segments default to one orbital period (`StateVector.period` is in minutes and is converted to seconds), so a day of LEO ephemeris becomes about 16 segments.

```typescript
import { ChebyshevCompressor, EpochUTC, Seconds, Sgp4Propagator, Tle } from 'ootk';

const tle = new Tle(
  '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991',
  '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741',
);
const start = tle.epoch;
const stop = start.roll(86400 as Seconds);

// One day of ephemeris sampled every 60 s (1441 J2000 states)
const ephemeris = new Sgp4Propagator(tle).ephemeris(start, stop, 60 as Seconds);

// Default: one segment per orbital period, 21 coefficients per axis per segment
const compressed = new ChebyshevCompressor(ephemeris).compress(21);

console.log(`Original:   ${ephemeris.sizeBytes} bytes`);
console.log(`Compressed: ${compressed.sizeBytes} bytes`);

// Position error at an arbitrary time inside the window
const t = start.roll(43210 as Seconds);
const error = compressed.interpolate(t)!.position.distance(ephemeris.interpolate(t)!.position);
console.log(`Error at T+43210 s: ${(error * 1000).toFixed(3)} m`);
```

In this run 16 segments replace 1441 states: 8,320 bytes instead of 80,696 (about 10x), and the largest position difference from the source interpolator over the day, sampled every 7 s, is about 8 m. Raising `cpr` to 41 doubles the size without reducing that difference, so 21 is enough at this sample spacing.

**Workflow: Mission Planning System**

```
┌─────────────────────────┐
│ High-Fidelity Propagator│
│ (RK4/DP54/RK89, full    │
│  force model)           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ ChebyshevCompressor     │
│ (21 coefficients/rev)   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ ChebyshevInterpolator   │
│ (Fast position lookups) │
└───────────┬─────────────┘
            │
    ┌───────┴───────┐
    ▼               ▼
Conjunction     Ground Pass
 Screening       Planning
```

**Outcomes:**

- Ephemeris compressed by about 10x for LEO at 60 s sampling (more for denser input), with a few metres of reconstruction error
- Fast position interpolation at any time (one segment lookup and a Chebyshev evaluation)
- Efficient ephemeris distribution to field systems

---

## Choosing the Right Optimizer

| Problem Type | Optimizer | Example |
|--------------|-----------|---------|
| Linear trend in data | SimpleLinearRegression | Altitude decay rate |
| 1D min/max search | GoldenSection | Closest approach time |
| Multi-parameter fitting | DownhillSimplex | Model fitting, cost minimization |
| Smooth curve fitting | PolynomialRegression | Ephemeris smoothing |
| Ephemeris compression | ChebyshevCompressor | Storage/transmission |

## Common Workflows

### Orbit Determination Pipeline

```
Observations → DownhillSimplex (fit elements) → PolynomialRegression (smooth residuals)
                                              → SimpleLinearRegression (detect drift)
```

### Conjunction Assessment

```
TLE Catalog → Coarse screening → GoldenSection (precise TCA) → Risk calculation
```

### Ephemeris Distribution

```
Propagator → ChebyshevCompressor → Transmit → ChebyshevInterpolator → Application
```

### Trend Analysis

```
Historical data → SimpleLinearRegression → Predict future values
                → filterOutliers() → Cleaned regression
```
