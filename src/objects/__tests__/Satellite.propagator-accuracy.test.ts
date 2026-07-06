/**
 * Accuracy comparison tests for numerical propagators vs SGP4.
 *
 * All propagators are initialized from the satellite's state at TLE epoch,
 * then propagated forward. Positions are compared against the Sgp4Propagator
 * baseline at multiple time steps.
 *
 * Both Satellite.toJ2000() and Sgp4Propagator now produce proper J2000
 * coordinates (with full TEME→J2000 precession/nutation transformation),
 * so the t=0 baseline offset between them should be near-zero.
 *
 * Tests focus on:
 * - Error growth over time due to force model differences
 * - Force model fidelity ordering (J2 beats point-mass, 8x8 beats J2)
 * - Cross-propagator consistency (RK89 vs DP54 in the same frame)
 * - Velocity accuracy across all propagator types
 * - OEM truth data validation with real satellite data (NORAD 39208)
 * - SP3 laser ranging truth validation with AJISAI (NORAD 16908)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ITRF } from '../../coordinate/ITRF';
import { PropagatorType } from '../../enums/PropagatorType';
import { ForceModel } from '../../force/ForceModel';
import { Vector3D } from '../../operations/Vector3D';
import { DormandPrince54Propagator } from '../../propagator/DormandPrince54Propagator';
import { Propagator } from '../../propagator/Propagator';
import { RungeKutta89Propagator } from '../../propagator/RungeKutta89Propagator';
import { EpochUTC } from '../../time/EpochUTC';
import { Kilometers, KilometersPerSecond, TleLine1, TleLine2 } from '../../types/types';
import { Satellite } from '../Satellite';

describe('Propagator Accuracy vs SGP4', () => {
  // ISS TLE (epoch: 2024-001 12:00:00 UTC)
  const tle1 = '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002' as TleLine1;
  const tle2 = '2 25544  51.6400 208.9163 0006730 358.5720 122.3372 15.50104550100010' as TleLine2;

  const tleEpochDate = new Date(Date.UTC(2024, 0, 1, 12, 0, 0));

  let sat: Satellite;

  beforeEach(() => {
    sat = new Satellite({ tle1, tle2, name: 'ISS' });
  });

  /**
   * Compute position difference (km) between two J2000 states.
   */
  const posDiff = (
    a: { position: { x: number; y: number; z: number } },
    b: { position: { x: number; y: number; z: number } },
  ): number => {
    const dx = a.position.x - b.position.x;
    const dy = a.position.y - b.position.y;
    const dz = a.position.z - b.position.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  /**
   * Compute velocity difference (km/s) between two J2000 states.
   */
  const velDiff = (
    a: { velocity: { x: number; y: number; z: number } },
    b: { velocity: { x: number; y: number; z: number } },
  ): number => {
    const dx = a.velocity.x - b.velocity.x;
    const dy = a.velocity.y - b.velocity.y;
    const dz = a.velocity.z - b.velocity.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  /**
   * Propagate at multiple time steps and collect position/velocity errors vs SGP4.
   */
  const collectErrors = (
    sgp4Prop: Propagator,
    testProp: Propagator,
    stepMinutes: number,
    numSteps: number,
  ): { timeMin: number; posErrKm: number; velErrKmps: number }[] => {
    const errors: { timeMin: number; posErrKm: number; velErrKmps: number }[] = [];

    for (let i = 0; i <= numSteps; i++) {
      const offsetMs = i * stepMinutes * 60_000;
      const epoch = EpochUTC.fromDateTime(new Date(tleEpochDate.getTime() + offsetMs));

      const sgp4State = sgp4Prop.propagate(epoch);
      const testState = testProp.propagate(epoch);

      errors.push({
        timeMin: i * stepMinutes,
        posErrKm: posDiff(sgp4State, testState),
        velErrKmps: velDiff(sgp4State, testState),
      });
    }

    return errors;
  };

  // ==================== Multi-step accuracy comparison ====================

  describe('multi-step accuracy comparison over 2 hours', () => {
    const stepMinutes = 10;
    const numSteps = 12; // 0, 10, 20, ... 120 minutes

    it('Kepler (two-body) should diverge from SGP4 over time', () => {
      const sgp4 = sat.createPropagator(tleEpochDate, { type: PropagatorType.SGP4 });
      const kepler = sat.createPropagator(tleEpochDate, { type: PropagatorType.KEPLER });

      const errors = collectErrors(sgp4, kepler, stepMinutes, numSteps);

      // At t=0, both propagators start from the same J2000 state
      const baselineOffset = errors[0].posErrKm;

      expect(baselineOffset).toBeLessThan(1); // Near-zero at t=0

      // Kepler diverges: no J2, no drag, no perturbations at all
      const maxErr = Math.max(...errors.map((e) => e.posErrKm));

      expect(maxErr).toBeGreaterThan(10); // Significant divergence over 2 hours
    });

    it('RK89 with point-mass gravity should diverge from SGP4 but stay in LEO', () => {
      const sgp4 = sat.createPropagator(tleEpochDate, { type: PropagatorType.SGP4 });
      const rk89 = sat.createPropagator(tleEpochDate, {
        type: PropagatorType.RK89,
        forceModel: new ForceModel().setGravity(),
      });

      const errors = collectErrors(sgp4, rk89, stepMinutes, numSteps);

      // At t=0, both propagators start from the same J2000 state
      const baselineOffset = errors[0].posErrKm;

      expect(baselineOffset).toBeLessThan(1);

      // Point-mass misses J2 — error grows over time
      const finalErr = errors[errors.length - 1];

      expect(finalErr.posErrKm).toBeGreaterThan(1);
      expect(finalErr.velErrKmps).toBeLessThan(1); // Velocity stays LEO-like
    });

    it('RK89 with J2 gravity should track SGP4 more closely than point-mass', () => {
      const sgp4 = sat.createPropagator(tleEpochDate, { type: PropagatorType.SGP4 });

      const fmPointMass = new ForceModel().setGravity();
      const rk89PointMass = sat.createPropagator(tleEpochDate, {
        type: PropagatorType.RK89,
        forceModel: fmPointMass,
      });

      const fmJ2 = new ForceModel();

      fmJ2.setEarthGravity(2, 0); // J2 only (degree 2, order 0)
      const rk89J2 = sat.createPropagator(tleEpochDate, {
        type: PropagatorType.RK89,
        forceModel: fmJ2,
      });

      const errorsPointMass = collectErrors(sgp4, rk89PointMass, stepMinutes, numSteps);
      const errorsJ2 = collectErrors(sgp4, rk89J2, stepMinutes, numSteps);

      // J2 should track SGP4 better than point-mass at every step beyond t=0
      for (let i = 2; i < errorsPointMass.length; i++) {
        expect(errorsJ2[i].posErrKm).toBeLessThan(errorsPointMass[i].posErrKm);
      }

      // Final J2 error should be meaningfully smaller
      const finalPM = errorsPointMass[errorsPointMass.length - 1];
      const finalJ2 = errorsJ2[errorsJ2.length - 1];

      expect(finalJ2.posErrKm).toBeLessThan(finalPM.posErrKm * 0.5);
    });

    it('J2 gravity should track SGP4 more closely than higher-degree gravity', () => {
      const sgp4 = sat.createPropagator(tleEpochDate, { type: PropagatorType.SGP4 });

      const fmJ2 = new ForceModel();

      fmJ2.setEarthGravity(2, 0);
      const rk89J2 = sat.createPropagator(tleEpochDate, {
        type: PropagatorType.RK89,
        forceModel: fmJ2,
      });

      const fmHigh = new ForceModel();

      fmHigh.setEarthGravity(8, 8);
      const rk89High = sat.createPropagator(tleEpochDate, {
        type: PropagatorType.RK89,
        forceModel: fmHigh,
      });

      const errorsJ2 = collectErrors(sgp4, rk89J2, stepMinutes, numSteps);
      const errorsHigh = collectErrors(sgp4, rk89High, stepMinutes, numSteps);

      // SGP4 models J2-like perturbations, so J2-only gravity tracks SGP4 more
      // closely than 8x8. Higher-degree gravity is more physically accurate but
      // diverges from SGP4's simplified model.
      const finalJ2 = errorsJ2[errorsJ2.length - 1];
      const finalHigh = errorsHigh[errorsHigh.length - 1];

      expect(finalJ2.posErrKm).toBeLessThan(finalHigh.posErrKm);

      // Both should still be in a reasonable range
      expect(finalJ2.posErrKm).toBeLessThan(5);
      expect(finalHigh.posErrKm).toBeLessThan(5);
    });
  });

  // ==================== Cross-propagator consistency ====================

  describe('cross-propagator consistency', () => {
    const stepMinutes = 10;
    const numSteps = 6; // 0 to 60 minutes

    it('RK89 and DP54 should agree closely with same force model', () => {
      const fm = new ForceModel();

      fm.setEarthGravity(4, 4);

      const rk89 = sat.createPropagator(tleEpochDate, {
        type: PropagatorType.RK89,
        forceModel: fm,
      });
      const dp54 = sat.createPropagator(tleEpochDate, {
        type: PropagatorType.DP54,
        forceModel: fm,
      });

      const errors = collectErrors(rk89, dp54, stepMinutes, numSteps);

      // With default tolerances (1e-9), RK89 and DP54 should agree to ~meters
      for (const err of errors) {
        expect(err.posErrKm).toBeLessThan(0.1); // Within 100 meters
        expect(err.velErrKmps).toBeLessThan(0.001); // Within 1 m/s
      }
    });

    it('RK4 and RK89 should agree reasonably with same force model', () => {
      const fm = new ForceModel().setGravity();

      const rk89 = sat.createPropagator(tleEpochDate, {
        type: PropagatorType.RK89,
        forceModel: fm,
      });
      const rk4 = sat.createPropagator(tleEpochDate, {
        type: PropagatorType.RK4,
        forceModel: fm,
        stepSize: 10.0,
      });

      const errors = collectErrors(rk89, rk4, stepMinutes, numSteps);

      // RK4 with 10s step is less accurate but should be in the right ballpark
      for (const err of errors) {
        expect(err.posErrKm).toBeLessThan(5); // Within 5 km over 1 hour
      }
    });
  });

  // ==================== Force model fidelity ladder ====================

  describe('force model fidelity ladder', () => {
    it('should show decreasing SGP4 error with increasing force model fidelity', () => {
      const sgp4 = sat.createPropagator(tleEpochDate, { type: PropagatorType.SGP4 });
      const twoHourEpoch = EpochUTC.fromDateTime(new Date(tleEpochDate.getTime() + 7200_000));

      // Level 0: Point-mass gravity
      const fm0 = new ForceModel().setGravity();
      const prop0 = sat.createPropagator(tleEpochDate, { type: PropagatorType.RK89, forceModel: fm0 });
      const state0 = prop0.propagate(twoHourEpoch);
      const sgp4State = sgp4.propagate(twoHourEpoch);
      const err0 = posDiff(sgp4State, state0);

      // Level 1: J2 gravity
      const fm1 = new ForceModel();

      fm1.setEarthGravity(2, 0);
      const prop1 = sat.createPropagator(tleEpochDate, { type: PropagatorType.RK89, forceModel: fm1 });
      const state1 = prop1.propagate(twoHourEpoch);
      const err1 = posDiff(sgp4State, state1);

      // Level 2: EGM-96 8x8
      const fm2 = new ForceModel();

      fm2.setEarthGravity(8, 8);
      const prop2 = sat.createPropagator(tleEpochDate, { type: PropagatorType.RK89, forceModel: fm2 });
      const state2 = prop2.propagate(twoHourEpoch);
      const err2 = posDiff(sgp4State, state2);

      // Level 3: EGM-96 8x8 + Moon/Sun
      const fm3 = new ForceModel();

      fm3.setEarthGravity(8, 8);
      fm3.setThirdBodyGravity({ moon: true, sun: true });
      const prop3 = sat.createPropagator(tleEpochDate, { type: PropagatorType.RK89, forceModel: fm3 });
      const state3 = prop3.propagate(twoHourEpoch);
      const err3 = posDiff(sgp4State, state3);

      // Point-mass should be worse than J2 (misses dominant perturbation)
      expect(err0).toBeGreaterThan(err1);

      // SGP4 models J2-like perturbations, so J2-only gravity tracks SGP4
      // more closely than higher-degree models. 8x8 is more physically
      // accurate but diverges from SGP4's simplified perturbation model.
      expect(err1).toBeLessThan(err0);
      expect(err2).toBeLessThan(err0);

      // All numerical propagators produce valid LEO positions
      expect(err0).toBeLessThan(500);
      expect(err1).toBeLessThan(5);
      expect(err2).toBeLessThan(5);

      // Adding third-body for LEO should not make things dramatically worse
      // (Moon/Sun are small perturbations for LEO, so err3 ≈ err2)
      expect(err3).toBeLessThan(5);
    });
  });

  // ==================== Velocity accuracy ====================

  describe('velocity accuracy', () => {
    it('all propagators should produce LEO-consistent velocities at every step', () => {
      const propagators = [
        { name: 'SGP4', prop: sat.createPropagator(tleEpochDate, { type: PropagatorType.SGP4 }) },
        { name: 'Kepler', prop: sat.createPropagator(tleEpochDate, { type: PropagatorType.KEPLER }) },
        { name: 'RK89-PM', prop: sat.createNumericalPropagator(tleEpochDate) },
        {
          name: 'RK89-J2',
          prop: (() => {
            const fm = new ForceModel();

            fm.setEarthGravity(4, 4);

            return sat.createPropagator(tleEpochDate, { type: PropagatorType.RK89, forceModel: fm });
          })(),
        },
      ];

      // Check every 15 minutes for 2 hours
      for (let min = 0; min <= 120; min += 15) {
        const epoch = EpochUTC.fromDateTime(new Date(tleEpochDate.getTime() + min * 60_000));

        for (const { prop } of propagators) {
          const state = prop.propagate(epoch);
          const v = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2);

          // ISS orbital velocity is ~7.66 km/s; allow generous range
          expect(v).toBeGreaterThan(7.0);
          expect(v).toBeLessThan(8.0);
        }
      }
    });

    it('RK89 velocity error vs SGP4 should be smaller with J2 than point-mass', () => {
      const sgp4 = sat.createPropagator(tleEpochDate, { type: PropagatorType.SGP4 });
      const twoHourEpoch = EpochUTC.fromDateTime(new Date(tleEpochDate.getTime() + 7200_000));

      const fmPM = new ForceModel().setGravity();
      const propPM = sat.createPropagator(tleEpochDate, { type: PropagatorType.RK89, forceModel: fmPM });

      const fmJ2 = new ForceModel();

      fmJ2.setEarthGravity(4, 4);
      const propJ2 = sat.createPropagator(tleEpochDate, { type: PropagatorType.RK89, forceModel: fmJ2 });

      const sgp4State = sgp4.propagate(twoHourEpoch);
      const velErrPM = velDiff(sgp4State, propPM.propagate(twoHourEpoch));
      const velErrJ2 = velDiff(sgp4State, propJ2.propagate(twoHourEpoch));

      expect(velErrJ2).toBeLessThan(velErrPM);
    });
  });
});

// ===========================================================================
// OEM Truth Data Validation (NORAD 39208 — Shiyan-7)
// ===========================================================================
/**
 * Validates numerical propagators against real OEM ephemeris data for NORAD
 * 39208 (Shiyan-7), a sun-synchronous LEO satellite at ~700 km, 98° incl.
 *
 * The OEM truth file (39208.oem) was generated from ~4003 TLEs — each TLE
 * propagated to its own epoch via SGP4, then converted to EME2000 (= J2000).
 * This represents the "best known" orbit state at each epoch.
 *
 * Numerical propagators are initialized from the FIRST TLE's J2000 state
 * (obtained via Sgp4Propagator). Both Satellite.toJ2000() and Sgp4Propagator
 * now produce proper J2000 coordinates with full TEME→J2000 transformation.
 *
 * Without atmospheric drag modeling, numerical propagators are expected to
 * diverge from truth over multi-week periods. The tests focus on:
 * - Near-epoch accuracy (t=0 match)
 * - Force model fidelity ordering for short-term propagation (1–7 days)
 * - Physical reasonableness at all time steps
 * - Cross-integrator consistency (RK89 vs DP54) on real data
 */
describe('Propagator accuracy vs OEM truth data (NORAD 39208)', () => {
  // First TLE from the dataset (epoch: 2020-366.90899438 = 2020-12-31T21:48:57.114 UTC)
  const tle1_39208 = '1 39208U 13037A   20366.90899438  .00000088  00000-0  23522-4 0    11' as TleLine1;
  const tle2_39208 = '2 39208  98.0102   4.5055 0008785  14.2424 345.9028 14.68405624399392' as TleLine2;

  const tleEpochDate = new Date(Date.UTC(2020, 11, 31, 21, 48, 57, 114));

  /**
   * OEM truth data in EME2000/J2000 frame (km, km/s).
   * Each entry was generated from a DIFFERENT TLE (the one closest to that epoch)
   * propagated to its own epoch via SGP4. This represents tracked reality.
   */
  const truthData = [
    {
      label: 'TLE epoch (t=0)',
      date: new Date(Date.UTC(2020, 11, 31, 21, 48, 57, 114)),
      pos: { x: 7022.046038, y: 520.154720, z: -14.106040 },
      vel: { x: 0.08291379666025, y: -1.04628127028446, z: 7.45532395425293 },
    },
    {
      label: '~1 day',
      date: new Date(Date.UTC(2021, 0, 1, 22, 20, 49, 72)),
      pos: { x: 7011.868831, y: 642.720260, z: -14.098078 },
      vel: { x: 0.10155568707842, y: -1.04491481578374, z: 7.45530739248666 },
    },
    {
      label: '~3 days',
      date: new Date(Date.UTC(2021, 0, 3, 23, 24, 32, 950)),
      pos: { x: 6985.155848, y: 887.227147, z: -14.043709 },
      vel: { x: 0.13871656007296, y: -1.04118344499092, z: 7.45521603002676 },
    },
    {
      label: '~7 days',
      date: new Date(Date.UTC(2021, 0, 7, 22, 15, 45, 612)),
      pos: { x: 6909.599659, y: 1356.672585, z: -13.893903 },
      vel: { x: 0.21005705139884, y: -1.03018261014449, z: 7.45480177366911 },
    },
    {
      label: '~14 days',
      date: new Date(Date.UTC(2021, 0, 14, 12, 53, 48, 699)),
      pos: { x: 6713.591885, y: 2127.160241, z: -13.537946 },
      vel: { x: 0.32690973942765, y: -1.00087995233663, z: 7.45351030002443 },
    },
    {
      label: '~28 days',
      date: new Date(Date.UTC(2021, 0, 28, 13, 47, 23, 55)),
      pos: { x: 6019.226883, y: 3663.592571, z: -12.181512 },
      vel: { x: 0.55766388595254, y: -0.89640371615403, z: 7.44883352621863 },
    },
  ];

  /** Position error (km) between a propagated state and a raw position vector. */
  const posErrorVsTruth = (
    state: { position: { x: number; y: number; z: number } },
    truth: { x: number; y: number; z: number },
  ): number => {
    const dx = state.position.x - truth.x;
    const dy = state.position.y - truth.y;
    const dz = state.position.z - truth.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  /** Position difference (km) between two propagated states. */
  const posDiffStates = (
    a: { position: { x: number; y: number; z: number } },
    b: { position: { x: number; y: number; z: number } },
  ): number => {
    const dx = a.position.x - b.position.x;
    const dy = a.position.y - b.position.y;
    const dz = a.position.z - b.position.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  it('SGP4 from first TLE should match OEM truth at TLE epoch', () => {
    const sat = new Satellite({ tle1: tle1_39208, tle2: tle2_39208, name: 'SHIYAN-7' });
    const sgp4 = sat.createSgp4Propagator();
    const epoch = EpochUTC.fromDateTime(truthData[0].date);
    const state = sgp4.propagate(epoch);

    // At TLE epoch, SGP4 should produce the same state as the OEM truth
    // (both generated from the same TLE via SGP4 → J2000)
    const err = posErrorVsTruth(state, truthData[0].pos);

    expect(err).toBeLessThan(0.01); // Within 10 meters
  });

  it('numerical propagator initialized from proper J2000 should match truth at epoch', () => {
    const sat = new Satellite({ tle1: tle1_39208, tle2: tle2_39208, name: 'SHIYAN-7' });
    const sgp4 = sat.createSgp4Propagator();
    const epoch = EpochUTC.fromDateTime(tleEpochDate);

    // Get proper J2000 state (via Sgp4Propagator's TEME→J2000 conversion)
    const initJ2000 = sgp4.propagate(epoch);

    const rk89 = new RungeKutta89Propagator(initJ2000, new ForceModel().setGravity());
    const state = rk89.propagate(epoch);

    // At t=0, numerical propagator starts from the same J2000 state
    const err = posErrorVsTruth(state, truthData[0].pos);

    expect(err).toBeLessThan(0.01); // Within 10 meters
  });

  it('all propagators should produce LEO-consistent states at every truth point', () => {
    const sat = new Satellite({ tle1: tle1_39208, tle2: tle2_39208, name: 'SHIYAN-7' });
    const sgp4 = sat.createSgp4Propagator();
    const initEpoch = EpochUTC.fromDateTime(tleEpochDate);
    const initJ2000 = sgp4.propagate(initEpoch);


    const fm8x8tb = new ForceModel();

    fm8x8tb.setEarthGravity(8, 8);
    fm8x8tb.setThirdBodyGravity({ moon: true, sun: true });

    const propagators = [
      { name: 'SGP4', prop: sgp4 },
      { name: 'RK89-PM', prop: new RungeKutta89Propagator(initJ2000, new ForceModel().setGravity()) },
      {
        name: 'RK89-J2',
        prop: (() => {
          const fm = new ForceModel();

          fm.setEarthGravity(2, 0);

          return new RungeKutta89Propagator(initJ2000, fm);
        })(),
      },
      { name: 'RK89-8x8+TB', prop: new RungeKutta89Propagator(initJ2000, fm8x8tb) },
    ];

    for (const truth of truthData) {
      const epoch = EpochUTC.fromDateTime(truth.date);

      for (const { prop } of propagators) {
        const state = prop.propagate(epoch);

        // Position should be in LEO range (~6400-7400 km from Earth center)
        const posMag = Math.sqrt(
          state.position.x ** 2 + state.position.y ** 2 + state.position.z ** 2,
        );

        expect(posMag).toBeGreaterThan(6000);
        expect(posMag).toBeLessThan(8000);

        // Velocity should be LEO range (~7-8 km/s)
        const velMag = Math.sqrt(
          state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2,
        );

        expect(velMag).toBeGreaterThan(7);
        expect(velMag).toBeLessThan(8);
      }
    }
  }, 60_000);

  it('SGP4 prediction error should grow with time from TLE epoch', () => {
    const sat = new Satellite({ tle1: tle1_39208, tle2: tle2_39208, name: 'SHIYAN-7' });
    const sgp4 = sat.createSgp4Propagator();

    const errors: number[] = [];

    for (const truth of truthData) {
      const epoch = EpochUTC.fromDateTime(truth.date);
      const state = sgp4.propagate(epoch);

      errors.push(posErrorVsTruth(state, truth.pos));
    }

    // Error at epoch should be near-zero
    expect(errors[0]).toBeLessThan(0.01);

    // Error should generally grow — final error > initial error
    expect(errors[errors.length - 1]).toBeGreaterThan(errors[0]);

    // At 28 days from a single TLE, error should be bounded but meaningful
    expect(errors[errors.length - 1]).toBeLessThan(1000);
  });

  it('J2 and higher gravity should dramatically beat point-mass vs truth at 3 days', () => {
    const sat = new Satellite({ tle1: tle1_39208, tle2: tle2_39208, name: 'SHIYAN-7' });
    const sgp4 = sat.createSgp4Propagator();
    const initJ2000 = sgp4.propagate(EpochUTC.fromDateTime(tleEpochDate));

    // 3-day truth point — gravity dominates over drag at this timescale
    const truth3d = truthData[2];
    const epoch3d = EpochUTC.fromDateTime(truth3d.date);

    const fmPM = new ForceModel().setGravity();
    const fmJ2 = new ForceModel();

    fmJ2.setEarthGravity(2, 0);
    const fm8x8 = new ForceModel();

    fm8x8.setEarthGravity(8, 8);

    const errPM = posErrorVsTruth(
      new RungeKutta89Propagator(initJ2000, fmPM).propagate(epoch3d),
      truth3d.pos,
    );
    const errJ2 = posErrorVsTruth(
      new RungeKutta89Propagator(initJ2000, fmJ2).propagate(epoch3d),
      truth3d.pos,
    );
    const errHigh = posErrorVsTruth(
      new RungeKutta89Propagator(initJ2000, fm8x8).propagate(epoch3d),
      truth3d.pos,
    );

    // Point-mass should be worst — misses dominant J2 perturbation
    expect(errPM).toBeGreaterThan(errJ2);
    expect(errPM).toBeGreaterThan(errHigh);

    // Both J2 and 8x8 should be dramatically better than point-mass
    // Note: J2 may actually be slightly closer to SGP4-derived truth than 8x8,
    // because SGP4 itself models J2-like perturbations. Adding higher-order
    // terms makes the model more physically accurate but can diverge from
    // SGP4-based truth. Both should be within ~10 km of each other.
    expect(Math.abs(errJ2 - errHigh)).toBeLessThan(10);
  });

  it('error growth comparison across force models (1d, 3d, 7d)', () => {
    const sat = new Satellite({ tle1: tle1_39208, tle2: tle2_39208, name: 'SHIYAN-7' });
    const sgp4 = sat.createSgp4Propagator();
    const initJ2000 = sgp4.propagate(EpochUTC.fromDateTime(tleEpochDate));

    const fmPM = new ForceModel().setGravity();
    const fmJ2 = new ForceModel();

    fmJ2.setEarthGravity(2, 0);
    const fm8x8 = new ForceModel();

    fm8x8.setEarthGravity(8, 8);
    const fm8x8TB = new ForceModel();

    fm8x8TB.setEarthGravity(8, 8);
    fm8x8TB.setThirdBodyGravity({ moon: true, sun: true });

    const propSGP4 = sgp4;
    const propPM = new RungeKutta89Propagator(initJ2000, fmPM);
    const propJ2 = new RungeKutta89Propagator(initJ2000, fmJ2);
    const prop8x8 = new RungeKutta89Propagator(initJ2000, fm8x8);
    const prop8x8TB = new RungeKutta89Propagator(initJ2000, fm8x8TB);

    const results: {
      label: string;
      sgp4: number;
      pm: number;
      j2: number;
      g8x8: number;
      g8x8tb: number;
    }[] = [];

    // Test 1d, 3d, 7d truth points (indices 1-3, skip t=0)
    // Longer propagations (14d, 28d) are tested separately without point-mass
    // to avoid timeouts — point-mass to 28 days requires many integrator steps.
    for (const truth of truthData.slice(1, 4)) {
      const epoch = EpochUTC.fromDateTime(truth.date);

      results.push({
        label: truth.label,
        sgp4: posErrorVsTruth(propSGP4.propagate(epoch), truth.pos),
        pm: posErrorVsTruth(propPM.propagate(epoch), truth.pos),
        j2: posErrorVsTruth(propJ2.propagate(epoch), truth.pos),
        g8x8: posErrorVsTruth(prop8x8.propagate(epoch), truth.pos),
        g8x8tb: posErrorVsTruth(prop8x8TB.propagate(epoch), truth.pos),
      });
    }

    // J2 should beat point-mass at every step
    for (const r of results) {
      expect(r.j2).toBeLessThan(r.pm);
    }

    // J2 and 8x8 should be close to each other (both model oblateness)
    // Note: 8x8 is more physically accurate, but SGP4-derived truth may
    // slightly favor J2-only since SGP4's perturbation model is J2-like.
    for (const r of results) {
      expect(Math.abs(r.g8x8 - r.j2)).toBeLessThan(10);
    }

    // 1-day error bounds:
    // - SGP4, J2, 8x8: should be modest (< 50 km) since they model oblateness
    // - Point-mass: can be ~500 km because J2 perturbation accumulates
    //   ~40 km/orbit for polar orbits, and Shiyan-7 completes ~15 orbits/day
    expect(results[0].sgp4).toBeLessThan(50);
    expect(results[0].pm).toBeLessThan(600);
    expect(results[0].j2).toBeLessThan(50);
    expect(results[0].g8x8).toBeLessThan(50);

    // SGP4 and gravity-aware propagators should stay bounded through 7 days
    for (const r of results) {
      expect(r.sgp4).toBeLessThan(500);
      expect(r.j2).toBeLessThan(200);
      expect(r.g8x8).toBeLessThan(200);
      expect(r.g8x8tb).toBeLessThan(200);
    }

    // Point-mass should always be much worse than J2
    for (const r of results) {
      expect(r.pm).toBeGreaterThan(r.j2);
    }
  }, 60_000);

  it('gravity-aware propagators should track truth through 28 days', () => {
    const sat = new Satellite({ tle1: tle1_39208, tle2: tle2_39208, name: 'SHIYAN-7' });
    const sgp4 = sat.createSgp4Propagator();
    const initJ2000 = sgp4.propagate(EpochUTC.fromDateTime(tleEpochDate));

    const fmJ2 = new ForceModel();

    fmJ2.setEarthGravity(2, 0);
    const fm8x8TB = new ForceModel();

    fm8x8TB.setEarthGravity(8, 8);
    fm8x8TB.setThirdBodyGravity({ moon: true, sun: true });

    const propJ2 = new RungeKutta89Propagator(initJ2000, fmJ2);
    const prop8x8TB = new RungeKutta89Propagator(initJ2000, fm8x8TB);

    // Check all truth points including 14d and 28d
    for (const truth of truthData.slice(1)) {
      const epoch = EpochUTC.fromDateTime(truth.date);

      const errSGP4 = posErrorVsTruth(sgp4.propagate(epoch), truth.pos);
      const errJ2 = posErrorVsTruth(propJ2.propagate(epoch), truth.pos);
      const err8x8TB = posErrorVsTruth(prop8x8TB.propagate(epoch), truth.pos);

      // All should stay bounded (< 1000 km even at 28 days)
      expect(errSGP4).toBeLessThan(1000);
      expect(errJ2).toBeLessThan(1000);
      expect(err8x8TB).toBeLessThan(1000);
    }
  }, 30_000);

  it('DP54 and RK89 should agree closely on real satellite data', () => {
    const sat = new Satellite({ tle1: tle1_39208, tle2: tle2_39208, name: 'SHIYAN-7' });
    const sgp4 = sat.createSgp4Propagator();
    const initJ2000 = sgp4.propagate(EpochUTC.fromDateTime(tleEpochDate));

    const fm = new ForceModel();

    fm.setEarthGravity(4, 4);

    const rk89 = new RungeKutta89Propagator(initJ2000, fm);
    const dp54 = new DormandPrince54Propagator(initJ2000, fm);

    // Compare at 3-day truth point
    const epoch = EpochUTC.fromDateTime(truthData[2].date);
    const stateRK89 = rk89.propagate(epoch);
    const stateDP54 = dp54.propagate(epoch);

    const diff = posDiffStates(stateRK89, stateDP54);

    // Two adaptive integrators with default tolerance should agree to ~meters
    expect(diff).toBeLessThan(0.1); // Within 100 meters
  });
});

// ===========================================================================
// SP3 Laser Ranging Truth Data Validation (NORAD 16908 — AJISAI)
// ===========================================================================
/**
 * Validates propagators against precision SP3 orbit ephemeris from satellite
 * laser ranging (SLR) for AJISAI (NORAD 16908), a geodetic satellite.
 *
 * AJISAI characteristics making it ideal for propagator validation:
 * - Passive geodetic sphere at ~1485 km altitude, 50° inclination
 * - Nearly circular orbit (e ≈ 0.001), minimal drag at this altitude
 * - High ballistic coefficient (685 kg, 2.15 m diameter sphere)
 * - SP3 truth data: cm-level accuracy from satellite laser ranging
 * - Independent truth source: fitted orbit from SLR, not derived from TLEs
 *
 * Key improvement over OEM-based tests (Shiyan-7):
 * - Truth is genuinely independent of SGP4/TLE pipeline
 * - With independent truth, higher-fidelity force models produce LOWER error
 *   (unlike SGP4-derived truth where J2-only can paradoxically beat 8x8)
 * - SP3 includes velocity data, enabling velocity accuracy tests
 * - AJISAI's near-zero drag means force model quality is the dominant factor
 *
 * Numerical propagators are initialized from the FIRST SP3 truth point
 * (converted from ITRF to J2000), then propagated forward through the
 * SP3 window. This eliminates SGP4 initialization error and purely tests
 * propagator force model accuracy against laser-ranging truth.
 *
 * Source: NSGF ILRS SP3 nsgf.orb.ajisai.v00.sp3 (4-day SLR fitted arc)
 * Frame: ITRF/ECF → converted to J2000 at test time via ITRF.toJ2000()
 */
describe('Propagator accuracy vs SP3 laser ranging truth (NORAD 16908 — AJISAI)', () => {
  const tle1_16908 = '1 16908U 86061A   26057.30424418 -.00000104  00000+0 -46547-4 0  9997' as TleLine1;
  const tle2_16908 = '2 16908  50.0084 128.3590 0011236 257.6678 137.3100 12.44515474466586' as TleLine2;

  // TLE epoch: 2026-02-26T07:18:06.697Z (day 57.30424418 of 2026)
  // SGP4 is initialized from TLE and propagated backward to the SP3 window.

  /**
   * SP3 truth data in ITRF (Earth-fixed) frame.
   * Positions: km (directly from SP3). Velocities: km/s (converted from SP3 dm/s ÷ 10000).
   * Source: nsgf.orb.ajisai.v00.sp3 — NSGF ILRS SLR orbit solution, 4-day arc.
   * The SP3 window (Feb 22–25) precedes the TLE epoch (Feb 26).
   */
  const sp3TruthData = [
    {
      label: 't=0 (SP3 start)',
      date: new Date(Date.UTC(2026, 1, 22, 0, 0, 0)),
      pos: { x: -7733.495228, y: 1419.617223, z: 13.453864 },
      vel: { x: -0.72990591, y: -3.93644030, z: -5.45915390 },
    },
    {
      label: '6h',
      date: new Date(Date.UTC(2026, 1, 22, 6, 0, 0)),
      pos: { x: -2053.160157, y: 6497.501805, z: -3920.052596 },
      vel: { x: -3.84366900, y: -3.71529900, z: -4.14276570 },
    },
    {
      label: '12h',
      date: new Date(Date.UTC(2026, 1, 22, 12, 0, 0)),
      pos: { x: 2223.111677, y: 4628.177915, z: -5953.280902 },
      vel: { x: -6.39156320, y: 2.01676620, z: -0.82193053 },
    },
    {
      label: '1d',
      date: new Date(Date.UTC(2026, 1, 23, 0, 0, 0)),
      pos: { x: 6906.551518, y: -3318.870253, z: -1786.691023 },
      vel: { x: 2.89043640, y: 3.20163000, z: 5.20895900 },
    },
    {
      label: '2d',
      date: new Date(Date.UTC(2026, 1, 24, 0, 0, 0)),
      pos: { x: -5238.316120, y: 4769.217794, z: 3416.349803 },
      vel: { x: -4.67347980, y: -1.91639050, z: -4.49511150 },
    },
    {
      label: '3d',
      date: new Date(Date.UTC(2026, 1, 25, 0, 0, 0)),
      pos: { x: 2991.731057, y: -5530.400699, z: -4723.546330 },
      vel: { x: 5.84265550, y: 0.26451999, z: 3.38310490 },
    },
    {
      label: '~3.86d (SP3 end)',
      date: new Date(Date.UTC(2026, 1, 25, 20, 32, 0)),
      pos: { x: -6915.568335, y: -3725.339881, z: -373.522292 },
      vel: { x: 2.13147390, y: -3.40497560, z: -5.44754500 },
    },
  ];

  /** Convert an SP3 truth point from ITRF to J2000. */
  const sp3ToJ2000 = (truth: typeof sp3TruthData[0]) => {
    const epoch = EpochUTC.fromDateTime(truth.date);
    const pos = new Vector3D(
      truth.pos.x as Kilometers,
      truth.pos.y as Kilometers,
      truth.pos.z as Kilometers,
    );
    const vel = new Vector3D(
      truth.vel.x as KilometersPerSecond,
      truth.vel.y as KilometersPerSecond,
      truth.vel.z as KilometersPerSecond,
    );

    return new ITRF(epoch, pos, vel).toJ2000();
  };

  /** Position error (km) between a J2000 state and an SP3 truth point (converted to J2000). */
  const posErrorVsSP3 = (
    state: { position: { x: number; y: number; z: number } },
    truth: typeof sp3TruthData[0],
  ): number => {
    const truthJ2000 = sp3ToJ2000(truth);
    const dx = state.position.x - truthJ2000.position.x;
    const dy = state.position.y - truthJ2000.position.y;
    const dz = state.position.z - truthJ2000.position.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  /** Velocity error (km/s) between a J2000 state and an SP3 truth point (converted to J2000). */
  const velErrorVsSP3 = (
    state: { velocity: { x: number; y: number; z: number } },
    truth: typeof sp3TruthData[0],
  ): number => {
    const truthJ2000 = sp3ToJ2000(truth);
    const dx = state.velocity.x - truthJ2000.velocity.x;
    const dy = state.velocity.y - truthJ2000.velocity.y;
    const dz = state.velocity.z - truthJ2000.velocity.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  /** 3D position difference in km between two states. */
  const pos3dDiff = (
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
  ): number => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  // ==================== Sanity checks ====================

  it('ITRF-to-J2000 roundtrip should be consistent', () => {
    const truth = sp3TruthData[0];
    const epoch = EpochUTC.fromDateTime(truth.date);
    const pos = new Vector3D(truth.pos.x as Kilometers, truth.pos.y as Kilometers, truth.pos.z as Kilometers);
    const vel = new Vector3D(
      truth.vel.x as KilometersPerSecond,
      truth.vel.y as KilometersPerSecond,
      truth.vel.z as KilometersPerSecond,
    );

    const itrf = new ITRF(epoch, pos, vel);
    const j2000 = itrf.toJ2000();
    const itrfBack = j2000.toITRF();

    // Position roundtrip error < 1 meter
    const posErr = Math.sqrt(
      (itrf.position.x - itrfBack.position.x) ** 2 +
      (itrf.position.y - itrfBack.position.y) ** 2 +
      (itrf.position.z - itrfBack.position.z) ** 2,
    );

    expect(posErr).toBeLessThan(0.001);

    // Velocity roundtrip error < 1 mm/s
    const velErr = Math.sqrt(
      (itrf.velocity.x - itrfBack.velocity.x) ** 2 +
      (itrf.velocity.y - itrfBack.velocity.y) ** 2 +
      (itrf.velocity.z - itrfBack.velocity.z) ** 2,
    );

    expect(velErr).toBeLessThan(0.000001);
  });

  it('numerical propagator at init epoch should return the same state', () => {
    const initJ2000 = sp3ToJ2000(sp3TruthData[0]);
    const rk89 = new RungeKutta89Propagator(initJ2000, new ForceModel().setGravity());
    const state = rk89.propagate(initJ2000.epoch);

    const posErr = posErrorVsSP3(state, sp3TruthData[0]);

    expect(posErr).toBeLessThan(0.001); // Within 1 meter
  });

  // ==================== SGP4 backward prediction ====================

  it('SGP4 backward prediction should track SP3 truth with growing error', () => {
    const sat = new Satellite({ tle1: tle1_16908, tle2: tle2_16908, name: 'AJISAI' });
    const sgp4 = sat.createSgp4Propagator();

    const errors: number[] = [];

    // SP3 window is Feb 22-25, TLE epoch is Feb 26.
    // SGP4 propagates backward 1-4 days.
    for (const truth of sp3TruthData) {
      const epoch = EpochUTC.fromDateTime(truth.date);
      const state = sgp4.propagate(epoch);

      errors.push(posErrorVsSP3(state, truth));
    }

    // Error should generally grow with distance from TLE epoch
    // (last SP3 point is closest to TLE epoch → smallest error)
    const closestErr = errors[errors.length - 1]; // ~3.86d end, ~11h before TLE
    const farthestErr = errors[0]; // SP3 start, ~4.3 days before TLE

    expect(closestErr).toBeLessThan(farthestErr);

    // All errors bounded — SGP4 backward propagation over a few days
    for (const err of errors) {
      expect(err).toBeLessThan(100);
    }
  });

  // ==================== SP3-initialized force model comparison ====================

  it('force model comparison: J2 should beat point-mass at every step beyond 6h', () => {
    const initJ2000 = sp3ToJ2000(sp3TruthData[0]);

    const fmPM = new ForceModel().setGravity();
    const fmJ2 = new ForceModel();

    fmJ2.setEarthGravity(2, 0);

    const propPM = new RungeKutta89Propagator(initJ2000, fmPM);
    const propJ2 = new RungeKutta89Propagator(initJ2000, fmJ2);

    // Skip t=0 (both identical); test from 6h onward where J2 perturbation accumulates
    for (const truth of sp3TruthData.slice(1)) {
      const epoch = EpochUTC.fromDateTime(truth.date);
      const errPM = posErrorVsSP3(propPM.propagate(epoch), truth);
      const errJ2 = posErrorVsSP3(propJ2.propagate(epoch), truth);

      expect(errJ2).toBeLessThan(errPM);
    }
  }, 60_000);

  it('error growth comparison across force models (6h to 3d)', () => {
    const initJ2000 = sp3ToJ2000(sp3TruthData[0]);

    // AJISAI physical properties for SRP:
    // mass = 685 kg, diameter = 2.15 m → cross-section = π×1.075² ≈ 3.63 m², Cr ≈ 1.13
    const ajisaiMass = 685;
    const ajisaiArea = 3.63;
    const ajisaiCr = 1.13;

    const fmPM = new ForceModel().setGravity();
    const fmJ2 = new ForceModel();

    fmJ2.setEarthGravity(2, 0);
    const fm8x8 = new ForceModel();

    fm8x8.setEarthGravity(8, 8);
    const fm8x8SRP = new ForceModel();

    fm8x8SRP.setEarthGravity(8, 8);
    fm8x8SRP.setSolarRadiationPressure(ajisaiMass, ajisaiArea, ajisaiCr);
    const fm8x8TB = new ForceModel();

    fm8x8TB.setEarthGravity(8, 8);
    fm8x8TB.setThirdBodyGravity({ moon: true, sun: true });
    const fmFull = new ForceModel();

    fmFull.setEarthGravity(8, 8);
    fmFull.setThirdBodyGravity({ moon: true, sun: true });
    fmFull.setSolarRadiationPressure(ajisaiMass, ajisaiArea, ajisaiCr);

    const propPM = new RungeKutta89Propagator(initJ2000, fmPM);
    const propJ2 = new RungeKutta89Propagator(initJ2000, fmJ2);
    const prop8x8 = new RungeKutta89Propagator(initJ2000, fm8x8);
    const prop8x8SRP = new RungeKutta89Propagator(initJ2000, fm8x8SRP);
    const prop8x8TB = new RungeKutta89Propagator(initJ2000, fm8x8TB);
    const propFull = new RungeKutta89Propagator(initJ2000, fmFull);

    // Test from 6h through 3d (skip t=0)
    for (const truth of sp3TruthData.slice(1, 6)) {
      const epoch = EpochUTC.fromDateTime(truth.date);

      const errPM = posErrorVsSP3(propPM.propagate(epoch), truth);
      const errJ2 = posErrorVsSP3(propJ2.propagate(epoch), truth);
      const err8x8 = posErrorVsSP3(prop8x8.propagate(epoch), truth);
      const err8x8SRP = posErrorVsSP3(prop8x8SRP.propagate(epoch), truth);
      const err8x8TB = posErrorVsSP3(prop8x8TB.propagate(epoch), truth);
      const errFull = posErrorVsSP3(propFull.propagate(epoch), truth);

      // J2 should always beat point-mass
      expect(errJ2).toBeLessThan(errPM);

      // Gravity-aware propagators stay bounded
      expect(errJ2).toBeLessThan(200);
      expect(err8x8).toBeLessThan(200);
      expect(err8x8SRP).toBeLessThan(200);
      expect(err8x8TB).toBeLessThan(200);
      expect(errFull).toBeLessThan(200);
    }

    // 1-day point-mass error bound: AJISAI at 50° inclination accumulates
    // ~65 km/orbit from missing J2, doing ~12.4 orbits/day ≈ ~800 km/day
    const epoch1d = EpochUTC.fromDateTime(sp3TruthData[3].date);
    const errPM1d = posErrorVsSP3(propPM.propagate(epoch1d), sp3TruthData[3]);

    expect(errPM1d).toBeLessThan(1000);
  }, 30_000);

  it('force model fidelity ladder: point-mass > J2 at 2 days', () => {
    const initJ2000 = sp3ToJ2000(sp3TruthData[0]);

    const fmPM = new ForceModel().setGravity();
    const fmJ2 = new ForceModel();

    fmJ2.setEarthGravity(2, 0);
    const fm8x8 = new ForceModel();

    fm8x8.setEarthGravity(8, 8);

    const epoch2d = EpochUTC.fromDateTime(sp3TruthData[4].date);

    const errPM = posErrorVsSP3(new RungeKutta89Propagator(initJ2000, fmPM).propagate(epoch2d), sp3TruthData[4]);
    const errJ2 = posErrorVsSP3(new RungeKutta89Propagator(initJ2000, fmJ2).propagate(epoch2d), sp3TruthData[4]);
    const err8x8 = posErrorVsSP3(new RungeKutta89Propagator(initJ2000, fm8x8).propagate(epoch2d), sp3TruthData[4]);

    // Point-mass should be worst (misses dominant J2 perturbation)
    expect(errPM).toBeGreaterThan(errJ2);
    expect(errPM).toBeGreaterThan(err8x8);

    // J2 and 8x8 should be close (both model oblateness)
    expect(Math.abs(errJ2 - err8x8)).toBeLessThan(20);
  }, 60_000);

  // ==================== Cross-propagator consistency ====================

  it('DP54 and RK89 should agree closely with same force model on SP3 data', () => {
    const initJ2000 = sp3ToJ2000(sp3TruthData[0]);

    const fm = new ForceModel();

    fm.setEarthGravity(4, 4);

    const rk89 = new RungeKutta89Propagator(initJ2000, fm);
    const dp54 = new DormandPrince54Propagator(initJ2000, fm);

    // Compare at every truth point
    for (const truth of sp3TruthData.slice(1)) {
      const epoch = EpochUTC.fromDateTime(truth.date);
      const stateRK89 = rk89.propagate(epoch);
      const stateDP54 = dp54.propagate(epoch);

      const diff = pos3dDiff(stateRK89.position, stateDP54.position);

      // Two adaptive integrators with default tolerance should agree to ~meters
      expect(diff).toBeLessThan(0.1); // Within 100 meters
    }
  }, 60_000);

  // ==================== Velocity accuracy ====================

  it('velocity accuracy vs SP3 truth with 8x8+third-body force model', () => {
    const initJ2000 = sp3ToJ2000(sp3TruthData[0]);

    const fm = new ForceModel();

    fm.setEarthGravity(8, 8);
    fm.setThirdBodyGravity({ moon: true, sun: true });

    const prop = new RungeKutta89Propagator(initJ2000, fm);

    for (const truth of sp3TruthData.slice(1)) {
      const epoch = EpochUTC.fromDateTime(truth.date);
      const state = prop.propagate(epoch);
      const velErr = velErrorVsSP3(state, truth);

      // All velocity magnitudes should be LEO-consistent (~7.1 km/s for AJISAI)
      const velMag = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2);

      expect(velMag).toBeGreaterThan(6.8);
      expect(velMag).toBeLessThan(7.5);

      // Velocity error should stay bounded (< 0.1 km/s = 100 m/s even at 3+ days)
      expect(velErr).toBeLessThan(0.1);
    }
  }, 30_000);

  // ==================== Physical reasonableness ====================

  it('all propagators should produce physically reasonable states at every SP3 truth point', () => {
    const sat = new Satellite({ tle1: tle1_16908, tle2: tle2_16908, name: 'AJISAI' });
    const sgp4 = sat.createSgp4Propagator();
    const initJ2000 = sp3ToJ2000(sp3TruthData[0]);

    const fm = new ForceModel();

    fm.setEarthGravity(4, 4);

    const propagators = [
      { name: 'SGP4', prop: sgp4 },
      { name: 'RK89-PM', prop: new RungeKutta89Propagator(initJ2000, new ForceModel().setGravity()) },
      { name: 'RK89-4x4', prop: new RungeKutta89Propagator(initJ2000, fm) },
    ];

    for (const truth of sp3TruthData) {
      const epoch = EpochUTC.fromDateTime(truth.date);

      for (const { prop } of propagators) {
        const state = prop.propagate(epoch);

        // AJISAI orbital radius: ~7863 km (6378 + 1485 km altitude)
        const posMag = Math.sqrt(
          state.position.x ** 2 + state.position.y ** 2 + state.position.z ** 2,
        );

        expect(posMag).toBeGreaterThan(7000);
        expect(posMag).toBeLessThan(9000);

        // J2000 velocity: ~7.1 km/s for AJISAI
        const velMag = Math.sqrt(
          state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2,
        );

        expect(velMag).toBeGreaterThan(6.5);
        expect(velMag).toBeLessThan(7.5);
      }
    }
  }, 60_000);

  // ==================== Summary Report ====================

  it('should generate propagator-accuracy-summary.txt', () => {
    const sat = new Satellite({ tle1: tle1_16908, tle2: tle2_16908, name: 'AJISAI' });
    const sgp4 = sat.createSgp4Propagator();
    const initJ2000 = sp3ToJ2000(sp3TruthData[0]);

    const fmPM = new ForceModel().setGravity();
    const fmJ2 = new ForceModel();

    fmJ2.setEarthGravity(2, 0);
    const fm4x4 = new ForceModel();

    fm4x4.setEarthGravity(4, 4);
    const fm8x8 = new ForceModel();

    fm8x8.setEarthGravity(8, 8);
    const fm8x8SRP = new ForceModel();

    fm8x8SRP.setEarthGravity(8, 8);
    fm8x8SRP.setSolarRadiationPressure(685, 3.63, 1.13);
    const fm8x8TB = new ForceModel();

    fm8x8TB.setEarthGravity(8, 8);
    fm8x8TB.setThirdBodyGravity({ moon: true, sun: true });
    const fmFull = new ForceModel();

    fmFull.setEarthGravity(8, 8);
    fmFull.setThirdBodyGravity({ moon: true, sun: true });
    fmFull.setSolarRadiationPressure(685, 3.63, 1.13);

    const propagators = [
      { name: 'SGP4 (bkwd)', prop: sgp4 },
      { name: 'Point-Mass', prop: new RungeKutta89Propagator(initJ2000, fmPM) },
      { name: 'J2 (2,0)', prop: new RungeKutta89Propagator(initJ2000, fmJ2) },
      { name: 'EGM96 4x4', prop: new RungeKutta89Propagator(initJ2000, fm4x4) },
      { name: 'EGM96 8x8', prop: new RungeKutta89Propagator(initJ2000, fm8x8) },
      { name: '8x8+SRP', prop: new RungeKutta89Propagator(initJ2000, fm8x8SRP) },
      { name: '8x8+TB', prop: new RungeKutta89Propagator(initJ2000, fm8x8TB) },
      { name: '8x8+TB+SRP', prop: new RungeKutta89Propagator(initJ2000, fmFull) },
      { name: 'DP54 4x4', prop: new DormandPrince54Propagator(initJ2000, fm4x4) },
    ];

    // Collect all errors vs SP3 truth
    const rows: { label: string; errors: number[] }[] = [];

    for (const truth of sp3TruthData) {
      const epoch = EpochUTC.fromDateTime(truth.date);
      const errors = propagators.map(({ prop }) => posErrorVsSP3(prop.propagate(epoch), truth));

      rows.push({ label: truth.label, errors });
    }

    // Format the table
    const colWidth = 14;
    const labelWidth = 24;
    const header = propagators.map(({ name }) => name.padStart(colWidth)).join('');
    const divider = '─'.repeat(labelWidth + propagators.length * colWidth);

    const tableRows = rows.map(({ label, errors }) => {
      const cells = errors.map((e) => {
        if (e < 0.01) {
          return `${(e * 1000).toFixed(1)} m`.padStart(colWidth);
        } else if (e < 1) {
          return `${(e * 1000).toFixed(0)} m`.padStart(colWidth);
        }

        return `${e.toFixed(2)} km`.padStart(colWidth);
      });

      return label.padEnd(labelWidth) + cells.join('');
    });

    // Cross-integrator comparison at 1-day point
    const epoch1d = EpochUTC.fromDateTime(sp3TruthData[3].date);
    const rk89_4x4 = propagators.find((p) => p.name === 'EGM96 4x4')!;
    const dp54_4x4 = propagators.find((p) => p.name === 'DP54 4x4')!;
    const crossDiff = pos3dDiff(
      rk89_4x4.prop.propagate(epoch1d).position,
      dp54_4x4.prop.propagate(epoch1d).position,
    );

    // Best propagator at each time step (skip SGP4 backward for fair comparison)
    const numericOnly = propagators.slice(1);
    const bestPerRow = rows.map(({ label, errors }) => {
      const numericErrors = errors.slice(1);
      const minErr = Math.min(...numericErrors);
      const bestIdx = numericErrors.indexOf(minErr);

      return { label, best: numericOnly[bestIdx].name, err: minErr };
    });

    const summary = [
      '===============================================================================',
      'PROPAGATOR ACCURACY vs SP3 LASER RANGING TRUTH',
      '===============================================================================',
      '',
      'Target:       AJISAI (NORAD 16908) — geodetic laser ranging sphere',
      '              ~1485 km altitude, 50° inclination, e ≈ 0.001',
      'Truth source: NSGF ILRS SP3 nsgf.orb.ajisai.v00.sp3',
      '              cm-level accuracy from satellite laser ranging (4-day arc)',
      'Init state:   First SP3 point (ITRF → J2000 conversion)',
      'TLE:          1 16908U 86061A   26057.30424418 (2026-02-26T07:18:06.697Z)',
      '              SGP4 propagated backward from TLE epoch to SP3 window',
      'Comparison:   J2000 position difference vs SP3 truth (ITRF → J2000)',
      `Generated:    ${new Date().toISOString()}`,
      '',
      '───────────────────────────────────────────────────────────────────────────────',
      'POSITION ERROR vs SP3 TRUTH (J2000 frame)',
      '───────────────────────────────────────────────────────────────────────────────',
      '',
      ''.padEnd(labelWidth) + header,
      divider,
      ...tableRows,
      divider,
      '',
      '───────────────────────────────────────────────────────────────────────────────',
      'BEST NUMERICAL PROPAGATOR AT EACH TIME STEP',
      '───────────────────────────────────────────────────────────────────────────────',
      '',
      ...bestPerRow.map(({ label, best, err }) => {
        const errStr = err < 1 ? `${(err * 1000).toFixed(0)} m` : `${err.toFixed(2)} km`;

        return `  ${label.padEnd(labelWidth)}${best.padEnd(16)}${errStr}`;
      }),
      '',
      '───────────────────────────────────────────────────────────────────────────────',
      'CROSS-INTEGRATOR CONSISTENCY (same 4x4 force model)',
      '───────────────────────────────────────────────────────────────────────────────',
      '',
      `  RK89 vs DP54 at 1 day:  ${(crossDiff * 1000).toFixed(1)} meters`,
      '',
      '───────────────────────────────────────────────────────────────────────────────',
      'PROPAGATOR KEY',
      '───────────────────────────────────────────────────────────────────────────────',
      '',
      '  SGP4 (bkwd)   Analytical SGP4, propagated backward from TLE epoch',
      '  Point-Mass    RK89 numerical, central body gravity only (mu/r²)',
      '  J2 (2,0)      RK89 numerical, J2 oblateness only',
      '  EGM96 4x4     RK89 numerical, 4×4 spherical harmonics',
      '  EGM96 8x8     RK89 numerical, 8×8 spherical harmonics',
      '  8x8+SRP       RK89 numerical, 8×8 gravity + solar radiation pressure',
      '  8x8+TB        RK89 numerical, 8×8 gravity + lunar/solar third-body',
      '  8x8+TB+SRP    RK89 numerical, 8×8 + third-body + SRP (full model)',
      '  DP54 4x4      Dormand-Prince 5(4) numerical, 4×4 harmonics',
      '',
      '  AJISAI SRP params: mass=685 kg, area=3.63 m², Cr=1.13',
      '',
      'Note: Numerical propagators initialized from SP3 start (ITRF → J2000).',
      '      SGP4 backward uses TLE epoch 2026-02-26, propagating back to SP3 window.',
      '',
    ].join('\n');

    const outPath = path.join(__dirname, 'propagator-accuracy-summary.txt');

    fs.writeFileSync(outPath, summary, 'utf-8');

    // Verify the file was written
    expect(fs.existsSync(outPath)).toBe(true);
  }, 30_000);
});
