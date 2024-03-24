# ootk

[![build](https://img.shields.io/github/workflow/status/thkruz/ootk/CI?style=flat-square)](https://github.com/thkruz/ootk/actions?query=workflow%3ACI)
![Size](https://img.shields.io/github/languages/code-size/thkruz/ootk?style=flat-square)
[![Release](https://img.shields.io/github/v/release/thkruz/ootk?style=flat-square)](https://www.npmjs.com/package/ootk)
[![Issues](https://img.shields.io/github/issues/thkruz/ootk?style=flat-square)](https://github.com/thkruz/ootk/issues)
[![Coverage](https://img.shields.io/codecov/c/github/thkruz/ootk?style=flat-square)](https://codecov.io/gh/thkruz/ootk)
[![License](https://img.shields.io/github/license/thkruz/ootk?style=flat-square)](LICENSE.MD)

> An Orbital Object Toolkit in Your Web Browser

**ootk** is a collection libraries for doing math related to orbital objects written in TypeScript. **ootk** was
developed to simplify the math and let you focus on using the results.

Most of the functionality was originally written for [KeepTrack](https://github.com/thkruz/keeptrack.space) and then
later refactored into this library for others to use.

## :blue_book: Table of Contents

- [Installation](#Installation)
- [Usage](#Usage)
  - [Loading the Library](#Loading-the-Library)
  - [Propagating a TLE](#Propagating-a-TLE)
  - [Creating a Satellite](#Creating-a-Satellite)
  - [Creating a Sensor](#Creating-a-Sensor)
- [Contributing](#Contributing)
- [Building](#Building)
- [Contributors](#Contributors)
- [License](#License)

## :wrench: Installation

Install the library with [NPM](https://www.npmjs.com/):

```bash
npm i ootk
```

### Loading the Library

```js
import { Sgp4 } as Ootk from 'ootk';
...
const satrec = Sgp4.createSatrec(line1, line2, 'wgs72', 'i');
```

## :satellite: Usage

### Propagating a TLE

```js
const satrec = Ootk.Sgp4.createSatrec(line1, line2);
const state = Ootk.Sgp4.propagate(satrec, time);
console.log(state.position); // [x, y, z]
console.log(state.velocity); // [vx, vy, vz]
```

### Creating a Satellite

```js
const sat = new Ootk.Sat({ name: 'Test', tle1, tle2 });
console.log(sat.intlDes); // International Designator
console.log(sat.epochYear); // Epoch Year
console.log(sat.epochDay); // Epoch Day
console.log(sat.meanMoDev1); // Mean Motion Deviation 1
console.log(sat.meanMoDev2); // Mean Motion Deviation 2
console.log(sat.bstar); // Bstar (Drag Coefficient)
console.log(sat.inclination); // inclination in degrees
console.log(sat.raan); // right ascension of the ascending node in degrees
console.log(sat.eccentricity); // eccentricity
console.log(sat.argOfPerigee); // argument of perigee in degrees
console.log(sat.meanAnomaly); // mean anomaly in degrees
console.log(sat.meanMotion); // mean motion in revolutions per day
console.log(sat.period); // period in seconds
console.log(sat.apogee); // apogee in kilometers
console.log(sat.perigee); // perigee in kilometers

sat.propagate(time); // Propagate the satellite to the given time
sat.getLla(); // Get the satellite's position in latitude, longitude, altitude at its current time
sat.getEci(time); // Get the satellite's position in Earth-Centered Inertial coordinates at the given time without changing its state
sat.getRae(sensor, time); // Get position in range, aziimuth, elevation relative to a sensor object at the given time without changing its state
```

### Creating a Sensor

```js
const sensor = new Ootk.Sensor({ name: 'Test', lat: lat, lon: lon, alt: alt });
sensor.setTime(time); // Set the sensor's time to the given time
sensor.getRae(sat); // Get satellite position in range, aziimuth, elevation at the sensor's current time
sensor.getRae(sat, time); // Get position in range, aziimuth, elevation relative to a satellite object at the given time without changing its state
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
