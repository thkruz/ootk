# Covariance Matrix

This example builds 6x6 state covariance matrices for the ISS directly from TLEs: a simple diagonal covariance and a more realistic sigma-point sampled covariance that grows with TLE age. You need these matrices as inputs to conjunction assessment and probability-of-collision calculations.

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

`createCovarianceFromTle()` parses the TLE and returns a `StateCovariance` with fixed 1-sigma values (1 km position, 1 m/s velocity) on the diagonal, expressed in the requested frame (`CovarianceFrame.RIC` or `CovarianceFrame.ECI`). The `sigmas()` method reads the standard deviations back off the diagonal. Note the helper also logs the parsed J2000 state as a side effect.

<<< ../../examples/covariance-matrix.ts#ric-covariance

## Sample covariance

`createSampleCovarianceFromTle()` starts from realistic RIC sigmas (larger intrack than radial or crosstrack), builds a `CovarianceSample` of sigma points, and scales the result by TLE quality and by the age of the element set relative to the current date. The desampled matrix therefore has large off-axis realism compared to the diagonal version.

<<< ../../examples/covariance-matrix.ts#sample-covariance

## Newer TLE comparison

Running the same sampling on the newer TLE produces smaller uncertainties because the regime aging factor is smaller for a fresher element set.

<<< ../../examples/covariance-matrix.ts#newer-tle-comparison

## Output

The sample-based values depend on the TLE age relative to the current system date, so the numbers below will differ per run.

```txt
J2000 State: _J2000 {
  epoch: _EpochUTC { posix: 1677149344.839744 },
  position: _Vector3D {
    x: 6452.956415876445,
    y: 1323.8981961866361,
    z: 1660.8968775840344
  },
  velocity: _Vector3D {
    x: 0.42731041814610304,
    y: 5.09881401183609,
    z: -5.706704292053693
  }
}
RIC Frame Covariance Matrix:
[[1,0,0,0,0,0],[0,1,0,0,0,0],[0,0,1,0,0,0],[0,0,0,0.000001,0,0],[0,0,0,0,0.000001,0],[0,0,0,0,0,0.000001]]
Standard Deviations:
[1, 1, 1, 0.001, 0.001, 0.001]
Sample-based Covariance Matrix:
[[64211139.85456954,-9.76495008511313e-7, ... (truncated) ...,26.38504266632789]]
Radial Uncertainty: 8013.185375028431 km
Intrack Uncertainty: 164371.1133339165 km
Crosstrack Uncertainty: 5136.637291684891 km
Sample-based Covariance Matrix (newer TLE):
[[2817318.745587026,3.431987609522133e-8, ... (truncated) ...,1.1576323179524683]]
Radial Uncertainty: 1678.4870406372002 km
Intrack Uncertainty: 34428.58339768615 km
Crosstrack Uncertainty: 1075.9332311776918 km
```
