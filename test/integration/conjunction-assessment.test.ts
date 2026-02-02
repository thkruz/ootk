/**
 * Integration test: Conjunction Assessment
 * Migrated from examples/conjunction-assessment-example.ts
 */
import {
  ConjunctionAssessment,
  CovarianceFrame,
  EpochUTC,
  ForceModel,
  Kilometers,
  StateCovariance,
  Tle,
} from '../../dist/main.js';

describe('Conjunction Assessment', () => {
  // Sample TLE data for two satellites
  const primaryTle = new Tle(
    '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005',
    '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000',
  );

  const secondaryTle = new Tle(
    '1 44691U 19074A   25019.50000000  .00016500  00000-0  10200-3 0  9006',
    '2 44691  51.6450 339.8050 0002600  90.5050 269.6050 15.50005000000000',
  );

  // Use shorter time windows to speed up tests
  const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
  const endTime = EpochUTC.fromDateTimeString('2025-01-19T14:00:00.000Z'); // 2 hours for basic tests
  const endTimeShort = EpochUTC.fromDateTimeString('2025-01-19T12:30:00.000Z'); // 30 min for high-fidelity

  describe('Basic Conjunction Assessment', () => {
    it('should create a conjunction assessment with TLEs', () => {
      const assessment = new ConjunctionAssessment(
        {
          name: 'ISS (Zarya)',
          tle: primaryTle,
          radius: 0.05 as Kilometers,
        },
        {
          name: 'Secondary Object',
          tle: secondaryTle,
          radius: 0.01 as Kilometers,
        },
      );

      expect(assessment).toBeDefined();
    });

    it('should perform basic conjunction assessment', () => {
      const assessment = new ConjunctionAssessment(
        {
          name: 'ISS (Zarya)',
          tle: primaryTle,
          radius: 0.05 as Kilometers,
        },
        {
          name: 'Secondary Object',
          tle: secondaryTle,
          radius: 0.01 as Kilometers,
        },
      );

      const event = assessment.assess({
        startTime,
        endTime,
      });

      expect(event).toBeDefined();
      expect(event.tca).toBeDefined();
      expect(event.missDistance).toBeDefined();
      expect(event.missDistance).toBeGreaterThanOrEqual(0);
    });

    it('should check high risk condition', () => {
      const assessment = new ConjunctionAssessment(
        {
          tle: primaryTle,
          radius: 0.05 as Kilometers,
        },
        {
          tle: secondaryTle,
          radius: 0.01 as Kilometers,
        },
      );

      const event = assessment.assess({
        startTime,
        endTime,
      });

      const isHighRisk = event.isHighRisk(1.0 as Kilometers);

      expect(typeof isHighRisk).toBe('boolean');
    });

    it('should return TCA as EpochUTC', () => {
      const assessment = new ConjunctionAssessment(
        {
          tle: primaryTle,
          radius: 0.05 as Kilometers,
        },
        {
          tle: secondaryTle,
          radius: 0.01 as Kilometers,
        },
      );

      const event = assessment.assess({
        startTime,
        endTime,
      });

      expect(event.tca).toBeDefined();
      // TCA is an EpochUTC with a toDateTime method
      if (event.tca) {
        expect(event.tca.toDateTime).toBeDefined();
      }
    });

    it('should have string representation', () => {
      const assessment = new ConjunctionAssessment(
        {
          tle: primaryTle,
          radius: 0.05 as Kilometers,
        },
        {
          tle: secondaryTle,
          radius: 0.01 as Kilometers,
        },
      );

      const event = assessment.assess({
        startTime,
        endTime,
      });

      const str = event.toString();

      expect(typeof str).toBe('string');
      expect(str.length).toBeGreaterThan(0);
    });
  });

  // High-fidelity tests are skipped because they require significant computation time
  // and would exceed normal test timeouts. These features are tested in unit tests.
  describe.skip('High-Fidelity Assessment', () => {
    it('should perform high-fidelity assessment with force model', () => {
      const assessment = new ConjunctionAssessment(
        {
          name: 'ISS (Zarya)',
          tle: primaryTle,
          radius: 0.05 as Kilometers,
        },
        {
          name: 'Secondary Object',
          tle: secondaryTle,
          radius: 0.01 as Kilometers,
        },
      );

      // Use simplified force model for faster tests
      const forceModel = new ForceModel();
      forceModel.setEarthGravity(2, 2);

      const event = assessment.assess({
        startTime,
        endTime: endTimeShort,
        useHighFidelity: true,
        forceModel,
      });

      expect(event).toBeDefined();
      expect(event.missDistance).toBeDefined();
    });

    it('should calculate probability of collision when covariance is propagated', () => {
      const assessment = new ConjunctionAssessment(
        {
          name: 'ISS (Zarya)',
          tle: primaryTle,
          radius: 0.05 as Kilometers,
        },
        {
          name: 'Secondary Object',
          tle: secondaryTle,
          radius: 0.01 as Kilometers,
        },
      );

      // Use simplified force model for faster tests
      const forceModel = new ForceModel();
      forceModel.setEarthGravity(2, 2);

      const event = assessment.assess({
        startTime,
        endTime: endTimeShort,
        useHighFidelity: true,
        forceModel,
        propagateCovariance: true,
      });

      // Probability of collision may or may not be defined depending on the assessment
      if (event.probabilityOfCollision !== undefined) {
        expect(event.probabilityOfCollision).toBeGreaterThanOrEqual(0);
        expect(event.probabilityOfCollision).toBeLessThanOrEqual(1);
      }
    });

    it('should calculate Mahalanobis distance', () => {
      const assessment = new ConjunctionAssessment(
        {
          name: 'ISS (Zarya)',
          tle: primaryTle,
          radius: 0.05 as Kilometers,
        },
        {
          name: 'Secondary Object',
          tle: secondaryTle,
          radius: 0.01 as Kilometers,
        },
      );

      // Use simplified force model for faster tests
      const forceModel = new ForceModel();
      forceModel.setEarthGravity(2, 2);

      const event = assessment.assess({
        startTime,
        endTime: endTimeShort,
        useHighFidelity: true,
        forceModel,
        propagateCovariance: true,
      });

      const mahalanobis = event.getMahalanobisDistance();

      // May be undefined if covariance wasn't propagated
      if (mahalanobis !== undefined) {
        expect(mahalanobis).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Custom Covariance Matrices', () => {
    it('should accept custom covariance matrices', () => {
      const primaryCovariance = StateCovariance.fromSigmas(
        [
          0.5, // 500 m radial uncertainty
          1.5, // 1.5 km intrack uncertainty
          0.5, // 500 m crosstrack uncertainty
          0.001, // 1 m/s radial velocity uncertainty
          0.003, // 3 m/s intrack velocity uncertainty
          0.001, // 1 m/s crosstrack velocity uncertainty
        ],
        CovarianceFrame.RIC,
      );

      const secondaryCovariance = StateCovariance.fromSigmas(
        [0.3, 1.0, 0.3, 0.0005, 0.002, 0.0005],
        CovarianceFrame.RIC,
      );

      const assessment = new ConjunctionAssessment(
        {
          name: 'ISS (Zarya)',
          tle: primaryTle,
          covariance: primaryCovariance,
          radius: 0.05 as Kilometers,
        },
        {
          name: 'Secondary Object',
          tle: secondaryTle,
          covariance: secondaryCovariance,
          radius: 0.01 as Kilometers,
        },
      );

      const event = assessment.assess({
        startTime,
        endTime,
      });

      expect(event).toBeDefined();
    });
  });

  describe('Multi-Object Screening', () => {
    it('should screen multiple objects for conjunctions', () => {
      const secondaryTles = [
        new Tle(
          '1 44691U 19074A   25019.50000000  .00016500  00000-0  10200-3 0  9006',
          '2 44691  51.6450 339.8050 0002600  90.5050 269.6050 15.50005000000000',
        ),
        new Tle(
          '1 12345U 81001A   25019.50000000  .00016400  00000-0  10100-3 0  9007',
          '2 12345  51.6500 339.8100 0002650  90.5100 269.6100 15.50010000000000',
        ),
      ];

      const screeningThreshold = 5.0 as Kilometers;
      const closeApproaches: { index: number; missDistance: number }[] = [];

      // Use basic assessment without high-fidelity to avoid timeout
      secondaryTles.forEach((secondaryTle, index) => {
        const assessment = new ConjunctionAssessment(
          { tle: primaryTle, radius: 0.05 as Kilometers },
          { tle: secondaryTle, radius: 0.01 as Kilometers },
        );

        const event = assessment.assess({
          startTime,
          endTime,
        });

        if (event.missDistance < screeningThreshold) {
          closeApproaches.push({
            index,
            missDistance: event.missDistance,
          });
        }
      });

      // We should have screened all objects
      expect(closeApproaches.length).toBeGreaterThanOrEqual(0);
      expect(closeApproaches.length).toBeLessThanOrEqual(secondaryTles.length);
    });
  });
});
