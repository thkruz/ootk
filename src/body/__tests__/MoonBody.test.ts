/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import {
  Moon,
  MoonBody,
  CelestialBodyType,
  Vector3D,
  Degrees,
  Kilometers,
  GroundStation,
} from '../../main';

describe('MoonBody', () => {
  const testDate = new Date('2024-06-21T12:00:00Z');
  const fullMoonDate = new Date('2024-04-23T23:49:00Z'); // Full Moon
  const newMoonDate = new Date('2024-04-08T18:21:00Z'); // New Moon

  describe('singleton pattern', () => {
    it('should return the same instance via getInstance', () => {
      const instance1 = MoonBody.getInstance();
      const instance2 = MoonBody.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should export Moon as the singleton instance', () => {
      expect(Moon).toBe(MoonBody.getInstance());
    });
  });

  describe('static constants', () => {
    it('should have correct gravitational parameter', () => {
      expect(MoonBody.MU).toBeCloseTo(4902.8, 1);
    });

    it('should have correct radius', () => {
      expect(MoonBody.RADIUS).toBeCloseTo(1738.0, 0);
    });
  });

  describe('body properties', () => {
    it('should have correct name', () => {
      expect(Moon.name).toBe('Moon');
    });

    it('should have correct body type', () => {
      expect(Moon.bodyType).toBe(CelestialBodyType.MOON);
    });

    it('should have correct mu', () => {
      expect(Moon.mu).toBe(MoonBody.MU);
    });

    it('should have correct radius', () => {
      expect(Moon.radius).toBe(MoonBody.RADIUS);
    });
  });

  describe('eci position', () => {
    it('should return position as Vector3D', () => {
      const position = Moon.eci(testDate);

      expect(position).toBeInstanceOf(Vector3D);
    });

    it('should return position at lunar distance', () => {
      const position = Moon.eci(testDate);
      const distance = position.magnitude();

      // Earth-Moon distance ~384,400 km (varies 356,500 to 406,700 km)
      expect(distance).toBeGreaterThan(350_000);
      expect(distance).toBeLessThan(420_000);
    });

    it('should return different positions for different dates', () => {
      const pos1 = Moon.eci(new Date('2024-01-01T12:00:00Z'));
      const pos2 = Moon.eci(new Date('2024-01-15T12:00:00Z'));

      // Positions should differ after ~14 days (half lunar month)
      const diff = pos1.subtract(pos2).magnitude();

      expect(diff).toBeGreaterThan(100_000);
    });
  });

  describe('illumination methods', () => {
    it('should return high illumination fraction for full moon', () => {
      const fraction = Moon.getIlluminationFraction(fullMoonDate);

      expect(fraction).toBeGreaterThan(0.95);
    });

    it('should return low illumination fraction for new moon', () => {
      const fraction = Moon.getIlluminationFraction(newMoonDate);

      expect(fraction).toBeLessThan(0.05);
    });

    it('should return illumination fraction between 0 and 1', () => {
      const fraction = Moon.getIlluminationFraction(testDate);

      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThanOrEqual(1);
    });
  });

  describe('phase methods', () => {
    it('should return phase angle in degrees', () => {
      const phaseAngle = Moon.getPhaseAngle(testDate);

      expect(phaseAngle).toBeGreaterThanOrEqual(0);
      expect(phaseAngle).toBeLessThan(360);
    });

    it('should return phase angle near 180 for full moon', () => {
      const phaseAngle = Moon.getPhaseAngle(fullMoonDate);

      // Full moon: phase angle should be near 180
      expect(phaseAngle).toBeGreaterThan(150);
      expect(phaseAngle).toBeLessThan(210);
    });

    it('should return phase name', () => {
      const phaseInfo = Moon.getPhase(testDate);

      expect(typeof phaseInfo.phase.name).toBe('string');
      expect([
        'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
        'Full Moon', 'Waning Gibbous', 'Third Quarter', 'Waning Crescent',
      ]).toContain(phaseInfo.phase.name);
    });

    it('should return full moon for full moon date', () => {
      const phaseInfo = Moon.getPhase(fullMoonDate);

      expect(phaseInfo.phase.name).toBe('Full Moon');
    });

    it('should return new moon for new moon date', () => {
      const phaseInfo = Moon.getPhase(newMoonDate);

      expect(phaseInfo.phase.name).toBe('New Moon');
    });
  });

  describe('moon times', () => {
    it('should return moon times for a location', () => {
      const observer = new GroundStation({
        lat: 40.7 as Degrees,
        lon: -74.0 as Degrees,
        alt: 0 as Kilometers,
      });
      const times = Moon.getMoonTimes(testDate, observer);

      // Should have rise, set, or both (depending on date/location)
      expect(times).toHaveProperty('rise');
      expect(times).toHaveProperty('set');
    });
  });

  describe('libration', () => {
    it('should return libration values', () => {
      const libration = Moon.getLibration(testDate);

      expect(libration).toHaveProperty('elat');
      expect(libration).toHaveProperty('elon');
      expect(typeof libration.elat).toBe('number');
      expect(typeof libration.elon).toBe('number');
    });

    it('should return libration within expected range', () => {
      const libration = Moon.getLibration(testDate);

      // Libration is typically ±8° in longitude and ±7° in latitude
      expect(Math.abs(libration.elon)).toBeLessThan(10);
      expect(Math.abs(libration.elat)).toBeLessThan(10);
    });
  });

  describe('serialization', () => {
    it('should serialize to object', () => {
      const serialized = Moon.serialize();

      expect(serialized).toHaveProperty('id', 10);
      expect(serialized).toHaveProperty('name', 'Moon');
      expect(serialized).toHaveProperty('bodyType', CelestialBodyType.MOON);
    });
  });

  describe('name and id', () => {
    it('should have Moon name and id', () => {
      expect(Moon.name).toBe('Moon');
      expect(Moon.id).toBe(10);
    });
  });
});
