/**
 * @file ConjunctionAssessment basic test suite
 * @description Tests for basic conjunction assessment, state vectors, and event formatting
 */

import {
  ConjunctionAssessment,
  CovarianceFrame,
  EpochUTC,
  J2000,
  Kilometers,
  KilometersPerSecond,
  ProbabilityOfCollision,
  StateCovariance,
  Tle,
  Vector3D,
} from '../../main';

describe('ConjunctionAssessment - Basic', () => {
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

  describe('Basic Conjunction Assessment', () => {
    it('should create a conjunction assessment from TLEs', () => {
      const assessment = new ConjunctionAssessment(
        { tle: primaryTle, radius: 0.01 as Kilometers },
        { tle: secondaryTle, radius: 0.01 as Kilometers },
      );

      expect(assessment).toBeDefined();
    });

    it('should find TCA and compute miss distance', () => {
      const assessment = new ConjunctionAssessment(
        { tle: primaryTle, radius: 0.01 as Kilometers },
        { tle: secondaryTle, radius: 0.01 as Kilometers },
      );

      const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
      const endTime = EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z');

      const event = assessment.assess({
        startTime,
        endTime,
      });

      expect(event).toBeDefined();
      expect(event.tca).toBeDefined();
      expect(event.missDistance).toBeGreaterThan(0);
      expect(event.relativeVelocity).toBeGreaterThan(0);
    });

    it('should provide RIC components of miss distance', () => {
      const assessment = new ConjunctionAssessment(
        { tle: primaryTle, radius: 0.01 as Kilometers },
        { tle: secondaryTle, radius: 0.01 as Kilometers },
      );

      const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
      const endTime = EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z');

      const event = assessment.assess({
        startTime,
        endTime,
      });

      expect(event.radialDistance).toBeGreaterThanOrEqual(0);
      expect(event.intrackDistance).toBeGreaterThanOrEqual(0);
      expect(event.crosstrackDistance).toBeGreaterThanOrEqual(0);

      // Verify that RIC components sum to total miss distance
      const computedMiss = Math.sqrt(
        event.radialDistance ** 2 + event.intrackDistance ** 2 + event.crosstrackDistance ** 2,
      );

      expect(computedMiss).toBeCloseTo(event.missDistance, 6);
    });
  });

  describe('State Vector Input', () => {
    it('should accept state vectors instead of TLEs', () => {
      const primaryState = new J2000(
        EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        new Vector3D(6878.0 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );

      const secondaryState = new J2000(
        EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        new Vector3D(6878.1 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );

      const assessment = new ConjunctionAssessment(
        { state: primaryState, radius: 0.01 as Kilometers },
        { state: secondaryState, radius: 0.01 as Kilometers },
      );

      const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
      const endTime = EpochUTC.fromDateTimeString('2025-01-19T13:00:00.000Z');

      const event = assessment.assess({
        startTime,
        endTime,
      });

      expect(event).toBeDefined();
      expect(event.missDistance).toBeGreaterThan(0);
    });

    it('should use provided covariances for Pc calculation', () => {
      const primaryState = new J2000(
        EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        new Vector3D(6878.0 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );

      const secondaryState = new J2000(
        EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        new Vector3D(6878.1 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );

      const covariance = StateCovariance.fromSigmas([1.0, 1.0, 1.0, 0.001, 0.001, 0.001], CovarianceFrame.RIC);

      const assessment = new ConjunctionAssessment(
        { state: primaryState, covariance, radius: 0.01 as Kilometers },
        { state: secondaryState, covariance, radius: 0.01 as Kilometers },
      );

      const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
      const endTime = EpochUTC.fromDateTimeString('2025-01-19T13:00:00.000Z');

      const event = assessment.assess({
        startTime,
        endTime,
      });

      expect(event.probabilityOfCollision).toBeDefined();
      expect(event.probabilityOfCollision).toBeGreaterThanOrEqual(0);
      expect(event.probabilityOfCollision).toBeLessThanOrEqual(1);
    });
  });

  describe('ConjunctionEvent', () => {
    it('should format conjunction event as string', () => {
      const assessment = new ConjunctionAssessment(
        { tle: primaryTle, radius: 0.01 as Kilometers },
        { tle: secondaryTle, radius: 0.01 as Kilometers },
      );

      const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
      const endTime = EpochUTC.fromDateTimeString('2025-01-19T13:00:00.000Z');

      const event = assessment.assess({
        startTime,
        endTime,
      });

      const str = event.toString();

      expect(str).toContain('Conjunction Event');
      expect(str).toContain('TCA:');
      expect(str).toContain('Miss Distance:');
    });

    it('should identify high-risk conjunctions', () => {
      const primaryState = new J2000(
        EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        new Vector3D(6878.0 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );

      const secondaryState = new J2000(
        EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        new Vector3D(6878.0005 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );

      const assessment = new ConjunctionAssessment(
        { state: primaryState, radius: 0.01 as Kilometers },
        { state: secondaryState, radius: 0.01 as Kilometers },
      );

      const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
      const endTime = EpochUTC.fromDateTimeString('2025-01-19T13:00:00.000Z');

      const event = assessment.assess({
        startTime,
        endTime,
      });

      expect(event.isHighRisk(1.0 as Kilometers)).toBe(true);
    });
  });

  describe('ProbabilityOfCollision', () => {
    it('should compute Pc for a given relative state and covariance', () => {
      const relativePosition = new Vector3D(0.5 as Kilometers, 0.5 as Kilometers, 0.5 as Kilometers);
      const relativeVelocity = new Vector3D(0.1, 0.1, 0.1);
      const covariance = StateCovariance.fromSigmas([1.0, 1.0, 1.0, 0.001, 0.001, 0.001], CovarianceFrame.RIC);
      const combinedRadius = 0.02 as Kilometers;

      const pc = ProbabilityOfCollision.calculate(relativePosition, relativeVelocity, covariance, combinedRadius);

      expect(pc).toBeGreaterThanOrEqual(0);
      expect(pc).toBeLessThanOrEqual(1);
    });

    it('should return higher Pc for smaller miss distances', () => {
      const covariance = StateCovariance.fromSigmas([1.0, 1.0, 1.0, 0.001, 0.001, 0.001], CovarianceFrame.RIC);
      // Use velocity along Z-axis so positions in X-Y plane project onto encounter plane
      const relativeVelocity = new Vector3D(0.0, 0.0, 1.0);
      const combinedRadius = 0.02 as Kilometers;

      // Positions perpendicular to velocity so they project fully onto the encounter plane
      const relativePosition1 = new Vector3D(0.1 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers);
      const relativePosition2 = new Vector3D(1.0 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers);

      const pc1 = ProbabilityOfCollision.calculate(relativePosition1, relativeVelocity, covariance, combinedRadius);
      const pc2 = ProbabilityOfCollision.calculate(relativePosition2, relativeVelocity, covariance, combinedRadius);

      expect(pc1).toBeGreaterThan(pc2);
    });

    it('should combine covariance matrices correctly', () => {
      const cov1 = StateCovariance.fromSigmas([1.0, 1.0, 1.0, 0.001, 0.001, 0.001], CovarianceFrame.RIC);
      const cov2 = StateCovariance.fromSigmas([0.5, 0.5, 0.5, 0.0005, 0.0005, 0.0005], CovarianceFrame.RIC);

      const combined = ProbabilityOfCollision.combineCovarianceMatrices(cov1, cov2);

      expect(combined).toBeDefined();
      expect(combined.frame).toBe(CovarianceFrame.RIC);

      // Combined variance should be sum of individual variances
      expect(combined.matrix.elements[0][0]).toBeCloseTo(cov1.matrix.elements[0][0] + cov2.matrix.elements[0][0]);
    });
  });
});
