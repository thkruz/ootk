import { EpochUTC, Seconds, SecondsPerMeterPerSecond } from '../../main';
import { TwoBurnOrbitTransfer } from '../TwoBurnOrbitTransfer';

describe('TwoBurnOrbitTransfer', () => {
  describe('constructor', () => {
    it('should create an instance with correct properties', () => {
      const transfer = new TwoBurnOrbitTransfer(7.5, 7.8, 0.3, 0.2, 3000 as Seconds);

      expect(transfer.vInit).toBe(7.5);
      expect(transfer.vFinal).toBe(7.8);
      expect(transfer.vTransA).toBe(0.3);
      expect(transfer.vTransB).toBe(0.2);
      expect(transfer.tTrans).toBe(3000);
    });
  });

  describe('hohmannTransfer', () => {
    it('should calculate Hohmann transfer from LEO to GEO', () => {
      const rInit = 6678; // LEO radius (km)
      const rFinal = 42164; // GEO radius (km)

      const transfer = TwoBurnOrbitTransfer.hohmannTransfer(rInit, rFinal);

      expect(transfer.vInit).toBeCloseTo(7.726, 2);
      expect(transfer.vFinal).toBeCloseTo(3.075, 2);
      expect(transfer.vTransA).toBeGreaterThan(0);
      expect(transfer.vTransB).toBeGreaterThan(0);
      expect(transfer.tTrans).toBeGreaterThan(0);
    });

    it('should calculate Hohmann transfer for equal radii', () => {
      const radius = 7000;

      const transfer = TwoBurnOrbitTransfer.hohmannTransfer(radius, radius);

      expect(transfer.vInit).toBeCloseTo(transfer.vFinal, 5);
      expect(transfer.vTransA).toBeCloseTo(0, 5);
      expect(transfer.vTransB).toBeCloseTo(0, 5);
    });
  });

  describe('deltaV', () => {
    it('should return total delta-V magnitude', () => {
      const transfer = new TwoBurnOrbitTransfer(7.5, 7.8, 0.3, -0.2, 3000 as Seconds);

      expect(transfer.deltaV).toBe(0.5);
    });

    it('should handle positive values', () => {
      const transfer = new TwoBurnOrbitTransfer(7.5, 7.8, 0.3, 0.2, 3000 as Seconds);

      expect(transfer.deltaV).toBe(0.5);
    });
  });

  describe('toManeuvers', () => {
    it('should create two thrust maneuvers', () => {
      const epoch = EpochUTC.fromDateTimeString('2025-01-01T00:00:00.000Z');
      const transfer = new TwoBurnOrbitTransfer(7.5, 7.8, 0.3, 0.2, 3000 as Seconds);

      const [mA, mB] = transfer.toManeuvers(epoch);

      expect(mA).toBeDefined();
      expect(mB).toBeDefined();
      expect(mA.intrack).toBe(300); // 0.3 * 1000
      expect(mB.intrack).toBe(200); // 0.2 * 1000
    });

    it('should use custom duration rate', () => {
      const epoch = EpochUTC.fromDateTimeString('2025-01-01T00:00:00.000Z');
      const transfer = new TwoBurnOrbitTransfer(7.5, 7.8, 0.3, 0.2, 3000 as Seconds);
      const durationRate = 10.0 as SecondsPerMeterPerSecond;

      const [mA, mB] = transfer.toManeuvers(epoch, durationRate);

      expect(mA).toBeDefined();
      expect(mB).toBeDefined();
    });

    it('should space maneuvers by transfer time', () => {
      const epoch = EpochUTC.fromDateTimeString('2025-01-01T00:00:00.000Z');
      const tTrans = 5000 as Seconds;
      const transfer = new TwoBurnOrbitTransfer(7.5, 7.8, 0.3, 0.2, tTrans);

      const [, mB] = transfer.toManeuvers(epoch);

      expect(mB.center.toDateTime()).toEqual(epoch.roll(tTrans).toDateTime());
    });
  });
});
