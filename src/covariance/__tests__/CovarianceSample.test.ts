import { ForceModel } from '../../force/ForceModel';
import { Thrust } from '../../force/Thrust';
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Matrix, MetersPerSecond, SecondsPerMeterPerSecond, Tle, TleLine1, TleLine2, Vector3D } from '../../main';
import { CovarianceSample } from '../CovarianceSample';
import { CovarianceFrame, StateCovariance } from '../StateCovariance';

describe('CovarianceSample', () => {
  let epoch: EpochUTC;
  let state: J2000;
  let covariance: StateCovariance;

  beforeEach(() => {
    epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
    state = new J2000(
      epoch,
      new Vector3D(6778.0 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers),
      new Vector3D(0.0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0.0 as KilometersPerSecond),
    );
    const matrix = Matrix.identity(6).scale(0.001);

    covariance = new StateCovariance(matrix, CovarianceFrame.ECI);
  });

  describe('constructor', () => {
    it('should create a CovarianceSample with ECI covariance', () => {
      const sample = new CovarianceSample(state, covariance);

      expect(sample.epoch).toEqual(state.epoch);
      expect(sample.state.position.x).toBeCloseTo(state.position.x, 6);
    });

    it('should create a CovarianceSample with RIC covariance', () => {
      const ricCovariance = new StateCovariance(Matrix.identity(6).scale(0.001), CovarianceFrame.RIC);
      const sample = new CovarianceSample(state, ricCovariance);

      expect(sample.epoch).toEqual(state.epoch);
    });

    it('should use default force models when not provided', () => {
      const sample = new CovarianceSample(state, covariance);

      expect(sample).toBeDefined();
    });

    it('should use custom force models when provided', () => {
      const forceModel = new ForceModel().setGravity();
      const sample = new CovarianceSample(state, covariance, undefined, forceModel, forceModel);

      expect(sample).toBeDefined();
    });
  });

  describe('propagate', () => {
    it('should propagate to a new epoch', () => {
      const sample = new CovarianceSample(state, covariance);
      const newEpoch = EpochUTC.fromDateTime(new Date('2024-01-01T01:00:00.000Z'));

      sample.propagate(newEpoch);
      expect(sample.epoch.toDateTime()).toEqual(newEpoch.toDateTime());
    });
  });

  describe('maneuver', () => {
    it('should apply a maneuver', () => {
      const sample = new CovarianceSample(state, covariance);
      const initialVelocity = new Vector3D(0.001 as KilometersPerSecond, 0.0 as KilometersPerSecond, 0.0 as KilometersPerSecond);
      const thrust = new Thrust(
        EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z')),
        initialVelocity.x * 1000 as MetersPerSecond,
        initialVelocity.y * 1000 as MetersPerSecond,
        initialVelocity.z * 1000 as MetersPerSecond,
        600 as SecondsPerMeterPerSecond, // duration in seconds
      );

      expect(() => sample.maneuver(thrust)).not.toThrow();
    });
  });

  describe('desampleJ2000', () => {
    it('should desample covariance in J2000 frame', () => {
      const sample = new CovarianceSample(state, covariance);
      const desampled = sample.desampleJ2000();

      expect(desampled.frame).toBe(CovarianceFrame.ECI);
      expect(desampled.matrix.rows).toBe(6);
      expect(desampled.matrix.columns).toBe(6);
    });
  });

  describe('desampleRIC', () => {
    it('should desample covariance in RIC frame', () => {
      const sample = new CovarianceSample(state, covariance);
      const desampled = sample.desampleRIC();

      expect(desampled.frame).toBe(CovarianceFrame.RIC);
      expect(desampled.matrix.rows).toBe(6);
      expect(desampled.matrix.columns).toBe(6);
    });
  });

  describe('evaluateTleQuality', () => {
    it('should return quality factors for low drag TLE', () => {
      const tle = new Tle(
        '1 25544U 98067A   24001.00000000  .00000000  00000-0  00000-0 0  9999' as TleLine1,
        '2 25544  51.6400   0.0000 0001000   0.0000   0.0000 15.50000000000000' as TleLine2,
      );
      const sample = new CovarianceSample(state, covariance);
      const quality = sample.evaluateTleQuality(tle);

      expect(quality).toHaveLength(3);
      expect(quality[0]).toBeGreaterThan(0);
      expect(quality[1]).toBeGreaterThan(0);
      expect(quality[2]).toBeGreaterThan(0);
    });
  });

  describe('getRegimeAgingFactor', () => {
    it('should return aging factors for LEO regime', () => {
      const tle = new Tle(
        '1 25544U 98067A   24001.00000000  .00000000  00000-0  00000-0 0  9999' as TleLine1,
        '2 25544  51.6400   0.0000 0001000   0.0000   0.0000 15.50000000000000' as TleLine2,
      );
      const sample = new CovarianceSample(state, covariance);
      const factors = sample.getRegimeAgingFactor(tle, 1.0);

      expect(factors).toHaveLength(3);
      expect(factors[0]).toBeGreaterThanOrEqual(1);
      expect(factors[1]).toBeGreaterThanOrEqual(1);
      expect(factors[2]).toBeGreaterThanOrEqual(1);
    });

    it('should handle zero age days', () => {
      const tle = new Tle(
        '1 25544U 98067A   24001.00000000  .00000000  00000-0  00000-0 0  9999' as TleLine1,
        '2 25544  51.6400   0.0000 0001000   0.0000   0.0000 15.50000000000000' as TleLine2,
      );
      const sample = new CovarianceSample(state, covariance);
      const factors = sample.getRegimeAgingFactor(tle, 0);

      expect(factors).toEqual([1, 1, 1]);
    });
  });
});
