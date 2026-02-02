/**
 * Integration test: Moon position and calculations
 * Migrated from examples/moon.ts
 */
import {
  Degrees,
  GroundObject,
  Kilometers,
  Moon,
  calcGmst,
  eci2lla,
} from '../../dist/main.js';

describe('Moon Calculations', () => {
  const date = new Date('2024-01-28T12:00:00.000Z');
  const lunarRadius = 1737.4 as Kilometers;

  describe('Moon Position', () => {
    it('should return Moon position in ECI coordinates', () => {
      const moonPos = Moon.eci(date);

      expect(moonPos).toBeDefined();
      expect(moonPos.x).toBeDefined();
      expect(moonPos.y).toBeDefined();
      expect(moonPos.z).toBeDefined();
    });

    it('should return Moon at reasonable distance from Earth', () => {
      const moonPos = Moon.eci(date);
      const distance = Math.sqrt(
        moonPos.x ** 2 +
        moonPos.y ** 2 +
        moonPos.z ** 2,
      );

      // Moon distance varies between ~356,500 km and ~406,700 km
      expect(distance).toBeGreaterThan(350000);
      expect(distance).toBeLessThan(420000);
    });

    it('should calculate sub-lunar point', () => {
      const moonPos = Moon.eci(date);
      const gmst = calcGmst(date);
      const moonLla = eci2lla(moonPos, gmst.gmst);

      // Latitude should be within valid range
      expect(moonLla.lat).toBeGreaterThanOrEqual(-90);
      expect(moonLla.lat).toBeLessThanOrEqual(90);

      // Longitude should be within valid range
      expect(moonLla.lon).toBeGreaterThanOrEqual(-180);
      expect(moonLla.lon).toBeLessThanOrEqual(180);
    });
  });

  describe('Moon Rise/Set Times', () => {
    const observer = new GroundObject({
      lat: 41 as Degrees,
      lon: -71 as Degrees,
      alt: 0 as Kilometers,
      name: 'Test Observer',
    });

    it('should calculate Moon times for a given location', () => {
      const moonTimes = Moon.getMoonTimes(date, observer);

      expect(moonTimes).toBeDefined();
      // Rise and set may be null if Moon doesn't rise/set that day
    });

    it('should return rise time as Date or null', () => {
      const moonTimes = Moon.getMoonTimes(date, observer);

      if (moonTimes.rise !== null) {
        expect(moonTimes.rise).toBeInstanceOf(Date);
      }
    });

    it('should return set time as Date or null', () => {
      const moonTimes = Moon.getMoonTimes(date, observer);

      if (moonTimes.set !== null) {
        expect(moonTimes.set).toBeInstanceOf(Date);
      }
    });
  });

  describe('Moon Illumination', () => {
    it('should return illumination fraction', () => {
      const fraction = Moon.getIlluminationFraction(date);

      expect(fraction).toBeDefined();
      expect(typeof fraction).toBe('number');
    });

    it('should have fraction between 0 and 1', () => {
      const fraction = Moon.getIlluminationFraction(date);

      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThanOrEqual(1);
    });

    it('should return phase info', () => {
      const phaseInfo = Moon.getPhase(date);

      expect(phaseInfo).toBeDefined();
      expect(phaseInfo.fraction).toBeDefined();
      expect(phaseInfo.phase).toBeDefined();
      expect(phaseInfo.phaseValue).toBeDefined();
    });

    it('should have phaseValue between 0 and 1', () => {
      const phaseInfo = Moon.getPhase(date);

      expect(phaseInfo.phaseValue).toBeGreaterThanOrEqual(0);
      expect(phaseInfo.phaseValue).toBeLessThanOrEqual(1);
    });

    it('should have valid phase angle', () => {
      const phaseAngle = Moon.getPhaseAngle(date);

      // Phase angle in degrees (0 = new moon, 90 = first quarter, 180 = full moon, 270 = third quarter)
      expect(phaseAngle).toBeGreaterThanOrEqual(0);
      expect(phaseAngle).toBeLessThan(360);
    });
  });

  describe('Moon Angular Size', () => {
    it('should have reasonable angular diameter', () => {
      const moonPos = Moon.eci(date);
      const distance = Math.sqrt(
        moonPos.x ** 2 +
        moonPos.y ** 2 +
        moonPos.z ** 2,
      );

      const angularDiameterRad = 2 * Math.atan(lunarRadius / distance);
      const angularDiameterArcmin = angularDiameterRad * (180 / Math.PI) * 60;

      // Moon angular diameter is about 29.3 to 34.1 arcminutes
      expect(angularDiameterArcmin).toBeGreaterThan(29);
      expect(angularDiameterArcmin).toBeLessThan(35);
    });
  });

  describe('Moon Position Over Time', () => {
    it('should show Moon position changes throughout the day', () => {
      const positions: { distance: number; lat: number; lon: number }[] = [];

      for (let hour = 0; hour < 24; hour += 6) {
        const timePoint = new Date(date.getTime());

        timePoint.setUTCHours(hour, 0, 0, 0);

        const moonPos = Moon.eci(timePoint);
        const dist = Math.sqrt(
          moonPos.x ** 2 +
          moonPos.y ** 2 +
          moonPos.z ** 2,
        );

        const gmstTime = calcGmst(timePoint);
        const lla = eci2lla(moonPos, gmstTime.gmst);

        positions.push({ distance: dist, lat: lla.lat, lon: lla.lon });
      }

      // Should have 4 positions
      expect(positions.length).toBe(4);

      // All distances should be reasonable
      positions.forEach((pos) => {
        expect(pos.distance).toBeGreaterThan(350000);
        expect(pos.distance).toBeLessThan(420000);
      });

      // Sub-lunar point longitude should change throughout the day
      const lonDiff = Math.abs(positions[0].lon - positions[3].lon);

      expect(lonDiff).toBeGreaterThan(0);
    });
  });

  describe('Finding Full Moon', () => {
    it('should find a full moon within 60 days', () => {
      const startDate = new Date('2024-01-01T00:00:00.000Z');
      let fullMoonFound = false;

      for (let day = 0; day < 60; day++) {
        const checkDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
        const phaseInfo = Moon.getPhase(checkDate);

        // Full moon is when phaseValue is closest to 0.5
        if (Math.abs(phaseInfo.phaseValue - 0.5) < 0.02) {
          fullMoonFound = true;
          expect(phaseInfo.fraction).toBeGreaterThan(0.95); // High illumination at full moon
          break;
        }
      }

      expect(fullMoonFound).toBe(true);
    });
  });
});
