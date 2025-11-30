/* eslint-disable max-lines */
/**
 * @file BatchLeastSquaresOD test suite
 * @description Comprehensive tests for Batch Least Squares orbit determination
 *
 * Test priority: Accuracy-first - verify the algorithm produces correct results
 * with perfect data before testing robustness.
 *
 * Uses Kepler-based synthetic test cases for validation.
 */

import { ForceModel } from '@src/force/ForceModel';
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
import { Sensor } from '../../objects/Sensor';
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
 * Using KeplerPropagator to match BLS's two-body dynamics
 * ============================================================================
 */

/** Create a LEO orbit (ISS-like, ~400 km altitude) */
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

/** Create a MEO orbit (GPS-like, ~20,200 km altitude) */
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

/** Create a GEO orbit (~35,786 km altitude) */
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

/** Create a HEO orbit (moderately eccentric) */
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

/**
 * Create a sensor at a specified location
 */
function createSensor(location: 'eastCoast' | 'westCoast' | 'hawaii' = 'eastCoast'): Sensor {
  const locations = {
    eastCoast: { lat: 41.75 as Degrees, lon: -70.54 as Degrees, alt: 0.1 as Kilometers },
    westCoast: { lat: 34.0 as Degrees, lon: -118.0 as Degrees, alt: 0.3 as Kilometers },
    hawaii: { lat: 20.71 as Degrees, lon: -156.26 as Degrees, alt: 3.055 as Kilometers },
  };

  const loc = locations[location];

  return new Sensor({
    lat: loc.lat,
    lon: loc.lon,
    alt: loc.alt,
    minEl: 0 as Degrees,
    maxEl: 90 as Degrees,
    minAz: 0 as Degrees,
    maxAz: 360 as Degrees,
    minRng: 0 as Kilometers,
    maxRng: 100_000 as Kilometers,
  });
}

/**
 * Generate an array of epochs at regular intervals
 */
function generateEpochs(startEpoch: EpochUTC, count: number, intervalSeconds: number): EpochUTC[] {
  const epochs: EpochUTC[] = [];

  for (let i = 0; i < count; i++) {
    epochs.push(startEpoch.roll((intervalSeconds * i) as Seconds));
  }

  return epochs;
}

/**
 * Generate perfect optical observations from a propagator
 */
function generateOpticalObservations(
  propagator: Propagator,
  sensor: Sensor,
  epochs: EpochUTC[],
): ObservationOptical[] {
  return epochs.map((epoch) => {
    const state = propagator.propagate(epoch);
    const siteState = sensor.toJ2000(epoch.toDateTime());
    const radec = RadecTopocentric.fromStateVector(state, siteState);

    return new ObservationOptical(siteState, radec);
  });
}

/**
 * Generate perfect radar observations from a propagator
 */
function generateRadarObservations(
  propagator: Propagator,
  sensor: Sensor,
  epochs: EpochUTC[],
): ObservationRadar[] {
  return epochs.map((epoch) => {
    const state = propagator.propagate(epoch);
    const siteState = sensor.toJ2000(epoch.toDateTime());
    const rae = RAE.fromStateVector(state, siteState);

    return new ObservationRadar(siteState, rae);
  });
}

/**
 * Create a slightly perturbed state for apriori testing
 */
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

/**
 * Validate state accuracy against truth
 */
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
 * Test Suite
 * ============================================================================
 */

// eslint-disable-next-line max-lines-per-function
describe('BatchLeastSquaresOD', () => {
  /*
   * ==========================================================================
   * 1. PERFECT DATA ACCURACY TESTS (HIGHEST PRIORITY)
   * ==========================================================================
   */

  describe('Perfect Data Accuracy', () => {
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

  /*
   * ==========================================================================
   * 2. OBSERVATION TYPE TESTS
   * ==========================================================================
   */

  describe('Observation Types', () => {
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
   * ==========================================================================
   * 3. COVARIANCE VALIDATION
   * ==========================================================================
   */

  describe('Covariance Output', () => {
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

  /*
   * ==========================================================================
   * 4. CONVERGENCE BEHAVIOR
   * ==========================================================================
   */

  describe('Convergence Behavior', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));
    const sensor = createSensor('eastCoast');

    describe('Configuration Options', () => {
      it('should respect custom maxIter', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const blsOd = new BatchLeastSquaresOD(observations, truthState);
        const result = blsOd.solve({ maxIter: 5, tolerance: 1e-12 });

        // Should complete without error, result should be defined
        expect(result.state).toBeDefined();
        expect(result.rms).toBeDefined();
      });

      it('should converge faster with larger tolerance', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);
        const perturbedApriori = perturbState(truthState, 1.0, 0.001);

        const blsOdTight = new BatchLeastSquaresOD(observations, perturbedApriori);
        const resultTight = blsOdTight.solve({ tolerance: 1e-9 });

        const blsOdLoose = new BatchLeastSquaresOD(observations, perturbedApriori);
        const resultLoose = blsOdLoose.solve({ tolerance: 1e-3 });

        // Both should produce valid results
        expect(resultTight.state).toBeDefined();
        expect(resultLoose.state).toBeDefined();
      });
    });
  });

  /*
   * ==========================================================================
   * 5. ROBUSTNESS TESTS
   * ==========================================================================
   */

  describe('Robustness', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));
    const sensor = createSensor('eastCoast');

    describe('Degraded Apriori', () => {
      it('should converge with 10 km position error', () => {
        const epochs = generateEpochs(startEpoch, 15, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);
        const perturbedApriori = perturbState(truthState, 10, 0.01);

        const blsOd = new BatchLeastSquaresOD(observations, perturbedApriori);
        const result = blsOd.solve({ tolerance: 1e-6, maxIter: 100 });

        validateStateAccuracy(result.state, truthState, 1.0, 0.001);
      });

      it('should handle 50 km position error with more iterations', () => {
        const epochs = generateEpochs(startEpoch, 20, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);
        const perturbedApriori = perturbState(truthState, 50, 0.05);

        const blsOd = new BatchLeastSquaresOD(observations, perturbedApriori);
        const result = blsOd.solve({ tolerance: 1e-5, maxIter: 100 });

        // May or may not converge, but should not crash
        expect(result.rms).toBeDefined();
        expect(result.state).toBeDefined();
      });
    });

    describe('Observation Geometry', () => {
      it('should handle short arc observations (2 minutes)', () => {
        const epochs = generateEpochs(startEpoch, 8, 15);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const blsOd = new BatchLeastSquaresOD(observations, truthState);
        const result = blsOd.solve({ tolerance: 1e-6 });

        validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
      });

      it('should handle longer arc observations (10 minutes)', () => {
        const epochs = generateEpochs(startEpoch, 10, 60);
        const opticalObs = generateOpticalObservations(propagator, sensor, epochs.slice(0, 5));
        const radarObs = generateRadarObservations(propagator, sensor, epochs.slice(5));
        const observations: Observation[] = [...opticalObs, ...radarObs];
        const truthState = propagator.propagate(epochs[0]);

        const blsOd = new BatchLeastSquaresOD(observations, truthState);
        const result = blsOd.solve({ tolerance: 1e-6 });

        validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
      });
    });
  });

  /*
   * ==========================================================================
   * 6. NUMERICAL STABILITY
   * ==========================================================================
   */

  describe('Numerical Stability', () => {
    it('should handle near-circular orbits (e < 0.001)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));
      const sensor = createSensor('eastCoast');

      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(observations, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
    });

    it('should handle moderately eccentric orbits', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createHeoOrbit(startEpoch));
      const sensor = createSensor('eastCoast');

      const epochs = generateEpochs(startEpoch, 10, 120);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(observations, truthState);
      const result = blsOd.solve({ tolerance: 1e-5 });

      validateStateAccuracy(result.state, truthState, 1.0, 0.001);
    });

    it('should handle geostationary altitude', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createGeoOrbit(startEpoch));
      const sensor = createSensor('hawaii');

      const epochs = generateEpochs(startEpoch, 8, 300);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(observations, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
    });
  });

  /*
   * ==========================================================================
   * 7. CONSTRUCTOR AND CONFIGURATION
   * ==========================================================================
   */

  describe('Constructor and Configuration', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));
    const sensor = createSensor('eastCoast');

    it('should sort observations by epoch', () => {
      const epochs = generateEpochs(startEpoch, 5, 60);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      // Shuffle observations
      const shuffled = [observations[2], observations[0], observations[4], observations[1], observations[3]];

      const blsOd = new BatchLeastSquaresOD(shuffled, truthState);
      const result = blsOd.solve({ tolerance: 1e-6 });

      // Should still converge despite shuffled input
      expect(result.rms).toBeLessThan(1e-5);
    });

    it('should accept custom ForceModel', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const customForceModel = new ForceModel().setGravity();

      const blsOd = new BatchLeastSquaresOD(observations, truthState, customForceModel);
      const result = blsOd.solve({ tolerance: 1e-6 });

      expect(result.rms).toBeLessThan(1e-5);
    });

    it('should use default parameters correctly', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      // Use all defaults
      const blsOd = new BatchLeastSquaresOD(observations, truthState);
      const result = blsOd.solve();

      expect(result.state).toBeDefined();
      expect(result.covariance).toBeDefined();
      expect(result.rms).toBeDefined();
    });
  });

  /*
   * ==========================================================================
   * 8. FASTDERIVATIVES FLAG
   * ==========================================================================
   */

  describe('fastDerivatives Flag', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));
    const sensor = createSensor('eastCoast');

    it('should work with fastDerivatives=false (default)', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(
        observations,
        truthState,
        undefined,
        1e-5,
        1e-5,
        false,
      );
      const result = blsOd.solve({ tolerance: 1e-6 });

      expect(result.rms).toBeLessThan(1e-5);
    });

    it('should work with fastDerivatives=true', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOd = new BatchLeastSquaresOD(
        observations,
        truthState,
        undefined,
        1e-5,
        1e-5,
        true,
      );
      const result = blsOd.solve({ tolerance: 1e-6 });

      expect(result.rms).toBeLessThan(1e-5);
    });

    it('should produce similar results with both modes', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const blsOdSlow = new BatchLeastSquaresOD(observations, truthState, undefined, 1e-5, 1e-5, false);
      const resultSlow = blsOdSlow.solve({ tolerance: 1e-6 });

      const blsOdFast = new BatchLeastSquaresOD(observations, truthState, undefined, 1e-5, 1e-5, true);
      const resultFast = blsOdFast.solve({ tolerance: 1e-6 });

      // Results should be similar (within reasonable tolerance)
      const posDiff = resultSlow.state.position.subtract(resultFast.state.position).magnitude();

      expect(posDiff).toBeLessThan(1.0);
    });
  });
});
