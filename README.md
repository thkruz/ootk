# ootk

![Size](https://img.shields.io/github/languages/code-size/thkruz/ootk?style=flat-square)
[![Release](https://img.shields.io/github/v/release/thkruz/ootk?style=flat-square)](https://www.npmjs.com/package/ootk)
[![Issues](https://img.shields.io/github/issues/thkruz/ootk?style=flat-square)](https://github.com/thkruz/ootk/issues)
[![License](https://img.shields.io/github/license/thkruz/ootk?style=flat-square)](LICENSE.MD)

> An Orbital Object Toolkit in Your Web Browser

**ootk** is a collection libraries for doing math related to orbital objects written in TypeScript. **ootk** was
developed to simplify the math and let you focus on using the results.

Most of the functionality was originally written for [KeepTrack](https://github.com/thkruz/keeptrack.space) and then
later refactored into this library for others to use.

## :wrench: Installation

Install the library with [NPM](https://www.npmjs.com/):

```bash
npm i ootk
```

### Example Usage

```ts
import { DetailedSatellite, DetailedSensor, Degrees, Kilometers, SpaceObjectType, TleLine1, TleLine2 } from "ootk";

// Using api.keeptrack.space API
fetch('https://api.keeptrack.space/v1/sat/25544')
  .then((res) => res.json())
  .then((satData) => {
    const satellite = new DetailedSatellite({
      id: satData.id,
      tle1: satData.tle1 as TleLine1,
      tle2: satData.tle2 as TleLine2,
    });

    // Get the satellite's position at the current time
    const eci = satellite.eci();

    // Log the satellite's position - y component only
    console.log(eci.position.y);

    // Access other satellite properties
    console.log(satellite.inclination); // inclination in degrees
    console.log(satellite.eccentricity); // eccentricity
    console.log(satellite.period); // period in minutes

    // Get LLA (Latitude, Longitude, Altitude)
    const lla = satellite.lla();

    console.log(lla); // { lat: degrees, lon: degrees, alt: kilometers }

    const sensor = new DetailedSensor({
      lat: 41.754785 as Degrees,
      lon: -70.539151 as Degrees,
      alt: 0.060966 as Kilometers,
      minAz: 347 as Degrees,
      maxAz: 227 as Degrees,
      minEl: 3 as Degrees,
      maxEl: 85 as Degrees,
      minRng: 0 as Kilometers,
      maxRng: 5556 as Kilometers,
      name: 'Cape Cod',
      type: SpaceObjectType.PHASED_ARRAY_RADAR,
    });

    // Assuming we have a satellite object from the previous example
    const rae = sensor.rae(satellite);

    // Log the azimuth from sensor to satellite
    console.log(rae.az);

    // Check if a satellite is in the sensor's field of view right now
    const isSatInFov = sensor.isSatInFov(satellite);

    console.log(isSatInFov); // true or false

    // Calculate passes for a satellite (in 30 second intervals)
    const passes = sensor.calculatePasses(30, satellite);

    console.log(passes); // Array of pass information

    // Convert sensor position to J2000 coordinates
    const j2000 = sensor.toJ2000();

    console.log(j2000); // J2000 object with position and velocity
  });
```

## :desktop_computer: Building

1. Install [Node.js](https://nodejs.org/) and [Node Package Manager](https://www.npmjs.com/);

2. Install all required packages with NPM by running the following command from repository's root directory:

   ```bash
   npm install
   ```

3. Run the following NPM script to build everything:

   ```bash
   npm run build
   ```

## :gem: NPM Scripts

- `build` compiles TypeScript into ES6 Modules and combines them into a single file in the `dist` directory.
- `lint` lints source code located in `src` directory with [ESLint](http://eslint.org/)
- `lint:fix` lints tests located in `src` directory with ESLint and attempts to auto-fix errors
- `lint:test` lints tests located in `test` directory with ESLint
- `test` runs jest to verify code remains functional
- `test:coverage` generates lcov report to view code coverage

## :man_teacher: Contributing

This repo follows [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow).

Before starting a work on new [pull request](https://github.com/thkruz/ootk/compare), please, checkout your feature or
bugfix branch from `develop` branch:

```bash
git checkout develop
git fetch origin
git merge origin/develop
git checkout -b my-feature
```

Make sure that your changes don't break the existing code by running:

```bash
npm test
```

Check that your code follows the rules established in eslint.rc:

```bash
npm run lint
```

## :man_scientist: Contributors

This whole project is an example of standing on the shoulder's of giants. None of it would have been possible without
the previous work of the following:

- [@ezze (Dmitriy Pushkov)](https://github.com/ezze)
- [@david-rc-dayton (David RC Dayton)](https://github.com/david-rc-dayton)
- [@davidcalhoun (David Calhoun)](https://github.com/davidcalhoun)
- [@shashwatak (Shashwat Kandadai)](https://github.com/shashwatak)
- [@brandon-rhodes (Brandon Rhodes)](https://github.com/brandon-rhodes)
- [@mourner (Volodymyr Agafonkin)](https://github.com/mourner)
- [@Hypnos (Robert Gester)](https://github.com/Hypnos3)

## :balance_scale: License

I have placed the code under the [AGPL License](LICENSE.md) in order to ensure that good ideas can be shared and that
the code is open for everyone to use. [Learn more here](https://www.gnu.org/philosophy/philosophy.html).
