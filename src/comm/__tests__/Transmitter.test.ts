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
  ModulationType,
  Transmitter,
  ValidationError,
  Watts,
  wattsToDbw,
} from '../../main';

describe('Transmitter', () => {
  const createTestTransmitter = (overrides = {}): Transmitter => new Transmitter({
    id: 1003,
    name: 'Test Transmitter',
    frequency: 14e9 as Hertz,
    power: 1000 as Watts,
    bandwidth: 36e6 as Hertz,
    antenna: new Antenna({ gain: 45 as Decibels }),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a transmitter with required parameters', () => {
      const tx = createTestTransmitter();

      expect(tx.id).toBe(1003);
      expect(tx.name).toBe('Test Transmitter');
      expect(tx.frequency).toBe(14e9);
      expect(tx.power).toBe(1000);
      expect(tx.bandwidth).toBe(36e6);
      expect(tx.antenna.gain).toBe(45);
      expect(tx.lineLoss).toBe(0);
    });

    it('should create a transmitter with all parameters', () => {
      const tx = createTestTransmitter({
        modulation: ModulationType.QPSK,
        lineLoss: 2 as Decibels,
        metadata: { custom: 'data' },
      });

      expect(tx.modulation).toBe(ModulationType.QPSK);
      expect(tx.lineLoss).toBe(2);
      expect(tx.metadata).toEqual({ custom: 'data' });
    });

    it('should throw on non-positive power', () => {
      expect(() => createTestTransmitter({ power: 0 as Watts })).toThrow(ValidationError);
      expect(() => createTestTransmitter({ power: -10 as Watts })).toThrow(ValidationError);
    });

    it('should throw on non-positive frequency', () => {
      expect(() => createTestTransmitter({ frequency: 0 as Hertz })).toThrow(ValidationError);
      expect(() => createTestTransmitter({ frequency: -1e9 as Hertz })).toThrow(ValidationError);
    });

    it('should throw on non-positive bandwidth', () => {
      expect(() => createTestTransmitter({ bandwidth: 0 as Hertz })).toThrow(ValidationError);
      expect(() => createTestTransmitter({ bandwidth: -1e6 as Hertz })).toThrow(ValidationError);
    });
  });

  describe('properties', () => {
    it('should return correct device type', () => {
      const tx = createTestTransmitter();

      expect(tx.deviceType).toBe(CommDeviceType.TRANSMITTER);
    });

    it('should calculate EIRP correctly', () => {
      const tx = createTestTransmitter({
        power: 1000 as Watts, // 30 dBW
        antenna: new Antenna({ gain: 45 as Decibels }),
        lineLoss: 2 as Decibels,
      });

      // EIRP = 30 dBW + 45 dB - 2 dB = 73 dBW
      const expectedEirp = wattsToDbw(1000 as Watts) + 45 - 2;

      expect(tx.eirp).toBeCloseTo(expectedEirp, 1);
    });

    it('should calculate wavelength correctly', () => {
      const tx = createTestTransmitter({
        frequency: 3e8 as Hertz, // 300 MHz for easy calculation
      });

      // wavelength = c / f = 3e8 / 3e8 = 1 meter
      expect(tx.wavelength).toBeCloseTo(1, 1);
    });
  });

  describe('hasParent', () => {
    it('should return false when no parent is set', () => {
      const tx = createTestTransmitter();

      expect(tx.hasParent()).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize correctly', () => {
      const tx = createTestTransmitter({
        modulation: ModulationType.BPSK,
        lineLoss: 1.5 as Decibels,
      });

      const serialized = tx.serialize();

      expect(serialized.type).toBe('Transmitter');
      expect(serialized.id).toBe(1003);
      expect(serialized.name).toBe('Test Transmitter');
      expect(serialized.deviceType).toBe(CommDeviceType.TRANSMITTER);
      expect(serialized.frequency).toBe(14e9);
      expect(serialized.power).toBe(1000);
      expect(serialized.bandwidth).toBe(36e6);
      expect(serialized.modulation).toBe(ModulationType.BPSK);
      expect(serialized.lineLoss).toBe(1.5);
      expect(serialized.antenna).toBeDefined();
    });

    it('should deserialize correctly', () => {
      const original = createTestTransmitter({
        modulation: ModulationType.QPSK,
        lineLoss: 2 as Decibels,
      });

      const serialized = original.serialize();
      const restored = Transmitter.deserialize(serialized);

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.frequency).toBe(original.frequency);
      expect(restored.power).toBe(original.power);
      expect(restored.bandwidth).toBe(original.bandwidth);
      expect(restored.modulation).toBe(original.modulation);
      expect(restored.lineLoss).toBe(original.lineLoss);
      expect(restored.antenna.gain).toBe(original.antenna.gain);
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      const tx = createTestTransmitter({
        modulation: ModulationType.QPSK,
      });

      const str = tx.toString();

      expect(str).toContain('[Transmitter]');
      expect(str).toContain('1003');
      expect(str).toContain('14.000 GHz');
      expect(str).toContain('QPSK');
    });
  });
});
