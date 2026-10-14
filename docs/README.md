# ootk Documentation

This folder is the source of the ootk documentation site (VitePress). Run `pnpm run docs:dev` from the repository
root to browse it locally. `index.md` is the site home page; this README is only for browsing the folder on GitHub.

## Guides

- **[Getting Started](./getting-started.md)**: installation, your first satellite, positions, ground stations and
  sensors, look angles and passes.
- **[User Guide](./user-guide.md)**: reference for the main features: satellites, ground stations and sensors,
  passes, coordinate frames, propagation and force models, orbit determination, time, covariance, celestial
  bodies, maneuvers, conjunction assessment and CCSDS message files.
- **[Advanced Features](./advanced-features-guide.md)**: force models and numerical propagators, interpolation,
  covariance, conjunction assessment, orbit determination, relative motion, maneuvers, optimizers and OEM files.
- **[Lambert and Satellite Integration](./lambert-satellite-integration-guide.md)**: solving Lambert's problem and
  turning the solution into a propagated state, a TLE or a `Satellite`.
- **[Migrating to v8](./migration-v8.md)**: every breaking change in ootk 8.0.0 with before/after code and a
  checklist. Read this before upgrading from 7.x.

## Examples

**[Examples](./examples/index.md)** walks through the runnable scripts in [`../examples`](../examples). The code on
those pages is pulled directly from the scripts, so it always matches what runs.

## Module notes

Some modules carry their own README with design notes:

- [Coordinate systems](../src/coordinate/README.md): frames (J2000, TEME, ITRF, Geodetic, RIC, Hill), element sets
  and when to use each.
- [Time](../src/time/README.md): epochs and time scales.
- [Force models](../src/force/README.md) and [propagators](../src/propagator/README.md).
- [Orbit determination](../src/orbit-determination/README.md).
- [Optimizers](../src/optimize/README.md).
- [Field of view design](../src/sensor/v2-docs/field-of-view-design-document.md): the sensor cone model, the
  boresight frame and the v8 zenith roll convention.

## What is ootk?

ootk is a TypeScript library for orbital mechanics:

- **Satellite tracking**: SGP4 (pure TypeScript, with an optional wasm backend), Kepler, Runge-Kutta 4,
  Runge-Kutta 8(9) and Dormand-Prince 5(4) propagators with configurable force models.
- **Sensors**: ground stations with attached radars, optical sensors and antennas, field-of-view cones with
  elevation masks, look angles and pass prediction.
- **Coordinate frames**: J2000, TEME, ITRF, geodetic, RIC, Hill, RAE and classical and equinoctial elements, with
  branded unit types (`Degrees`, `Radians`, `Kilometers`, ...) that catch unit mix-ups at compile time.
- **Orbit determination**: Lambert, Gibbs, Herrick-Gibbs and Gooding initial orbit determination, batch least
  squares and Levenberg-Marquardt refinement.
- **Mission planning**: Hohmann and two-burn transfers, plane changes, constellation and repeat-ground-track
  design.
- **Uncertainty**: covariance generation and propagation, conjunction screening and probability of collision.
- **Data formats**: CCSDS CDM, OEM and OMM parsing and export, JPL Horizons parsing.

Originally developed for [KeepTrack](https://github.com/thkruz/keeptrack.space). It runs in Node.js 20 or later
and in the browser.

## Installation

```bash
npm install ootk
```

## Support

- **GitHub repository**: <https://github.com/thkruz/ootk>
- **Issues**: <https://github.com/thkruz/ootk/issues>
- **npm package**: <https://www.npmjs.com/package/ootk>
- **Changelog**: [CHANGELOG.md](../CHANGELOG.md)

## License

AGPL-3.0-or-later. See [LICENSE.MD](../LICENSE.MD).
