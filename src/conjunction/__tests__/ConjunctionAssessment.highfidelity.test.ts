/**
 * @file ConjunctionAssessment high-fidelity test suite
 * @description Tests for high-fidelity propagation and covariance propagation
 */

import {
  ConjunctionAssessment,
  EpochUTC,
  Kilometers,
  Seconds,
  Tle,
} from '../../main';

describe('ConjunctionAssessment - High Fidelity', () => {
  // Sample TLE data for testing (ISS and a close approach satellite)
  const tleLine1Primary = '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005';
  const tleLine2Primary = '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000';
  const tleLine1Secondary = '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9006';
  const tleLine2Secondary = '2 25544  51.6400 339.8100 0002571  90.5100 269.6100 15.50000000000000';

  let primaryTle: Tle;
  let secondaryTle: Tle;

  beforeEach(() => {
    primaryTle = new Tle(tleLine1Primary, tleLine2Primary);
    secondaryTle = new Tle(tleLine1Secondary, tleLine2Secondary);
  });

  describe('High-Fidelity Propagation', () => {
    it('should use high-fidelity propagation when requested', { timeout: 30000 }, () => {
      const assessment = new ConjunctionAssessment(
        { tle: primaryTle, radius: 0.01 as Kilometers },
        { tle: secondaryTle, radius: 0.01 as Kilometers },
      );

      const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
      const endTime = EpochUTC.fromDateTimeString('2025-01-19T12:15:00.000Z');

      const event = assessment.assess({
        startTime,
        endTime,
        useHighFidelity: true,
        searchStepSize: 120 as Seconds,
      });

      expect(event).toBeDefined();
      expect(event.tca).toBeDefined();
    });
  });

  describe('Covariance Propagation', () => {
    it('should propagate covariances and compute Pc', { timeout: 30000 }, () => {
      const assessment = new ConjunctionAssessment(
        { tle: primaryTle, radius: 0.01 as Kilometers },
        { tle: secondaryTle, radius: 0.01 as Kilometers },
      );

      const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
      const endTime = EpochUTC.fromDateTimeString('2025-01-19T12:15:00.000Z');

      const event = assessment.assess({
        startTime,
        endTime,
        useHighFidelity: true,
        propagateCovariance: true,
        searchStepSize: 120 as Seconds,
      });

      expect(event).toBeDefined();
      expect(event.combinedCovariance).toBeDefined();
      expect(event.probabilityOfCollision).toBeDefined();
      expect(event.probabilityOfCollision).toBeGreaterThanOrEqual(0);
      expect(event.probabilityOfCollision).toBeLessThanOrEqual(1);
    });
  });
});
