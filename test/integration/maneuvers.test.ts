/**
 * Integration test: Orbital Maneuvers
 * Migrated from examples/maneuvers.ts
 */
import {
  ClassicalElements,
  Degrees,
  EpochUTC,
  Kilometers,
  TwoBurnOrbitTransfer,
} from '../../dist/main.js';

describe('Orbital Maneuvers', () => {
  const date = new Date('2024-01-28T00:00:00.000Z');
  const mu = 398600.4418; // Earth gravitational parameter

  describe('Classical Elements for Transfer Orbits', () => {
    it('should create LEO orbit elements', () => {
      const leoOrbit = new ClassicalElements({
        epoch: EpochUTC.fromDateTime(date),
        semimajorAxis: 6778 as Kilometers,
        eccentricity: 0.001,
        inclination: 28.5 as Degrees,
        rightAscension: 0 as Degrees,
        argPerigee: 0 as Degrees,
        trueAnomaly: 0 as Degrees,
      });

      expect(leoOrbit.semimajorAxis).toBe(6778);
      expect(leoOrbit.eccentricity).toBeCloseTo(0.001);
      expect(leoOrbit.period).toBeGreaterThan(90); // ~92 minutes for LEO
      expect(leoOrbit.period).toBeLessThan(95);
    });

    it('should create GEO orbit elements', () => {
      const geoOrbit = new ClassicalElements({
        epoch: EpochUTC.fromDateTime(date),
        semimajorAxis: 42164 as Kilometers,
        eccentricity: 0.001,
        inclination: 0 as Degrees,
        rightAscension: 0 as Degrees,
        argPerigee: 0 as Degrees,
        trueAnomaly: 0 as Degrees,
      });

      expect(geoOrbit.semimajorAxis).toBe(42164);
      // GEO period should be ~1436 minutes (sidereal day)
      expect(geoOrbit.period).toBeGreaterThan(1430);
      expect(geoOrbit.period).toBeLessThan(1445);
    });

    it('should create Molniya orbit elements', () => {
      const molniyaOrbit = new ClassicalElements({
        epoch: EpochUTC.fromDateTime(date),
        semimajorAxis: 26554 as Kilometers,
        eccentricity: 0.74,
        inclination: 63.4 as Degrees,
        rightAscension: 0 as Degrees,
        argPerigee: 270 as Degrees,
        trueAnomaly: 0 as Degrees,
      });

      expect(molniyaOrbit.eccentricity).toBeCloseTo(0.74);
      // Molniya period should be ~12 hours (half sidereal day)
      expect(molniyaOrbit.period).toBeGreaterThan(700);
      expect(molniyaOrbit.period).toBeLessThan(730);
    });
  });

  describe('Hohmann Transfer using Static Method', () => {
    it('should calculate LEO to GEO transfer orbit', () => {
      const rInit = 6778; // LEO radius
      const rFinal = 42164; // GEO radius

      const transfer = TwoBurnOrbitTransfer.hohmannTransfer(rInit, rFinal);

      expect(transfer).toBeDefined();
      expect(transfer.vInit).toBeGreaterThan(0);
      expect(transfer.vFinal).toBeGreaterThan(0);
      expect(transfer.vTransA).toBeGreaterThan(0);
      expect(transfer.vTransB).toBeGreaterThan(0);
      expect(transfer.tTrans).toBeGreaterThan(0);
    });

    it('should calculate correct delta-V for LEO to GEO transfer', () => {
      const rInit = 6778;
      const rFinal = 42164;

      const transfer = TwoBurnOrbitTransfer.hohmannTransfer(rInit, rFinal);

      // LEO to GEO Hohmann transfer is typically ~3.9 km/s
      expect(transfer.deltaV).toBeGreaterThan(3.5);
      expect(transfer.deltaV).toBeLessThan(4.5);
    });

    it('should calculate transfer to MEO', () => {
      const rInit = 6778; // LEO
      const rFinal = 26560; // MEO (GPS-like)

      const transfer = TwoBurnOrbitTransfer.hohmannTransfer(rInit, rFinal);

      // LEO to MEO should be less than LEO to GEO
      expect(transfer.deltaV).toBeGreaterThan(2);
      expect(transfer.deltaV).toBeLessThan(4);
    });
  });

  describe('Delta-V Calculations', () => {
    it('should calculate reasonable delta-V for LEO to GEO', () => {
      const r1 = 6778; // LEO
      const r2 = 42164; // GEO
      const at = (r1 + r2) / 2; // Transfer orbit semi-major axis

      // Circular velocity at LEO
      const v1 = Math.sqrt(mu / r1);

      // Transfer velocity at periapsis
      const vt1 = Math.sqrt(mu * (2 / r1 - 1 / at));

      // First delta-V
      const dv1 = Math.abs(vt1 - v1);

      // Circular velocity at GEO
      const v2 = Math.sqrt(mu / r2);

      // Transfer velocity at apoapsis
      const vt2 = Math.sqrt(mu * (2 / r2 - 1 / at));

      // Second delta-V
      const dv2 = Math.abs(v2 - vt2);

      const totalDv = dv1 + dv2;

      // LEO to GEO Hohmann transfer is typically ~3.9 km/s
      expect(totalDv).toBeGreaterThan(3.5);
      expect(totalDv).toBeLessThan(4.5);
    });

    it('should calculate delta-V for LEO to MEO', () => {
      const r1 = 6778; // LEO
      const r2 = 26560; // MEO (GPS-like)
      const at = (r1 + r2) / 2;

      const v1 = Math.sqrt(mu / r1);
      const vt1 = Math.sqrt(mu * (2 / r1 - 1 / at));
      const dv1 = Math.abs(vt1 - v1);

      const v2 = Math.sqrt(mu / r2);
      const vt2 = Math.sqrt(mu * (2 / r2 - 1 / at));
      const dv2 = Math.abs(v2 - vt2);

      const totalDv = dv1 + dv2;

      // LEO to MEO should be less than LEO to GEO
      expect(totalDv).toBeGreaterThan(2);
      expect(totalDv).toBeLessThan(4);
    });
  });

  describe('Orbit Raising', () => {
    it('should calculate simple orbit raising maneuver', () => {
      const r1 = 6678; // Starting radius
      const r2 = 6778; // Target radius (100 km higher)

      const transfer = TwoBurnOrbitTransfer.hohmannTransfer(r1, r2);

      // 100 km orbit raise should be small delta-V
      expect(transfer.deltaV).toBeLessThan(0.1);
    });
  });

  describe('Transfer Time', () => {
    it('should calculate transfer time for Hohmann transfer', () => {
      const r1 = 6778; // LEO
      const r2 = 42164; // GEO
      const at = (r1 + r2) / 2;

      // Period of transfer orbit
      const period = 2 * Math.PI * Math.sqrt(Math.pow(at, 3) / mu);

      // Transfer time is half the period
      const transferTime = period / 2;

      // LEO to GEO transfer should take about 5.2 hours
      const transferTimeHours = transferTime / 3600;

      expect(transferTimeHours).toBeGreaterThan(5);
      expect(transferTimeHours).toBeLessThan(6);
    });

    it('should return transfer time from TwoBurnOrbitTransfer', () => {
      const rInit = 6778;
      const rFinal = 42164;

      const transfer = TwoBurnOrbitTransfer.hohmannTransfer(rInit, rFinal);

      // Transfer time should be about 5.2 hours (18720 seconds)
      const transferTimeHours = transfer.tTrans / 3600;

      expect(transferTimeHours).toBeGreaterThan(5);
      expect(transferTimeHours).toBeLessThan(6);
    });
  });
});
