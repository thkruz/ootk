import { Matrix } from '../../main';
import { CovarianceFrame, StateCovariance } from '../StateCovariance';

describe('StateCovariance', () => {
  describe('constructor', () => {
    it('should create a StateCovariance with given matrix and frame', () => {
      const matrix = Matrix.identity(3);
      const covariance = new StateCovariance(matrix, CovarianceFrame.ECI);

      expect(covariance.matrix).toBe(matrix);
      expect(covariance.frame).toBe(CovarianceFrame.ECI);
    });

    it('should create a StateCovariance with RIC frame', () => {
      const matrix = Matrix.identity(3);
      const covariance = new StateCovariance(matrix, CovarianceFrame.RIC);

      expect(covariance.frame).toBe(CovarianceFrame.RIC);
    });
  });

  describe('fromSigmas', () => {
    it('should create covariance matrix from sigma values', () => {
      const sigmas = [1.0, 2.0, 3.0];
      const covariance = StateCovariance.fromSigmas(sigmas, CovarianceFrame.ECI);

      expect(covariance.frame).toBe(CovarianceFrame.ECI);
      expect(covariance.matrix.elements[0][0]).toBeCloseTo(1.0);
      expect(covariance.matrix.elements[1][1]).toBeCloseTo(4.0);
      expect(covariance.matrix.elements[2][2]).toBeCloseTo(9.0);
    });

    it('should handle very small sigma values with minimum threshold', () => {
      const sigmas = [1e-20, 1e-18];
      const covariance = StateCovariance.fromSigmas(sigmas, CovarianceFrame.RIC);

      expect(covariance.matrix.elements[0][0]).toBe(1e-32);
      expect(covariance.matrix.elements[1][1]).toBe(1e-32);
    });

    it('should create diagonal matrix with off-diagonal zeros', () => {
      const sigmas = [1.0, 2.0, 3.0];
      const covariance = StateCovariance.fromSigmas(sigmas, CovarianceFrame.ECI);

      expect(covariance.matrix.elements[0][1]).toBe(0);
      expect(covariance.matrix.elements[0][2]).toBe(0);
      expect(covariance.matrix.elements[1][0]).toBe(0);
      expect(covariance.matrix.elements[1][2]).toBe(0);
    });
  });

  describe('sigmas', () => {
    it('should calculate standard deviations from covariance matrix', () => {
      const matrix = new Matrix([[1.0, 0, 0], [0, 4.0, 0], [0, 0, 9.0]]);
      const covariance = new StateCovariance(matrix, CovarianceFrame.ECI);
      const sigmas = covariance.sigmas();

      expect(sigmas.x).toBeCloseTo(1.0);
      expect(sigmas.y).toBeCloseTo(2.0);
      expect(sigmas.z).toBeCloseTo(3.0);
    });

    it('should return vector with correct length', () => {
      const matrix = Matrix.identity(6);
      const covariance = new StateCovariance(matrix, CovarianceFrame.RIC);
      const sigmas = covariance.sigmas();

      expect(sigmas.toArray().length).toBe(6);
    });

    it('should handle zero variance values', () => {
      const matrix = new Matrix([[0, 0], [0, 1.0]]);
      const covariance = new StateCovariance(matrix, CovarianceFrame.ECI);
      const sigmas = covariance.sigmas();

      expect(sigmas.toArray()[0]).toBe(0);
      expect(sigmas.toArray()[1]).toBeCloseTo(1.0);
    });
  });

  describe('CovarianceFrame', () => {
    it('should have ECI frame value', () => {
      expect(CovarianceFrame.ECI).toBe('eci');
    });

    it('should have RIC frame value', () => {
      expect(CovarianceFrame.RIC).toBe('ric');
    });
  });
});
