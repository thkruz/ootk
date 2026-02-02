/**
 * Integration test: Doppler shift calculations
 * Migrated from examples/doppler.ts
 */
import {
  Degrees,
  dopplerFactor,
  GroundStation,
  Kilometers,
  Satellite,
  TleLine1,
  TleLine2,
} from '../../dist/main.js';
import { ISS_TLE } from './lib/testData';

describe('Doppler Calculations', () => {
  const groundStation = new GroundStation({
    lat: 41.754785 as Degrees,
    lon: -70.539151 as Degrees,
    alt: 0.060966 as Kilometers,
    name: 'Cape Cod Ground Station',
  });

  const iss = new Satellite({
    tle1: ISS_TLE.line1 as TleLine1,
    tle2: ISS_TLE.line2 as TleLine2,
  });

  const date = new Date('2024-01-28T12:00:00.000Z');
  const transmitFreq = 437.8e6; // 437.8 MHz

  describe('Basic Doppler Shift', () => {
    it('should calculate Doppler factor close to 1', () => {
      const doppler = iss.dopplerFactor(groundStation, date);

      expect(doppler).toBeGreaterThan(0.99);
      expect(doppler).toBeLessThan(1.01);
    });

    it('should apply Doppler to frequency', () => {
      const receivedFreq = iss.applyDoppler(transmitFreq, groundStation, date);
      const freqShift = receivedFreq - transmitFreq;

      // Frequency shift should be within reasonable range for LEO satellite
      // Max shift at 437.8 MHz is about ±10 kHz for LEO
      expect(Math.abs(freqShift)).toBeLessThan(15000);
    });

    it('should have consistent Doppler factor and applied frequency', () => {
      const doppler = iss.dopplerFactor(groundStation, date);
      const receivedFreq = iss.applyDoppler(transmitFreq, groundStation, date);

      // The applied Doppler should be consistent with the factor
      const expectedReceivedFreq = transmitFreq * doppler;

      expect(receivedFreq).toBeCloseTo(expectedReceivedFreq, 0);
    });
  });

  describe('Doppler During Pass', () => {
    it('should calculate changing Doppler throughout a pass', () => {
      const passStart = new Date('2024-01-28T12:00:00.000Z');
      const dopplerValues: number[] = [];

      for (let i = 0; i <= 10; i++) {
        const time = new Date(passStart.getTime() + i * 60 * 1000);
        const doppler = iss.dopplerFactor(groundStation, time);

        dopplerValues.push(doppler);
      }

      // All values should be valid (close to 1)
      dopplerValues.forEach((d) => {
        expect(d).toBeGreaterThan(0.99);
        expect(d).toBeLessThan(1.01);
      });
    });
  });

  describe('Frequency Band Scaling', () => {
    it('should scale Doppler shift with frequency', () => {
      const frequencies = [
        145.8e6, // VHF
        437.8e6, // UHF
        1575.42e6, // L-band (GPS L1)
        2200e6, // S-band
      ];

      const shifts = frequencies.map((freq) => {
        const received = iss.applyDoppler(freq, groundStation, date);

        return Math.abs(received - freq);
      });

      // Higher frequencies should have larger absolute shifts
      for (let i = 1; i < shifts.length; i++) {
        expect(shifts[i]).toBeGreaterThan(shifts[i - 1]);
      }
    });
  });

  describe('Doppler Rate of Change', () => {
    it('should calculate Doppler rate of change', () => {
      const rateStart = new Date('2024-01-28T12:00:00.000Z');
      const deltaTime = 10; // seconds

      const t1 = rateStart;
      const t2 = new Date(t1.getTime() + deltaTime * 1000);

      const freq1 = iss.applyDoppler(transmitFreq, groundStation, t1);
      const freq2 = iss.applyDoppler(transmitFreq, groundStation, t2);

      const freqChange = freq2 - freq1;
      const rateOfChange = freqChange / deltaTime; // Hz per second

      // Rate of change should be finite and reasonable
      expect(Number.isFinite(rateOfChange)).toBe(true);
      expect(Math.abs(rateOfChange)).toBeLessThan(1000); // Less than 1 kHz/s
    });
  });

  describe('dopplerFactor Utility Function', () => {
    it('should calculate Doppler factor from position and velocity vectors', () => {
      const satelliteState = iss.eci(date);
      const observerEci = groundStation.eci(date);

      // dopplerFactor takes (observerLocation, satellitePosition, satelliteVelocity)
      const manualDoppler = dopplerFactor(
        observerEci,
        satelliteState!.position,
        satelliteState!.velocity,
      );

      // Should be close to the satellite method result
      const satDoppler = iss.dopplerFactor(groundStation, date);

      // They should be equal since they use the same underlying calculation
      expect(manualDoppler).toBeGreaterThan(0.99);
      expect(manualDoppler).toBeLessThan(1.01);
      expect(satDoppler).toBeGreaterThan(0.99);
      expect(satDoppler).toBeLessThan(1.01);
      // Should be nearly identical
      expect(manualDoppler).toBeCloseTo(satDoppler!, 5);
    });
  });
});
