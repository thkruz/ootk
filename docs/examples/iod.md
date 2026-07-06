# Initial Orbit Determination

This example recovers an orbit from a handful of position fixes using three classic IOD methods: Lambert (two positions), Gibbs (three positions), and Herrick-Gibbs (three closely spaced positions). Each solution is then fitted to a TLE so the results can be compared side by side and fed to SGP4 consumers.

<<< ../../examples/iod.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/iod.ts
```

## Setup Observations

Three radar-style range/azimuth/elevation (RAE) measurements taken 10 seconds apart from a fixed ground sensor, plus the sensor's geodetic location (latitude and longitude in radians, altitude in km).

<<< ../../examples/iod.ts#setup-observations

## RAE to Position

IOD methods work on inertial positions, so each RAE measurement is converted: `calcGmst` and `lla2eci` produce the sensor's ECI position, and `RAE.fromDegrees(...).toStateVector(site)` turns the measurement into a `J2000` state relative to that site. The site velocity is left at zero here, which is acceptable because only the positions are used downstream.

<<< ../../examples/iod.ts#rae-to-position

## ECI Positions

A second data set of known ECI positions for the same object (recorded from a propagator) at 10 and 30 second spacings. These bypass the sensor geometry entirely and represent the cleanest possible IOD input.

<<< ../../examples/iod.ts#eci-positions

## Solve IOD

Four estimates are produced: `LambertIOD.estimate` from two positions and their epochs, `HerrickGibbsIOD.solve` from the three RAE-derived positions, `GibbsIOD.solve` from the three ECI positions, and `HerrickGibbsIOD.solve` again from ECI positions 30 seconds apart. Each returns a `J2000` state (position and velocity) at one of the observation epochs. Herrick-Gibbs is preferred over Gibbs when the positions are closely spaced (small angular separation).

<<< ../../examples/iod.ts#solve-iod

## Fit TLEs

`toClassicalElements()` converts each solved state to Keplerian elements, and `Tle.fromClassicalElements()` fits a TLE. Note how the two ECI-based solutions (Gibbs and Herrick-Gibbs) agree closely, while the Lambert solution from only two noisy RAE fixes is far less constrained (its eccentricity is clearly wrong), showing how sensitive IOD is to input quality and observation count.

<<< ../../examples/iod.ts#fit-tles

## Output

```txt
Lambert IOD (two RAE-derived positions, 10 s apart) fitted to a TLE:
  1 00001U 58001A   24007.49608796  .00000000  00000+0  00000+0 0  9995
  2 00001  40.7526 176.3707 3432410  46.3020   0.6275 08.01238333    01

Herrick-Gibbs IOD (three RAE-derived positions, 10 s spacing) fitted to a TLE:
  1 00001U 58001A   24007.49620370  .00000000  00000+0  00000+0 0  9997
  2 00001  43.5386 180.7830 0388414 224.2656 180.9250 15.93538194    07

Gibbs IOD (three ECI positions, 10 s spacing) fitted to a TLE:
  1 00001U 58001A   24007.49620370  .00000000  00000+0  00000+0 0  9997
  2 00001  42.9994 180.3394 0006341 105.1309 300.2630 15.05329933    05

Herrick-Gibbs IOD (three ECI positions, 30 s spacing) fitted to a TLE:
  1 00001U 58001A   24007.49643519  .00000000  00000+0  00000+0 0  9997
  2 00001  42.9985 180.3381 0010714  76.6282 330.0209 15.03982493    09
```
