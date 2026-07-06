/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import {
  Degrees,
  GroundStation,
  Kilometers,
  OpticalSensor,
  Satellite,
  SensorType,
  TleLine1,
  TleLine2,
  ValidationError,
} from '../../main';

describe('Sensor parent validation', () => {
  const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
  const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

  const createOrphanSensor = () =>
    new OpticalSensor({
      id: 2001,
      name: 'Test Sensor',
      sensorType: SensorType.OPTICAL,
      fieldOfView: {
        minRange: 100 as Kilometers,
        maxRange: 40000 as Kilometers,
        boresightEl: 45 as Degrees,
        halfAngle: 60 as Degrees,
      },
    });

  it('should create sensor without parent', () => {
    const sensor = createOrphanSensor();

    expect(sensor).toBeDefined();
    expect(sensor.hasParent()).toBe(false);
  });

  it('should throw ValidationError when accessing parent getter without parent', () => {
    const sensor = createOrphanSensor();

    expect(() => sensor.parent).toThrow(ValidationError);
    expect(() => sensor.parent).toThrow(/no parent platform assigned/u);
  });

  it('should throw ValidationError when calling getJ2000 without parent', () => {
    const sensor = createOrphanSensor();

    expect(() => sensor.getJ2000()).toThrow(ValidationError);
    expect(() => sensor.getJ2000()).toThrow(/getJ2000/u);
  });

  it('should throw ValidationError when calling getRae without parent', () => {
    const sensor = createOrphanSensor();
    const sat = new Satellite({ tle1, tle2 });

    expect(() => sensor.getRae(sat)).toThrow(ValidationError);
    expect(() => sensor.getRae(sat)).toThrow(/getRae/u);
  });

  it('should throw ValidationError when calling calculatePasses without parent', () => {
    const sensor = createOrphanSensor();
    const sat = new Satellite({ tle1, tle2 });

    expect(() => sensor.calculatePasses(sat, 3600)).toThrow(ValidationError);
  });

  it('should return true for hasParent after setParent', () => {
    const sensor = createOrphanSensor();
    const gs = new GroundStation({
      lat: 0 as Degrees,
      lon: 0 as Degrees,
      alt: 0 as Kilometers,
    });

    sensor.setParent(gs);
    expect(sensor.hasParent()).toBe(true);
    expect(sensor.parent).toBe(gs);
  });

  it('should include sensor name in error message', () => {
    const sensor = createOrphanSensor();

    try {
      const _parent = sensor.parent;

      fail('Expected an error to be thrown');
    } catch (e) {
      expect((e as ValidationError).message).toContain('Test Sensor');
    }
  });

  it('should include method name in requireParent error message', () => {
    const sensor = createOrphanSensor();

    try {
      sensor.getJ2000();
      fail('Expected an error to be thrown');
    } catch (e) {
      expect((e as ValidationError).message).toContain('getJ2000');
      expect((e as ValidationError).message).toContain('Test Sensor');
    }
  });

  it('should have correct field property on ValidationError', () => {
    const sensor = createOrphanSensor();

    try {
      const _parent = sensor.parent;

      fail('Expected an error to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).field).toBe('parent');
    }
  });

  it('should work correctly after parent is set', () => {
    const sensor = createOrphanSensor();
    const gs = new GroundStation({
      lat: 40 as Degrees,
      lon: -75 as Degrees,
      alt: 0.1 as Kilometers,
    });
    const sat = new Satellite({ tle1, tle2 });

    sensor.setParent(gs);

    // These should not throw after parent is set
    expect(() => sensor.getJ2000()).not.toThrow();
    expect(() => sensor.getRae(sat)).not.toThrow();
  });
});
