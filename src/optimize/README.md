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
// => Decay rate: -0.343 km/day

// Predict when altitude drops below 400 km
const daysUntil400km = (400 - regression.intercept) / regression.slope;
console.log(`Days until 400 km: ${daysUntil400km.toFixed(1)}`);
// => Days until 400 km: 24.0

// Remove noisy measurements
const cleaned = regression.filterOutliers(2.0);
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

**Example: Finding Closest Approach Time**

During a conjunction event, you need the exact time two satellites are closest.

```typescript
import { GoldenSection } from 'ootk';

// Distance function (km) as a function of minutes from epoch
const distanceBetweenSats = (minutesFromEpoch: number): number => {
  const pos1 = satellite1.propagate(epoch.addMinutes(minutesFromEpoch));
  const pos2 = satellite2.propagate(epoch.addMinutes(minutesFromEpoch));
  return pos1.position.distance(pos2.position);
};

// Search within a 10-minute window around predicted TCA
const tca = GoldenSection.search(distanceBetweenSats, 0, 10, {
  tolerance: 0.0001,  // 0.006 seconds precision
  solveMax: false,    // minimize distance
});

console.log(`Closest approach at T+${tca.toFixed(4)} minutes`);
// => Closest approach at T+4.2731 minutes
```

**Example: Maximum Elevation During Pass**

Ground stations need to know when a satellite reaches peak elevation for optimal communication.

```typescript
const elevation = (minutes: number): number => {
  const look = groundStation.lookAngles(satellite.propagate(epoch.addMinutes(minutes)));
  return look.elevation;
};

// Pass starts at T+5 min and ends at T+15 min
const peakTime = GoldenSection.search(elevation, 5, 15, {
  tolerance: 1e-6,
  solveMax: true,  // maximize elevation
});

console.log(`Peak elevation at T+${peakTime.toFixed(4)} minutes`);
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

**Example: Fitting TLE Parameters to Observations**

Given radar observations, find the orbital elements that best match the data.

```typescript
import { DownhillSimplex } from 'ootk';

// Cost function: sum of squared residuals between predicted and observed positions
const fitOrbit = (params: Float64Array): number => {
  const [semiMajorAxis, eccentricity, inclination, raan, argPerigee, meanAnomaly] = params;

  let totalError = 0;
  for (const obs of observations) {
    const predicted = propagateWithElements(params, obs.epoch);
    const residual = obs.position.distance(predicted.position);
    totalError += residual * residual;
  }
  return totalError;
};

// Initial guess from preliminary orbit determination
const initialGuess = new Float64Array([7000, 0.001, 0.9, 3.14, 0, 0]);
const simplex = DownhillSimplex.generateSimplex(initialGuess, 0.01);

const optimalElements = DownhillSimplex.solveSimplex(fitOrbit, simplex, {
  xTolerance: 1e-10,
  fTolerance: 1e-10,
  maxIter: 5000,
  adaptive: true,
});

console.log('Fitted elements:', optimalElements);
```

**Example: Two-Burn Transfer Optimization**

Find the optimal impulse magnitudes and timing for a Hohmann-like transfer.

```typescript
const transferCost = (params: Float64Array): number => {
  const [deltaV1, deltaV2, burnTime] = params;
  // Propagate with burns and measure final orbit error
  return computeOrbitError(deltaV1, deltaV2, burnTime);
};

const initialGuess = new Float64Array([0.5, 0.3, 45.0]); // km/s, km/s, minutes
const simplex = DownhillSimplex.generateSimplex(initialGuess, 0.05);

const optimalBurns = DownhillSimplex.solveSimplex(transferCost, simplex, {
  maxIter: 2000,
  printIter: true,  // watch convergence
});
```

**Outcomes:**

- Fitted orbital elements matching observation data
- Optimal maneuver parameters (delta-V, timing)
- Solutions to any multi-dimensional minimization problem

---

### PolynomialRegression

Fits polynomial curves to data using Downhill Simplex optimization.

**When to Use:**

- Smoothing noisy ephemeris data
- Creating compact polynomial representations of trajectories
- Interpolating between sparse observation points
- Fitting non-linear trends in orbital parameters

**Example: Smoothing Noisy Position Data**

Sensor measurements often have noise. Fit a smooth polynomial to recover the true trajectory.

```typescript
import { PolynomialRegression, evalPoly } from 'ootk';

// Noisy altitude measurements (km) over 5 minutes
const times = new Float64Array([0, 60, 120, 180, 240, 300]); // seconds
const altitudes = new Float64Array([400.1, 400.8, 402.3, 404.6, 407.7, 411.6]);

// Fit a quadratic (captures acceleration due to gravity)
const result = PolynomialRegression.solve(times, altitudes, 2);

console.log('Coefficients:', result.coefficients);
// [a, b, c] for y = at² + bt + c

console.log('Fit error (RSS):', result.rss.toFixed(4), 'km');

// Interpolate at t=150 seconds
const smoothedAlt = evalPoly(150, result.coefficients);
console.log(`Altitude at t=150s: ${smoothedAlt.toFixed(2)} km`);
```

**Example: Automatic Polynomial Order Selection**

Let the algorithm determine the optimal polynomial degree using Bayesian Information Criterion.

```typescript
// Fit polynomials from linear (order 1) to quartic (order 4)
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

**Example: Compressing 7-Day Ephemeris**

A high-fidelity propagator generates positions every second. Compress this to polynomial coefficients.

```typescript
import { ChebyshevCompressor } from 'ootk';

// stateInterpolator contains 7 days of ephemeris at 1-second intervals
// That's ~600,000 position vectors

const compressor = new ChebyshevCompressor(stateInterpolator);
const compressed = compressor.compress(21); // 21 coefficients per orbital period

// Now use compressed for fast position lookups
const position = compressed.interpolate(someEpoch);

// Storage comparison:
// Original: 600,000 vectors × 3 × 8 bytes = 14.4 MB
// Compressed: ~100 periods × 21 coeffs × 3 axes × 8 bytes = 50 KB
```

**Workflow: Mission Planning System**

```
┌─────────────────────────┐
│ High-Fidelity Propagator│
│ (RK4/78, full force     │
│  model, 1-sec steps)    │
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

- Ephemeris compressed by 100-300x with sub-meter accuracy
- Fast O(1) position interpolation at any time
- Efficient ephemeris distribution to field systems

---

## Choosing the Right Optimizer

| Problem Type | Optimizer | Example |
|--------------|-----------|---------|
| Linear trend in data | SimpleLinearRegression | Altitude decay rate |
| 1D min/max search | GoldenSection | Closest approach time |
| Multi-parameter fitting | DownhillSimplex | Orbit determination |
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
