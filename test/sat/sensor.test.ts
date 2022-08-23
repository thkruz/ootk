/**
 * @file   Test Suite to verify sat class work as expected
 * @author Theodore Kruczek.
 * @since  1.2.0
 */

import { Sat, Sensor, SpaceObjectType } from '../../lib/ootk';

const dateObj = new Date(1661400000000);

const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996';
const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657';

const { PI } = Math;
const TAU = PI * 2; // https://tauday.com/tau-manifesto
const RAD2DEG = 360 / TAU;

describe('Basic Sensor functionality', () => {
  const sat = new Sat({ name: 'Test', tle1, tle2 });

  it('should be able to get rae coordinates', () => {
    const sensor = new Sensor({ name: 'Test', lat: 41, lon: -71, alt: 0 });

    const rae = sensor.getRae(sat, dateObj);

    rae.az *= RAD2DEG;
    rae.el *= RAD2DEG;

    expect(rae.az).toBeCloseTo(73.86522544035945);
    expect(rae.el).toBeCloseTo(-56.89115262874271);
    expect(rae.rng).toBeCloseTo(11183.206102756607);

    // Verify it works in reverse
    const rae2 = sat.getRae(sensor, dateObj);

    rae2.az *= RAD2DEG;
    rae2.el *= RAD2DEG;

    expect(rae2.az).toBeCloseTo(73.86522544035945);
    expect(rae2.el).toBeCloseTo(-56.89115262874271);
    expect(rae2.rng).toBeCloseTo(11183.206102756607);
  });

  it('should be able to determine InView without FOV', () => {
    const sensor = new Sensor({ name: 'Test', lat: 41, lon: -71, alt: 0, type: SpaceObjectType.OPTICAL });

    const inView = sensor.isSatInFov(sat, dateObj);
    const rae = sat.getRae(sensor, dateObj);

    rae.az *= RAD2DEG;
    rae.el *= RAD2DEG;
    const inView2 = sensor.isRaeInFov(rae, dateObj);

    expect(inView).toEqual(inView2);
  });

  it('should be able to determine InView with FOV', () => {
    const sensor = new Sensor({
      name: 'Test',
      lat: 41,
      lon: -71,
      alt: 0,
      minAz: 0,
      maxAz: 360,
      minEl: 0,
      maxEl: 90,
      minRng: 0,
      maxRng: 100000,
    });

    const inView = sensor.isSatInFov(sat, dateObj);
    const rae = sat.getRae(sensor, dateObj);

    rae.az *= RAD2DEG;
    rae.el *= RAD2DEG;
    const inView2 = sensor.isRaeInFov(rae, dateObj);

    expect(inView).toEqual(inView2);
  });

  it('should error if bad minAz', () => {
    const result = () => new Sensor({ name: 'Test', lat: 41, lon: -71, alt: 0, minAz: -999 });

    expect(result).toThrow();
  });

  it('should error if bad maxAz', () => {
    const result = () => new Sensor({ name: 'Test', lat: 41, lon: -71, alt: 0, maxAz: -999 });

    expect(result).toThrow();
  });

  it('should error if bad minEl', () => {
    const result = () => new Sensor({ name: 'Test', lat: 41, lon: -71, alt: 0, minEl: -999 });

    expect(result).toThrow();
  });

  it('should error if bad maxEl', () => {
    const result = () => new Sensor({ name: 'Test', lat: 41, lon: -71, alt: 0, maxEl: -999 });

    expect(result).toThrow();
  });

  it('should error if bad minRng', () => {
    const result = () => new Sensor({ name: 'Test', lat: 41, lon: -71, alt: 0, minRng: -999 });

    expect(result).toThrow();
  });
  it('should error if bad maxRng', () => {
    const result = () => new Sensor({ name: 'Test', lat: 41, lon: -71, alt: 0, maxRng: -999 });

    expect(result).toThrow();
  });

  it('should error if bad lat', () => {
    const result = () => new Sensor({ name: 'Test', lat: -999, lon: -71, alt: 0 });

    expect(result).toThrow();
  });

  it('should error if bad lon', () => {
    const result = () => new Sensor({ name: 'Test', lat: 41, lon: -999, alt: 0 });

    expect(result).toThrow();
  });

  it('should error if bad alt', () => {
    const result = () => new Sensor({ name: 'Test', lat: 41, lon: -71, alt: -999 });

    expect(result).toThrow();
  });

  it('should create a lookangles array', () => {
    const sensor = new Sensor({
      name: 'Test',
      lat: 41,
      lon: -71,
      alt: 0,
      minAz: 0,
      maxAz: 360,
      minEl: 0,
      maxEl: 90,
      minRng: 0,
      maxRng: 100000,
    });

    const lookangles = sensor.calculatePasses(1440 * 60, sat, dateObj);

    expect(lookangles).toMatchSnapshot();
  });
});
