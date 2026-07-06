# Working Examples

Every page in this section embeds a runnable script from the [`examples/`](https://github.com/thkruz/ootk/tree/main/examples) directory of the repository. The code you see is the code that runs: the pages import the scripts directly, so they cannot drift out of sync with the library.

## Running the examples

The example scripts import from `'ootk'` exactly like consumer code would. Inside the repository this resolves to the built `dist/` output through npm package self-reference, so build once, then run any example with [tsx](https://github.com/privatenumber/tsx):

```bash
git clone https://github.com/thkruz/ootk.git
cd ootk
npm install
npm run build

npx tsx ./examples/satellite-passes.ts
```

## Index

| Example | Demonstrates |
| ------- | ------------ |
| [Orbital Elements](./orbital-elements) | Classical elements from TLEs, element/state-vector conversions, TLEs from elements |
| [Coordinate Transforms](./coordinate-transforms) | ECI/ECEF/LLA, J2000/TEME/ITRF state vectors, RIC/Hill relative frames, RAE/SEZ |
| [Time Systems](./time-systems) | UTC/TAI/TT/TDB/GPS epochs, Julian dates, GMST |
| [Satellite Passes](./satellite-passes) | Pass prediction, look angles, field-of-view checks |
| [Sensors](./sensor) | Ground sensor math: RAE, ECEF/ECI transforms |
| [Observations](./observations) | RADEC formats, topocentric vs geocentric, state vectors from observations |
| [Doppler Shift](./doppler) | Frequency shifts during a pass, Doppler corrections |
| [Numerical Integrators](./integrator) | RK4/RK89 propagation with force models |
| [Initial Orbit Determination](./iod) | Lambert, Gibbs, and Herrick-Gibbs IOD from position fixes |
| [Gooding IOD](./gooding-iod) | Angles-only IOD from optical observations |
| [Lambert State Vectors](./lambert-state-vector) | State vectors without TLEs, transfer planning, multi-rev solutions |
| [Maneuvers](./maneuvers) | Hohmann and two-burn transfers, delta-V budgets |
| [Conjunction Assessment](./conjunction-assessment-example) | High-fidelity conjunction screening with probability of collision |
| [Covariance Matrix](./covariance-matrix) | RIC-frame covariance from TLE history |
| [Sun](./sun) | Sunrise/sunset and solar event times |
| [Moon](./moon) | Lunar position, rise/set, phase, and illumination |
