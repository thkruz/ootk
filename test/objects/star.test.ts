/**
 * @file   Test Suite to verify star class work as expected
 * @author Theodore Kruczek.
 * @since  3.0.0
 */

import { Star } from '@src/objects';
import { Degrees, Kilometers, Radians } from '@src/ootk';

describe('Basic Star functionality', () => {
  const star = new Star({
    name: 'Test',
    ra: <Radians>0,
    dec: <Radians>0,
  });

  it('should be able to get rae coordinates', () => {
    const rae = star.getRae(
      {
        lat: <Degrees>0,
        lon: <Degrees>0,
        alt: <Kilometers>0,
      },
      new Date(1661400000000),
    );

    expect(rae.az).toMatchSnapshot();
    expect(rae.el).toMatchSnapshot();
    expect(rae.rng).toMatchSnapshot();
  });

  it('should be able to get ECI coordinates', () => {
    const eci = star.getEci(
      {
        lat: <Degrees>0,
        lon: <Degrees>0,
        alt: <Kilometers>0,
      },
      new Date(1661400000000),
    );

    expect(eci.x).toMatchSnapshot();
    expect(eci.y).toMatchSnapshot();
    expect(eci.z).toMatchSnapshot();
  });
});
