/**
 * @file BatchLeastSquaresOD observation types test suite
 * @description Tests for observation types and covariance output
 */

import {
  ClassicalElements,
  DEG2RAD,
  Degrees,
  J2000,
  Kilometers,
  RAE,
  RadecTopocentric,
  Radians,
  Seconds,
} from '@src/main';
import { GroundStation } from '../../objects/GroundStation';
import { Observation } from '@src/observation/Observation';
import { ObservationOptical } from '@src/observation/ObservationOptical';
import { ObservationRadar } from '@src/observation/ObservationRadar';
import { BatchLeastSquaresOD } from '@src/orbit-determination/BatchLeastSquaresOD';
import { KeplerPropagator } from '@src/propagator/KeplerPropagator';
import { Propagator } from '@src/propagator/Propagator';
import { EpochUTC } from '@src/time';

/*
 * ============================================================================
 * Test Helpers
 * ============================================================================
 */

function createLeoOrbit(epoch: EpochUTC): ClassicalElements {
  return new ClassicalElements({
    epoch,
    semimajorAxis: 6778 as Kilometers,
    eccentricity: 0.0001,
    inclination: (51.6 * DEG2RAD) as Radians,
    argPerigee: (90.0 * DEG2RAD) as Radians,
    rightAscension: (45.0 * DEG2RAD) as Radians,
    trueAnomaly: (0.0 * DEG2RAD) as Radians,
  });
}

function createSensor(location: 'eastCoast' | 'westCoast' | 'hawaii' = 'eastCoast'): GroundStation {
  const locations = {
    eastCoast: { lat: 41.75 as Degrees, lon: -70.54 as Degrees, alt: 0.1 as Kilometers },
    westCoast: { lat: 34.0 as Degrees, lon: -118.0 as Degrees, alt: 0.3 as Kilometers },
    hawaii: { lat: 20.71 as Degrees, lon: -156.26 as Degrees, alt: 3.055 as Kilometers },
  };

  const loc = locations[location];

  return new GroundStation({
    lat: loc.lat,
    lon: loc.lon,
    alt: loc.alt,
  });
}

function generateEpochs(startEpoch: EpochUTC, count: number, intervalSeconds: number): EpochUTC[] {
  const epochs: EpochUTC[] = [];

  for (let i = 0; i < count; i++) {
    epochs.push(startEpoch.roll((intervalSeconds * i) as Seconds));
  }

  return epochs;
}

function generateOpticalObservations(
  propagator: Propagator,
  sensor: GroundStation,
  epochs: EpochUTC[],
): ObservationOptical[] {
  return epochs.map((epoch) => {
    const state = propagator.propagate(epoch);
    const siteState = sensor.toJ2000(epoch.toDateTime());
    const radec = RadecTopocentric.fromStateVector(state, siteState);

    return new ObservationOptical(siteState, radec);
  });
}

function generateRadarObservations(
  propagator: Propagator,
  sensor: GroundStation,
  epochs: EpochUTC[],
): ObservationRadar[] {
  return epochs.map((epoch) => {
    const state = propagator.propagate(epoch);
    const siteState = sensor.toJ2000(epoch.toDateTime());
    const rae = RAE.fromStateVector(state, siteState);

    return new ObservationRadar(siteState, rae);
  });
}

function validateStateAccuracy(
  computed: J2000,
  truth: J2000,
  posTolKm: number,
  velTolKmps: number,
): void {
  const posError = computed.position.subtract(truth.position).magnitude();
  const velError = computed.velocity.subtract(truth.velocity).magnitude();

  expect(posError).toBeLessThan(posTolKm);
  expect(velError).toBeLessThan(velTolKmps);
}

/*
 * ============================================================================
 * Test Suite: Observation Types
 * ============================================================================
 */

describe('BatchLeastSquaresOD - Observation Types', () => {
  const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
  const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));
  const sensor = createSensor('eastCoast');

  describe('ObservationOptical (RA/Dec)', () => {
    it('should handle varying numbers of observations (6, 10, 20)', () => {
      const truthState = propagator.propagate(startEpoch);

      for (const count of [6, 10, 20]) {
        const epochs = generateEpochs(startEpoch, count, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);

        const blsOd = new BatchLeastSquaresOD(observations, truthState);
        const result = blsOd.solve({ tolerance: 1e-6 });

        expect(result.rms).toBeLessThan(1e-5);
      }
    });

    it('should work with observations from multiple sensors', () => {
      const sensor1 = createSensor('eastCoast');
      const sensor2 = createSensor('westCoast');
      const epochs = generateEpochs(startEpoch, 10, 30);
      const truthState = propagator.propagate(epochs[0]);

      const obs1 = generateOpticalObservations(propagator, sensor1, epochs.slice(0, 5));
      const obs2 = generateOpticalObservations(propagator, sensor2, epochs.slice(5, 10));
      const allObs = [...obs1, ...obs2];

      const blsOd = new BatchLeastSquaresOD(allObs, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      validateStateAccuracy(result.state, truthState, 0.01, 0.00001);
    });
  });

  describe('ObservationRadar (Range/Az/El)', () => {
    it('should handle varying numbers of observations (6, 10, 20)', () => {
      const truthState = propagator.propagate(startEpoch);

      for (const count of [6, 10, 20]) {
        const epochs = generateEpochs(startEpoch, count, 30);
        const observations = generateRadarObservations(propagator, sensor, epochs);

        const blsOd = new BatchLeastSquaresOD(observations, truthState);
        const result = blsOd.solve({ tolerance: 1e-6 });

        expect(result.rms).toBeLessThan(1e-5);
      }
    });

    it('should work with observations from multiple sensors', () => {
      const sensor1 = createSensor('eastCoast');
      const sensor2 = createSensor('hawaii');
      const epochs = generateEpochs(startEpoch, 10, 30);
      const truthState = propagator.propagate(epochs[0]);

      const obs1 = generateRadarObservations(propagator, sensor1, epochs.slice(0, 5));
      const obs2 = generateRadarObservations(propagator, sensor2, epochs.slice(5, 10));
      const allObs = [...obs1, ...obs2];

      const blsOd = new BatchLeastSquaresOD(allObs, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      validateStateAccuracy(result.state, truthState, 0.01, 0.00001);
    });
  });

  describe('Mixed Optical + Radar', () => {
    it('should properly weight mixed observation types', () => {
      const epochs = generateEpochs(startEpoch, 12, 30);
      const truthState = propagator.propagate(epochs[0]);

      // Interleave optical and radar
      const opticalObs = generateOpticalObservations(propagator, sensor, epochs.filter((_, i) => i % 2 === 0));
      const radarObs = generateRadarObservations(propagator, sensor, epochs.filter((_, i) => i % 2 === 1));
      const mixedObs: Observation[] = [...opticalObs, ...radarObs];

      const blsOd = new BatchLeastSquaresOD(mixedObs, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      validateStateAccuracy(result.state, truthState, 0.01, 0.00001);
    });
  });
});

/*
 * ============================================================================
 * Test Suite: Covariance Output
 * ============================================================================
 */

describe('BatchLeastSquaresOD - Covariance Output', () => {
  const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
  const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));
  const sensor = createSensor('eastCoast');

  it('should return positive diagonal elements', () => {
    const epochs = generateEpochs(startEpoch, 10, 30);
    const observations = generateOpticalObservations(propagator, sensor, epochs);
    const truthState = propagator.propagate(epochs[0]);

    const blsOd = new BatchLeastSquaresOD(observations, truthState);
    const result = blsOd.solve({ tolerance: 1e-6 });

    const covMatrix = result.covariance.matrix;

    // All diagonal elements should be positive
    for (let i = 0; i < 6; i++) {
      expect(covMatrix.elements[i][i]).toBeGreaterThan(0);
    }
  });

  it('should return symmetric covariance matrix', () => {
    const epochs = generateEpochs(startEpoch, 10, 30);
    const observations = generateOpticalObservations(propagator, sensor, epochs);
    const truthState = propagator.propagate(epochs[0]);

    const blsOd = new BatchLeastSquaresOD(observations, truthState);
    const result = blsOd.solve({ tolerance: 1e-6 });

    const covMatrix = result.covariance.matrix;

    // Matrix should be symmetric
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        expect(covMatrix.elements[i][j]).toBeCloseTo(covMatrix.elements[j][i], 10);
      }
    }
  });

  it('should decrease covariance with more observations', () => {
    const truthState = propagator.propagate(startEpoch);

    // Fewer observations
    const epochs6 = generateEpochs(startEpoch, 6, 30);
    const obs6 = generateOpticalObservations(propagator, sensor, epochs6);
    const blsOd6 = new BatchLeastSquaresOD(obs6, truthState);
    const result6 = blsOd6.solve({ tolerance: 1e-6 });

    // More observations
    const epochs20 = generateEpochs(startEpoch, 20, 30);
    const obs20 = generateOpticalObservations(propagator, sensor, epochs20);
    const blsOd20 = new BatchLeastSquaresOD(obs20, truthState);
    const result20 = blsOd20.solve({ tolerance: 1e-6 });

    // Calculate trace (sum of diagonal elements)
    const cov6 = result6.covariance.matrix;
    const cov20 = result20.covariance.matrix;
    let trace6 = 0;
    let trace20 = 0;

    for (let i = 0; i < 6; i++) {
      trace6 += cov6.elements[i][i];
      trace20 += cov20.elements[i][i];
    }

    expect(trace20).toBeLessThan(trace6);
  });
});
