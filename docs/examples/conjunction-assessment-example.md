# Conjunction Assessment

This example runs the `ConjunctionAssessment` workflow between two space objects: it finds the time of closest approach (TCA) inside a search window, reports the miss distance in RIC components, and computes probability of collision from either TLE-derived or user-supplied covariance. Use it for close-approach screening and risk evaluation.

<<< ../../examples/conjunction-assessment-example.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/conjunction-assessment-example.ts
```

## Scenario setup

Two fabricated TLEs place the objects in nearly identical LEO orbits so a close approach exists inside the 6-hour search window. The hard body radii are required for any probability-of-collision calculation; without radii on both objects the assessment only reports geometry.

<<< ../../examples/conjunction-assessment-example.ts#scenario-setup

## Basic SGP4 assessment

With plain TLE inputs, `assess()` propagates both objects with SGP4, does a coarse 60-second sweep of the window, then polishes every local minimum of the range with a golden-section search and keeps the smallest, so a brief fast crossing between two samples is not lost to a slower, shallower approach. The returned `ConjunctionEvent` carries the TCA, total and per-axis (radial, intrack, crosstrack) miss distances, and relative velocity; `isHighRisk(distanceThreshold = 1 km, pcThreshold = 1e-4)` flags an event when either threshold is crossed.

<<< ../../examples/conjunction-assessment-example.ts#basic-sgp4-assessment

## High fidelity with covariance

For higher fidelity, seed a `RungeKutta89Propagator` from the SGP4 state at the window start and pass it via the `propagator` override on each object input. The `ForceModel` here uses 8x8 spherical harmonic gravity plus atmospheric drag and solar radiation pressure (both take spacecraft mass in kg and area in m^2; the drag model is still marked work-in-progress in the library). `propagateCovariance: true` builds sigma-point covariance samples from each TLE, scales them by TLE quality and by TLE age (measured from the TLE epoch to the sampled state epoch, not to the wall clock), and propagates them to TCA. Each desampled covariance is in its own object's RIC frame; the secondary's is rotated into the primary's RIC frame before the two are summed into the combined covariance used for Pc.

<<< ../../examples/conjunction-assessment-example.ts#high-fidelity-with-covariance

## Custom covariance

If you already have covariance data (for example from an OD process or a CDM), supply `StateCovariance.fromSigmas()` matrices on the object inputs instead. Each covariance is a 6x6 matrix of variances (km^2, km^2/s^2). A RIC-frame covariance is taken to be in that object's own RIC frame: the primary's is used as-is and the secondary's is rotated into the primary's RIC frame before summing. ECI-frame covariances are rotated into the primary's RIC frame.

<<< ../../examples/conjunction-assessment-example.ts#custom-covariance

## Multi object screening

Screening loops one primary against a list of candidate TLEs, then filters events by miss distance and flags any with Pc above a reporting threshold. For large candidate sets the library also provides `CatalogScreener` with orbital-shell prefilters.

<<< ../../examples/conjunction-assessment-example.ts#multi-object-screening

## Output

The output is deterministic (TLE age is measured against the state epoch, not the run date). The Pc values are from ootk 8, whose two-dimensional Pc and RIC covariance combination were corrected; ootk 7 printed values off by a factor of about 4 in either direction for the same inputs.

Pc values below `PC_NEGLIGIBLE` (1e-30, exported from the package) are reported as exactly 0: when an analytic upper bound on Pc (hard-body disc area times the peak Gaussian density over it) is already below that level, the encounter-plane integral is skipped. No operational threshold is anywhere near 1e-30, and it keeps catalog screens from spending seconds per pair on far-tail misses.

```txt
=== Example 1: Basic Conjunction Assessment ===

[Conjunction Event]
  TCA: 2025-01-19T12:08:10.086Z
  Miss Distance: 1.533883 km
    Radial:     0.026031 km
    Intrack:    1.531291 km
    Crosstrack: 0.085241 km
  Relative Velocity: 0.001941 km/s
  Combined Hard Body Radius: 0.060 km

High Risk: false

=== Example 2: High-Fidelity Assessment with Covariance ===

[Conjunction Event]
  TCA: 2025-01-19T12:08:00.000Z
  Miss Distance: 1.533910 km
    Radial:     0.025833 km
    Intrack:    1.530823 km
    Crosstrack: 0.093767 km
  Relative Velocity: 0.001940 km/s
  Probability of Collision: 3.145291e-4
  Combined Hard Body Radius: 0.060 km

Probability of Collision: 3.145291e-4
Mahalanobis Distance: 0.588 sigma

=== Example 3: Custom Covariance Matrices ===

[Conjunction Event]
  TCA: 2025-01-19T12:08:10.086Z
  Miss Distance: 1.533883 km
    Radial:     0.026031 km
    Intrack:    1.531291 km
    Crosstrack: 0.085241 km
  Relative Velocity: 0.001941 km/s
  Probability of Collision: 1.178638e-3
  Combined Hard Body Radius: 0.060 km

=== Example 4: Multi-Object Screening ===

Screening 2 objects for conjunctions...

Object 1: CLOSE APPROACH DETECTED
  TCA: 2025-01-19T12:08:10.086Z
  Miss Distance: 1.534 km
  Pc: 3.126e-4 [HIGH RISK]

Object 2: CLOSE APPROACH DETECTED
  TCA: 2025-01-19T12:07:54.425Z
  Miss Distance: 3.043 km
  Pc: 1.907e-4 [HIGH RISK]

=== All Examples Complete ===
```
