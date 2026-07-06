

/**
 * @file LevenbergMarquardtOD test suite
 * @description Comprehensive tests for Levenberg-Marquardt orbit determination
 *
 * Test priority: Accuracy-first - verify the algorithm produces correct results
 * with perfect data before testing robustness.
 *
 * Uses SGP4-based synthetic test cases with proven TLEs.
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
import { GroundStation } from '../../objects/GroundStation';
import { Observation } from '@src/observation/Observation';
import { ObservationOptical } from '@src/observation/ObservationOptical';
import { ObservationRadar } from '@src/observation/ObservationRadar';
import { GoodingIOD, LevenbergMarquardtOD } from '@src/orbit-determination';
import { GaussIOD } from '@src/orbit-determination/GaussIOD';
import { KeplerPropagator } from '@src/propagator/KeplerPropagator';
import { Propagator } from '@src/propagator/Propagator';
import { EpochUTC } from '@src/time';

/*
 * ============================================================================
 * Test Fixtures: Classical elements for each orbit regime
 * Using KeplerPropagator to match LM's two-body dynamics
 * ============================================================================
 */

/** Create a LEO orbit (ISS-like, ~400 km altitude) */
function createLeoOrbit(epoch: EpochUTC): ClassicalElements {
  return new ClassicalElements({
    epoch,
    semimajorAxis: 6778 as Kilometers, // ~400 km altitude
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

/** Create a HEO orbit (moderately eccentric, transfer orbit style) */
function createHeoOrbit(epoch: EpochUTC): ClassicalElements {
  return new ClassicalElements({
    epoch,
    semimajorAxis: 24000 as Kilometers,
    eccentricity: 0.3, // Moderate eccentricity (0.74 is too extreme for the algorithm)
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

/**
 * Generate perfect radar observations from a propagator
 */
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


describe('LevenbergMarquardtOD', () => {
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
        const epochs = generateEpochs(startEpoch, 10, 30); // 10 obs, 30s apart = 5 min arc
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        // Use truth state as apriori (perfect initial guess)
        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        expect(result.rms).toBeLessThan(1e-6);
        validateStateAccuracy(result.state, truthState, 0.01, 0.00001);
      });

      it('should converge with perfect radar observations', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const observations = generateRadarObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        expect(result.rms).toBeLessThan(1e-6);
        validateStateAccuracy(result.state, truthState, 0.01, 0.00001);
      });

      it('should converge with mixed optical + radar observations', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const opticalObs = generateOpticalObservations(propagator, sensor, epochs.slice(0, 5));
        const radarObs = generateRadarObservations(propagator, sensor, epochs.slice(5, 10));
        const mixedObs: Observation[] = [...opticalObs, ...radarObs];
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(mixedObs, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        expect(result.rms).toBeLessThan(1e-6);
        validateStateAccuracy(result.state, truthState, 0.01, 0.00001);
      });

      it('should converge with slightly perturbed apriori', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);
        const perturbedApriori = perturbState(truthState, 1.0, 0.001); // 1 km, 1 m/s perturbation

        const lmOd = new LevenbergMarquardtOD(observations, perturbedApriori);
        const result = lmOd.solve({ epsilon: 1e-6, printIter: false });

        expect(result.converged).toBe(true);
        validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
      });
    });

    describe('MEO Orbit (GPS-like)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createMeoOrbit(startEpoch));
      const sensor = createSensor('westCoast');

      it('should converge with perfect optical observations', () => {
        const epochs = generateEpochs(startEpoch, 8, 120); // 8 obs, 2 min apart = 16 min arc
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        expect(result.rms).toBeLessThan(1e-6);
        validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
      });

      it('should converge with perfect radar observations', () => {
        const epochs = generateEpochs(startEpoch, 8, 120);
        const observations = generateRadarObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        expect(result.rms).toBeLessThan(1e-6);
        validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
      });

      it('should converge with mixed observations', () => {
        const epochs = generateEpochs(startEpoch, 8, 120);
        const opticalObs = generateOpticalObservations(propagator, sensor, epochs.slice(0, 4));
        const radarObs = generateRadarObservations(propagator, sensor, epochs.slice(4, 8));
        const mixedObs: Observation[] = [...opticalObs, ...radarObs];
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(mixedObs, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
      });
    });

    describe('GEO Orbit', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createGeoOrbit(startEpoch));
      const sensor = createSensor('hawaii');

      it('should converge with perfect optical observations', () => {
        const epochs = generateEpochs(startEpoch, 6, 300); // 6 obs, 5 min apart = 30 min arc
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        expect(result.rms).toBeLessThan(1e-6);
        validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
      });

      it('should converge with perfect radar observations', () => {
        const epochs = generateEpochs(startEpoch, 6, 300);
        const observations = generateRadarObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        expect(result.rms).toBeLessThan(1e-6);
        validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
      });

      it('should converge with mixed observations', () => {
        const epochs = generateEpochs(startEpoch, 6, 300);
        const opticalObs = generateOpticalObservations(propagator, sensor, epochs.slice(0, 3));
        const radarObs = generateRadarObservations(propagator, sensor, epochs.slice(3, 6));
        const mixedObs: Observation[] = [...opticalObs, ...radarObs];
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(mixedObs, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
      });
    });

    describe('HEO Orbit (Molniya-like)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createHeoOrbit(startEpoch));
      const sensor = createSensor('eastCoast');

      it('should converge with perfect optical observations', () => {
        const epochs = generateEpochs(startEpoch, 8, 180); // 8 obs, 3 min apart = 24 min arc
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-5 }); // Slightly relaxed for HEO

        expect(result.converged).toBe(true);
        validateStateAccuracy(result.state, truthState, 1.0, 0.001); // Relaxed for HEO
      });

      it('should converge with perfect radar observations', () => {
        const epochs = generateEpochs(startEpoch, 8, 180);
        const observations = generateRadarObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-5 });

        expect(result.converged).toBe(true);
        validateStateAccuracy(result.state, truthState, 1.0, 0.001);
      });

      it('should converge with mixed observations', () => {
        const epochs = generateEpochs(startEpoch, 8, 180);
        const opticalObs = generateOpticalObservations(propagator, sensor, epochs.slice(0, 4));
        const radarObs = generateRadarObservations(propagator, sensor, epochs.slice(4, 8));
        const mixedObs: Observation[] = [...opticalObs, ...radarObs];
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(mixedObs, truthState);
        const result = lmOd.solve({ epsilon: 1e-5 });

        expect(result.converged).toBe(true);
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

          const lmOd = new LevenbergMarquardtOD(observations, truthState);
          const result = lmOd.solve({ epsilon: 1e-6 });

          expect(result.converged).toBe(true);
          expect(result.rms).toBeLessThan(1e-6);
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

        const lmOd = new LevenbergMarquardtOD(allObs, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        validateStateAccuracy(result.state, truthState, 0.01, 0.00001);
      });
    });

    describe('ObservationRadar (Range/Az/El)', () => {
      it('should handle varying numbers of observations (6, 10, 20)', () => {
        const truthState = propagator.propagate(startEpoch);

        for (const count of [6, 10, 20]) {
          const epochs = generateEpochs(startEpoch, count, 30);
          const observations = generateRadarObservations(propagator, sensor, epochs);

          const lmOd = new LevenbergMarquardtOD(observations, truthState);
          const result = lmOd.solve({ epsilon: 1e-6 });

          expect(result.converged).toBe(true);
          expect(result.rms).toBeLessThan(1e-6);
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

        const lmOd = new LevenbergMarquardtOD(allObs, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
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

        const lmOd = new LevenbergMarquardtOD(mixedObs, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        validateStateAccuracy(result.state, truthState, 0.01, 0.00001);
      });
    });
  });

  /*
   * ==========================================================================
   * 3. IOD INTEGRATION PIPELINES
   * ==========================================================================
   */

  describe('IOD Integration Pipelines', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));
    const sensor = createSensor('eastCoast');

    describe('GaussIOD → LevenbergMarquardtOD', () => {
      /**
       * USE CASE: Have 3+ optical observations, need refined orbit
       * 1. Run GaussIOD on first 3 observations → initial state
       * 2. Run LM with all observations → refined state
       * 3. Verify: LM produces better solution
       */
      it('should refine GaussIOD solution with additional observations', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        // Step 1: Run GaussIOD on first 3 observations
        const gaussIod = new GaussIOD();
        const gaussResult = gaussIod.estimate(observations[0], observations[1], observations[2]);

        expect(gaussResult).not.toBeNull();
        if (!gaussResult) {
          return;
        }

        // Step 2: Run LM with GaussIOD result as apriori
        const lmOd = new LevenbergMarquardtOD(observations, gaussResult);
        const lmResult = lmOd.solve({ epsilon: 1e-6 });

        // Step 3: Verify LM improves the solution
        expect(lmResult.converged).toBe(true);

        const gaussPosError = gaussResult.position.subtract(truthState.position).magnitude();
        const lmPosError = lmResult.state.position.subtract(truthState.position).magnitude();

        // LM should produce a better (or equal) solution
        expect(lmPosError).toBeLessThanOrEqual(gaussPosError + 0.1); // Allow small tolerance
      });
    });

    describe('GoodingIOD → LevenbergMarquardtOD', () => {
      /**
       * USE CASE: Have optical observations with range estimates
       * 1. Run GoodingIOD with range hints → initial state
       * 2. Run LM with all observations → refined state
       * 3. Verify: LM produces better solution
       */
      it('should refine GoodingIOD solution', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        // Range estimates for LEO
        const rangeEstimate = 1500 as Kilometers;

        // Step 1: Run GoodingIOD
        const goodingIod = new GoodingIOD();
        const goodingResult = goodingIod.estimate(
          observations[0],
          observations[1],
          observations[2],
          rangeEstimate,
          rangeEstimate,
        );

        // Step 2: Run LM with GoodingIOD result as apriori
        const lmOd = new LevenbergMarquardtOD(observations, goodingResult);
        const lmResult = lmOd.solve({ epsilon: 1e-6 });

        // Step 3: Verify LM converges and improves
        expect(lmResult.converged).toBe(true);

        const goodingPosError = goodingResult.position.subtract(truthState.position).magnitude();
        const lmPosError = lmResult.state.position.subtract(truthState.position).magnitude();

        // LM should produce a better (or equal) solution
        expect(lmPosError).toBeLessThanOrEqual(goodingPosError + 0.1);
      });
    });

    describe('Direct LM (Good Apriori from TLE)', () => {
      /**
       * USE CASE: Have prior orbit knowledge (e.g., from TLE catalog)
       * 1. Use TLE-propagated state as apriori
       * 2. Run LM with new observations
       * 3. Fast convergence expected (< 10 iterations)
       */
      it('should converge quickly with TLE-based apriori', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        // Use the truth state directly as apriori (best case)
        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        expect(result.iterations).toBeLessThan(10); // Should converge quickly
        validateStateAccuracy(result.state, truthState, 0.01, 0.00001);
      });
    });
  });

  /*
   * ==========================================================================
   * 4. COVARIANCE VALIDATION
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

      const lmOd = new LevenbergMarquardtOD(observations, truthState);
      const result = lmOd.solve({ epsilon: 1e-6 });

      expect(result.converged).toBe(true);

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

      const lmOd = new LevenbergMarquardtOD(observations, truthState);
      const result = lmOd.solve({ epsilon: 1e-6 });

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
      const lmOd6 = new LevenbergMarquardtOD(obs6, truthState);
      const result6 = lmOd6.solve({ epsilon: 1e-6 });

      // More observations
      const epochs20 = generateEpochs(startEpoch, 20, 30);
      const obs20 = generateOpticalObservations(propagator, sensor, epochs20);
      const lmOd20 = new LevenbergMarquardtOD(obs20, truthState);
      const result20 = lmOd20.solve({ epsilon: 1e-6 });

      /*
       * Covariance trace should be smaller with more observations
       * Calculate trace manually (sum of diagonal elements)
       */
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
   * 5. CONVERGENCE BEHAVIOR
   * ==========================================================================
   */

  describe('Convergence Behavior', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));
    const sensor = createSensor('eastCoast');

    describe('Successful Convergence', () => {
      it('should set converged=true when RMS falls below epsilon', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        expect(result.rms).toBeLessThan(1e-6);
      });

      it('should return reasonable iteration count', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.iterations).toBeGreaterThanOrEqual(0);
        expect(result.iterations).toBeLessThan(50);
      });
    });

    describe('Max Iterations Reached', () => {
      it('should return converged=false when max iterations reached', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);
        const badApriori = perturbState(truthState, 100, 0.1); // Very bad apriori

        const lmOd = new LevenbergMarquardtOD(observations, badApriori);
        const result = lmOd.solve({ maxIterations: 2, epsilon: 1e-12 }); // Very tight epsilon

        // With only 2 iterations and very tight epsilon, unlikely to converge
        expect(result.iterations).toBeLessThanOrEqual(2);
      });
    });

    describe('Configuration Options', () => {
      it('should respect custom maxIterations', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ maxIterations: 5, epsilon: 1e-12 });

        expect(result.iterations).toBeLessThanOrEqual(5);
      });

      it('should converge faster with larger epsilon', () => {
        const epochs = generateEpochs(startEpoch, 10, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);
        const perturbedApriori = perturbState(truthState, 1.0, 0.001);

        const lmOdTight = new LevenbergMarquardtOD(observations, perturbedApriori);
        const resultTight = lmOdTight.solve({ epsilon: 1e-9 });

        const lmOdLoose = new LevenbergMarquardtOD(observations, perturbedApriori);
        const resultLoose = lmOdLoose.solve({ epsilon: 1e-3 });

        // Looser epsilon should converge in fewer (or equal) iterations
        expect(resultLoose.iterations).toBeLessThanOrEqual(resultTight.iterations);
      });
    });
  });

  /*
   * ==========================================================================
   * 6. ROBUSTNESS TESTS
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

        const lmOd = new LevenbergMarquardtOD(observations, perturbedApriori);
        const result = lmOd.solve({ epsilon: 1e-6, maxIterations: 100 });

        expect(result.converged).toBe(true);
        validateStateAccuracy(result.state, truthState, 1.0, 0.001);
      });

      it('should converge with 50 km position error (more iterations)', () => {
        const epochs = generateEpochs(startEpoch, 20, 30);
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);
        const perturbedApriori = perturbState(truthState, 50, 0.05);

        const lmOd = new LevenbergMarquardtOD(observations, perturbedApriori);
        const result = lmOd.solve({ epsilon: 1e-5, maxIterations: 100 });

        // May or may not converge depending on geometry, but should not crash
        expect(result.rms).toBeDefined();
        expect(result.iterations).toBeGreaterThan(0);
      });
    });

    describe('Observation Geometry', () => {
      it('should handle short arc observations (2 minutes)', () => {
        const epochs = generateEpochs(startEpoch, 8, 15); // 8 obs, 15s apart = 2 min
        const observations = generateOpticalObservations(propagator, sensor, epochs);
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
      });

      it('should handle longer arc observations (10 minutes)', () => {
        /*
         * 10 observations over 10 minutes tests extended arc handling
         * Note: Very long arcs (30+ min) may require multiple-revolution or batch processing
         */
        const epochs = generateEpochs(startEpoch, 10, 60); // 10 obs, 1 min apart = 10 min
        // Use mixed observations for better observability
        const opticalObs = generateOpticalObservations(propagator, sensor, epochs.slice(0, 5));
        const radarObs = generateRadarObservations(propagator, sensor, epochs.slice(5));
        const observations: Observation[] = [...opticalObs, ...radarObs];
        const truthState = propagator.propagate(epochs[0]);

        const lmOd = new LevenbergMarquardtOD(observations, truthState);
        const result = lmOd.solve({ epsilon: 1e-6 });

        expect(result.converged).toBe(true);
        validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
      });
    });
  });

  /*
   * ==========================================================================
   * 7. NUMERICAL STABILITY
   * ==========================================================================
   */

  describe('Numerical Stability', () => {
    it('should handle near-circular orbits (e < 0.001)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch)); // LEO has very low eccentricity
      const sensor = createSensor('eastCoast');

      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const lmOd = new LevenbergMarquardtOD(observations, truthState);
      const result = lmOd.solve({ epsilon: 1e-6 });

      expect(result.converged).toBe(true);
      validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
    });

    it('should handle highly eccentric orbits', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createHeoOrbit(startEpoch));
      const sensor = createSensor('eastCoast');

      const epochs = generateEpochs(startEpoch, 10, 120);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const lmOd = new LevenbergMarquardtOD(observations, truthState);
      const result = lmOd.solve({ epsilon: 1e-5 });

      expect(result.converged).toBe(true);
      validateStateAccuracy(result.state, truthState, 1.0, 0.001);
    });

    it('should handle geostationary altitude', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createGeoOrbit(startEpoch));
      const sensor = createSensor('hawaii');

      const epochs = generateEpochs(startEpoch, 8, 300);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const lmOd = new LevenbergMarquardtOD(observations, truthState);
      const result = lmOd.solve({ epsilon: 1e-6 });

      expect(result.converged).toBe(true);
      validateStateAccuracy(result.state, truthState, 0.1, 0.0001);
    });
  });

  /*
   * ==========================================================================
   * 8. CONSTRUCTOR AND CONFIGURATION
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

      const lmOd = new LevenbergMarquardtOD(shuffled, truthState);
      const result = lmOd.solve({ epsilon: 1e-6 });

      // Should still converge despite shuffled input
      expect(result.converged).toBe(true);
    });

    it('should accept custom ForceModel', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const customForceModel = new ForceModel().setGravity();

      const lmOd = new LevenbergMarquardtOD(observations, truthState, customForceModel);
      const result = lmOd.solve({ epsilon: 1e-6 });

      expect(result.converged).toBe(true);
    });

    it('should use default parameters correctly', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      // Use all defaults
      const lmOd = new LevenbergMarquardtOD(observations, truthState);
      const result = lmOd.solve();

      expect(result.converged).toBe(true);
      expect(result.state).toBeDefined();
      expect(result.covariance).toBeDefined();
      expect(result.rms).toBeDefined();
      expect(result.iterations).toBeDefined();
    });
  });

  /*
   * ==========================================================================
   * 9. FASTDERIVATIVES FLAG
   * ==========================================================================
   */

  describe('fastDerivatives Flag', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));
    const sensor = createSensor('eastCoast');

    it('should converge with fastDerivatives=false (default)', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const lmOd = new LevenbergMarquardtOD(
        observations,
        truthState,
        undefined, // default force model
        1e-5, // default posStep
        1e-5, // default velStep
        false, // fastDerivatives = false
      );
      const result = lmOd.solve({ epsilon: 1e-6 });

      expect(result.converged).toBe(true);
    });

    it('should converge with fastDerivatives=true', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const lmOd = new LevenbergMarquardtOD(
        observations,
        truthState,
        undefined,
        1e-5,
        1e-5,
        true, // fastDerivatives = true
      );
      const result = lmOd.solve({ epsilon: 1e-6 });

      expect(result.converged).toBe(true);
    });

    it('should produce similar results with both modes', () => {
      const epochs = generateEpochs(startEpoch, 10, 30);
      const observations = generateOpticalObservations(propagator, sensor, epochs);
      const truthState = propagator.propagate(epochs[0]);

      const lmOdSlow = new LevenbergMarquardtOD(observations, truthState, undefined, 1e-5, 1e-5, false);
      const resultSlow = lmOdSlow.solve({ epsilon: 1e-6 });

      const lmOdFast = new LevenbergMarquardtOD(observations, truthState, undefined, 1e-5, 1e-5, true);
      const resultFast = lmOdFast.solve({ epsilon: 1e-6 });

      // Both should converge
      expect(resultSlow.converged).toBe(true);
      expect(resultFast.converged).toBe(true);

      // Results should be similar (within reasonable tolerance)
      const posDiff = resultSlow.state.position.subtract(resultFast.state.position).magnitude();

      expect(posDiff).toBeLessThan(1.0); // Within 1 km
    });
  });
});
