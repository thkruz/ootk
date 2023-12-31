import { EpochUTC } from '@src/time/EpochUTC';
import { J2000 } from '../coordinate/J2000';
import { RIC } from '../coordinate/RIC';
import { Thrust } from '../force/Thrust';
import { StateInterpolator } from '../interpolator/StateInterpolator';
import { Vector3D } from '../operations/Vector3D';
import { ForceModel } from './../force/ForceModel';
import { DownhillSimplex } from './../optimize/DownhillSimplex';
import { LambertIOD } from './../orbit_determination/LambertIOD';
import { RungeKutta89Propagator } from './../propagator/RungeKutta89Propagator';

// / Relative waypoint targeting.
export class Waypoint {
  epoch: EpochUTC;
  relativePosition: Vector3D;

  // / Create a new [Waypoint] object.
  constructor(epoch: EpochUTC, relativePosition: Vector3D) {
    this.epoch = epoch;
    this.relativePosition = relativePosition;
  }

  /**
   * Return the perturbed error in a [maneuver] when compared against the
   * target [waypoint] given an initial [state], [forceModel],
   * [target] interpolator, and speculative relative maneuver
   * [components] _(m/s)_.
   */
  static _error(
    waypoint: Waypoint,
    maneuver: Thrust,
    state: J2000,
    forceModel: ForceModel,
    target: StateInterpolator,
    components: Float64Array,
  ): number {
    const testManeuver = new Thrust(
      maneuver.center,
      components[0],
      components[1],
      components[2],
      maneuver.durationRate,
    );
    const propagator = new RungeKutta89Propagator(state, forceModel);
    const maneuverSteps = propagator.maneuver(testManeuver);
    const postManeuver = maneuverSteps[maneuverSteps.length - 1];
    const interceptor = new RungeKutta89Propagator(postManeuver, forceModel).propagate(waypoint.epoch);
    const targetState = target.interpolate(waypoint.epoch);

    if (targetState === null) {
      throw new Error('Error calculation failed; epoch is outside the target interpolator ephemeris window.');
    }
    const expected = waypoint.relativePosition;
    const actual = RIC.fromJ2000(interceptor, targetState);

    return actual.position.distance(expected);
  }

  /**
   * Generate a score function for refining perturbed [waypoint] maneuvers.
   *
   * The score function takes an array of speculative radial, intrack, and
   * crosstrack components _(m/s)_ and returns the propagated error from the
   * desired waypoint target.
   */
  static _refineManeuverScore(
    waypoint: Waypoint,
    maneuver: Thrust,
    state: J2000,
    forceModel: ForceModel,
    target: StateInterpolator,
  ): (components: Float64Array) => number {
    return (components: Float64Array) => Waypoint._error(waypoint, maneuver, state, forceModel, target, components);
  }

  /**
   * Convert an array of [waypoints] into a maneuver sequence given an
   * [interceptor] state, [pivot] epoch for the first burn to arrive at the
   * first waypoint, and [target] ephemeris interpolator.
   *
   * Optional arguments are as follows:
   *  - `preManeuvers`: maneuvers to execute before the pivot burn
   * - `postManeuvers`: maneuvers to execute after the last pivot burn
   * - `durationRate`: thruster duration rate _(s/m/s)_
   * - `forceModel`: interceptor force model, defaults to two-body
   * - `refine`: refine maneuvers to account for perturbations if `true`
   * - `maxIter`: maximum refinement iterations per maneuver
   * - `printIter`: print debug information on each refinement iteration
   */
  static toManeuvers(
    interceptor: J2000,
    pivot: EpochUTC,
    waypoints: Waypoint[],
    target: StateInterpolator,
    preManeuvers: Thrust[] | null,
    postManeuvers: Thrust[] | null,
    {
      durationRate = 0.0,
      forceModel,
      refine = false,
      maxIter = 500,
      printIter = false,
    }: {
      durationRate?: number;
      forceModel?: ForceModel;
      refine?: boolean;
      maxIter?: number;
      printIter?: boolean;
    } = {},
  ): Thrust[] {
    const preMnv = preManeuvers ?? [];
    const postMnv = postManeuvers ?? [];
    let state = interceptor;

    if (preMnv.length > 0) {
      for (const maneuver of preMnv) {
        const mvrStep = new RungeKutta89Propagator(state, forceModel).maneuver(maneuver);

        state = mvrStep[mvrStep.length - 1];
      }
    }
    state = new RungeKutta89Propagator(state, forceModel).propagate(pivot);
    const pivotState = state;
    let waypointManeuvers: Thrust[] = [];

    for (const wp of waypoints) {
      const targetWp = new RIC(wp.relativePosition, Vector3D.origin);
      const targetState = target.interpolate(wp.epoch);

      if (targetState === null) {
        throw new Error('Waypoint outside target interpolator window.');
      }
      const wpState = targetWp.toJ2000(targetState);
      const tof = wp.epoch.difference(state.epoch);
      const revs = Math.floor(tof / state.period());
      const shortPath = LambertIOD.useShortPath(state, targetState);
      const lambert = new LambertIOD();
      const components = lambert.estimate(state.position, wpState.position, state.epoch, wp.epoch, {
        posigrade: shortPath,
        nRev: revs,
      });

      if (components === null) {
        throw new Error('Lambert solve result is null.');
      }
      const componentsRel = RIC.fromJ2000(components, state).velocity.scale(1e3);
      const maneuver = new Thrust(state.epoch, componentsRel.x, componentsRel.y, componentsRel.z, durationRate);
      const tempProp = new RungeKutta89Propagator(state, forceModel);

      tempProp.maneuver(maneuver);
      state = tempProp.propagate(wp.epoch);
      waypointManeuvers.push(maneuver);
    }
    if (refine) {
      forceModel ??= new ForceModel().setGravity();
      waypointManeuvers = this._refineManeuvers(waypoints, waypointManeuvers, pivotState, forceModel, target, {
        maxIter,
        printIter,
      });
    }
    const output: Thrust[] = [];

    output.push(...preMnv);
    output.push(...waypointManeuvers);
    output.push(...postMnv);

    return output;
  }

  static _refineManeuvers(
    waypoints: Waypoint[],
    maneuvers: Thrust[],
    interceptor: J2000,
    forceModel: ForceModel,
    target: StateInterpolator,
    {
      maxIter = 500,
      printIter = false,
    }: {
      maxIter?: number;
      printIter?: boolean;
    } = {},
  ): Thrust[] {
    let state = interceptor;
    const output: Thrust[] = [];

    for (let i = 0; i < maneuvers.length; i++) {
      const maneuver = maneuvers[i];
      const waypoint = waypoints[i];
      const guess = maneuver.deltaV.scale(1e3).toArray();
      const simplex = DownhillSimplex.generateSimplex(guess, 1e-1);
      const scoreFn = this._refineManeuverScore(waypoint, maneuver, state, forceModel, target);
      const results = DownhillSimplex.solveSimplex(scoreFn, simplex, {
        maxIter,
        xTolerance: 1e-6,
        fTolerance: 1e-6,
        printIter,
      });
      const tR = results[0];
      const tI = results[1];
      const tC = results[2];
      const newManeuver = new Thrust(maneuver.center, tR, tI, tC, maneuver.durationRate);

      output.push(newManeuver);
      const mvrStep = new RungeKutta89Propagator(state, forceModel).maneuver(newManeuver);

      state = mvrStep[mvrStep.length - 1];
    }

    return output;
  }
}
