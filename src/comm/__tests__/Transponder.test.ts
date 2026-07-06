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
  Transponder,
  ValidationError,
  Watts,
} from '../../main';

describe('Transponder', () => {
  const createTestTransponder = (overrides = {}): Transponder => new Transponder({
    id: 1004,
    name: 'Test Transponder',
    uplinkFrequency: 14e9 as Hertz,
    downlinkFrequency: 12e9 as Hertz,
    power: 50 as Watts,
    bandwidth: 36e6 as Hertz,
    uplinkAntenna: new Antenna({ gain: 30 as Decibels }),
    downlinkAntenna: new Antenna({ gain: 30 as Decibels }),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a transponder with required parameters', () => {
      const xponder = createTestTransponder();

      expect(xponder.id).toBe(1004);
      expect(xponder.name).toBe('Test Transponder');
      expect(xponder.uplinkFrequency).toBe(14e9);
      expect(xponder.downlinkFrequency).toBe(12e9);
      expect(xponder.power).toBe(50);
      expect(xponder.bandwidth).toBe(36e6);
      expect(xponder.delay).toBe(0);
    });

    it('should create a transponder with all parameters', () => {
      const xponder = createTestTransponder({
        noiseFigure: 4 as Decibels,
        delay: 0.01,
        transponderGain: 110 as Decibels,
        metadata: { custom: 'data' },
      });

      expect(xponder.receiver.noiseFigure).toBe(4);
      expect(xponder.delay).toBe(0.01);
      expect(xponder.transponderGain).toBe(110);
      expect(xponder.metadata).toEqual({ custom: 'data' });
    });

    it('should create internal receiver and transmitter', () => {
      const xponder = createTestTransponder();

      expect(xponder.receiver).toBeDefined();
      expect(xponder.transmitter).toBeDefined();
      expect(xponder.receiver.id).toBe(1004001);
      expect(xponder.transmitter.id).toBe(1004002);
    });

    it('should throw on non-positive power', () => {
      expect(() => createTestTransponder({ power: 0 as Watts })).toThrow(ValidationError);
      expect(() => createTestTransponder({ power: -10 as Watts })).toThrow(ValidationError);
    });

    it('should throw on non-positive frequencies', () => {
      expect(() => createTestTransponder({ uplinkFrequency: 0 as Hertz })).toThrow(ValidationError);
      expect(() => createTestTransponder({ downlinkFrequency: 0 as Hertz })).toThrow(ValidationError);
    });

    it('should throw on non-positive bandwidth', () => {
      expect(() => createTestTransponder({ bandwidth: 0 as Hertz })).toThrow(ValidationError);
    });
  });

  describe('properties', () => {
    it('should return correct device type', () => {
      const xponder = createTestTransponder();

      expect(xponder.deviceType).toBe(CommDeviceType.TRANSPONDER);
    });

    it('should calculate frequency offset correctly', () => {
      const xponder = createTestTransponder({
        uplinkFrequency: 14e9 as Hertz,
        downlinkFrequency: 12e9 as Hertz,
      });

      // Offset = 12e9 - 14e9 = -2e9 Hz
      expect(xponder.frequencyOffset).toBe(-2e9);
    });

    it('should expose internal component properties', () => {
      const xponder = createTestTransponder({
        uplinkFrequency: 14e9 as Hertz,
        downlinkFrequency: 12e9 as Hertz,
        power: 50 as Watts,
        bandwidth: 36e6 as Hertz,
      });

      expect(xponder.uplinkFrequency).toBe(14e9);
      expect(xponder.downlinkFrequency).toBe(12e9);
      expect(xponder.power).toBe(50);
      expect(xponder.bandwidth).toBe(36e6);
    });
  });

  describe('hasParent', () => {
    it('should return false when no parent is set', () => {
      const xponder = createTestTransponder();

      expect(xponder.hasParent()).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize correctly', () => {
      const xponder = createTestTransponder({
        delay: 0.01,
        transponderGain: 100 as Decibels,
      });

      const serialized = xponder.serialize();

      expect(serialized.type).toBe('Transponder');
      expect(serialized.id).toBe(1004);
      expect(serialized.name).toBe('Test Transponder');
      expect(serialized.deviceType).toBe(CommDeviceType.TRANSPONDER);
      expect(serialized.uplinkFrequency).toBe(14e9);
      expect(serialized.downlinkFrequency).toBe(12e9);
      expect(serialized.power).toBe(50);
      expect(serialized.bandwidth).toBe(36e6);
      expect(serialized.delay).toBe(0.01);
      expect(serialized.transponderGain).toBe(100);
      expect(serialized.uplinkAntenna).toBeDefined();
      expect(serialized.downlinkAntenna).toBeDefined();
    });

    it('should deserialize correctly', () => {
      const original = createTestTransponder({
        delay: 0.02,
        transponderGain: 105 as Decibels,
      });

      const serialized = original.serialize();
      const restored = Transponder.deserialize(serialized);

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.uplinkFrequency).toBe(original.uplinkFrequency);
      expect(restored.downlinkFrequency).toBe(original.downlinkFrequency);
      expect(restored.power).toBe(original.power);
      expect(restored.bandwidth).toBe(original.bandwidth);
      expect(restored.delay).toBe(original.delay);
      expect(restored.transponderGain).toBe(original.transponderGain);
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      const xponder = createTestTransponder({
        delay: 0.01,
      });

      const str = xponder.toString();

      expect(str).toContain('[Transponder]');
      expect(str).toContain('1004');
      expect(str).toContain('14.000 GHz'); // uplink
      expect(str).toContain('12.000 GHz'); // downlink
      expect(str).toContain('36.0 MHz'); // bandwidth
      expect(str).toContain('50.0 W'); // power
      expect(str).toContain('10.0 ms'); // delay
    });
  });
});
