/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
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

import { Matrix, StateVector, Vector3D } from '../main.js';
import { Kilometers, KilometersPerSecond, Meters } from '../types/types.js';

/**
 * Options for probability of collision calculation.
 */
export interface ProbabilityOfCollisionOptions {
  /** Combined hard body radius (sum of both object radii) in meters */
  combinedRadius: Meters;
  /** Primary object covariance matrix (3x3 position covariance in km²) */
  primaryCovariance: Matrix;
  /** Secondary object covariance matrix (3x3 position covariance in km²) */
  secondaryCovariance: Matrix;
  /** Method to use for calculation (default: 'chan') */
  method?: 'chan' | 'foster' | 'patera';
}

/**
 * Result of probability of collision calculation.
 */
export interface ProbabilityOfCollisionResult {
  /** Probability of collision (0-1) */
  probability: number;
  /** Miss distance in kilometers */
  missDistance: Kilometers;
  /** Mahalanobis distance (dimensionless) */
  mahalanobisDistance: number;
  /** Combined covariance matrix */
  combinedCovariance: Matrix;
  /** Method used for calculation */
  method: string;
}

/**
 * Calculates probability of collision between two space objects.
 * Implements various methods including Chan, Foster, and Patera.
 */
export class ProbabilityOfCollision {
  /**
   * Calculate probability of collision using specified method.
   * @param primaryState - State vector of primary object at TCA
   * @param secondaryState - State vector of secondary object at TCA
   * @param options - Calculation options
   * @returns Probability of collision result
   */
  static calculate(
    primaryState: StateVector,
    secondaryState: StateVector,
    options: ProbabilityOfCollisionOptions,
  ): ProbabilityOfCollisionResult {
    const { combinedRadius, primaryCovariance, secondaryCovariance, method = 'chan' } = options;

    // Calculate relative state
    const relPos = new Vector3D(
      (secondaryState.position.x - primaryState.position.x) as Kilometers,
      (secondaryState.position.y - primaryState.position.y) as Kilometers,
      (secondaryState.position.z - primaryState.position.z) as Kilometers,
    );

    const relVel = new Vector3D(
      (secondaryState.velocity.x - primaryState.velocity.x) as KilometersPerSecond,
      (secondaryState.velocity.y - primaryState.velocity.y) as KilometersPerSecond,
      (secondaryState.velocity.z - primaryState.velocity.z) as KilometersPerSecond,
    );

    const missDistance = relPos.magnitude() as Kilometers;

    // Combine covariances
    const combinedCov = primaryCovariance.add(secondaryCovariance);

    // Transform to encounter frame (relative velocity aligned with x-axis)
    const encounterFrame = this.createEncounterFrame_(relPos, relVel);
    const covEncounter = this.transformCovariance_(combinedCov, encounterFrame);

    // Calculate probability based on method
    let probability: number;

    switch (method) {
      case 'foster':
        probability = this.calculateFoster_(covEncounter, combinedRadius);
        break;
      case 'patera':
        probability = this.calculatePatera_(covEncounter, combinedRadius);
        break;
      case 'chan':
      default:
        probability = this.calculateChan_(covEncounter, combinedRadius);
        break;
    }

    // Calculate Mahalanobis distance
    const mahalanobisDistance = this.calculateMahalanobisDistance_(relPos, combinedCov);

    return {
      probability,
      missDistance,
      mahalanobisDistance,
      combinedCovariance: combinedCov,
      method,
    };
  }

  /**
   * Calculate Pc using Chan's method (2D circular approximation).
   * This is a fast, conservative approximation.
   */
  private static calculateChan_(covEncounter: Matrix, combinedRadius: Meters): number {
    // Project to 2D (y-z plane in encounter frame)
    const sigma_y = Math.sqrt(covEncounter.elements[1][1]);
    const sigma_z = Math.sqrt(covEncounter.elements[2][2]);

    // Use circular approximation
    const sigma = Math.sqrt((sigma_y ** 2 + sigma_z ** 2) / 2);
    const radiusKm = combinedRadius / 1000;

    // Chan's approximation
    const lambda = radiusKm / sigma;
    const pc = 1 - Math.exp(-(lambda ** 2) / 2);

    return Math.min(Math.max(pc, 0), 1); // Clamp to [0, 1]
  }

  /**
   * Calculate Pc using Foster's method (2D elliptical).
   * More accurate than Chan for elliptical covariances.
   */
  private static calculateFoster_(covEncounter: Matrix, combinedRadius: Meters): number {
    // Extract 2D covariance in y-z plane
    const Cyy = covEncounter.elements[1][1];
    const Czz = covEncounter.elements[2][2];
    const Cyz = covEncounter.elements[1][2];

    const radiusKm = combinedRadius / 1000;

    // Calculate eigenvalues of 2D covariance
    const trace = Cyy + Czz;
    const det = Cyy * Czz - Cyz ** 2;
    const discriminant = trace ** 2 - 4 * det;

    if (discriminant < 0 || det <= 0) {
      return 0;
    }

    const lambda1 = (trace + Math.sqrt(discriminant)) / 2;
    const lambda2 = (trace - Math.sqrt(discriminant)) / 2;

    const sigma1 = Math.sqrt(lambda1);
    const sigma2 = Math.sqrt(lambda2);

    // Foster's formula (simplified)
    const alpha = radiusKm / sigma1;
    const beta = sigma2 / sigma1;

    // Approximate using series expansion
    const pc = 1 - Math.exp(-((alpha ** 2) / (2 * beta ** 2)));

    return Math.min(Math.max(pc, 0), 1);
  }

  /**
   * Calculate Pc using Patera's method (numerical integration).
   * Most accurate but computationally expensive.
   */
  private static calculatePatera_(covEncounter: Matrix, combinedRadius: Meters): number {
    // This is a simplified version - full Patera method requires numerical integration
    // For now, use Chan's method as a placeholder
    // TODO: Implement full Patera numerical integration
    return this.calculateChan_(covEncounter, combinedRadius);
  }

  /**
   * Create encounter reference frame.
   * X-axis aligned with relative velocity vector.
   * Y-Z plane is the collision plane.
   */
  private static createEncounterFrame_(relPos: Vector3D<Kilometers>, relVel: Vector3D<KilometersPerSecond>): Matrix {
    // X-axis: unit relative velocity
    const xAxis = relVel.normalize();

    // Z-axis: perpendicular to relative position and velocity
    const zAxis = relPos.cross(relVel).normalize();

    // Y-axis: completes right-handed system
    const yAxis = zAxis.cross(xAxis);

    // Create rotation matrix (rows are the new axes in old frame)
    return new Matrix([
      [xAxis.x, xAxis.y, xAxis.z],
      [yAxis.x, yAxis.y, yAxis.z],
      [zAxis.x, zAxis.y, zAxis.z],
    ]);
  }

  /**
   * Transform covariance matrix to encounter frame.
   */
  private static transformCovariance_(covariance: Matrix, rotation: Matrix): Matrix {
    // C' = R * C * R^T
    return rotation.multiply(covariance).multiply(rotation.transpose());
  }

  /**
   * Calculate Mahalanobis distance.
   * This is a dimensionless measure of how many standard deviations
   * the miss distance is from the mean.
   */
  private static calculateMahalanobisDistance_(relPos: Vector3D<Kilometers>, covariance: Matrix): number {
    const r = new Matrix([[relPos.x], [relPos.y], [relPos.z]]);

    try {
      const covInv = covariance.inverse();
      const d2 = r.transpose().multiply(covInv).multiply(r).elements[0][0];

      return Math.sqrt(Math.max(d2, 0));
    } catch {
      return 0;
    }
  }

  /**
   * Assess collision risk based on probability.
   * @param probability - Probability of collision (0-1)
   * @returns Risk level string
   */
  static assessRisk(probability: number): string {
    if (probability > 1e-4) {
      return 'HIGH';
    } else if (probability > 1e-5) {
      return 'MEDIUM';
    } else if (probability > 1e-6) {
      return 'LOW';
    } else {
      return 'NEGLIGIBLE';
    }
  }
}
