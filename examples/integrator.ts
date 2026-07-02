/* eslint-disable no-console */
// #region imports
import {
  RungeKutta4Propagator, RungeKutta89Propagator, ForceModel, EpochUTC, Satellite, TleLine1, TleLine2,
} from 'ootk';
// #endregion imports

// #region setup-satellite
const start = new Date(2024, 0, 28, 0, 0, 0, 0);
const stop = new Date(2024, 0, 29, 0, 0, 0, 0);
const stopEpoch = EpochUTC.fromDateTime(stop);
const sat = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

console.log('SGP4 state at stop time (TEME):');
console.log(sat.eci(stop));
// #endregion setup-satellite

// #region force-model
const forceModel = new ForceModel();

forceModel.setEarthGravity(8, 8);
forceModel.setThirdBodyGravity({
  moon: true,
  sun: true,
});
forceModel.setSolarRadiationPressure(1000, 400);
forceModel.setAtmosphericDrag(1000, 400);
// #endregion force-model

// #region rk4-propagation
const rk4 = new RungeKutta4Propagator(sat.toJ2000(start), forceModel);

console.log('\nRungeKutta4 state after 24 hours (J2000):');
console.log(rk4.propagate(stopEpoch));
// #endregion rk4-propagation

// #region rk89-propagation
const rkA = new RungeKutta89Propagator(sat.toJ2000(start), forceModel);

console.log('\nRungeKutta89 state after 24 hours (J2000):');
console.log(rkA.propagate(stopEpoch));
// #endregion rk89-propagation
