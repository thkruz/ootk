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

import type { StateCovariance } from '../covariance/StateCovariance';
import type { Kilometers } from '../types/types';
import { Matrix } from '../operations/Matrix';
import { Vector3D } from '../operations/Vector3D';

/**
 * Probability of Collision calculator using Chan's 2D method.
 *
 * This implementation projects the combined covariance matrix onto the
 * encounter plane (B-plane) perpendicular to the relative velocity vector,
 * then computes the probability that the relative position lies within
 * the combined hard body radius.
 *
 * Reference: Chan, F. K. (2008). "Spacecraft Collision Probability"
 */
export class ProbabilityOfCollision {
  /**
   * Computes probability of collision using Chan's 2D method.
   *
   * @param relativePosition Relative position vector in RIC frame (km)
   * @param relativeVelocity Relative velocity vector in RIC frame (km/s)
   * @param combinedCovariance Combined position covariance in RIC frame (6x6)
   * @param combinedRadius Combined hard body radius (km)
   * @returns Probability of collision (0 to 1)
   */
  static calculate(
    relativePosition: Vector3D<Kilometers>,
    relativeVelocity: Vector3D,
    combinedCovariance: StateCovariance,
    combinedRadius: Kilometers,
  ): number {
    // Extract position covariance (first 3x3 block)
    const posCovariance = this.extractPositionCovariance(combinedCovariance.matrix);

    /*
     * Create encounter plane coordinate system
     * z-axis: along relative velocity (perpendicular to encounter plane)
     * x-axis and y-axis: in the encounter plane
     */
    const vMag = relativeVelocity.magnitude();

    if (vMag < 1e-9) {
      // Nearly zero relative velocity - use 3D method or return conservative estimate
      return this.calculate3D(relativePosition, posCovariance, combinedRadius);
    }

    const zAxis = relativeVelocity.scale(1.0 / vMag);

    // Choose x-axis perpendicular to z-axis
    let xAxis: Vector3D;

    if (Math.abs(zAxis.z) < 0.9) {
      // z-axis is not close to [0,0,1], use cross product with [0,0,1]
      xAxis = new Vector3D(0, 0, 1).cross(zAxis).normalize();
    } else {
      // z-axis is close to [0,0,1], use cross product with [1,0,0]
      xAxis = new Vector3D(1, 0, 0).cross(zAxis).normalize();
    }

    const yAxis = zAxis.cross(xAxis).normalize();

    // Rotation matrix from RIC to encounter plane frame
    const rotMatrix = new Matrix([
      [xAxis.x, xAxis.y, xAxis.z],
      [yAxis.x, yAxis.y, yAxis.z],
      [zAxis.x, zAxis.y, zAxis.z],
    ]);

    // Transform position to encounter plane frame
    const posEncounter = rotMatrix.multiplyVector3D(relativePosition);

    // Project position onto encounter plane (drop z-component)
    const x = posEncounter.x;
    const y = posEncounter.y;

    // Transform covariance to encounter plane frame: C_enc = R * C * R^T
    const covEncounter = rotMatrix.multiply(posCovariance).multiply(rotMatrix.transpose());

    // Extract 2D covariance in encounter plane (top-left 2x2 block)
    const cov2D = new Matrix([
      [covEncounter.elements[0][0], covEncounter.elements[0][1]],
      [covEncounter.elements[1][0], covEncounter.elements[1][1]],
    ]);

    // Compute Pc using 2D method
    return this.calculatePc2D(x, y, cov2D, combinedRadius);
  }

  /**
   * Calculates 2D probability of collision in the encounter plane.
   *
   * Uses the analytical solution for 2D Gaussian probability within a circle.
   *
   * @param x X-coordinate in encounter plane (km)
   * @param y Y-coordinate in encounter plane (km)
   * @param cov2D 2x2 covariance matrix in encounter plane
   * @param radius Combined hard body radius (km)
   * @returns Probability of collision (0 to 1)
   */
  private static calculatePc2D(x: number, y: number, cov2D: Matrix, radius: number): number {
    // Compute determinant and trace
    const c11 = cov2D.elements[0][0];
    const c12 = cov2D.elements[0][1];
    const c22 = cov2D.elements[1][1];

    const det = c11 * c22 - c12 * c12;

    if (det <= 0) {
      // Singular or invalid covariance
      return 0;
    }

    // Compute Mahalanobis distance squared: d^2 = r^T * C^-1 * r
    const covInv11 = c22 / det;
    const covInv12 = -c12 / det;
    const covInv22 = c11 / det;

    const d2 = x * (covInv11 * x + covInv12 * y) + y * (covInv12 * x + covInv22 * y);

    // Compute eigenvalues for ellipse semi-axes
    const trace = c11 + c22;
    const discriminant = Math.sqrt((c11 - c22) ** 2 + 4 * c12 * c12);
    const lambda1 = (trace + discriminant) / 2;
    const lambda2 = (trace - discriminant) / 2;

    const sigma1 = Math.sqrt(Math.max(lambda1, 0));
    const sigma2 = Math.sqrt(Math.max(lambda2, 0));

    // Use Chan's analytical approximation
    return this.chanPc2D(Math.sqrt(d2), radius, sigma1, sigma2);
  }

  /**
   * Chan's analytical approximation for 2D Pc.
   *
   * Reference: Chan, F. K. (2008). "Spacecraft Collision Probability"
   *
   * @param mahalanobisDistance Mahalanobis distance (sqrt of d2)
   * @param radius Combined hard body radius
   * @param sigma1 Larger semi-axis of covariance ellipse
   * @param sigma2 Smaller semi-axis of covariance ellipse
   * @returns Probability of collision (0 to 1)
   */
  private static chanPc2D(
    mahalanobisDistance: number,
    radius: number,
    sigma1: number,
    sigma2: number,
  ): number {
    // Effective radius in Mahalanobis space
    const sigmaMean = Math.sqrt(sigma1 * sigma2);

    if (sigmaMean < 1e-12) {
      return 0;
    }

    const eta = radius / sigmaMean;

    // If miss distance is much larger than combined size, Pc is negligible
    if (mahalanobisDistance > eta + 10) {
      return 0;
    }

    // If objects are overlapping at nominal position
    if (mahalanobisDistance * sigmaMean < radius) {
      // Use complementary error function approximation
      const zeta = mahalanobisDistance;

      return Math.exp(-0.5 * zeta * zeta) * (1 - this.approximateErfc(eta / Math.sqrt(2))) / 2;
    }

    // General case: use Chan's approximation
    const u = mahalanobisDistance;
    // const gamma = sigma1 / sigma2;

    // Foster's approximation (simplified Chan method)
    const pc = (eta * eta) / (2 * (u * u + eta * eta)) * Math.exp(-0.5 * u * u);

    return Math.min(Math.max(pc, 0), 1); // Clamp to [0, 1]
  }

  /**
   * Approximates the complementary error function erfc(x).
   *
   * Uses Abramowitz and Stegun approximation (formula 7.1.26).
   *
   * @param x Input value
   * @returns erfc(x)
   */
  private static approximateErfc(x: number): number {
    if (x < 0) {
      return 2 - this.approximateErfc(-x);
    }

    // Constants for Abramowitz and Stegun approximation
    const p = 0.3275911;
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;

    const t = 1.0 / (1.0 + p * x);
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;

    return (a1 * t + a2 * t2 + a3 * t3 + a4 * t4 + a5 * t5) * Math.exp(-x * x);
  }

  /**
   * Fallback 3D probability calculation for cases with very low relative velocity.
   *
   * Uses simple spherical approximation.
   *
   * @param relativePosition Relative position vector
   * @param posCovariance 3x3 position covariance matrix
   * @param combinedRadius Combined hard body radius
   * @returns Probability of collision (0 to 1)
   */
  private static calculate3D(
    relativePosition: Vector3D,
    posCovariance: Matrix,
    combinedRadius: number,
  ): number {
    const r = relativePosition.magnitude();

    // Compute average variance (trace / 3)
    const avgVariance =
      (posCovariance.elements[0][0] + posCovariance.elements[1][1] + posCovariance.elements[2][2]) / 3;
    const sigma = Math.sqrt(avgVariance);

    if (sigma < 1e-12) {
      return r < combinedRadius ? 1.0 : 0.0;
    }

    // Use Gaussian CDF approximation
    const z = (r - combinedRadius) / sigma;

    if (z < -3) {
      return 1.0;
    }
    if (z > 3) {
      return 0.0;
    }

    // Approximate using complementary error function
    return 0.5 * this.approximateErfc(z / Math.sqrt(2));
  }

  /**
   * Combines two covariance matrices (primary and secondary).
   *
   * The combined covariance is simply the sum of the two covariances,
   * assuming they are independent.
   *
   * @param primaryCov Primary object covariance
   * @param secondaryCov Secondary object covariance
   * @returns Combined covariance
   */
  static combineCovarianceMatrices(primaryCov: StateCovariance, secondaryCov: StateCovariance): StateCovariance {
    const combinedMatrix = primaryCov.matrix.add(secondaryCov.matrix);

    return {
      matrix: combinedMatrix,
      frame: primaryCov.frame,
    } as StateCovariance;
  }

  /**
   * Extracts the 3x3 position covariance from a 6x6 state covariance matrix.
   * @param stateCov 6x6 state covariance matrix
   * @returns 3x3 position covariance matrix
   */
  private static extractPositionCovariance(stateCov: Matrix): Matrix {
    const elements = [
      [stateCov.elements[0][0], stateCov.elements[0][1], stateCov.elements[0][2]],
      [stateCov.elements[1][0], stateCov.elements[1][1], stateCov.elements[1][2]],
      [stateCov.elements[2][0], stateCov.elements[2][1], stateCov.elements[2][2]],
    ];

    return new Matrix(elements);
  }
}
