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

import type { J2000 } from '../coordinate/J2000';
import type { RIC } from '../coordinate/RIC';
import type { StateCovariance } from '../covariance/StateCovariance';
import type { Kilometers, KilometersPerSecond } from '../types/types';
import { Matrix } from '../operations/Matrix';
import type { EpochUTC } from '../time/EpochUTC';

/**
 * Represents the result of a conjunction assessment between two space objects.
 * Contains all relevant information about the close approach event.
 */
export class ConjunctionEvent {
  /** Time of Closest Approach (TCA) */
  public readonly tca: EpochUTC;
  /** Primary object state at TCA in J2000 frame */
  public readonly primaryState: J2000;
  /** Secondary object state at TCA in J2000 frame */
  public readonly secondaryState: J2000;
  /** Relative state in RIC frame (relative to primary) */
  public readonly relativeState: RIC;
  /** Total miss distance at TCA (km) */
  public readonly missDistance: Kilometers;
  /** Radial component of miss distance (km) */
  public readonly radialDistance: Kilometers;
  /** Intrack component of miss distance (km) */
  public readonly intrackDistance: Kilometers;
  /** Crosstrack component of miss distance (km) */
  public readonly crosstrackDistance: Kilometers;
  /** Relative velocity magnitude at TCA (km/s) */
  public readonly relativeVelocity: KilometersPerSecond;
  /** Combined position covariance matrix in RIC frame (optional) */
  public readonly combinedCovariance?: StateCovariance;
  /** Probability of collision (optional, 0-1) */
  public readonly probabilityOfCollision?: number;
  /** Hard body radius for primary object (km, optional) */
  public readonly primaryRadius?: Kilometers;
  /** Hard body radius for secondary object (km, optional) */
  public readonly secondaryRadius?: Kilometers;
  /** Primary object name/identifier (optional, for CDM export) */
  public readonly primaryName?: string;
  /** Secondary object name/identifier (optional, for CDM export) */
  public readonly secondaryName?: string;
  /** Primary object catalog designator (optional, for CDM export) */
  public readonly primaryDesignator?: string;
  /** Secondary object catalog designator (optional, for CDM export) */
  public readonly secondaryDesignator?: string;
  /** Primary object covariance (optional, for CDM export) */
  public readonly primaryCovariance?: StateCovariance;
  /** Secondary object covariance (optional, for CDM export) */
  public readonly secondaryCovariance?: StateCovariance;

  constructor(
    params: {
      tca: EpochUTC; primaryState: J2000; secondaryState: J2000;
      relativeState: RIC; missDistance: Kilometers;
      radialDistance: Kilometers; intrackDistance: Kilometers;
      crosstrackDistance: Kilometers; relativeVelocity: KilometersPerSecond;
      combinedCovariance?: StateCovariance; probabilityOfCollision?: number;
      primaryRadius?: Kilometers; secondaryRadius?: Kilometers;
      primaryName?: string; secondaryName?: string;
      primaryDesignator?: string; secondaryDesignator?: string;
      primaryCovariance?: StateCovariance; secondaryCovariance?: StateCovariance;
    },
  ) {
    this.tca = params.tca;
    this.primaryState = params.primaryState;
    this.secondaryState = params.secondaryState;
    this.relativeState = params.relativeState;
    this.missDistance = params.missDistance;
    this.radialDistance = params.radialDistance;
    this.intrackDistance = params.intrackDistance;
    this.crosstrackDistance = params.crosstrackDistance;
    this.relativeVelocity = params.relativeVelocity;
    this.combinedCovariance = params.combinedCovariance;
    this.probabilityOfCollision = params.probabilityOfCollision;
    this.primaryRadius = params.primaryRadius;
    this.secondaryRadius = params.secondaryRadius;
    this.primaryName = params.primaryName;
    this.secondaryName = params.secondaryName;
    this.primaryDesignator = params.primaryDesignator;
    this.secondaryDesignator = params.secondaryDesignator;
    this.primaryCovariance = params.primaryCovariance;
    this.secondaryCovariance = params.secondaryCovariance;
  }

  /**
   * Returns a formatted string representation of the conjunction event.
   * @returns A multi-line string with conjunction details.
   */
  toString(): string {
    const lines = [
      '[Conjunction Event]',
      `  TCA: ${this.tca.toString()}`,
      `  Miss Distance: ${this.missDistance.toFixed(6)} km`,
      `    Radial:     ${this.radialDistance.toFixed(6)} km`,
      `    Intrack:    ${this.intrackDistance.toFixed(6)} km`,
      `    Crosstrack: ${this.crosstrackDistance.toFixed(6)} km`,
      `  Relative Velocity: ${this.relativeVelocity.toFixed(6)} km/s`,
    ];

    if (this.probabilityOfCollision !== undefined) {
      lines.push(`  Probability of Collision: ${this.probabilityOfCollision.toExponential(6)}`);
    }

    if (this.primaryRadius !== undefined && this.secondaryRadius !== undefined) {
      const combinedRadius = this.primaryRadius + this.secondaryRadius;

      lines.push(`  Combined Hard Body Radius: ${combinedRadius.toFixed(3)} km`);
    }

    return lines.join('\n');
  }

  /**
   * Checks if this is a high-risk conjunction based on miss distance and Pc.
   * @param distanceThreshold Miss distance threshold in km (default: 1.0 km)
   * @param pcThreshold Probability of collision threshold (default: 1e-4)
   * @returns True if the conjunction exceeds risk thresholds.
   */
  isHighRisk(distanceThreshold: Kilometers = 1.0 as Kilometers, pcThreshold: number = 1e-4): boolean {
    const distanceRisk = this.missDistance < distanceThreshold;
    const pcRisk = this.probabilityOfCollision !== undefined && this.probabilityOfCollision > pcThreshold;

    return distanceRisk || pcRisk;
  }

  /**
   * Gets the Mahalanobis distance if covariance is available.
   * This is the miss distance normalized by the combined covariance.
   * @returns The Mahalanobis distance (unitless), or undefined if no covariance.
   */
  getMahalanobisDistance(): number | undefined {
    if (!this.combinedCovariance) {
      return undefined;
    }

    // Extract position-only covariance (first 3x3 block)
    const posCovariance = this.extractPositionCovariance(this.combinedCovariance.matrix);
    const relPos = this.relativeState.position;

    try {
      // Compute Mahalanobis distance: sqrt(r^T * C^-1 * r)
      const covInv = posCovariance.inverse();
      const temp = covInv.multiplyVector3D(relPos);
      const mahalanobis = relPos.x * temp.x + relPos.y * temp.y + relPos.z * temp.z;

      return Math.sqrt(mahalanobis);
    } catch {
      // Covariance may be singular
      return undefined;
    }
  }

  /**
   * Extracts the 3x3 position covariance from a 6x6 state covariance matrix.
   * @param stateCov 6x6 state covariance matrix
   * @returns 3x3 position covariance matrix
   */
  private extractPositionCovariance(stateCov: Matrix): Matrix {
    const elements = [
      [stateCov.elements[0][0], stateCov.elements[0][1], stateCov.elements[0][2]],
      [stateCov.elements[1][0], stateCov.elements[1][1], stateCov.elements[1][2]],
      [stateCov.elements[2][0], stateCov.elements[2][1], stateCov.elements[2][2]],
    ];

    return new Matrix(elements);
  }
}
