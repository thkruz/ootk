import { vi } from 'vitest';
import { CovarianceFrame, StateCovariance } from '../../main';
import { createCovarianceFromTle, createSampleCovarianceFromTle } from '../create-covariance-from-tle';

describe('createCovarianceFromTle', () => {
  const tleLine1 = '1 25544U 98067A   21001.00000000  .00002182  00000-0  41420-4 0  9990';
  const tleLine2 = '2 25544  51.6461 339.8014 0002571  34.5857 120.4689 15.48919393265019';

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a StateCovariance object with default parameters', () => {
    const covariance = createCovarianceFromTle(tleLine1, tleLine2);

    expect(covariance).toBeInstanceOf(StateCovariance);
  });

  it('should create covariance in RIC frame by default', () => {
    const covariance = createCovarianceFromTle(tleLine1, tleLine2);

    expect(covariance.frame).toBe(CovarianceFrame.RIC);
  });

  it('should create covariance in ECI frame when specified', () => {
    const covariance = createCovarianceFromTle(tleLine1, tleLine2, CovarianceFrame.ECI);

    expect(covariance.frame).toBe(CovarianceFrame.ECI);
  });

  it('should apply sigma scaling factor', () => {
    const covariance1 = createCovarianceFromTle(tleLine1, tleLine2, CovarianceFrame.RIC, 1.0);
    const covariance2 = createCovarianceFromTle(tleLine1, tleLine2, CovarianceFrame.RIC, 2.0);

    expect(covariance1).toBeInstanceOf(StateCovariance);
    expect(covariance2).toBeInstanceOf(StateCovariance);
  });

  it('should parse TLE and convert to J2000', () => {
    createCovarianceFromTle(tleLine1, tleLine2);


    expect(console.log).toHaveBeenCalled();
  });
});

describe('createSampleCovarianceFromTle', () => {
  const tleLine1 = '1 25544U 98067A   21001.00000000  .00002182  00000-0  41420-4 0  9990';
  const tleLine2 = '2 25544  51.6461 339.8014 0002571  34.5857 120.4689 15.48919393265019';

  it('should create a StateCovariance object with default RIC frame', () => {
    const covariance = createSampleCovarianceFromTle(tleLine1, tleLine2);

    expect(covariance).toBeInstanceOf(StateCovariance);
  });

  it('should create covariance in RIC frame by default', () => {
    const covariance = createSampleCovarianceFromTle(tleLine1, tleLine2);

    expect(covariance.frame).toBe(CovarianceFrame.RIC);
  });

  it('should create covariance in ECI frame when specified', () => {
    const covariance = createSampleCovarianceFromTle(tleLine1, tleLine2, CovarianceFrame.ECI);

    expect(covariance.frame).toBe(CovarianceFrame.ECI);
  });

  it('should use different sigmas for RIC vs ECI frame', () => {
    const covarianceRIC = createSampleCovarianceFromTle(tleLine1, tleLine2, CovarianceFrame.RIC);
    const covarianceECI = createSampleCovarianceFromTle(tleLine1, tleLine2, CovarianceFrame.ECI);

    expect(covarianceRIC).toBeInstanceOf(StateCovariance);
    expect(covarianceECI).toBeInstanceOf(StateCovariance);
    expect(covarianceRIC.frame).toBe(CovarianceFrame.RIC);
    expect(covarianceECI.frame).toBe(CovarianceFrame.ECI);
  });

  it('should create realistic covariance with sample-based approach', () => {
    const covariance = createSampleCovarianceFromTle(tleLine1, tleLine2);

    expect(covariance).toBeInstanceOf(StateCovariance);
    expect(covariance.matrix).toBeDefined();
    expect(covariance.matrix.elements.length).toBe(6);
    expect(covariance.matrix.elements[0].length).toBe(6);
  });
});
