/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import {
  calculateFspl,
  calculatePropagationDelay,
  Dbm,
  dbmToDbw,
  Dbw,
  dbwToDbm,
  dbwToWatts,
  Hertz,
  SPEED_OF_LIGHT_KM_S,
  wattsToDbw,
  Watts,
} from '../../main';

describe('CommTypes utilities', () => {
  describe('wattsToDbw', () => {
    it('should convert 1 watt to 0 dBW', () => {
      expect(wattsToDbw(1 as Watts)).toBeCloseTo(0, 5);
    });

    it('should convert 10 watts to 10 dBW', () => {
      expect(wattsToDbw(10 as Watts)).toBeCloseTo(10, 5);
    });

    it('should convert 1000 watts to 30 dBW', () => {
      expect(wattsToDbw(1000 as Watts)).toBeCloseTo(30, 5);
    });

    it('should convert 0.001 watts to -30 dBW', () => {
      expect(wattsToDbw(0.001 as Watts)).toBeCloseTo(-30, 5);
    });
  });

  describe('dbwToWatts', () => {
    it('should convert 0 dBW to 1 watt', () => {
      expect(dbwToWatts(0 as Dbw)).toBeCloseTo(1, 5);
    });

    it('should convert 10 dBW to 10 watts', () => {
      expect(dbwToWatts(10 as Dbw)).toBeCloseTo(10, 5);
    });

    it('should convert 30 dBW to 1000 watts', () => {
      expect(dbwToWatts(30 as Dbw)).toBeCloseTo(1000, 1);
    });

    it('should convert -30 dBW to 0.001 watts', () => {
      expect(dbwToWatts(-30 as Dbw)).toBeCloseTo(0.001, 6);
    });
  });

  describe('dbmToDbw', () => {
    it('should convert 0 dBm to -30 dBW', () => {
      expect(dbmToDbw(0 as Dbm)).toBe(-30);
    });

    it('should convert 30 dBm to 0 dBW', () => {
      expect(dbmToDbw(30 as Dbm)).toBe(0);
    });
  });

  describe('dbwToDbm', () => {
    it('should convert 0 dBW to 30 dBm', () => {
      expect(dbwToDbm(0 as Dbw)).toBe(30);
    });

    it('should convert -30 dBW to 0 dBm', () => {
      expect(dbwToDbm(-30 as Dbw)).toBe(0);
    });
  });

  describe('round-trip conversions', () => {
    it('should round-trip watts to dBW and back', () => {
      const original = 42 as Watts;
      const dbw = wattsToDbw(original);
      const restored = dbwToWatts(dbw);

      expect(restored).toBeCloseTo(original, 5);
    });

    it('should round-trip dBm to dBW and back', () => {
      const original = 15 as Dbm;
      const dbw = dbmToDbw(original);
      const restored = dbwToDbm(dbw);

      expect(restored).toBe(original);
    });
  });

  describe('calculateFspl', () => {
    it('should calculate FSPL for GEO distance at Ku-band', () => {
      // GEO is ~36000 km, Ku-band is ~12 GHz
      const fspl = calculateFspl(36000, 12e9 as Hertz);

      // Expected FSPL for GEO at 12 GHz is approximately 205-207 dB
      expect(fspl).toBeGreaterThan(200);
      expect(fspl).toBeLessThan(210);
    });

    it('should calculate FSPL for LEO distance at S-band', () => {
      // LEO is ~500 km, S-band is ~2 GHz
      const fspl = calculateFspl(500, 2e9 as Hertz);

      // Expected FSPL for LEO at 2 GHz is approximately 150-155 dB
      // 20*log10(500) + 20*log10(2e9) - 87.55 ≈ 152.45 dB
      expect(fspl).toBeGreaterThan(150);
      expect(fspl).toBeLessThan(155);
    });

    it('should increase with distance', () => {
      const freq = 10e9 as Hertz;
      const fspl1000 = calculateFspl(1000, freq);
      const fspl2000 = calculateFspl(2000, freq);

      // Doubling distance should add ~6 dB (20*log10(2))
      expect(fspl2000 - fspl1000).toBeCloseTo(6, 1);
    });

    it('should increase with frequency', () => {
      const distance = 1000;
      const fspl10GHz = calculateFspl(distance, 10e9 as Hertz);
      const fspl20GHz = calculateFspl(distance, 20e9 as Hertz);

      // Doubling frequency should add ~6 dB (20*log10(2))
      expect(fspl20GHz - fspl10GHz).toBeCloseTo(6, 1);
    });
  });

  describe('calculatePropagationDelay', () => {
    it('should calculate correct delay for GEO distance', () => {
      // GEO is ~36000 km
      const delay = calculatePropagationDelay(36000);

      // Light travel time: 36000 / 299792.458 ≈ 0.12 seconds
      expect(delay).toBeCloseTo(0.12, 2);
    });

    it('should calculate correct delay for LEO distance', () => {
      // LEO is ~500 km
      const delay = calculatePropagationDelay(500);

      // Light travel time: 500 / 299792.458 ≈ 0.0017 seconds
      expect(delay).toBeCloseTo(0.00167, 4);
    });

    it('should scale linearly with distance', () => {
      const delay1000 = calculatePropagationDelay(1000);
      const delay2000 = calculatePropagationDelay(2000);

      expect(delay2000).toBeCloseTo(delay1000 * 2, 6);
    });
  });

  describe('SPEED_OF_LIGHT_KM_S', () => {
    it('should be approximately 299792 km/s', () => {
      expect(SPEED_OF_LIGHT_KM_S).toBeCloseTo(299792.458, 0);
    });
  });
});
