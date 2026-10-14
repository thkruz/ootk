# Sun

This example computes solar event times (sunrise, sunset, twilights, golden hour) for a ground location, then queries the Sun's ECI position and its topocentric look angles. Use these APIs when scheduling optical observation windows or modeling lighting conditions for a site.

<<< ../../examples/sun.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/sun.ts
```

## Observer setup

Ground locations are represented by `GroundStation`, which takes latitude and longitude in degrees and altitude in kilometers. A fixed date keeps the output reproducible.

<<< ../../examples/sun.ts#observer-setup

## Sun event times

`Sun.getTimes` returns a `SunTime` object containing every solar event for the day: rise and set, civil/nautical/astronomical dawn and dusk, golden and blue hours, solar noon, and nadir. It takes latitude and longitude in degrees and altitude in meters; the final `isUtc` flag anchors the calculation to noon UTC instead of local noon.

<<< ../../examples/sun.ts#sun-event-times

## Sunrise and sunset via astronomy-engine

`Sun.getSunriseSunset` runs a higher-precision horizon-crossing search using astronomy-engine, scanning forward one day from the given date. The times are when the Sun's centre crosses the `minElevation` geometric altitude, and either value is `null` when that crossing does not happen (polar day or night). The default, -0.833 deg, is the standard sunrise definition (refraction plus the solar semidiameter), the same event `Sun.getTimes` approximates with its lower-precision series (they agree to a minute or two); -6, -12 and -18 give civil, nautical and astronomical twilight. The script passes `0 as Degrees`, the instant the centre is on the geometric horizon, so its sunrise is about 5 minutes later and its sunset about 5 minutes earlier than with the default.

<<< ../../examples/sun.ts#sunrise-sunset

## Sun position

`Sun.eci` returns the Sun's position as a `Vector3D<Kilometers>` in Earth-centered inertial coordinates, and `Sun.getDistanceFromEarth` gives the geocentric distance directly.

<<< ../../examples/sun.ts#sun-position

## Azimuth and elevation

`Sun.getAzEl` computes topocentric look angles for a ground observer, applying atmospheric refraction by default. `getRightAscension` and `getDeclination` return geocentric right ascension and declination in radians in the J2000 equatorial frame (the same vector as `Sun.eci`). Before ootk 8 they were topocentric for an observer at 0 N 0 E and referred to the true equator and equinox of date.

<<< ../../examples/sun.ts#sun-azimuth-elevation

## Output

```txt
Observer: Cape Cod (41 deg N, 71 deg W)
Date: 2024-01-28T12:00:00.000Z

=== Sun Event Times ===

Astronomical dawn: 2024-01-28T10:25:00.217Z
Nautical dawn:     2024-01-28T10:57:27.460Z
Civil dawn:        2024-01-28T11:30:38.150Z
Sunrise:           2024-01-28T12:00:03.896Z
Solar noon:        2024-01-28T16:58:02.446Z
Sunset:            2024-01-28T21:56:00.996Z
Civil dusk:        2024-01-28T22:25:26.742Z
Nautical dusk:     2024-01-28T22:58:37.431Z
Astronomical dusk: 2024-01-28T23:31:04.675Z
Golden hour (PM):  2024-01-28T21:15:16.619Z

=== Sunrise/Sunset via astronomy-engine ===

Sunrise: 2024-01-28T12:03:28.812Z
Sunset:  2024-01-28T21:50:39.851Z

=== Sun Position (ECI) ===

X: 9.0107e+7 km
Y: -1.0693e+8 km
Z: -4.6354e+7 km

Distance from Earth: 1.4732e+8 km
                     0.9848 AU

=== Sun Azimuth/Elevation for Observer ===

Azimuth:   113.9559 deg
Elevation: -0.0210 deg

Right Ascension: 20.6746 hours
Declination:     -18.3399 deg
```
