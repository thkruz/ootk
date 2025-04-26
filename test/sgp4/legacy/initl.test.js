/**
 * @file   Tests from Sgp4JsUtils.js to ensure compatibility
 * @since  0.2.0
 */

import { Sgp4, Sgp4OpsMode } from '../../../src/main'; // eslint-disable-line
import { Sgp4Methods } from '../../../src/sgp4/sgp4';

// wgs84 constants
const mu = 398600.8; // in km3 / s2
const earthRadius = 6378.135; // in km
const xke = 60.0 / Math.sqrt((earthRadius * earthRadius * earthRadius) / mu);
const j2 = 0.001082616;

describe('Propagator Initialization', () => {
  it('Legacy Sidereal Time Calculations', () => {
    const satrec = {
      ecco: 0.1846988,
      inclo: 0,
      method: Sgp4Methods.NEAR_EARTH,
      no: 0.0037028783237264057,
      operationmode: Sgp4OpsMode.AFSPC,
      satn: '00001',
      xke,
      j2,
    };
    const epoch = 25938.538312919904;
    const results = Sgp4.initl_(satrec, epoch);

    expect(results.ainv).toBeCloseTo(0.1353414893496189);
    expect(results.ao).toBeCloseTo(7.3887172721793);
    expect(results.con41).toBeCloseTo(2);
    expect(results.con42).toBeCloseTo(-4);
    expect(results.cosio).toBeCloseTo(1);
    expect(results.cosio2).toBeCloseTo(1);
    expect(results.eccsq).toBeCloseTo(0.034113646721439995);
    expect(results.gsto).toBeCloseTo(5.220883431398299);
    expect(results.no).toBeCloseTo(0.003702762286531528);
    expect(results.omeosq).toBeCloseTo(0.96588635327856);
    expect(results.posq).toBeCloseTo(50.931932818552305);
    expect(results.rp).toBeCloseTo(6.02403005846851);
    expect(results.rteosq).toBeCloseTo(0.9827951736137902);
    expect(results.sinio).toBeCloseTo(0);
  });
});
