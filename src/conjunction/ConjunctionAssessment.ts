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
import { ConjunctionEvent } from './ConjunctionEvent';
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
  /** Object identifier/name */
  name?: string;

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
}

/**
 * High accuracy conjunction assessment workflow.
 *
 * This class provides a comprehensive workflow for assessing conjunctions between
 * space objects using:
 * - High accuracy propagators (SGP4 or numerical integrators)
 * - Covariance matrices based on historical TLE accuracy
 * - Time of Closest Approach (TCA) finding using optimization
 * - Probability of collision calculation using Chan's 2D method
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
    } = options;

    // Create propagators based on options
    this.primaryProp = this.primary.propagator ?? this.createPropagator(this.primary, useHighFidelity, forceModel);
    this.secondaryProp =
      this.secondary.propagator ?? this.createPropagator(this.secondary, useHighFidelity, forceModel);

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

    // Extract RIC components
    const radialDistance = Math.abs(relativeState.position.x) as Kilometers;
    const intrackDistance = Math.abs(relativeState.position.y) as Kilometers;
    const crosstrackDistance = Math.abs(relativeState.position.z) as Kilometers;
    const missDistance = relativeState.range;
    const relativeVelocity = relativeState.velocity.magnitude();

    // Compute combined covariance and Pc if available
    let combinedCovariance: StateCovariance | undefined;
    let probabilityOfCollision: number | undefined;

    if (this.primaryCovSample && this.secondaryCovSample && this.primary.radius && this.secondary.radius) {
      // Propagate covariance samples to TCA
      this.primaryCovSample.propagate(tca);
      this.secondaryCovSample.propagate(tca);

      // Get covariances in RIC frame
      const primaryCov = this.primaryCovSample.desampleRIC();
      const secondaryCov = this.secondaryCovSample.desampleRIC();

      // Combine covariances
      combinedCovariance = ProbabilityOfCollision.combineCovarianceMatrices(primaryCov, secondaryCov);

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
       * Use provided covariances without propagation
       * Transform to RIC if needed
       */
      let primaryCovRIC = this.primary.covariance;
      let secondaryCovRIC = this.secondary.covariance;

      if (this.primary.covariance.frame === CovarianceFrame.ECI) {
        primaryCovRIC = this.transformCovarianceToRIC(this.primary.covariance, primaryState);
      }
      if (this.secondary.covariance.frame === CovarianceFrame.ECI) {
        secondaryCovRIC = this.transformCovarianceToRIC(this.secondary.covariance, secondaryState);
      }

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
      combinedCovariance,
      probabilityOfCollision,
      primaryRadius: this.primary.radius,
      secondaryRadius: this.secondary.radius,
    });
  }

  /**
   * Finds the Time of Closest Approach (TCA) using golden section search.
   *
   * @param startTime Search window start
   * @param endTime Search window end
   * @param stepSize Initial search step size in seconds
   * @param tolerance TCA search tolerance in seconds
   * @returns TCA epoch
   */
  private findTCA(startTime: EpochUTC, endTime: EpochUTC, stepSize: Seconds, tolerance: Seconds): EpochUTC {
    // Coarse search to find approximate TCA region
    let minRange = Infinity;
    let minEpoch = startTime;
    let current = startTime;

    while (current.posix <= endTime.posix) {
      const primary = this.primaryProp.propagate(current);
      const secondary = this.secondaryProp.propagate(current);
      const ric = RIC.fromJ2000(secondary, primary);
      const range = ric.range;

      if (range < minRange) {
        minRange = range;
        minEpoch = current;
      }

      current = current.roll(stepSize);
    }

    // Fine search using golden section optimization
    const searchWindow = 2 * stepSize;
    const lowerBound = Math.max(startTime.posix, minEpoch.posix - searchWindow);
    const upperBound = Math.min(endTime.posix, minEpoch.posix + searchWindow);

    const tcaPosix = GoldenSection.search(
      (posix) => {
        const epoch = new EpochUTC(posix as Seconds);
        const primary = this.primaryProp.propagate(epoch);
        const secondary = this.secondaryProp.propagate(epoch);
        const ric = RIC.fromJ2000(secondary, primary);

        return ric.range;
      },
      lowerBound,
      upperBound,
      { tolerance },
    );

    return new EpochUTC(tcaPosix as Seconds);
  }

  /**
   * Creates a propagator for a space object.
   *
   * @param obj Space object
   * @param useHighFidelity Whether to use high-fidelity propagation
   * @param forceModel Optional force model for numerical propagation
   * @returns Propagator instance
   */
  private createPropagator(obj: ConjunctionSpaceObjectInput, useHighFidelity: boolean, forceModel?: ForceModel): Propagator {
    if (obj.tle) {
      if (useHighFidelity) {
        // Convert TLE to state and use RK89
        const state = obj.tle.propagate(new EpochUTC(Date.now() / 1000 as Seconds)).toJ2000();
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
