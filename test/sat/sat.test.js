/**
 * @file   Test Suite to verify sat class work as expected
 * @author Theodore Kruczek.
 * @since  1.2.0
 */

import { Sat } from '../../lib/ootk';
import { RAD2DEG } from '../../lib/utils/constants';

const dateObj = new Date(1661400000000);

const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996';
const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657';

describe('Basic Satellite functionality', () => {
  it('should create a new Sat object', () => {
    const sat = new Sat({ name: 'Test', tle1, tle2 });

    expect(sat).toBeDefined();
    expect(sat.inclination).toBe(51.6415);
    expect(sat.raan).toBe(161.8339);
    expect(sat.satrec).toBeDefined();
  });

  it('should allow chaining', () => {
    const eci = new Sat({ name: 'Test', tle1, tle2 }).propagateTo(dateObj).getEci().position;

    expect(eci.x).toBeCloseTo(6512.640035319078);
    expect(eci.y).toBeCloseTo(-1545.524934684146);
    expect(eci.z).toBeCloseTo(-1195.219347050479);
  });

  it('should allow getting eci coordinates', () => {
    const sat = new Sat({ name: 'Test', tle1, tle2 });

    const eci = sat.getEci(dateObj).position;

    expect(eci.x).toBeCloseTo(6512.640035319078);
    expect(eci.y).toBeCloseTo(-1545.524934684146);
    expect(eci.z).toBeCloseTo(-1195.219347050479);
  });

  it('should allow getting ecf coordinates', () => {
    const sat = new Sat({ name: 'Test', tle1, tle2 });

    const eci = sat.getEcf(dateObj);

    expect(eci.x).toBeCloseTo(4585.677469309576);
    expect(eci.y).toBeCloseTo(-4875.929624270418);
    expect(eci.z).toBeCloseTo(-1195.219347050479);
  });

  it('should allow getting lla coordinates', () => {
    const sat = new Sat({ name: 'Test', tle1, tle2 });

    const eci = sat.lla(dateObj);

    expect(eci.lat).toBeCloseTo(-0.17779469476167792 * RAD2DEG);
    expect(eci.lon).toBeCloseTo(-0.8160653803347542 * RAD2DEG);
    expect(eci.alt).toBeCloseTo(421.9147233728436);
  });

  it('should be able to get the orbital period', () => {
    const sat = new Sat({ name: 'Test', tle1, tle2 });

    expect(sat.period).toBeCloseTo(92.89920734635164);
  });
});
