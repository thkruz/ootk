/**
 * @file BatchLeastSquaresOD accuracy test suite
 * @description Tests for perfect data accuracy across different orbit regimes
 */

import {
  ClassicalElements,
  DEG2RAD,
  Degrees,
  J2000,
  Kilometers,
  KilometersPerSecond,
  RAE,
  RadecTopocentric,
  Radians,
  Seconds,
  Vector3D,
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
 * Test Fixtures: Classical elements for each orbit regime
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

function createMeoOrbit(epoch: EpochUTC): ClassicalElements {
  return new ClassicalElements({
    epoch,
    semimajorAxis: 26560 as Kilometers,
    eccentricity: 0.01,
    inclination: (55.0 * DEG2RAD) as Radians,
    argPerigee: (45.0 * DEG2RAD) as Radians,
    rightAscension: (120.0 * DEG2RAD) as Radians,
    trueAnomaly: (30.0 * DEG2RAD) as Radians,
  });
}

function createGeoOrbit(epoch: EpochUTC): ClassicalElements {
  return new ClassicalElements({
    epoch,
    semimajorAxis: 42164 as Kilometers,
    eccentricity: 0.0001,
    inclination: (0.1 * DEG2RAD) as Radians,
    argPerigee: (180.0 * DEG2RAD) as Radians,
    rightAscension: (90.0 * DEG2RAD) as Radians,
    trueAnomaly: (0.0 * DEG2RAD) as Radians,
  });
}

function createHeoOrbit(epoch: EpochUTC): ClassicalElements {
  return new ClassicalElements({
    epoch,
    semimajorAxis: 24000 as Kilometers,
    eccentricity: 0.3,
    inclination: (63.4 * DEG2RAD) as Radians,
    argPerigee: (270.0 * DEG2RAD) as Radians,
    rightAscension: (0.0 * DEG2RAD) as Radians,
    trueAnomaly: (0.0 * DEG2RAD) as Radians,
  });
}

/*
 * ============================================================================
 * Test Helpers
 * ============================================================================
 */

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

function perturbState(state: J2000, posKm: number, velKmps: number): J2000 {
  const perturbedPos = new Vector3D(
    (state.position.x + posKm) as Kilometers,
    (state.position.y + posKm * 0.5) as Kilometers,
    (state.position.z - posKm * 0.3) as Kilometers,
  );
  const perturbedVel = new Vector3D(
    (state.velocity.x + velKmps) as KilometersPerSecond,
    (state.velocity.y - velKmps * 0.5) as KilometersPerSecond,
    (state.velocity.z + velKmps * 0.3) as KilometersPerSecond,
  );

  return new J2000(state.epoch, perturbedPos, perturbedVel);
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
 * Test Suite: Perfect Data Accuracy
 * ============================================================================
 */

describe('BatchLeastSquaresOD - Perfect Data Accuracy', () => {
  describe('LEO Orbit (ISS-like)', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));
    const sensor = createSensor('eastCoast');

    it('should converge with perfect optical observations', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(observations, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      expect(result.rms).toBeLessThan(1e-5);
      validateStateAccuracy(result.state, truthState, 0.01, 0.00001);
    });

    it('should converge with perfect radar observations', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateRadarObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(observations, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      expect(result.rms).toBeLessThan(1e-5);
      validateStateAccuracy(result.state, truthState, 0.01, 0.00001);
    });

    it('should converge with mixed optical + radar observations', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const opticalObs = generateOpticalObservations(propagator, sensor, epochs.slice(0, 5));
      const radarObs = generateRadarObservations(propagator, sensor, epochs.slice(5, 10));
      const mixedObs: Observation[] = [...opticalObs, ...radarObs];
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(mixedObs, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      expect(result.rms).toBeLessThan(1e-5);
      validateStateAccuracy(result.state, truthState, 0.01, 0.00001);
    });

    it('should converge with slightly perturbed apriori', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);
      const perturbedApriori = perturbState(truthState, 1.0, 0.001);

      const blsOd = new BatchLeastSquaresOD(observations, perturbedApriori);
      const result = blsOd.solve({ tolerance: 1e-6 });

      validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
    });
  });

  describe('MEO Orbit (GPS-like)', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createMeoOrbit(startEpoch));
    const sensor = createSensor('westCoast');

    it('should converge with perfect optical observations', () => {
      const epochs = generateEpochs(startEpoch, 8, 120);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(observations, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      expect(result.rms).toBeLessThan(1e-5);
      validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
    });

    it('should converge with perfect radar observations', () => {
      const epochs = generateEpochs(startEpoch, 8, 120);
      const observations = generateRadarObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(observations, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      expect(result.rms).toBeLessThan(1e-5);
      validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
    });
  });

  describe('GEO Orbit', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createGeoOrbit(startEpoch));
    const sensor = createSensor('hawaii');

    it('should converge with perfect optical observations', () => {
      const epochs = generateEpochs(startEpoch, 6, 300);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(observations, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      expect(result.rms).toBeLessThan(1e-5);
      validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
    });

    it('should converge with perfect radar observations', () => {
      const epochs = generateEpochs(startEpoch, 6, 300);
      const observations = generateRadarObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(observations, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      expect(result.rms).toBeLessThan(1e-5);
      validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
    });
  });

  describe('HEO Orbit (Molniya-like)', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createHeoOrbit(startEpoch));
    const sensor = createSensor('eastCoast');

    it('should converge with perfect optical observations', () => {
      const epochs = generateEpochs(startEpoch, 8, 180);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(observations, truthState);
      const result = blsOd.solve({ tolerance: 1e-5 });

      validateStateAccuracy(result.state, truthState, 1.0, 0.001);
    });

    it('should converge with perfect radar observations', () => {
      const epochs = generateEpochs(startEpoch, 8, 180);
      const observations = generateRadarObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(observations, truthState);
      const result = blsOd.solve({ tolerance: 1e-5 });

      validateStateAccuracy(result.state, truthState, 1.0, 0.001);
    });
  });
});
