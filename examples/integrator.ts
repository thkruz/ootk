import { EpochUTC, ForceModel, RungeKutta4Propagator, RungeKutta89Propagator, Satellite, TleLine1, TleLine2 } from '../src/main.js';

const start = new Date(2024, 0, 28, 0, 0, 0, 0);
const stop = new Date(2024, 0, 29, 0, 0, 0, 0);
// const startEpoch = EpochUTC.fromDateTime(start);
const stopEpoch = EpochUTC.fromDateTime(stop);
const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

// eslint-disable-next-line no-console
console.log(sat.eci(stop));

const forceModel = new ForceModel();

forceModel.setEarthGravity(8, 8);
forceModel.setThirdBodyGravity({
  moon: true,
  sun: true,
});
forceModel.setSolarRadiationPressure(1000, 400);
forceModel.setAtmosphericDrag(1000, 400);

const rk4 = new RungeKutta4Propagator(sat.toJ2000(start), forceModel);

// eslint-disable-next-line no-console
console.log(rk4.propagate(stopEpoch));

const rkA = new RungeKutta89Propagator(sat.toJ2000(start), forceModel);

// eslint-disable-next-line no-console
console.log(rkA.propagate(stopEpoch));
