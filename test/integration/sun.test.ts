/**
 * Integration test: Sun position and calculations
 * Migrated from examples/sun.ts
 */
import {
  Degrees,
  Meters,
  Sun,
} from '../../dist/main.js';

describe('Sun Calculations', () => {
  const date = new Date('2024-01-28T12:00:00.000Z');
  const observerLat = 41 as Degrees;
  const observerLon = -71 as Degrees;
  const observerAlt = 0 as Meters;

  describe('Sun Times', () => {
    it('should return sun times for a given location', () => {
      const sunTimes = Sun.getTimes(date, observerLat, observerLon, observerAlt);

      expect(sunTimes).toBeDefined();
    });

    it('should have sunriseStart time', () => {
      const sunTimes = Sun.getTimes(date, observerLat, observerLon, observerAlt);

      expect(sunTimes.sunriseStart).toBeDefined();
      expect(sunTimes.sunriseStart).toBeInstanceOf(Date);
    });

    it('should have sunsetEnd time', () => {
      const sunTimes = Sun.getTimes(date, observerLat, observerLon, observerAlt);

      expect(sunTimes.sunsetEnd).toBeDefined();
      expect(sunTimes.sunsetEnd).toBeInstanceOf(Date);
    });

    it('should have sunrise before sunset', () => {
      const sunTimes = Sun.getTimes(date, observerLat, observerLon, observerAlt);

      expect(sunTimes.sunriseStart.getTime()).toBeLessThan(sunTimes.sunsetEnd.getTime());
    });

    it('should have civil dawn before sunrise', () => {
      const sunTimes = Sun.getTimes(date, observerLat, observerLon, observerAlt);

      expect(sunTimes.civilDawn.getTime()).toBeLessThan(sunTimes.sunriseStart.getTime());
    });

    it('should have civil dusk after sunset', () => {
      const sunTimes = Sun.getTimes(date, observerLat, observerLon, observerAlt);

      expect(sunTimes.civilDusk.getTime()).toBeGreaterThan(sunTimes.sunsetEnd.getTime());
    });
  });

  describe('Sun Position at Different Latitudes', () => {
    it('should calculate sun times for equatorial location', () => {
      const equatorLat = 0 as Degrees;
      const equatorLon = 0 as Degrees;

      const sunTimes = Sun.getTimes(date, equatorLat, equatorLon, observerAlt);

      expect(sunTimes).toBeDefined();
      expect(sunTimes.sunriseStart).toBeDefined();
      expect(sunTimes.sunsetEnd).toBeDefined();
    });

    it('should calculate sun times for northern latitude', () => {
      const northLat = 60 as Degrees;
      const sunTimes = Sun.getTimes(date, northLat, observerLon, observerAlt);

      expect(sunTimes).toBeDefined();
    });

    it('should calculate sun times for southern latitude', () => {
      const southLat = -35 as Degrees;
      const sunTimes = Sun.getTimes(date, southLat, observerLon, observerAlt);

      expect(sunTimes).toBeDefined();
    });
  });

  describe('Sun Times Throughout Year', () => {
    it('should show day length variation through the year', () => {
      const dates = [
        new Date('2024-03-21T12:00:00.000Z'), // Spring equinox
        new Date('2024-06-21T12:00:00.000Z'), // Summer solstice
        new Date('2024-09-21T12:00:00.000Z'), // Fall equinox
        new Date('2024-12-21T12:00:00.000Z'), // Winter solstice
      ];

      const dayLengths: number[] = [];

      dates.forEach((d) => {
        const times = Sun.getTimes(d, observerLat, observerLon, observerAlt);
        const dayLength = (times.sunsetEnd.getTime() - times.sunriseStart.getTime()) / (1000 * 60 * 60);

        dayLengths.push(dayLength);
      });

      // For northern hemisphere:
      // Summer solstice should have longest day
      // Winter solstice should have shortest day
      expect(dayLengths[1]).toBeGreaterThan(dayLengths[3]); // Summer > Winter
      // Equinoxes should be roughly similar
      expect(Math.abs(dayLengths[0] - dayLengths[2])).toBeLessThan(1);
    });
  });
});
