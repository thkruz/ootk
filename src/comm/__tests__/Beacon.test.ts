/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import {
  Antenna,
  Beacon,
  CommDeviceType,
  Hertz,
  ModulationType,
  ValidationError,
  Watts,
} from '../../main';

describe('Beacon', () => {
  const epoch = new Date('2025-01-01T00:00:00Z');

  const createTestBeacon = (overrides = {}): Beacon => new Beacon({
    id: 1001,
    name: 'Test Beacon',
    frequency: 437e6 as Hertz,
    power: 1 as Watts,
    bandwidth: 10e3 as Hertz,
    antenna: Antenna.omnidirectional(),
    transmitInterval: 60, // 60 seconds
    transmitDuration: 5, // 5 seconds
    epoch,
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a beacon with required parameters', () => {
      const beacon = createTestBeacon();

      expect(beacon.id).toBe(1001);
      expect(beacon.name).toBe('Test Beacon');
      expect(beacon.frequency).toBe(437e6);
      expect(beacon.power).toBe(1);
      expect(beacon.bandwidth).toBe(10e3);
      expect(beacon.transmitInterval).toBe(60);
      expect(beacon.transmitDuration).toBe(5);
      expect(beacon.epoch).toEqual(epoch);
    });

    it('should create a beacon with all parameters', () => {
      const beacon = createTestBeacon({
        modulation: ModulationType.BPSK,
        messageFormat: 'AX.25',
        metadata: { custom: 'data' },
      });

      expect(beacon.modulation).toBe(ModulationType.BPSK);
      expect(beacon.messageFormat).toBe('AX.25');
      expect(beacon.metadata).toEqual({ custom: 'data' });
    });

    it('should throw on non-positive transmit interval', () => {
      expect(() => createTestBeacon({ transmitInterval: 0 })).toThrow(ValidationError);
      expect(() => createTestBeacon({ transmitInterval: -60 })).toThrow(ValidationError);
    });

    it('should throw on non-positive transmit duration', () => {
      expect(() => createTestBeacon({ transmitDuration: 0 })).toThrow(ValidationError);
      expect(() => createTestBeacon({ transmitDuration: -5 })).toThrow(ValidationError);
    });

    it('should throw when duration exceeds interval', () => {
      expect(() => createTestBeacon({
        transmitInterval: 10,
        transmitDuration: 20,
      })).toThrow(ValidationError);
    });
  });

  describe('properties', () => {
    it('should return correct device type', () => {
      const beacon = createTestBeacon();

      expect(beacon.deviceType).toBe(CommDeviceType.BEACON);
    });

    it('should calculate duty cycle correctly', () => {
      const beacon = createTestBeacon({
        transmitInterval: 60,
        transmitDuration: 6, // 10% duty cycle
      });

      expect(beacon.dutyCycle).toBeCloseTo(0.1, 5);
    });
  });

  describe('isTransmitting', () => {
    it('should return true during transmission window', () => {
      const beacon = createTestBeacon({
        transmitInterval: 60,
        transmitDuration: 5,
      });

      // At epoch (0 seconds into cycle), should be transmitting
      expect(beacon.isTransmitting(epoch)).toBe(true);

      // At epoch + 2 seconds, should still be transmitting
      const during = new Date(epoch.getTime() + 2000);

      expect(beacon.isTransmitting(during)).toBe(true);
    });

    it('should return false outside transmission window', () => {
      const beacon = createTestBeacon({
        transmitInterval: 60,
        transmitDuration: 5,
      });

      // At epoch + 10 seconds, should not be transmitting
      const after = new Date(epoch.getTime() + 10000);

      expect(beacon.isTransmitting(after)).toBe(false);

      // At epoch + 30 seconds, should not be transmitting
      const middle = new Date(epoch.getTime() + 30000);

      expect(beacon.isTransmitting(middle)).toBe(false);
    });

    it('should return true at start of next cycle', () => {
      const beacon = createTestBeacon({
        transmitInterval: 60,
        transmitDuration: 5,
      });

      // At epoch + 60 seconds (start of next cycle)
      const nextCycle = new Date(epoch.getTime() + 60000);

      expect(beacon.isTransmitting(nextCycle)).toBe(true);
    });

    it('should return false before epoch', () => {
      const beacon = createTestBeacon();

      const beforeEpoch = new Date(epoch.getTime() - 1000);

      expect(beacon.isTransmitting(beforeEpoch)).toBe(false);
    });
  });

  describe('getRemainingTransmitTime', () => {
    it('should return remaining time during transmission', () => {
      const beacon = createTestBeacon({
        transmitInterval: 60,
        transmitDuration: 5,
      });

      // At epoch + 2 seconds, should have 3 seconds remaining
      const during = new Date(epoch.getTime() + 2000);

      expect(beacon.getRemainingTransmitTime(during)).toBeCloseTo(3, 1);
    });

    it('should return 0 when not transmitting', () => {
      const beacon = createTestBeacon();

      const notTransmitting = new Date(epoch.getTime() + 10000);

      expect(beacon.getRemainingTransmitTime(notTransmitting)).toBe(0);
    });
  });

  describe('getNextTransmission', () => {
    it('should return current transmission if active', () => {
      const beacon = createTestBeacon({
        transmitInterval: 60,
        transmitDuration: 5,
      });

      const during = new Date(epoch.getTime() + 2000);
      const next = beacon.getNextTransmission(during);

      // Should return the transmission that started at epoch
      expect(next.start).toEqual(epoch);
      expect(next.end).toEqual(new Date(epoch.getTime() + 5000));
    });

    it('should return next transmission if not active', () => {
      const beacon = createTestBeacon({
        transmitInterval: 60,
        transmitDuration: 5,
      });

      const between = new Date(epoch.getTime() + 30000);
      const next = beacon.getNextTransmission(between);

      // Should return the transmission starting at epoch + 60 seconds
      expect(next.start).toEqual(new Date(epoch.getTime() + 60000));
      expect(next.end).toEqual(new Date(epoch.getTime() + 65000));
    });

    it('should return first transmission when before epoch', () => {
      const beacon = createTestBeacon();

      const beforeEpoch = new Date(epoch.getTime() - 10000);
      const next = beacon.getNextTransmission(beforeEpoch);

      expect(next.start).toEqual(epoch);
    });
  });

  describe('getTransmissionsInRange', () => {
    it('should return all transmissions in range', () => {
      const beacon = createTestBeacon({
        transmitInterval: 60,
        transmitDuration: 5,
      });

      const start = epoch;
      const end = new Date(epoch.getTime() + 180000); // 3 minutes

      const transmissions = beacon.getTransmissionsInRange(start, end);

      // Should have 3 transmissions (at 0s, 60s, 120s)
      expect(transmissions.length).toBe(3);
      expect(transmissions[0].start).toEqual(epoch);
      expect(transmissions[1].start).toEqual(new Date(epoch.getTime() + 60000));
      expect(transmissions[2].start).toEqual(new Date(epoch.getTime() + 120000));
    });

    it('should return empty array if no transmissions in range', () => {
      const beacon = createTestBeacon({
        transmitInterval: 60,
        transmitDuration: 5,
      });

      // Range that doesn't include any transmissions
      const start = new Date(epoch.getTime() + 10000);
      const end = new Date(epoch.getTime() + 50000);

      const transmissions = beacon.getTransmissionsInRange(start, end);

      expect(transmissions.length).toBe(0);
    });

    it('should truncate transmission end time at range end', () => {
      const beacon = createTestBeacon({
        transmitInterval: 60,
        transmitDuration: 5,
      });

      // End in the middle of a transmission
      const start = epoch;
      const end = new Date(epoch.getTime() + 3000);

      const transmissions = beacon.getTransmissionsInRange(start, end);

      expect(transmissions.length).toBe(1);
      expect(transmissions[0].end).toEqual(end);
    });
  });

  describe('getTransmissionCount', () => {
    it('should estimate transmission count', () => {
      const beacon = createTestBeacon({
        transmitInterval: 60,
        transmitDuration: 5,
      });

      const start = epoch;
      const end = new Date(epoch.getTime() + 300000); // 5 minutes

      const count = beacon.getTransmissionCount(start, end);

      // 5 minutes / 60 seconds = 5 cycles + 1 = 6 transmissions
      expect(count).toBe(6);
    });
  });

  describe('serialization', () => {
    it('should serialize correctly', () => {
      const beacon = createTestBeacon({
        modulation: ModulationType.BPSK,
        messageFormat: 'AX.25',
      });

      const serialized = beacon.serialize();

      expect(serialized.type).toBe('Beacon');
      expect(serialized.id).toBe(1001);
      expect(serialized.deviceType).toBe(CommDeviceType.BEACON);
      expect(serialized.frequency).toBe(437e6);
      expect(serialized.transmitInterval).toBe(60);
      expect(serialized.transmitDuration).toBe(5);
      expect(serialized.epoch).toBe(epoch.toISOString());
      expect(serialized.messageFormat).toBe('AX.25');
    });

    it('should deserialize correctly', () => {
      const original = createTestBeacon({
        modulation: ModulationType.GMSK,
        messageFormat: 'CCSDS',
      });

      const serialized = original.serialize();
      const restored = Beacon.deserialize(serialized);

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.frequency).toBe(original.frequency);
      expect(restored.transmitInterval).toBe(original.transmitInterval);
      expect(restored.transmitDuration).toBe(original.transmitDuration);
      expect(restored.epoch.getTime()).toBe(original.epoch.getTime());
      expect(restored.messageFormat).toBe(original.messageFormat);
      expect(restored.modulation).toBe(original.modulation);
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      const beacon = createTestBeacon({
        messageFormat: 'AX.25',
      });

      const str = beacon.toString();

      expect(str).toContain('[Beacon]');
      expect(str).toContain('1001');
      expect(str).toContain('437.000 MHz');
      expect(str).toContain('60 s'); // interval
      expect(str).toContain('5 s'); // duration
      expect(str).toContain('AX.25');
    });
  });
});
