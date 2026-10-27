# ootk

![Size](https://img.shields.io/github/languages/code-size/thkruz/ootk?style=flat-square)
[![Release](https://img.shields.io/github/v/release/thkruz/ootk?style=flat-square)](https://www.npmjs.com/package/ootk)
[![Issues](https://img.shields.io/github/issues/thkruz/ootk?style=flat-square)](https://github.com/thkruz/ootk/issues)
[![License](https://img.shields.io/github/license/thkruz/ootk?style=flat-square)](LICENSE.MD)

> An Orbital Object Toolkit in Your Web Browser

**ootk** is a collection of libraries for doing math related to orbital objects written in TypeScript. **ootk** was
developed to simplify the math and let you focus on using the results.

Most of the functionality was originally written for [KeepTrack](https://github.com/thkruz/keeptrack.space) and then
later refactored into this library for others to use.

## :wrench: Installation

Install the library with [NPM](https://www.npmjs.com/):

```bash
npm i ootk
```

ootk requires Node.js 20 or later (or any modern browser bundler). It ships as ES modules with a CommonJS
build and full TypeScript types.

> **Upgrading from ootk 7?** Version 8 fixes a number of silently wrong results and changes a few API contracts
> (`mag2db` is now `pow2db`, Lambert `posigrade` is now `shortWay`, zenith field-of-view roll, CDM units and more).
> Read the [v8 migration guide](./docs/migration-v8.md) before upgrading.

### Example Usage

Units are carried in the types. The branded types (`Degrees`, `Radians`, `Kilometers`, `TleLine1`, ...) tell you
what each parameter expects and make the compiler catch a mix-up: `GroundStation`, sensor and `FieldOfView`
parameters are in degrees, while lower-level classes such as `Geodetic`, `RAE` and `ClassicalElements` take
radians. Distances are kilometres throughout.

```ts
import {
  Degrees,
  GroundStation,
  Kilometers,
  PassType,
  PhasedArrayRadar,
  Satellite,
  SensorType,
  TleLine1,
  TleLine2,
} from 'ootk';

// A satellite from a TLE. SGP4 is only accurate near the TLE epoch, so use a
// current TLE (or a date close to its epoch, as here).
const iss = new Satellite({
  name: 'ISS',
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});
const date = new Date('2024-01-28T12:00:00Z');

console.log(iss.inclination); // deg
console.log(iss.period); // min

// Position: eci() is TEME in km and km/s; lla() is degrees and km. Both return
// null if SGP4 fails (for example a decayed orbit), so check the result.
const eci = iss.eci(date);
const lla = iss.lla(date);

if (eci && lla) {
  console.log(eci.position.x, eci.velocity.x);
  console.log(lla.lat, lla.lon, lla.alt);
}

// A ground site. Latitude and longitude are degrees, altitude km above WGS-84.
const capeCod = new GroundStation({
  name: 'Cape Cod',
  lat: 41.754785 as Degrees,
  lon: -70.539151 as Degrees,
  alt: 0.060966 as Kilometers,
});

// Look angles from the site (azimuth and elevation in degrees, range in km).
const rae = iss.rae(capeCod, date);

if (rae) {
  console.log(rae.az, rae.el, rae.rng);
}

// A sensor is a component attached to a platform. Its field of view is a cone
// around each face boresight; halfAngle is required.
const radar = new PhasedArrayRadar({
  id: 1,
  name: 'Cape Cod Radar',
  sensorType: SensorType.PHASED_ARRAY_RADAR,
  beamwidth: 2 as Degrees,
  boresightAz: [47 as Degrees, 167 as Degrees],
  boresightEl: [20 as Degrees, 20 as Degrees],
  fieldOfView: {
    halfAngle: 60 as Degrees,
    minRange: 200 as Kilometers,
    maxRange: 5556 as Kilometers,
    minElevation: 3 as Degrees,
  },
});

capeCod.addSensor(radar);
radar.setParent(capeCod);

console.log(radar.canObserve(iss, date)); // inside the field of view right now?

// Pass events over the next 24 hours (1 s steps): ENTER and EXIT look angles.
const passes = radar.calculatePasses(iss, 24 * 60 * 60, date);

for (const pass of passes) {
  if (pass.type === PassType.ENTER) {
    console.log(`Enter ${pass.time.toISOString()} az ${pass.az.toFixed(1)} el ${pass.el.toFixed(1)}`);
  }
}
```

More runnable scripts live in [`examples/`](./examples) (orbital elements, coordinate transforms, time systems,
passes, sensors, observations, Doppler, integrators, IOD, Lambert, maneuvers, conjunction assessment, covariance,
Sun and Moon). Each one is walked through on the documentation site.

## :books: Documentation

The documentation site is built from [`docs/`](./docs) with VitePress (`pnpm run docs:dev`):

- **[Getting Started Guide](./docs/getting-started.md)** - installation and first steps
- **[User Guide](./docs/user-guide.md)** - reference for the main features
- **[Advanced Features](./docs/advanced-features-guide.md)** - force models, numerical propagation, covariance,
  conjunction assessment, orbit determination and optimizers
- **[Lambert and Satellite Integration](./docs/lambert-satellite-integration-guide.md)** - from Lambert solutions to
  propagated satellites
- **[Migrating to v8](./docs/migration-v8.md)** - every breaking change in 8.0.0, with before/after code
- **[Documentation Index](./docs/README.md)** - all documentation pages

The documentation covers:
- Installation and setup
- Satellite tracking and propagation
- Ground sensor operations and pass predictions
- Coordinate system transformations
- Orbit determination methods
- Maneuver planning
- Advanced features (force models, interpolation, covariance)
- Common use cases with complete examples

## :desktop_computer: Building

1. Install [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/) (`corepack enable pnpm` is enough; the
   required version is pinned by the `packageManager` field in `package.json`);

2. Install all required packages by running the following command from repository's root directory:

   ```bash
   pnpm install
   ```

3. Run the following script to build everything:

   ```bash
   pnpm run build
   ```

## :gem: Scripts

- `build` bundles `src/main.ts` with tsup into ES module and CommonJS builds (plus type declarations) in `dist`.
- `typecheck` runs `tsc --noEmit` over `src` and `test`.
- `lint` lints the `src` directory with [ESLint](https://eslint.org/); `lint:fix` also applies automatic fixes.
- `test` runs the unit tests with [Vitest](https://vitest.dev/).
- `test:coverage` runs the unit tests and writes a coverage report.
- `test:integration` builds the package and runs the integration tests against `dist`.
- `docs:dev` serves the VitePress documentation site locally; `docs:build` builds it.
- `bench` builds the package and runs the benchmarks in `benchmark/`.

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
pnpm test
```

Check that your code follows the rules in `eslint.config.js`:

```bash
pnpm run lint
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

I have placed the code under the [AGPL License](LICENSE.MD) in order to ensure that good ideas can be shared and that
the code is open for everyone to use. [Learn more here](https://www.gnu.org/philosophy/philosophy.html).
