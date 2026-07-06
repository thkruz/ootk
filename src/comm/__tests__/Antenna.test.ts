/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import { Antenna, Decibels, ValidationError } from '../../main';

describe('Antenna', () => {
  describe('constructor', () => {
    it('should create an antenna with basic parameters', () => {
      const antenna = new Antenna({
        gain: 30 as Decibels,
      });

      expect(antenna.gain).toBe(30);
      expect(antenna.efficiency).toBe(0.55); // default
      expect(antenna.beamwidth).toBeUndefined();
    });

    it('should create an antenna with all parameters', () => {
      const antenna = new Antenna({
        gain: 45 as Decibels,
        beamwidth: 2.5,
        efficiency: 0.65,
      });

      expect(antenna.gain).toBe(45);
      expect(antenna.beamwidth).toBe(2.5);
      expect(antenna.efficiency).toBe(0.65);
    });

    it('should throw on invalid efficiency', () => {
      expect(() => new Antenna({
        gain: 30 as Decibels,
        efficiency: -0.1,
      })).toThrow(ValidationError);

      expect(() => new Antenna({
        gain: 30 as Decibels,
        efficiency: 1.5,
      })).toThrow(ValidationError);
    });
  });

  describe('factory methods', () => {
    it('should create omnidirectional antenna', () => {
      const antenna = Antenna.omnidirectional();

      expect(antenna.gain).toBe(0);
      expect(antenna.beamwidth).toBe(360);
      expect(antenna.efficiency).toBe(1);
    });

    it('should create antenna from dish diameter', () => {
      // 3m dish at 12 GHz should have approximately 45 dB gain
      const antenna = Antenna.fromDishDiameter(3, 12e9, 0.55);

      // Check gain is in reasonable range for 3m dish at Ku-band
      expect(antenna.gain).toBeGreaterThan(40);
      expect(antenna.gain).toBeLessThan(50);
      expect(antenna.beamwidth).toBeDefined();
      expect(antenna.beamwidth).toBeGreaterThan(0);
    });
  });

  describe('getOffAxisLoss', () => {
    it('should return zero loss for omnidirectional antenna', () => {
      const antenna = Antenna.omnidirectional();

      expect(antenna.getOffAxisLoss(45)).toBe(0);
      expect(antenna.getOffAxisLoss(90)).toBe(0);
    });

    it('should return -3 dB at half-power beamwidth', () => {
      const antenna = new Antenna({
        gain: 30 as Decibels,
        beamwidth: 10, // 10 degree beamwidth
      });

      // At 5 degrees (half of 10 degree beamwidth), loss should be -3 dB
      const loss = antenna.getOffAxisLoss(5);

      expect(loss).toBeCloseTo(-3, 1);
    });

    it('should increase loss for larger off-axis angles', () => {
      const antenna = new Antenna({
        gain: 30 as Decibels,
        beamwidth: 10,
      });

      const loss5 = antenna.getOffAxisLoss(5);
      const loss10 = antenna.getOffAxisLoss(10);

      expect(loss10).toBeLessThan(loss5);
    });
  });

  describe('getEffectiveGain', () => {
    it('should return full gain on boresight', () => {
      const antenna = new Antenna({
        gain: 45 as Decibels,
        beamwidth: 2,
      });

      expect(antenna.getEffectiveGain(0)).toBe(45);
    });

    it('should return reduced gain off-axis', () => {
      const antenna = new Antenna({
        gain: 45 as Decibels,
        beamwidth: 2,
      });

      const effectiveGain = antenna.getEffectiveGain(1);

      expect(effectiveGain).toBeLessThan(45);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize correctly', () => {
      const original = new Antenna({
        gain: 42 as Decibels,
        beamwidth: 3.5,
        efficiency: 0.6,
      });

      const serialized = original.serialize();
      const restored = Antenna.deserialize(serialized);

      expect(restored.gain).toBe(original.gain);
      expect(restored.beamwidth).toBe(original.beamwidth);
      expect(restored.efficiency).toBe(original.efficiency);
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      const antenna = new Antenna({
        gain: 30 as Decibels,
        beamwidth: 5,
        efficiency: 0.6,
      });

      const str = antenna.toString();

      expect(str).toContain('[Antenna]');
      expect(str).toContain('30.0 dB');
      expect(str).toContain('5.0°');
      expect(str).toContain('60%');
    });
  });
});
