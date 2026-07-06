/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import {
  Antenna,
  CommDeviceType,
  Decibels,
  Hertz,
  Receiver,
  ValidationError,
} from '../../main';

describe('Receiver', () => {
  const createTestReceiver = (overrides = {}): Receiver => new Receiver({
    id: 1002,
    name: 'Test Receiver',
    frequency: 12e9 as Hertz,
    bandwidth: 36e6 as Hertz,
    noiseFigure: 1.5 as Decibels,
    minimumSnr: 10 as Decibels,
    antenna: new Antenna({ gain: 45 as Decibels }),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a receiver with required parameters', () => {
      const rx = createTestReceiver();

      expect(rx.id).toBe(1002);
      expect(rx.name).toBe('Test Receiver');
      expect(rx.frequency).toBe(12e9);
      expect(rx.bandwidth).toBe(36e6);
      expect(rx.noiseFigure).toBe(1.5);
      expect(rx.minimumSnr).toBe(10);
      expect(rx.antenna.gain).toBe(45);
      expect(rx.lineLoss).toBe(0);
    });

    it('should create a receiver with all parameters', () => {
      const rx = createTestReceiver({
        lineLoss: 1 as Decibels,
        metadata: { custom: 'data' },
      });

      expect(rx.lineLoss).toBe(1);
      expect(rx.metadata).toEqual({ custom: 'data' });
    });

    it('should throw on non-positive frequency', () => {
      expect(() => createTestReceiver({ frequency: 0 as Hertz })).toThrow(ValidationError);
      expect(() => createTestReceiver({ frequency: -1e9 as Hertz })).toThrow(ValidationError);
    });

    it('should throw on non-positive bandwidth', () => {
      expect(() => createTestReceiver({ bandwidth: 0 as Hertz })).toThrow(ValidationError);
      expect(() => createTestReceiver({ bandwidth: -1e6 as Hertz })).toThrow(ValidationError);
    });

    it('should throw on negative noise figure', () => {
      expect(() => createTestReceiver({ noiseFigure: -1 as Decibels })).toThrow(ValidationError);
    });

    it('should allow zero noise figure', () => {
      const rx = createTestReceiver({ noiseFigure: 0 as Decibels });

      expect(rx.noiseFigure).toBe(0);
    });
  });

  describe('properties', () => {
    it('should return correct device type', () => {
      const rx = createTestReceiver();

      expect(rx.deviceType).toBe(CommDeviceType.RECEIVER);
    });

    it('should calculate noise floor correctly', () => {
      const rx = createTestReceiver({
        bandwidth: 1e6 as Hertz, // 1 MHz for easier calculation
        noiseFigure: 3 as Decibels,
      });

      // Noise floor = -204 + 10*log10(1e6) + 3 = -204 + 60 + 3 = -141 dBW
      expect(rx.noiseFloor).toBeCloseTo(-141, 0);
    });

    it('should calculate system temperature correctly', () => {
      const rx = createTestReceiver({
        noiseFigure: 3 as Decibels,
      });

      // T_sys = 290 * 10^(3/10) ≈ 290 * 2 = 580 K
      expect(rx.systemTemperature).toBeCloseTo(580, -1);
    });

    it('should calculate G/T correctly', () => {
      const rx = createTestReceiver({
        antenna: new Antenna({ gain: 45 as Decibels }),
        noiseFigure: 3 as Decibels,
      });

      // G/T = 45 - 10*log10(580) ≈ 45 - 27.6 = 17.4 dB/K
      expect(rx.gOverT).toBeCloseTo(17.4, 0);
    });
  });

  describe('isFrequencyCompatible', () => {
    it('should return true for matching frequency', () => {
      const rx = createTestReceiver({
        frequency: 12e9 as Hertz,
        bandwidth: 36e6 as Hertz,
      });

      // Create a mock transmitter object with matching frequency
      const mockTx = {
        frequency: 12e9 as Hertz,
      };

      expect(rx.isFrequencyCompatible(mockTx as any)).toBe(true);
    });

    it('should return true for frequency within bandwidth', () => {
      const rx = createTestReceiver({
        frequency: 12e9 as Hertz,
        bandwidth: 36e6 as Hertz,
      });

      // Transmitter 10 MHz off center should still be compatible
      const mockTx = {
        frequency: (12e9 + 10e6) as Hertz,
      };

      expect(rx.isFrequencyCompatible(mockTx as any)).toBe(true);
    });

    it('should return false for frequency outside bandwidth', () => {
      const rx = createTestReceiver({
        frequency: 12e9 as Hertz,
        bandwidth: 36e6 as Hertz,
      });

      // Transmitter 100 MHz off center should not be compatible
      const mockTx = {
        frequency: (12e9 + 100e6) as Hertz,
      };

      expect(rx.isFrequencyCompatible(mockTx as any)).toBe(false);
    });
  });

  describe('hasParent', () => {
    it('should return false when no parent is set', () => {
      const rx = createTestReceiver();

      expect(rx.hasParent()).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize correctly', () => {
      const rx = createTestReceiver({
        lineLoss: 1.5 as Decibels,
      });

      const serialized = rx.serialize();

      expect(serialized.type).toBe('Receiver');
      expect(serialized.id).toBe(1002);
      expect(serialized.name).toBe('Test Receiver');
      expect(serialized.deviceType).toBe(CommDeviceType.RECEIVER);
      expect(serialized.frequency).toBe(12e9);
      expect(serialized.bandwidth).toBe(36e6);
      expect(serialized.noiseFigure).toBe(1.5);
      expect(serialized.minimumSnr).toBe(10);
      expect(serialized.lineLoss).toBe(1.5);
      expect(serialized.antenna).toBeDefined();
    });

    it('should deserialize correctly', () => {
      const original = createTestReceiver({
        lineLoss: 2 as Decibels,
      });

      const serialized = original.serialize();
      const restored = Receiver.deserialize(serialized);

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.frequency).toBe(original.frequency);
      expect(restored.bandwidth).toBe(original.bandwidth);
      expect(restored.noiseFigure).toBe(original.noiseFigure);
      expect(restored.minimumSnr).toBe(original.minimumSnr);
      expect(restored.lineLoss).toBe(original.lineLoss);
      expect(restored.antenna.gain).toBe(original.antenna.gain);
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      const rx = createTestReceiver();

      const str = rx.toString();

      expect(str).toContain('[Receiver]');
      expect(str).toContain('1002');
      expect(str).toContain('12.000 GHz');
      expect(str).toContain('36.0 MHz');
      expect(str).toContain('1.5 dB'); // noise figure
      expect(str).toContain('G/T');
    });
  });
});
