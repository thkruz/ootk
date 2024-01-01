/**
 * @file   Test Suite to verify sat class work as expected
 * @author Theodore Kruczek.
 * @since  1.2.0
 */

import { Degrees, Kilometers, Sat, Sensor, SpaceObjectType, TleLine1, TleLine2 } from '../../src/ootk';

const dateObj = new Date(1661400000000);

const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

describe('Basic Sensor functionality', () => {
  const sat = new Sat({ name: 'Test', tle1, tle2 });

  it('should be able to get rae coordinates', () => {
    const sensor = new Sensor({
      name: 'Test',
      lat: 41 as Degrees,
      lon: -71 as Degrees,
      alt: 0 as Kilometers,
      minAz: 0 as Degrees,
      maxAz: 360 as Degrees,
      minEl: 0 as Degrees,
      maxEl: 90 as Degrees,
      minRng: 0 as Kilometers,
      maxRng: 100000 as Kilometers,
    });

    const rae = sensor.getRae(sat, dateObj);

    expect(rae.az).toMatchSnapshot();
    expect(rae.el).toMatchSnapshot();
    expect(rae.rng).toMatchSnapshot();

    // Verify it works in reverse
    const rae2 = sat.raeOpt(sensor, dateObj);

    expect(rae2.az).toMatchSnapshot();
    expect(rae2.el).toMatchSnapshot();
    expect(rae2.rng).toMatchSnapshot();
  });

  it('should be able to determine InView without FOV', () => {
    const sensor = new Sensor({
      name: 'Test',
      lat: 41 as Degrees,
      lon: -71 as Degrees,
      alt: 0 as Kilometers,
      type: SpaceObjectType.OPTICAL,
      minAz: 0 as Degrees,
      maxAz: 360 as Degrees,
      minEl: 0 as Degrees,
      maxEl: 90 as Degrees,
      minRng: 0 as Kilometers,
      maxRng: 100000 as Kilometers,
    });

    const inView = sensor.isSatInFov(sat, dateObj);
    const rae = sat.raeOpt(sensor, dateObj);

    const inView2 = sensor.isRaeInFov(rae);

    expect(inView).toEqual(inView2);
  });

  it('should be able to determine InView with FOV', () => {
    const sensor = new Sensor({
      name: 'Test',
      lat: 41 as Degrees,
      lon: -71 as Degrees,
      alt: 0 as Kilometers,
      minAz: 0 as Degrees,
      maxAz: 360 as Degrees,
      minEl: 0 as Degrees,
      maxEl: 90 as Degrees,
      minRng: 0 as Kilometers,
      maxRng: 100000 as Kilometers,
    });

    const inView = sensor.isSatInFov(sat, dateObj);
    const rae = sat.raeOpt(sensor, dateObj);

    const inView2 = sensor.isRaeInFov(rae);

    expect(inView).toEqual(inView2);
  });

  it('should error if bad minAz', () => {
    const result = () =>
      new Sensor({
        name: 'Test',
        lat: 41 as Degrees,
        lon: -71 as Degrees,
        alt: 0 as Kilometers,
        minAz: -999 as Degrees,
        maxAz: 360 as Degrees,
        minEl: 0 as Degrees,
        maxEl: 90 as Degrees,
        minRng: 0 as Kilometers,
        maxRng: 100000 as Kilometers,
      });

    expect(result).toThrow();
  });

  it('should error if bad maxAz', () => {
    const result = () =>
      new Sensor({
        name: 'Test',
        lat: 41 as Degrees,
        lon: -71 as Degrees,
        alt: 0 as Kilometers,
        maxAz: -999 as Degrees,
        minAz: 0 as Degrees,
        minEl: 0 as Degrees,
        maxEl: 90 as Degrees,
        minRng: 0 as Kilometers,
        maxRng: 100000 as Kilometers,
      });

    expect(result).toThrow();
  });

  it('should error if bad minEl', () => {
    const result = () =>
      new Sensor({
        name: 'Test',
        lat: 41 as Degrees,
        lon: -71 as Degrees,
        alt: 0 as Kilometers,
        minEl: -999 as Degrees,
        minAz: 0 as Degrees,
        maxAz: 360 as Degrees,
        maxEl: 90 as Degrees,
        minRng: 0 as Kilometers,
        maxRng: 100000 as Kilometers,
      });

    expect(result).toThrow();
  });

  it('should error if bad maxEl', () => {
    const result = () =>
      new Sensor({
        name: 'Test',
        lat: 41 as Degrees,
        lon: -71 as Degrees,
        alt: 0 as Kilometers,
        maxEl: -999 as Degrees,
        minAz: 0 as Degrees,
        maxAz: 360 as Degrees,
        minEl: 0 as Degrees,
        minRng: 0 as Kilometers,
        maxRng: 100000 as Kilometers,
      });

    expect(result).toThrow();
  });

  it('should error if bad minRng', () => {
    const result = () =>
      new Sensor({
        name: 'Test',
        lat: 41 as Degrees,
        lon: -71 as Degrees,
        alt: 0 as Kilometers,
        minRng: -999 as Kilometers,
        minAz: 0 as Degrees,
        maxAz: 360 as Degrees,
        minEl: 0 as Degrees,
        maxEl: 90 as Degrees,
        maxRng: 100000 as Kilometers,
      });

    expect(result).toThrow();
  });
  it('should error if bad maxRng', () => {
    const result = () =>
      new Sensor({
        name: 'Test',
        lat: 41 as Degrees,
        lon: -71 as Degrees,
        alt: 0 as Kilometers,
        maxRng: -999 as Kilometers,
        minAz: 0 as Degrees,
        maxAz: 360 as Degrees,
        minEl: 0 as Degrees,
        maxEl: 90 as Degrees,
        minRng: 0 as Kilometers,
      });

    expect(result).toThrow();
  });

  it('should error if bad lat', () => {
    const result = () =>
      new Sensor({
        name: 'Test',
        lat: -999 as Degrees,
        lon: -71 as Degrees,
        alt: 0 as Kilometers,
        minAz: 0 as Degrees,
        maxAz: 360 as Degrees,
        minEl: 0 as Degrees,
        maxEl: 90 as Degrees,
        minRng: 0 as Kilometers,
        maxRng: 100000 as Kilometers,
      });

    expect(result).toThrow();
  });

  it('should error if bad lon', () => {
    const result = () =>
      new Sensor({
        name: 'Test',
        lat: 41 as Degrees,
        lon: -999 as Degrees,
        alt: 0 as Kilometers,
        minAz: 0 as Degrees,
        maxAz: 360 as Degrees,
        minEl: 0 as Degrees,
        maxEl: 90 as Degrees,
        minRng: 0 as Kilometers,
        maxRng: 100000 as Kilometers,
      });

    expect(result).toThrow();
  });

  it('should error if bad alt', () => {
    const result = () =>
      new Sensor({
        name: 'Test',
        lat: 41 as Degrees,
        lon: -71 as Degrees,
        alt: -999 as Kilometers,
        minAz: 0 as Degrees,
        maxAz: 360 as Degrees,
        minEl: 0 as Degrees,
        maxEl: 90 as Degrees,
        minRng: 0 as Kilometers,
        maxRng: 100000 as Kilometers,
      });

    expect(result).toThrow();
  });

  it('should create a lookangles array', () => {
    const sensor = new Sensor({
      name: 'Test',
      lat: 41 as Degrees,
      lon: -71 as Degrees,
      alt: 0 as Kilometers,
      minAz: 0 as Degrees,
      maxAz: 360 as Degrees,
      minEl: 0 as Degrees,
      maxEl: 90 as Degrees,
      minRng: 0 as Kilometers,
      maxRng: 100000 as Kilometers,
    });

    const lookangles = sensor.calculatePasses(1440 * 60, sat, dateObj);

    expect(lookangles).toMatchSnapshot();
  });
});
