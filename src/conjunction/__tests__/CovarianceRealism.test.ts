/**
 * @file CovarianceRealism test suite
 * @description Tests for covariance realism assessment metrics
 */

import {
  ConjunctionEvent,
  CovarianceFrame,
  CovarianceRealism,
  EpochUTC,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Matrix,
  RIC,
  StateCovariance,
  Vector3D,
} from '../../main';

describe('CovarianceRealism', () => {
  // Create test covariances
  const wellConditionedCovariance = new StateCovariance(
    new Matrix([
      [1.0, 0.1, 0.1, 0, 0, 0],
      [0.1, 2.0, 0.1, 0, 0, 0],
      [0.1, 0.1, 1.5, 0, 0, 0],
      [0, 0, 0, 0.001, 0, 0],
      [0, 0, 0, 0, 0.001, 0],
      [0, 0, 0, 0, 0, 0.001],
    ]),
    CovarianceFrame.RIC,
  );

  // Ill-conditioned: condition number > 1e6 but not singular
  // Using moderate values to avoid numerical issues in cubic solver
  // Eigenvalues: [1e4, 1e-3, 1e-3], condition number = 1e7 > 1e6
  const illConditionedCovariance = new StateCovariance(
    new Matrix([
      [1e4, 0, 0, 0, 0, 0],
      [0, 1e-3, 0, 0, 0, 0],
      [0, 0, 1e-3, 0, 0, 0],
      [0, 0, 0, 0.001, 0, 0],
      [0, 0, 0, 0, 0.001, 0],
      [0, 0, 0, 0, 0, 0.001],
    ]),
    CovarianceFrame.RIC,
  );

  const singularCovariance = new StateCovariance(
    new Matrix([
      [1.0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 1.0, 0, 0, 0],
      [0, 0, 0, 0.001, 0, 0],
      [0, 0, 0, 0, 0.001, 0],
      [0, 0, 0, 0, 0, 0.001],
    ]),
    CovarianceFrame.RIC,
  );

  // Helper to create a mock conjunction event
  function createMockEvent(
    missDistance: Kilometers,
    covariance?: StateCovariance,
  ): ConjunctionEvent {
    const tca = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
    const primaryPos = new Vector3D<Kilometers>(6878.137 as Kilometers, 0 as Kilometers, 0 as Kilometers);
    const primaryVel = new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 7.612 as KilometersPerSecond, 0 as KilometersPerSecond);
    const secondaryPos = new Vector3D<Kilometers>((6878.137 + missDistance) as Kilometers, 0.1 as Kilometers, 0.1 as Kilometers);
    const secondaryVel = new Vector3D<KilometersPerSecond>(0.001 as KilometersPerSecond, 7.612 as KilometersPerSecond, 0.001 as KilometersPerSecond);

    const primaryState = new J2000(tca, primaryPos, primaryVel);
    const secondaryState = new J2000(tca, secondaryPos, secondaryVel);
    const relativeState = RIC.fromJ2000(secondaryState, primaryState);

    return new ConjunctionEvent({
      tca,
      primaryState,
      secondaryState,
      relativeState,
      missDistance,
      radialDistance: missDistance as Kilometers,
      intrackDistance: 0.1 as Kilometers,
      crosstrackDistance: 0.1 as Kilometers,
      relativeVelocity: 0.001 as KilometersPerSecond,
      combinedCovariance: covariance,
    });
  }

  describe('analyzeEigenvalues', () => {
    it('should analyze well-conditioned covariance', () => {
      const result = CovarianceRealism.analyzeEigenvalues(wellConditionedCovariance);

      expect(result.isWellConditioned).toBe(true);
      expect(result.isSingular).toBe(false);
      expect(result.conditionNumber).toBeLessThan(1e6);
      expect(result.eigenvalues).toHaveLength(3);
      expect(result.principalAxes).toHaveLength(3);

      // Eigenvalues should be positive for valid covariance
      for (const ev of result.eigenvalues) {
        expect(ev).toBeGreaterThan(0);
      }

      // Principal axes should be sqrt of eigenvalues
      for (let i = 0; i < 3; i++) {
        expect(result.principalAxes[i]).toBeCloseTo(Math.sqrt(result.eigenvalues[i]), 5);
      }
    });

    it('should detect ill-conditioned covariance', () => {
      const result = CovarianceRealism.analyzeEigenvalues(illConditionedCovariance);

      expect(result.isWellConditioned).toBe(false);
      expect(result.isSingular).toBe(false);
      expect(result.conditionNumber).toBeGreaterThan(1e6);
    });

    it('should detect singular covariance', () => {
      const result = CovarianceRealism.analyzeEigenvalues(singularCovariance);

      expect(result.isSingular).toBe(true);
      expect(result.conditionNumber).toBe(Infinity);
    });
  });

  describe('computeMahalanobisDistance', () => {
    it('should return null without covariance', () => {
      const event = createMockEvent(1.0 as Kilometers);

      const result = CovarianceRealism.computeMahalanobisDistance(event);

      expect(result).toBeNull();
    });

    it('should compute Mahalanobis distance with covariance', () => {
      const event = createMockEvent(1.0 as Kilometers, wellConditionedCovariance);

      const result = CovarianceRealism.computeMahalanobisDistance(event);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.distance).toBeGreaterThanOrEqual(0);
        expect(result.expectedBound).toBe(3.0);
        expect(typeof result.withinBounds).toBe('boolean');
        expect(result.sigmaLevel).toBe(result.distance);
      }
    });

    it('should mark distance within bounds correctly', () => {
      // Small miss distance should be within bounds
      const event = createMockEvent(0.5 as Kilometers, wellConditionedCovariance);

      const result = CovarianceRealism.computeMahalanobisDistance(event);

      if (result && result.distance <= 3.0) {
        expect(result.withinBounds).toBe(true);
      }
    });
  });

  describe('computeConsistencyRatio', () => {
    it('should return null without covariance', () => {
      const event = createMockEvent(1.0 as Kilometers);

      const result = CovarianceRealism.computeConsistencyRatio(event);

      expect(result).toBeNull();
    });

    it('should compute consistency ratio with covariance', () => {
      const event = createMockEvent(1.0 as Kilometers, wellConditionedCovariance);

      const result = CovarianceRealism.computeConsistencyRatio(event);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.ratio).toBeGreaterThanOrEqual(0);
        expect(['optimistic', 'realistic', 'pessimistic']).toContain(result.assessment);
        expect(typeof result.isAppropriate).toBe('boolean');
      }
    });

    it('should classify small ratio as optimistic', () => {
      // Very small miss distance relative to covariance
      const event = createMockEvent(0.01 as Kilometers, wellConditionedCovariance);

      const result = CovarianceRealism.computeConsistencyRatio(event);

      if (result && result.ratio < 0.5) {
        expect(result.assessment).toBe('optimistic');
      }
    });
  });

  describe('assessScaleFactor', () => {
    it('should return null without covariance', () => {
      const event = createMockEvent(1.0 as Kilometers);

      const result = CovarianceRealism.assessScaleFactor(event);

      expect(result).toBeNull();
    });

    it('should assess scale factor with covariance', () => {
      const event = createMockEvent(1.0 as Kilometers, wellConditionedCovariance);

      const result = CovarianceRealism.assessScaleFactor(event);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.scaleFactor).toBeGreaterThan(0);
        expect(['too_small', 'appropriate', 'too_large']).toContain(result.assessment);
        expect(result.recommendation).toBeDefined();
      }
    });

    it('should detect too small covariance', () => {
      // Very small covariance - sigmas around 0.001 km = 1 meter
      // Expected min is 0.1 km = 100 meters, so this should be "too_small"
      const tinyCovariance = new StateCovariance(
        new Matrix([
          [1e-6, 0, 0, 0, 0, 0],
          [0, 1e-6, 0, 0, 0, 0],
          [0, 0, 1e-6, 0, 0, 0],
          [0, 0, 0, 1e-9, 0, 0],
          [0, 0, 0, 0, 1e-9, 0],
          [0, 0, 0, 0, 0, 1e-9],
        ]),
        CovarianceFrame.RIC,
      );

      const event = createMockEvent(1.0 as Kilometers, tinyCovariance);
      const result = CovarianceRealism.assessScaleFactor(event);

      if (result) {
        expect(result.assessment).toBe('too_small');
        expect(result.scaleFactor).toBeGreaterThan(1);
      }
    });
  });

  describe('assess (comprehensive)', () => {
    it('should perform comprehensive assessment with covariance', () => {
      const event = createMockEvent(1.0 as Kilometers, wellConditionedCovariance);

      const result = CovarianceRealism.assess(event);

      expect(result).toBeDefined();
      expect(typeof result.isRealistic).toBe('boolean');
      expect(result.realismScore).toBeGreaterThanOrEqual(0);
      expect(result.realismScore).toBeLessThanOrEqual(1);
      expect(result.metrics).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should return realistic assessment for good covariance', () => {
      const event = createMockEvent(1.0 as Kilometers, wellConditionedCovariance);

      const result = CovarianceRealism.assess(event);

      // Well-conditioned covariance with reasonable miss distance
      expect(result.realismScore).toBeGreaterThan(0.5);
    });

    it('should add warnings for ill-conditioned covariance', () => {
      const event = createMockEvent(1.0 as Kilometers, illConditionedCovariance);

      const result = CovarianceRealism.assess(event);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('ill-conditioned'))).toBe(true);
    });

    it('should add warnings for singular covariance', () => {
      const event = createMockEvent(1.0 as Kilometers, singularCovariance);

      const result = CovarianceRealism.assess(event);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('singular'))).toBe(true);
    });

    it('should handle event without covariance', () => {
      const event = createMockEvent(1.0 as Kilometers);

      const result = CovarianceRealism.assess(event);

      expect(result).toBeDefined();
      expect(result.metrics.mahalanobisDistance).toBeUndefined();
      expect(result.metrics.consistencyRatio).toBeUndefined();
    });
  });
});
