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

With plain TLE inputs, `assess()` propagates both objects with SGP4, does a coarse 60-second sweep of the window, then refines the TCA with a golden-section search. The returned `ConjunctionEvent` carries the TCA, total and per-axis (radial, intrack, crosstrack) miss distances, and relative velocity; `isHighRisk()` applies miss-distance and Pc thresholds.

<<< ../../examples/conjunction-assessment-example.ts#basic-sgp4-assessment

## High fidelity with covariance

For higher fidelity, seed a `RungeKutta89Propagator` from the SGP4 state at the window start and pass it via the `propagator` override on each object input. The `ForceModel` here uses 8x8 spherical harmonic gravity plus atmospheric drag and solar radiation pressure (both take spacecraft mass in kg and area in m^2; the drag model is still marked work-in-progress in the library). `propagateCovariance: true` builds sigma-point covariance samples from each TLE, scales them by TLE quality and age, and propagates them to TCA to produce a combined covariance and Pc.

<<< ../../examples/conjunction-assessment-example.ts#high-fidelity-with-covariance

## Custom covariance

If you already have covariance data (for example from an OD process or a CDM), supply `StateCovariance.fromSigmas()` matrices on the object inputs instead. RIC-frame covariances are used as-is at TCA; ECI-frame covariances are rotated into RIC automatically.

<<< ../../examples/conjunction-assessment-example.ts#custom-covariance

## Multi object screening

Screening loops one primary against a list of candidate TLEs, then filters events by miss distance and flags any with Pc above a reporting threshold. For large candidate sets the library also provides `CatalogScreener` with orbital-shell prefilters.

<<< ../../examples/conjunction-assessment-example.ts#multi-object-screening

## Output

The covariance sampling scales with TLE age relative to the current system date, so probability-of-collision values will differ per run.

```txt
=== Example 1: Basic Conjunction Assessment ===

[Conjunction Event]
  TCA: 2025-01-19T12:08:10.081Z
  Miss Distance: 1.533883 km
    Radial:     0.026031 km
    Intrack:    1.531291 km
    Crosstrack: 0.085245 km
  Relative Velocity: 0.001941 km/s
  Combined Hard Body Radius: 0.060 km

High Risk: false

=== Example 2: High-Fidelity Assessment with Covariance ===

[Conjunction Event]
  TCA: 2025-01-19T12:08:06.773Z
  Miss Distance: 1.533903 km
    Radial:     0.025963 km
    Intrack:    1.531154 km
    Crosstrack: 0.088044 km
  Relative Velocity: 0.001941 km/s
  Probability of Collision: 1.319935e-3
  Combined Hard Body Radius: 0.060 km

Probability of Collision: 1.319935e-3
Mahalanobis Distance: 0.000 sigma

=== Example 3: Custom Covariance Matrices ===

[Conjunction Event]
  TCA: 2025-01-19T12:08:10.081Z
  Miss Distance: 1.533883 km
    Radial:     0.026031 km
    Intrack:    1.531291 km
    Crosstrack: 0.085245 km
  Relative Velocity: 0.001941 km/s
  Probability of Collision: 1.578144e-3
  Combined Hard Body Radius: 0.060 km

=== Example 4: Multi-Object Screening ===

Screening 2 objects for conjunctions...

Object 1: CLOSE APPROACH DETECTED
  TCA: 2025-01-19T12:08:10.081Z
  Miss Distance: 1.534 km
  Pc: 1.324e-3 [HIGH RISK]

Object 2: CLOSE APPROACH DETECTED
  TCA: 2025-01-19T12:07:54.425Z
  Miss Distance: 3.043 km
  Pc: 3.370e-4 [HIGH RISK]

=== All Examples Complete ===
```
