/**
 * Integration test: Covariance Matrix calculations
 * Migrated from examples/covariance-matrix.ts
 */
import {
  CovarianceFrame,
  createCovarianceFromTle,
  createSampleCovarianceFromTle,
  TleLine1,
} from '../../dist/main.js';

describe('Covariance Matrix Calculations', () => {
  // Example TLE for the International Space Station
  const tle1 = '1 25544U 98067A   23054.45075046  .00008600  00000+0  16094-3 0  9999' as TleLine1;
  const tle2 = '2 25544  51.6417 203.5231 0005102 218.5493 303.0730 15.49367633384846';

  const tle1b = '1 25544U 98067A   25116.54581482  .00016635  00000+0  30629-3 0  9995' as TleLine1;
  const tle2b = '2 25544  51.6362 202.8258 0002482  75.3938 284.7326 15.49295384507153';

  describe('Basic Covariance Creation', () => {
    it('should create RIC frame covariance from TLE', () => {
      const covariance = createCovarianceFromTle(tle1, tle2, CovarianceFrame.RIC);

      expect(covariance).toBeDefined();
      expect(covariance.matrix).toBeDefined();
    });

    it('should have 6x6 covariance matrix', () => {
      const covariance = createCovarianceFromTle(tle1, tle2, CovarianceFrame.RIC);

      // Covariance matrix should be 6x6 for position and velocity
      expect(covariance.matrix.rows).toBe(6);
      expect(covariance.matrix.columns).toBe(6);
    });

    it('should calculate standard deviations (sigmas)', () => {
      const covariance = createCovarianceFromTle(tle1, tle2, CovarianceFrame.RIC);
      const sigmas = covariance.sigmas();

      expect(sigmas).toBeDefined();
      expect(sigmas.elements).toBeDefined();
      expect(sigmas.elements.length).toBe(6);

      // All sigmas should be positive
      sigmas.elements.forEach((sigma) => {
        expect(sigma).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have string representation', () => {
      const covariance = createCovarianceFromTle(tle1, tle2, CovarianceFrame.RIC);
      const sigmas = covariance.sigmas();
      const str = sigmas.toString();

      expect(typeof str).toBe('string');
      expect(str.length).toBeGreaterThan(0);
    });
  });

  describe('Sample-Based Covariance', () => {
    it('should create sample-based covariance from TLE', () => {
      const sampleCovariance = createSampleCovarianceFromTle(tle1, tle2);

      expect(sampleCovariance).toBeDefined();
      expect(sampleCovariance.matrix).toBeDefined();
    });

    it('should have positive radial uncertainty', () => {
      const sampleCovariance = createSampleCovarianceFromTle(tle1, tle2);
      const sigmas = sampleCovariance.sigmas();

      // Radial uncertainty (first element)
      expect(sigmas.elements[0]).toBeGreaterThan(0);
    });

    it('should have positive intrack uncertainty', () => {
      const sampleCovariance = createSampleCovarianceFromTle(tle1, tle2);
      const sigmas = sampleCovariance.sigmas();

      // Intrack uncertainty (second element)
      expect(sigmas.elements[1]).toBeGreaterThan(0);
    });

    it('should have positive crosstrack uncertainty', () => {
      const sampleCovariance = createSampleCovarianceFromTle(tle1, tle2);
      const sigmas = sampleCovariance.sigmas();

      // Crosstrack uncertainty (third element)
      expect(sigmas.elements[2]).toBeGreaterThan(0);
    });
  });

  describe('Different TLE Sets', () => {
    it('should calculate covariance for different TLE', () => {
      const sampleCovariance = createSampleCovarianceFromTle(tle1b, tle2b);
      const sigmas = sampleCovariance.sigmas();

      expect(sigmas.elements[0]).toBeGreaterThan(0);
      expect(sigmas.elements[1]).toBeGreaterThan(0);
      expect(sigmas.elements[2]).toBeGreaterThan(0);
    });

    it('should have different uncertainties for different TLEs', () => {
      const covariance1 = createSampleCovarianceFromTle(tle1, tle2);
      const covariance2 = createSampleCovarianceFromTle(tle1b, tle2b);

      const sigmas1 = covariance1.sigmas();
      const sigmas2 = covariance2.sigmas();

      // Different TLEs may have different uncertainty characteristics
      // At least one should be different
      const allSame =
        sigmas1.elements[0] === sigmas2.elements[0] &&
        sigmas1.elements[1] === sigmas2.elements[1] &&
        sigmas1.elements[2] === sigmas2.elements[2];

      // They likely have different values
      expect(allSame).toBe(false);
    });
  });

  describe('Covariance Frame Types', () => {
    it('should create covariance in RIC frame', () => {
      const covariance = createCovarianceFromTle(tle1, tle2, CovarianceFrame.RIC);

      expect(covariance).toBeDefined();
    });
  });

  describe('Matrix Properties', () => {
    it('should have symmetric covariance matrix', () => {
      const covariance = createCovarianceFromTle(tle1, tle2, CovarianceFrame.RIC);
      const elements = covariance.matrix.elements;

      // Check symmetry: elements[i][j] should equal elements[j][i]
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          expect(elements[i][j]).toBeCloseTo(elements[j][i], 10);
        }
      }
    });

    it('should have non-negative diagonal elements', () => {
      const covariance = createCovarianceFromTle(tle1, tle2, CovarianceFrame.RIC);
      const elements = covariance.matrix.elements;

      // Diagonal elements are variances, should be non-negative
      for (let i = 0; i < 6; i++) {
        expect(elements[i][i]).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
