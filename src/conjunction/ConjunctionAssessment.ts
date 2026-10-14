/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Orbital Object ToolKit is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Orbital Object ToolKit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * Orbital Object ToolKit. If not, see <http://www.gnu.org/licenses/>.
 */

import type { Kilometers, Seconds } from '../types/types';
import type { Vector3D } from '../operations/Vector3D';
import { ConjunctionEvent, type ConjunctionManeuverable, type ConjunctionScreenVolume } from './ConjunctionEvent';
import { CovarianceFrame, StateCovariance } from '../covariance/StateCovariance';
import { CovarianceSample } from '../covariance/CovarianceSample';
import { EpochUTC } from '../time/EpochUTC';
import { ForceModel } from '../force/ForceModel';
import { GoldenSection } from '../optimize/GoldenSection';
import { J2000 } from '../coordinate/J2000';
import { Matrix } from '../operations/Matrix';
import { ProbabilityOfCollision } from './ProbabilityOfCollision';
import { Propagator } from '../propagator/Propagator';
import { RIC } from '../coordinate/RIC';
import { Sgp4Propagator } from '../propagator/Sgp4Propagator';
import { Tle } from '../coordinate/Tle';
import { RungeKutta89Propagator } from './../propagator/RungeKutta89Propagator';

/**
 * Input for a space object in conjunction assessment.
 * Can be specified as either a TLE or a state vector with optional covariance.
 */
export interface ConjunctionSpaceObjectInput {
  /** Object identifier/name (copied to the event's primaryName / secondaryName) */
  name?: string;

  /**
   * Catalog designator for CDM export (CDM OBJECT_DESIGNATOR with CATALOG_NAME = SATCAT, copied to
   * the event's primaryDesignator / secondaryDesignator). Defaults to the TLE catalog number
   * (`Tle.satnum`) when a TLE is given.
   */
  designator?: string;

  /**
   * COSPAR international designator, e.g. 1998-067A (CDM INTERNATIONAL_DESIGNATOR). Defaults to
   * `Tle.intlDes` when a TLE is given.
   */
  internationalDesignator?: string;

  /** Maneuverability for CDM export (CDM MANEUVERABLE) */
  maneuverable?: ConjunctionManeuverable;

  /** Ephemeris source name for CDM export (CDM EPHEMERIS_NAME) */
  ephemerisName?: string;

  /** TLE for the object (alternative to state) */
  tle?: Tle;

  /** State vector in J2000 frame (alternative to TLE) */
  state?: J2000;

  /** Covariance matrix (optional, for probability calculation) */
  covariance?: StateCovariance;

  /** Hard body radius in km (optional, for probability calculation) */
  radius?: Kilometers;

  /** Custom propagator (optional, overrides default) */
  propagator?: Propagator;
}

/**
 * Configuration options for conjunction assessment.
 */
export interface ConjunctionAssessmentOptions {
  /** Search window start time */
  startTime: EpochUTC;

  /** Search window end time */
  endTime: EpochUTC;

  /** Use high-fidelity propagation (RungeKutta89 instead of SGP4) */
  useHighFidelity?: boolean;

  /** Force model for high-fidelity propagation (optional) */
  forceModel?: ForceModel;

  /** Propagate covariances using sigma-point method */
  propagateCovariance?: boolean;

  /** TCA search tolerance in seconds */
  tcaTolerance?: Seconds;

  /** Step size for initial TCA search in seconds */
  searchStepSize?: Seconds;

  /**
   * Epoch at which TLE inputs are converted to the initial state of the high-fidelity (RK89)
   * propagator. Defaults to `startTime`, so results never depend on the wall-clock time.
   * Ignored unless `useHighFidelity` is true.
   */
  highFidelitySeedEpoch?: EpochUTC;

  /** Screening volume and period copied to the event for CDM export (optional) */
  screenVolume?: ConjunctionScreenVolume;
}

/**
 * High accuracy conjunction assessment workflow.
 *
 * This class provides a comprehensive workflow for assessing conjunctions between
 * space objects using:
 * - High accuracy propagators (SGP4 or numerical integrators)
 * - Covariance matrices based on historical TLE accuracy
 * - Time of Closest Approach (TCA) finding using optimization
 * - Probability of collision from the exact 2D encounter-plane integral (see ProbabilityOfCollision)
 *
 * @example
 * ```typescript
 * const primaryTle = new Tle(line1, line2);
 * const secondaryTle = new Tle(line1, line2);
 *
 * const assessment = new ConjunctionAssessment(
 *   { tle: primaryTle, radius: 0.01 as Kilometers },
 *   { tle: secondaryTle, radius: 0.01 as Kilometers },
 * );
 *
 * const event = assessment.assess({
 *   startTime: EpochUTC.fromDateTime(new Date('2025-01-01T00:00:00Z')),
 *   endTime: EpochUTC.fromDateTime(new Date('2025-01-02T00:00:00Z')),
 *   useHighFidelity: true,
 *   propagateCovariance: true,
 * });
 *
 * console.log(event.toString());
 * ```
 */
export class ConjunctionAssessment {
  private primaryProp: Propagator;
  private secondaryProp: Propagator;
  private primaryCovSample?: CovarianceSample;
  private secondaryCovSample?: CovarianceSample;

  constructor(
    private primary: ConjunctionSpaceObjectInput,
    private secondary: ConjunctionSpaceObjectInput,
  ) {
    // Initialize propagators (will be replaced in assess() if needed)
    this.primaryProp = this.createPropagator(primary, false);
    this.secondaryProp = this.createPropagator(secondary, false);
  }

  /**
   * Performs conjunction assessment over the specified time window.
   *
   * @param options Assessment configuration options
   * @returns ConjunctionEvent with TCA, miss distance, and probability of collision
   */
  assess(options: ConjunctionAssessmentOptions): ConjunctionEvent {
    const {
      startTime,
      endTime,
      useHighFidelity = false,
      forceModel,
      propagateCovariance = false,
      tcaTolerance = 0.001 as Seconds,
      searchStepSize = 60.0 as Seconds,
      highFidelitySeedEpoch = startTime,
    } = options;

    // Create propagators based on options
    this.primaryProp =
      this.primary.propagator ?? this.createPropagator(this.primary, useHighFidelity, forceModel, highFidelitySeedEpoch);
    this.secondaryProp =
      this.secondary.propagator ??
      this.createPropagator(this.secondary, useHighFidelity, forceModel, highFidelitySeedEpoch);

    // Initialize covariance samples if requested
    if (propagateCovariance) {
      this.initializeCovarianceSamples(startTime, useHighFidelity, forceModel);
    }

    // Find Time of Closest Approach (TCA)
    const tca = this.findTCA(startTime, endTime, searchStepSize, tcaTolerance);

    // Propagate states to TCA
    const primaryState = this.primaryProp.propagate(tca);
    const secondaryState = this.secondaryProp.propagate(tca);

    // Compute relative state in RIC frame
    const relativeState = RIC.fromJ2000(secondaryState, primaryState);

    /*
     * Signed RIC components of the secondary relative to the primary, as CCSDS 508.0-B-1
     * RELATIVE_POSITION_R/T/N and RELATIVE_VELOCITY_R/T/N define them (v7 stored |x|, |y|, |z|).
     */
    const radialDistance = relativeState.position.x as Kilometers;
    const intrackDistance = relativeState.position.y as Kilometers;
    const crosstrackDistance = relativeState.position.z as Kilometers;
    const missDistance = relativeState.range;
    const relativeVelocity = relativeState.velocity.magnitude();

    // Compute combined covariance and Pc if available
    let combinedCovariance: StateCovariance | undefined;
    let probabilityOfCollision: number | undefined;
    let primaryCovariance: StateCovariance | undefined;
    let secondaryCovariance: StateCovariance | undefined;

    if (this.primaryCovSample && this.secondaryCovSample && this.primary.radius && this.secondary.radius) {
      // Propagate covariance samples to TCA
      this.primaryCovSample.propagate(tca);
      this.secondaryCovSample.propagate(tca);

      // Each desampled covariance is in its own object's RIC frame
      primaryCovariance = this.primaryCovSample.desampleRIC();
      secondaryCovariance = this.secondaryCovSample.desampleRIC();

      // Rotate the secondary into the primary RIC frame before summing (same frame as relativeState)
      combinedCovariance = ProbabilityOfCollision.combineCovarianceMatrices(
        primaryCovariance,
        this.rotateRicCovariance_(secondaryCovariance, secondaryState, primaryState),
      );

      // Calculate probability of collision
      const combinedRadius = (this.primary.radius + this.secondary.radius) as Kilometers;

      probabilityOfCollision = ProbabilityOfCollision.calculate(
        relativeState.position,
        relativeState.velocity,
        combinedCovariance,
        combinedRadius,
      );
    } else if (this.primary.covariance && this.secondary.covariance && this.primary.radius && this.secondary.radius) {
      /*
       * Use provided covariances without propagation. Both are expressed in the PRIMARY RIC frame
       * before summing, because the relative state (and so the encounter plane) is in that frame:
       * an ECI covariance is rotated ECI -> primary RIC; a secondary RIC covariance is rotated
       * secondary RIC -> ECI -> primary RIC, C' = M C M^T with M = Q_p Q_s^T (Q rows R, I, C).
       */
      primaryCovariance = this.primary.covariance;
      secondaryCovariance = this.secondary.covariance;

      const primaryCovRIC = this.primary.covariance.frame === CovarianceFrame.ECI
        ? this.transformCovarianceToRIC(this.primary.covariance, primaryState)
        : this.primary.covariance;
      const secondaryCovRIC = this.secondary.covariance.frame === CovarianceFrame.ECI
        ? this.transformCovarianceToRIC(this.secondary.covariance, primaryState)
        : this.rotateRicCovariance_(this.secondary.covariance, secondaryState, primaryState);

      combinedCovariance = ProbabilityOfCollision.combineCovarianceMatrices(primaryCovRIC, secondaryCovRIC);

      const combinedRadius = (this.primary.radius + this.secondary.radius) as Kilometers;

      probabilityOfCollision = ProbabilityOfCollision.calculate(
        relativeState.position,
        relativeState.velocity,
        combinedCovariance,
        combinedRadius,
      );
    }

    return new ConjunctionEvent({
      tca,
      primaryState,
      secondaryState,
      relativeState,
      missDistance,
      radialDistance,
      intrackDistance,
      crosstrackDistance,
      relativeVelocity,
      radialVelocity: relativeState.velocity.x,
      intrackVelocity: relativeState.velocity.y,
      crosstrackVelocity: relativeState.velocity.z,
      combinedCovariance,
      probabilityOfCollision,
      primaryRadius: this.primary.radius,
      secondaryRadius: this.secondary.radius,
      primaryName: this.primary.name,
      secondaryName: this.secondary.name,
      primaryDesignator: this.primary.designator ?? ConjunctionAssessment.catalogNumber_(this.primary.tle),
      secondaryDesignator: this.secondary.designator ?? ConjunctionAssessment.catalogNumber_(this.secondary.tle),
      primaryInternationalDesignator:
        this.primary.internationalDesignator ?? ConjunctionAssessment.cosparId_(this.primary.tle),
      secondaryInternationalDesignator:
        this.secondary.internationalDesignator ?? ConjunctionAssessment.cosparId_(this.secondary.tle),
      primaryManeuverable: this.primary.maneuverable,
      secondaryManeuverable: this.secondary.maneuverable,
      primaryEphemerisName: this.primary.ephemerisName,
      secondaryEphemerisName: this.secondary.ephemerisName,
      screenVolume: options.screenVolume,
      primaryCovariance,
      secondaryCovariance,
    });
  }

  /**
   * Catalog number of a TLE as a string (CDM OBJECT_DESIGNATOR with CATALOG_NAME = SATCAT).
   * @param tle The TLE, if any
   * @returns The catalog number, or undefined without a TLE or when its catalog field is blank
   */
  private static catalogNumber_(tle?: Tle): string | undefined {
    return tle && Number.isFinite(tle.satnum) ? String(tle.satnum) : undefined;
  }

  /**
   * COSPAR international designator of a TLE (CDM INTERNATIONAL_DESIGNATOR).
   * @param tle The TLE, if any
   * @returns The designator, e.g. 1998-067A, or undefined when absent
   */
  private static cosparId_(tle?: Tle): string | undefined {
    const id = tle ? Tle.intlDes(tle.line1) : '';

    return id.length > 0 ? id : undefined;
  }

  /**
   * Finds the Time of Closest Approach (TCA): the global minimum of the range over the window.
   *
   * 1. Samples the range on a coarse grid of `stepSize`.
   * 2. Lipschitz branch and bound: the range changes no faster than the relative speed, which is
   *    bounded by L = 1.25 * max(|v_primary| + |v_secondary|) over the samples. On an interval
   *    [a, b] the range is therefore at least (rho_a + rho_b - L (b - a)) / 2; every interval
   *    whose bound is below the best range found so far is bisected (down to stepSize / 64), so a
   *    fast encounter that falls between two grid samples is not lost.
   * 3. Every local minimum of the refined samples that can still beat the best range is polished
   *    with a golden section search on its bracketing interval; the smallest result wins.
   *
   * @param startTime Search window start
   * @param endTime Search window end
   * @param stepSize Coarse search step size in seconds
   * @param tolerance TCA search tolerance in seconds
   * @returns TCA epoch
   */
  private findTCA(startTime: EpochUTC, endTime: EpochUTC, stepSize: Seconds, tolerance: Seconds): EpochUTC {
    const t0: number = startTime.posix;
    const t1: number = endTime.posix;
    let maxSpeedSum = 0;
    const rangeAt = (posix: number): number => {
      const epoch = new EpochUTC(posix as Seconds);
      const primary = this.primaryProp.propagate(epoch);
      const secondary = this.secondaryProp.propagate(epoch);

      maxSpeedSum = Math.max(maxSpeedSum, primary.velocity.magnitude() + secondary.velocity.magnitude());

      return RIC.fromJ2000(secondary, primary).range;
    };

    // 1. Coarse grid (always includes both window ends)
    const samples: { t: number; r: number }[] = [];

    for (let t = t0; t < t1; t += stepSize) {
      samples.push({ t, r: rangeAt(t) });
    }
    samples.push({ t: t1, r: rangeAt(t1) });

    if (samples.length === 1) {
      return startTime;
    }

    // 2. Lipschitz branch and bound
    const lipschitz = 1.25 * maxSpeedSum;
    const minWidth = Math.max(stepSize / 64, tolerance);
    const maxEvaluations = 64 * samples.length;
    let best = Math.min(...samples.map((s) => s.r));
    const refined: { t: number; r: number }[] = [...samples];
    const stack: [{ t: number; r: number }, { t: number; r: number }][] = [];

    for (let i = 0; i < samples.length - 1; i++) {
      stack.push([samples[i], samples[i + 1]]);
    }

    let evaluations = 0;

    while (stack.length > 0 && evaluations < maxEvaluations) {
      const [a, b] = stack.pop()!;
      const width = b.t - a.t;
      const lowerBound = (a.r + b.r - lipschitz * width) / 2;

      if (lowerBound >= best || width <= minWidth) {
        continue;
      }

      const tm = (a.t + b.t) / 2;
      const m = { t: tm, r: rangeAt(tm) };

      evaluations++;
      refined.push(m);
      best = Math.min(best, m.r);
      stack.push([a, m], [m, b]);
    }

    refined.sort((x, y) => x.t - y.t);

    // 3. Polish every local minimum that can still beat the best value
    const candidates: number[] = [];

    for (let i = 0; i < refined.length; i++) {
      const left = i > 0 ? refined[i - 1].r : Infinity;
      const right = i < refined.length - 1 ? refined[i + 1].r : Infinity;

      if (refined[i].r <= left && refined[i].r <= right) {
        candidates.push(i);
      }
    }
    candidates.sort((i, j) => refined[i].r - refined[j].r);

    let bestT = refined[candidates[0]].t;
    let bestR = refined[candidates[0]].r;

    for (const i of candidates) {
      const lo = refined[Math.max(i - 1, 0)];
      const hi = refined[Math.min(i + 1, refined.length - 1)];
      const bound = Math.min(
        (lo.r + refined[i].r - lipschitz * (refined[i].t - lo.t)) / 2,
        (refined[i].r + hi.r - lipschitz * (hi.t - refined[i].t)) / 2,
      );

      if (bound >= bestR && i !== candidates[0]) {
        continue;
      }

      const tc = GoldenSection.search(rangeAt, lo.t, hi.t, { tolerance });
      const rc = rangeAt(tc);

      if (rc < bestR) {
        bestR = rc;
        bestT = tc;
      }
    }

    return new EpochUTC(bestT as Seconds);
  }

  /**
   * Creates a propagator for a space object.
   *
   * @param obj Space object
   * @param useHighFidelity Whether to use high-fidelity propagation
   * @param forceModel Optional force model for numerical propagation
   * @param seedEpoch Epoch at which a TLE is converted to the RK89 initial state (high fidelity
   *   only). Deterministic: never the wall-clock time.
   * @returns Propagator instance
   */
  private createPropagator(
    obj: ConjunctionSpaceObjectInput,
    useHighFidelity: boolean,
    forceModel?: ForceModel,
    seedEpoch?: EpochUTC,
  ): Propagator {
    if (obj.tle) {
      if (useHighFidelity) {
        // Convert TLE to state at the seed epoch (assess() passes the window start by default) and use RK89
        const state = obj.tle.propagate(seedEpoch ?? obj.tle.epoch).toJ2000();
        const fm = forceModel ?? new ForceModel().setGravity();

        return new RungeKutta89Propagator(state, fm);
      }

      return new Sgp4Propagator(obj.tle);
    } else if (obj.state) {
      if (useHighFidelity) {
        const fm = forceModel ?? new ForceModel().setGravity();

        return new RungeKutta89Propagator(obj.state, fm);
      }

      // For low-fidelity, still use RK89 but with simpler force model
      const fm = new ForceModel().setGravity();

      return new RungeKutta89Propagator(obj.state, fm);
    }

    throw new Error('Space object must have either a TLE or state vector');
  }

  /**
   * Initializes covariance samples for both objects.
   *
   * @param useHighFidelity Whether to use high-fidelity propagation
   * @param forceModel Optional force model
   */
  private initializeCovarianceSamples(startTime: EpochUTC, _useHighFidelity: boolean, forceModel?: ForceModel): void {
    const fm = forceModel ?? new ForceModel().setGravity();

    // Primary covariance
    if (this.primary.tle) {
      const state = this.primary.tle.propagate(startTime).toJ2000();
      const covariance =
        this.primary.covariance ??
        StateCovariance.fromSigmas([1.0, 1.0, 1.0, 0.001, 0.001, 0.001], CovarianceFrame.RIC);

      this.primaryCovSample = new CovarianceSample(state, covariance, this.primary.tle, fm, fm);
    } else if (this.primary.state && this.primary.covariance) {
      this.primaryCovSample = new CovarianceSample(this.primary.state, this.primary.covariance, this.primary.tle, fm, fm);
    }

    // Secondary covariance
    if (this.secondary.tle) {
      const state = this.secondary.tle.propagate(startTime).toJ2000();
      const covariance =
        this.secondary.covariance ??
        StateCovariance.fromSigmas([1.0, 1.0, 1.0, 0.001, 0.001, 0.001], CovarianceFrame.RIC);

      this.secondaryCovSample = new CovarianceSample(state, covariance, this.secondary.tle, fm, fm);
    } else if (this.secondary.state && this.secondary.covariance) {
      this.secondaryCovSample = new CovarianceSample(this.secondary.state, this.secondary.covariance, this.secondary.tle, fm, fm);
    }
  }

  /**
   * Rotates a covariance from the RIC frame of `from` into the RIC frame of `to`:
   * C_to = M C_from M^T with M = Q_to Q_from^T (block diagonal for the 6x6 state), where Q is the
   * ECI-to-RIC rotation (rows R, I, C). The omega x r coupling between the two rotating frames is
   * not applied to the velocity block; the position block, which drives Pc, is exact.
   *
   * @param covariance Covariance in the RIC frame of `from`
   * @param from State that defines the source RIC frame
   * @param to State that defines the target RIC frame
   * @returns Covariance in the RIC frame of `to`
   */
  private rotateRicCovariance_(covariance: StateCovariance, from: J2000, to: J2000): StateCovariance {
    const qFrom = this.createRICTransformMatrix(from.position, from.velocity);
    const qTo = this.createRICTransformMatrix(to.position, to.velocity);
    const transform = this.build6x6Transform(qTo.multiply(qFrom.transpose()));
    const rotated = transform.multiply(covariance.matrix).multiply(transform.transpose());

    return new StateCovariance(rotated, CovarianceFrame.RIC);
  }

  /**
   * Transforms ECI covariance to RIC frame.
   *
   * @param covariance ECI covariance
   * @param state State vector for RIC frame definition
   * @returns RIC covariance
   */
  private transformCovarianceToRIC(covariance: StateCovariance, state: J2000): StateCovariance {
    // Create RIC transformation matrix (3x3)
    const ricMatrix = this.createRICTransformMatrix(state.position, state.velocity);

    // Build 6x6 transformation matrix (block diagonal with 3x3 rotation)
    const transform = this.build6x6Transform(ricMatrix);

    // Transform covariance: C_ric = T * C_eci * T^T
    const covRIC = transform.multiply(covariance.matrix).multiply(transform.transpose());

    return new StateCovariance(covRIC, CovarianceFrame.RIC);
  }

  /**
   * Creates the 3x3 RIC transformation matrix.
   *
   * @param position Position vector
   * @param velocity Velocity vector
   * @returns 3x3 RIC transformation matrix
   */
  private createRICTransformMatrix(position: Vector3D, velocity: Vector3D): Matrix {
    const ru = position.normalize();
    const cu = position.cross(velocity).normalize();
    const iu = cu.cross(ru).normalize();

    return new Matrix([
      [ru.x, ru.y, ru.z],
      [iu.x, iu.y, iu.z],
      [cu.x, cu.y, cu.z],
    ]);
  }

  /**
   * Builds a 6x6 transformation matrix from a 3x3 rotation matrix.
   *
   * @param rot 3x3 rotation matrix
   * @returns 6x6 transformation matrix
   */
  private build6x6Transform(rot: Matrix): Matrix {
    const elements = [
      [rot.elements[0][0], rot.elements[0][1], rot.elements[0][2], 0, 0, 0],
      [rot.elements[1][0], rot.elements[1][1], rot.elements[1][2], 0, 0, 0],
      [rot.elements[2][0], rot.elements[2][1], rot.elements[2][2], 0, 0, 0],
      [0, 0, 0, rot.elements[0][0], rot.elements[0][1], rot.elements[0][2]],
      [0, 0, 0, rot.elements[1][0], rot.elements[1][1], rot.elements[1][2]],
      [0, 0, 0, rot.elements[2][0], rot.elements[2][1], rot.elements[2][2]],
    ];

    return new Matrix(elements);
  }
}
