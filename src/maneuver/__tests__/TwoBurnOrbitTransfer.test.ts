import { EpochUTC, Radians, Seconds, SecondsPerMeterPerSecond } from '../../main';
import { TwoBurnOrbitTransfer } from '../TwoBurnOrbitTransfer';

const DEG2RAD = Math.PI / 180;

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

  describe('hohmannTransferWithPlaneChange', () => {
    const rLeo = 6678; // km
    const rGeo = 42164; // km

    it('matches the coplanar transfer when the inclination change is zero', () => {
      const coplanar = TwoBurnOrbitTransfer.hohmannTransfer(rLeo, rGeo);
      const result = TwoBurnOrbitTransfer.hohmannTransferWithPlaneChange(rLeo, rGeo, 0 as Radians);

      expect(result.planeChangeBurn).toBe('none');
      expect(result.deltaV1).toBeCloseTo(coplanar.vTransA, 9);
      expect(result.deltaV2).toBeCloseTo(coplanar.vTransB, 9);
      expect(result.deltaVTotal).toBeCloseTo(coplanar.deltaV, 9);
      expect(result.tTrans).toBeCloseTo(coplanar.tTrans, 9);
    });

    it('computes the canonical LEO to GEO transfer with a 28.5 deg plane change on burn 2', () => {
      const result = TwoBurnOrbitTransfer.hohmannTransferWithPlaneChange(rLeo, rGeo, 28.5 * DEG2RAD as Radians);

      expect(result.planeChangeBurn).toBe('burn2');
      expect(result.deltaV1).toBeCloseTo(2.426, 2);
      expect(result.deltaV2).toBeCloseTo(1.83, 2);
      expect(result.deltaVTotal).toBeCloseTo(result.deltaV1 + result.deltaV2, 9);
      // Transfer time is a little over 5 hours
      expect(result.tTrans / 3600).toBeCloseTo(5.26, 1);
    });

    it('keeps the coplanar burn-2 cost when the plane change is zero', () => {
      const result = TwoBurnOrbitTransfer.hohmannTransferWithPlaneChange(rLeo, rGeo, 0 as Radians);

      expect(result.deltaV2).toBeCloseTo(1.467, 2);
    });

    it('assigns the plane change to burn 1 on a lowering transfer', () => {
      const raising = TwoBurnOrbitTransfer.hohmannTransferWithPlaneChange(rLeo, rGeo, 10 * DEG2RAD as Radians);
      const lowering = TwoBurnOrbitTransfer.hohmannTransferWithPlaneChange(rGeo, rLeo, 10 * DEG2RAD as Radians);

      expect(lowering.planeChangeBurn).toBe('burn1');
      // Same geometry either direction, so the totals must match
      expect(lowering.deltaVTotal).toBeCloseTo(raising.deltaVTotal, 9);
      expect(lowering.deltaV1).toBeCloseTo(raising.deltaV2, 9);
      expect(lowering.deltaV2).toBeCloseTo(raising.deltaV1, 9);
    });

    it('reduces to a pure plane change for equal radii', () => {
      const radius = 7000;
      const deltaInc = 30 * DEG2RAD as Radians;
      const result = TwoBurnOrbitTransfer.hohmannTransferWithPlaneChange(radius, radius, deltaInc);
      const vCirc = result.vInit;

      // 2 * v * sin(di / 2) is the textbook pure plane-change cost
      expect(result.deltaV1).toBeCloseTo(0, 9);
      expect(result.deltaV2).toBeCloseTo(2 * vCirc * Math.sin(deltaInc / 2), 9);
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
