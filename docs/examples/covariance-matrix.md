# Covariance Matrix

This example builds 6x6 state covariance matrices for the ISS directly from TLEs: a simple diagonal covariance and a sigma-point sampled covariance scaled by TLE quality (and by TLE age when the state epoch is away from the TLE epoch). You need these matrices as inputs to conjunction assessment and probability-of-collision calculations.

<<< ../../examples/covariance-matrix.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/covariance-matrix.ts
```

## ISS TLEs

Two real ISS TLEs at different epochs (2023 and 2025). The second, newer TLE is used at the end to show how covariance sampling responds to element set age.

<<< ../../examples/covariance-matrix.ts#iss-tles

## RIC covariance

`createCovarianceFromTle()` parses the TLE and returns a `StateCovariance` with fixed 1-sigma values (1 km position, 1 m/s velocity) on the diagonal, expressed in the requested frame (`CovarianceFrame.RIC` or `CovarianceFrame.ECI`). The `sigmas()` method reads the standard deviations back off the diagonal. The diagonal holds variances (km^2 and km^2/s^2), so `sigmas()` returns their square roots.

<<< ../../examples/covariance-matrix.ts#ric-covariance

## Sample covariance

`createSampleCovarianceFromTle()` starts from realistic RIC sigmas (larger intrack than radial or crosstrack), builds a `CovarianceSample` of sigma points, and scales each R, I, C axis by a TLE quality factor and a regime aging factor. The TLE age is measured from the TLE epoch to the epoch of the state being sampled (ootk 8; earlier versions used the wall clock, which inflated the sigmas of old TLEs by orders of magnitude and made the result change from run to run). This helper samples the state at the TLE epoch itself, so the age is zero and only the quality factor applies: the radial, in-track and cross-track sigmas come out as 0.12 x 1.56, 1.0 x 1.92 and 0.1 x 1.0 km for this ISS element set. The result is a variance matrix in the RIC frame.

<<< ../../examples/covariance-matrix.ts#sample-covariance

## Newer TLE comparison

Running the same sampling on the newer TLE gives the same sigmas: both element sets are sampled at their own epoch (age zero) and have the same quality factors. To see aging, sample a state at a later epoch with `new CovarianceSample(state, covariance, tle)`, where the age is |state epoch - TLE epoch|. (The comment in the example script still says the newer TLE gives smaller uncertainties; that was true only under the pre-v8 wall-clock aging.)

<<< ../../examples/covariance-matrix.ts#newer-tle-comparison

## Output

The output is deterministic: it does not depend on the date the script runs.

```txt
RIC Frame Covariance Matrix:
[[1,0, ... (truncated) ...,0.000001]]
Standard Deviations:
[1, 1, 1, 0.001, 0.001, 0.001]
Sample-based Covariance Matrix:
[[0.035043840000030226,-2.7314565005496516e-14, ... (truncated) ...,9.999999999994438e-9]]
Radial Uncertainty: 0.18720000000008072 km
Intrack Uncertainty: 1.920000000000025 km
Crosstrack Uncertainty: 0.09999999999997185 km
Sample-based Covariance Matrix (newer TLE):
[[0.03504384000005091,-8.618680646443896e-14, ... (truncated) ...,9.999999999995704e-9]]
Radial Uncertainty: 0.18720000000013598 km
Intrack Uncertainty: 1.9199999999999868 km
Crosstrack Uncertainty: 0.1000000000000517 km
```
