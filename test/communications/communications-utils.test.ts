import { Decibels, Gigahertz, Kelvin, Kilometers, Watts } from '../../src/main.js';
import {
  wattsToDbw,
  dbwToWatts,
  linearToDb,
  dbToLinear,
  calculateFreeSpacePathLoss,
  calculateAntennaGain,
  calculateEirp,
  calculateGOverT,
  calculateCN0,
} from '../../src/utils/communications.js';

describe('Communications Utility Functions', () => {
  describe('Power conversions', () => {
    it('should convert watts to dBW correctly', () => {
      const powerW = 100 as Watts;
      const powerDbw = wattsToDbw(powerW);

      expect(powerDbw).toBeCloseTo(20, 1);
    });

    it('should convert dBW to watts correctly', () => {
      const powerDbw = 20 as Decibels;
      const powerW = dbwToWatts(powerDbw);

      expect(powerW).toBeCloseTo(100, 0);
    });

    it('should round-trip power conversions', () => {
      const originalWatts = 50 as Watts;
      const dbw = wattsToDbw(originalWatts);
      const backToWatts = dbwToWatts(dbw);

      expect(backToWatts).toBeCloseTo(originalWatts, 1);
    });
  });

  describe('Linear/dB conversions', () => {
    it('should convert linear to dB correctly', () => {
      const linear = 100;
      const db = linearToDb(linear);

      expect(db).toBeCloseTo(20, 1);
    });

    it('should convert dB to linear correctly', () => {
      const db = 20 as Decibels;
      const linear = dbToLinear(db);

      expect(linear).toBeCloseTo(100, 0);
    });
  });

  describe('Free space path loss', () => {
    it('should calculate path loss for typical LEO distance', () => {
      const range = 1000 as Kilometers;
      const frequency = 2 as Gigahertz;
      const pathLoss = calculateFreeSpacePathLoss(range, frequency);

      // Should be around 166 dB for 1000 km at 2 GHz
      expect(pathLoss).toBeGreaterThan(160);
      expect(pathLoss).toBeLessThan(170);
    });

    it('should calculate path loss for GEO distance', () => {
      const range = 38000 as Kilometers;
      const frequency = 14 as Gigahertz;
      const pathLoss = calculateFreeSpacePathLoss(range, frequency);

      // Should be around 207 dB for GEO at 14 GHz
      expect(pathLoss).toBeGreaterThan(205);
      expect(pathLoss).toBeLessThan(210);
    });

    it('should increase with frequency', () => {
      const range = 1000 as Kilometers;
      const pathLoss1 = calculateFreeSpacePathLoss(range, 1 as Gigahertz);
      const pathLoss2 = calculateFreeSpacePathLoss(range, 10 as Gigahertz);

      expect(pathLoss2).toBeGreaterThan(pathLoss1);
    });

    it('should increase with distance', () => {
      const frequency = 2 as Gigahertz;
      const pathLoss1 = calculateFreeSpacePathLoss(1000 as Kilometers, frequency);
      const pathLoss2 = calculateFreeSpacePathLoss(10000 as Kilometers, frequency);

      expect(pathLoss2).toBeGreaterThan(pathLoss1);
    });
  });

  describe('Antenna gain calculations', () => {
    it('should calculate gain for a typical parabolic antenna', () => {
      const diameter = 2; // 2 meter dish
      const frequency = 10 as Gigahertz;
      const gain = calculateAntennaGain(diameter, frequency);

      // Should be around 44 dBi for a 2m dish at 10 GHz with 65% efficiency
      expect(gain).toBeGreaterThan(40);
      expect(gain).toBeLessThan(50);
    });

    it('should increase with diameter', () => {
      const frequency = 10 as Gigahertz;
      const gain1 = calculateAntennaGain(1, frequency);
      const gain2 = calculateAntennaGain(2, frequency);

      expect(gain2).toBeGreaterThan(gain1);
    });

    it('should increase with frequency', () => {
      const diameter = 2;
      const gain1 = calculateAntennaGain(diameter, 5 as Gigahertz);
      const gain2 = calculateAntennaGain(diameter, 10 as Gigahertz);

      expect(gain2).toBeGreaterThan(gain1);
    });
  });

  describe('EIRP calculations', () => {
    it('should calculate EIRP correctly', () => {
      const txPower = 20 as Decibels; // 20 dBW
      const antennaGain = 40 as Decibels; // 40 dBi
      const losses = 2 as Decibels; // 2 dB losses
      const eirp = calculateEirp(txPower, antennaGain, losses);

      expect(eirp).toBeCloseTo(58, 1); // 20 + 40 - 2 = 58 dBW
    });
  });

  describe('G/T calculations', () => {
    it('should calculate G/T correctly', () => {
      const gain = 40 as Decibels;
      const temp = 100 as Kelvin;
      const gOverT = calculateGOverT(gain, temp);

      // G/T = 40 - 10*log10(100) = 40 - 20 = 20 dB/K
      expect(gOverT).toBeCloseTo(20, 1);
    });
  });

  describe('C/N0 calculations', () => {
    it('should calculate C/N0 correctly', () => {
      const eirp = 60 as Decibels;
      const pathLoss = 180 as Decibels;
      const gOverT = 20 as Decibels;
      const cn0 = calculateCN0(eirp, pathLoss, gOverT);

      // C/N0 = EIRP - Path Loss + G/T + Boltzmann
      // = 60 - 180 + 20 + 228.6 = 128.6 dB-Hz
      expect(cn0).toBeCloseTo(128.6, 1);
    });
  });
});
