# Initial Orbit Determination

This example recovers an orbit from a handful of position fixes using three classic IOD methods: Lambert (two positions), Gibbs (three positions), and Herrick-Gibbs (three closely spaced positions). Each solution is then fitted to a TLE so the results can be compared side by side and fed to SGP4 consumers.

<<< ../../examples/iod.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/iod.ts
```

## Setup Observations

Three radar-style range/azimuth/elevation (RAE) measurements taken 10 seconds apart from a fixed ground sensor, plus the sensor as a `GroundStation` (geodetic latitude and longitude in degrees, altitude in km). The azimuths are rounded to whole degrees, so at ~1,570 km slant range each fix carries roughly 10-15 km of error.

<<< ../../examples/iod.ts#setup-observations

## RAE to Position

IOD methods work on inertial positions, so each RAE measurement is converted: `sensor.toJ2000(time)` gives the site's J2000 state at that measurement time (its WGS84 position rotated with precession, nutation and sidereal time, moving with the Earth), and `RAE.fromDegrees(...).toStateVector(site)` turns the measurement into a `J2000` state relative to that site. Use a fresh site state per measurement: the site moves about 3.5 km in inertial space every 10 s at this latitude. (`lla2eci` is a spherical-Earth drawing helper and puts the site up to ~21 km away from its WGS84 position, so it is not used here.)

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
  2 00001  39.7846 174.6222 4631813  47.8228   0.3099 05.92361752    02

Herrick-Gibbs IOD (three RAE-derived positions, 10 s spacing) fitted to a TLE:
  1 00001U 58001A   24007.49620370  .00000000  00000+0  00000+0 0  9997
  2 00001  42.2255 178.7484 0588845  46.9219 359.5543 13.74736092    07

Gibbs IOD (three ECI positions, 10 s spacing) fitted to a TLE:
  1 00001U 58001A   24007.49620370  .00000000  00000+0  00000+0 0  9997
  2 00001  42.9994 180.3394 0006341 105.1309 300.2630 15.05329933    05

Herrick-Gibbs IOD (three ECI positions, 30 s spacing) fitted to a TLE:
  1 00001U 58001A   24007.49643519  .00000000  00000+0  00000+0 0  9997
  2 00001  42.9985 180.3381 0010714  76.6282 330.0209 15.03982493    09
```
