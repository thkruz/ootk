/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import {
  Sun,
  SunBody,
  CelestialBodyType,
  Vector3D,
  Kilometers,
  KilometersPerSecond,
  Degrees,
  Meters,
  EpochUTC,
  J2000,
  GroundStation,
  RAD2DEG,
} from '../../main';
import { Body, GeoVector, KM_PER_AU, MakeTime } from 'astronomy-engine';

describe('SunBody', () => {
  const testDate = new Date('2024-06-21T12:00:00Z'); // Summer solstice

  describe('singleton pattern', () => {
    it('should return the same instance via getInstance', () => {
      const instance1 = SunBody.getInstance();
      const instance2 = SunBody.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should export Sun as the singleton instance', () => {
      expect(Sun).toBe(SunBody.getInstance());
    });
  });

  describe('static constants', () => {
    it('should have gravitational parameter', () => {
      expect(SunBody.MU).toBeGreaterThan(1e11);
    });

    it('should have radius', () => {
      expect(SunBody.RADIUS).toBeGreaterThan(600000);
    });

    it('should have solar flux constant', () => {
      expect(SunBody.SOLAR_FLUX).toBeGreaterThan(1300);
    });
  });

  describe('body properties', () => {
    it('should have correct name', () => {
      expect(Sun.name).toBe('Sun');
    });

    it('should have correct body type', () => {
      expect(Sun.bodyType).toBe(CelestialBodyType.STAR);
    });

    it('should have correct mu', () => {
      expect(Sun.mu).toBe(SunBody.MU);
    });

    it('should have correct radius', () => {
      expect(Sun.radius).toBe(SunBody.RADIUS);
    });
  });

  describe('eci position', () => {
    it('should return position as Vector3D', () => {
      const position = Sun.eci(testDate);

      expect(position).toBeInstanceOf(Vector3D);
    });

    it('should return position at roughly 1 AU distance', () => {
      const position = Sun.eci(testDate);
      const distance = position.magnitude();

      // Sun-Earth distance ~1 AU = 149,597,870 km
      expect(distance).toBeGreaterThan(145_000_000);
      expect(distance).toBeLessThan(155_000_000);
    });

    it('should return different positions for different dates', () => {
      const pos1 = Sun.eci(new Date('2024-01-01T12:00:00Z'));
      const pos2 = Sun.eci(new Date('2024-07-01T12:00:00Z'));

      // Positions should be roughly opposite (180 degrees apart)
      const dot = pos1.dot(pos2);

      expect(dot).toBeLessThan(0); // Opposite directions
    });
  });

  describe('eciApparent position', () => {
    it('should return position as Vector3D', () => {
      const position = Sun.eciApparent(testDate);

      expect(position).toBeInstanceOf(Vector3D);
    });

    it('equals astronomy-engine apparent GeoVector (light time applied once)', () => {
      // GeoVector(Sun, t, aberration=true) is already light-time and aberration corrected;
      // eciApparent used to roll back another ~499 s (~20 arcsec more).
      const v = GeoVector(Body.Sun, MakeTime(testDate), true);
      const ref = new Vector3D(v.x * KM_PER_AU, v.y * KM_PER_AU, v.z * KM_PER_AU);
      const apparent = Sun.eciApparent(testDate);

      expect(apparent.angle(ref as Vector3D<Kilometers>) * RAD2DEG * 3600).toBeLessThan(0.001);
    });
  });

  describe('shadow calculations', () => {
    it('should return false for LEO satellite in sunlight', () => {
      // LEO satellite on day side
      const satPos = new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
      const epoch = EpochUTC.fromDateTime(testDate);

      const inShadow = Sun.shadow(epoch, satPos);

      expect(inShadow).toBe(false);
    });

    it('should return boolean for satellite shadow calculation', () => {
      // LEO satellite on night side
      const satPos = new Vector3D(-7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
      const epoch = EpochUTC.fromDateTime(testDate);

      const inShadow = Sun.shadow(epoch, satPos);

      // Just verify it returns a boolean
      expect(typeof inShadow).toBe('boolean');
    });
  });

  describe('eclipseAngles', () => {
    it('should return angles tuple for satellite position', () => {
      const satPos = new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
      const sunPos = new Vector3D(150_000_000 as Kilometers, 0 as Kilometers, 0 as Kilometers);

      const angles = Sun.eclipseAngles(satPos, sunPos);

      // Returns [sunSatAngle, centralBodyApparentRadius, sunApparentRadius]
      expect(Array.isArray(angles)).toBe(true);
      expect(angles.length).toBe(3);
      expect(typeof angles[0]).toBe('number');
      expect(typeof angles[1]).toBe('number');
      expect(typeof angles[2]).toBe('number');
    });
  });

  describe('lightingRatio', () => {
    it('should return 1 for fully illuminated satellite', () => {
      const satPos = new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
      const sunPos = new Vector3D(150_000_000 as Kilometers, 0 as Kilometers, 0 as Kilometers);

      const ratio = Sun.lightingRatio(satPos, sunPos);

      expect(ratio).toBe(1);
    });

    it('should return 0 for satellite in full umbra', () => {
      const satPos = new Vector3D(-7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
      const sunPos = new Vector3D(150_000_000 as Kilometers, 0 as Kilometers, 0 as Kilometers);

      const ratio = Sun.lightingRatio(satPos, sunPos);

      expect(ratio).toBe(0);
    });
  });

  describe('getTimes', () => {
    it('does not modify the Date it is given', () => {
      const d = new Date('2024-06-21T04:00:00Z');

      Sun.getTimes(d, 40.7 as Degrees, -74.0 as Degrees, 0 as Meters);
      expect(d.toISOString()).toBe('2024-06-21T04:00:00.000Z');
    });

    it('should return sun times for a location', () => {
      const times = Sun.getTimes(testDate, 40.7 as Degrees, -74.0 as Degrees, 0 as Meters);

      expect(times).toHaveProperty('sunriseStart');
      expect(times).toHaveProperty('sunsetEnd');
      expect(times).toHaveProperty('solarNoon');
      expect(times).toHaveProperty('nadir');
    });

    it('should have sunrise before sunset for normal day', () => {
      const times = Sun.getTimes(testDate, 40.7 as Degrees, -74.0 as Degrees, 0 as Meters);

      if (times.sunriseStart && times.sunsetEnd) {
        expect(times.sunriseStart.getTime()).toBeLessThan(times.sunsetEnd.getTime());
      }
    });
  });

  describe('serialization', () => {
    it('should serialize to object', () => {
      const serialized = Sun.serialize();

      expect(serialized).toHaveProperty('id', 0);
      expect(serialized).toHaveProperty('name', 'Sun');
      expect(serialized).toHaveProperty('bodyType', CelestialBodyType.STAR);
    });
  });

  describe('toString', () => {
    it('should return string representation', () => {
      const str = Sun.toString();

      expect(typeof str).toBe('string');
    });
  });

  describe('J2000 state integration', () => {
    it('should work with J2000 state for force calculations', () => {
      const epoch = EpochUTC.fromDateTime(testDate);
      const position = new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
      const velocity = new Vector3D(
        0 as KilometersPerSecond,
        7.5 as KilometersPerSecond,
        0 as KilometersPerSecond,
      );
      const state = new J2000(epoch, position, velocity);

      const sunPos = Sun.eciApparent(state.epoch.toDateTime());

      expect(sunPos).toBeInstanceOf(Vector3D);
      expect(sunPos.magnitude()).toBeGreaterThan(100_000_000);
    });
  });
});

describe('Sun.getSunriseSunset', () => {
  it('returns the times the Sun centre crosses the requested elevation', () => {
    // Used to throw: the elevation went into astronomy-engine's metres-above-ground argument
    const site = new GroundStation({ lat: 40 as Degrees, lon: -75 as Degrees, alt: 0 as Kilometers });
    const { sunrise, sunset } = Sun.getSunriseSunset(site, new Date('2024-06-21T00:00:00Z'));

    expect(sunrise).not.toBeNull();
    expect(sunset).not.toBeNull();
    expect(Sun.getAzEl(site, sunrise!, false).el).toBeCloseTo(-0.833, 2);
    expect(Sun.getAzEl(site, sunset!, false).el).toBeCloseTo(-0.833, 2);
    // USNO: sunrise 09:32 UTC at 40N 75W on 2024-06-21
    expect(Math.abs(sunrise!.getTime() - Date.parse('2024-06-21T09:32:00Z'))).toBeLessThan(90e3);

    const civil = Sun.getSunriseSunset(site, new Date('2024-06-21T00:00:00Z'), -6 as Degrees);

    expect(Sun.getAzEl(site, civil.sunrise!, false).el).toBeCloseTo(-6, 2);
  });
});
