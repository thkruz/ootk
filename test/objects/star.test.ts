import { Degrees, Kilometers, Radians, Star } from '../../src/main';

describe('Basic Star functionality', () => {
  const star = new Star({
    name: 'Test',
    ra: <Radians>0,
    dec: <Radians>0,
  });

  it('should be able to get rae coordinates', () => {
    const rae = star.rae(
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
    const eci = star.eci(
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
