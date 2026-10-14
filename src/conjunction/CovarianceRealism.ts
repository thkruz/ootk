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

import { Matrix } from '../operations/Matrix';
import type { StateCovariance } from '../covariance/StateCovariance';
import type { Kilometers } from '../types/types';
import type { ConjunctionEvent } from './ConjunctionEvent';

/**
 * Mahalanobis distance assessment result.
 */
export interface MahalanobisResult {
  /** Mahalanobis distance value (unitless) */
  distance: number;
  /** Expected 3-sigma bound for realistic covariance */
  expectedBound: number;
  /** Whether the distance is within expected bounds (< 3 sigma) */
  withinBounds: boolean;
  /** Equivalent sigma level (number of standard deviations) */
  sigmaLevel: number;
}

/**
 * Covariance consistency ratio assessment result.
 */
export interface ConsistencyRatioResult {
  /** Ratio of actual miss distance to predicted 1-sigma uncertainty */
  ratio: number;
  /** Whether the covariance is appropriately sized */
  isAppropriate: boolean;
  /** Assessment of covariance sizing */
  assessment: 'optimistic' | 'realistic' | 'pessimistic';
}

/**
 * Eigenvalue analysis result for covariance matrix.
 */
export interface EigenvalueAnalysisResult {
  /** Eigenvalues of position covariance (km^2), sorted descending */
  eigenvalues: [number, number, number];
  /** Condition number (ratio of max to min eigenvalue) */
  conditionNumber: number;
  /** Whether the covariance is well-conditioned */
  isWellConditioned: boolean;
  /** Whether the covariance is singular or near-singular */
  isSingular: boolean;
  /** Principal axes lengths (1-sigma, km), sorted descending */
  principalAxes: [Kilometers, Kilometers, Kilometers];
}

/**
 * Scale factor assessment result.
 */
export interface ScaleFactorResult {
  /** Estimated scale factor needed to correct covariance */
  scaleFactor: number;
  /** Assessment of current covariance size */
  assessment: 'too_small' | 'appropriate' | 'too_large';
  /** Recommendation for covariance adjustment */
  recommendation: string;
}

/**
 * Complete covariance realism assessment result.
 */
export interface CovarianceRealismResult {
  /** Whether the covariance is considered realistic overall */
  isRealistic: boolean;
  /** Overall realism score (0-1, higher = more realistic) */
  realismScore: number;
  /** Individual metric results */
  metrics: {
    mahalanobisDistance?: MahalanobisResult;
    consistencyRatio?: ConsistencyRatioResult;
    eigenvalueAnalysis?: EigenvalueAnalysisResult;
    scaleFactor?: ScaleFactorResult;
  };
  /** Warnings and issues found during assessment */
  warnings: string[];
}

/**
 * Covariance realism assessment utilities.
 *
 * Provides multiple metrics to evaluate whether covariance matrices are
 * appropriately sized for conjunction assessment. Unrealistic covariances
 * (too small or too large) can lead to poor probability of collision estimates.
 *
 * @example
 * ```typescript
 * const event = assessment.assess({ startTime, endTime });
 * const realism = CovarianceRealism.assess(event);
 *
 * if (!realism.isRealistic) {
 *   console.log('Covariance issues:', realism.warnings);
 * }
 * ```
 */
export class CovarianceRealism {
  /** Threshold for singular eigenvalue detection */
  private static readonly SINGULAR_THRESHOLD_ = 1e-12;
  /** Threshold for ill-conditioned matrix detection */
  private static readonly CONDITION_THRESHOLD_ = 1e6;
  /** Expected 3-sigma bound for Mahalanobis distance */
  private static readonly MAHALANOBIS_3SIGMA_ = 3.0;

  private constructor() {
    // Static-only utility class
  }

  /**
   * Perform comprehensive covariance realism assessment.
   *
   * Combines multiple metrics to evaluate covariance quality:
   * - Mahalanobis distance (is miss within expected sigma bounds?)
   * - Consistency ratio (ratio of miss to predicted uncertainty)
   * - Eigenvalue analysis (is covariance well-conditioned?)
   * - Scale factor assessment (is covariance sized correctly?)
   *
   * @param event - Conjunction event to assess
   * @returns Comprehensive assessment result
   */
  static assess(event: ConjunctionEvent): CovarianceRealismResult {
    const warnings: string[] = [];
    const metrics: CovarianceRealismResult['metrics'] = {};

    // Compute individual metrics
    const mahalanobis = CovarianceRealism.computeMahalanobisDistance(event);

    if (mahalanobis) {
      metrics.mahalanobisDistance = mahalanobis;
      if (!mahalanobis.withinBounds) {
        warnings.push(`Mahalanobis distance (${mahalanobis.distance.toFixed(2)}) exceeds 3-sigma bound`);
      }
    }

    const consistency = CovarianceRealism.computeConsistencyRatio(event);

    if (consistency) {
      metrics.consistencyRatio = consistency;
      if (consistency.assessment === 'optimistic') {
        warnings.push('Covariance appears optimistic (too small)');
      } else if (consistency.assessment === 'pessimistic') {
        warnings.push('Covariance appears pessimistic (too large)');
      }
    }

    if (event.combinedCovariance) {
      const eigenAnalysis = CovarianceRealism.analyzeEigenvalues(event.combinedCovariance);

      metrics.eigenvalueAnalysis = eigenAnalysis;
      if (eigenAnalysis.isSingular) {
        warnings.push('Covariance matrix is singular or near-singular');
      } else if (!eigenAnalysis.isWellConditioned) {
        warnings.push(`Covariance is ill-conditioned (condition number: ${eigenAnalysis.conditionNumber.toExponential(2)})`);
      }

      const scaleFactor = CovarianceRealism.assessScaleFactor(event);

      if (scaleFactor) {
        metrics.scaleFactor = scaleFactor;
        if (scaleFactor.assessment !== 'appropriate') {
          warnings.push(scaleFactor.recommendation);
        }
      }
    }

    // Calculate overall realism score
    let realismScore = 1.0;
    let issueCount = 0;

    if (mahalanobis && !mahalanobis.withinBounds) {
      realismScore -= 0.3;
      issueCount++;
    }
    if (consistency && !consistency.isAppropriate) {
      realismScore -= 0.2;
      issueCount++;
    }
    if (metrics.eigenvalueAnalysis?.isSingular) {
      realismScore -= 0.4;
      issueCount++;
    } else if (metrics.eigenvalueAnalysis && !metrics.eigenvalueAnalysis.isWellConditioned) {
      realismScore -= 0.2;
      issueCount++;
    }
    if (metrics.scaleFactor && metrics.scaleFactor.assessment !== 'appropriate') {
      realismScore -= 0.1;
      issueCount++;
    }

    realismScore = Math.max(0, realismScore);

    return {
      isRealistic: realismScore >= 0.7 && issueCount <= 1,
      realismScore,
      metrics,
      warnings,
    };
  }

  /**
   * Compute Mahalanobis distance for the conjunction.
   *
   * The Mahalanobis distance measures how many standard deviations
   * the miss distance is from zero, accounting for the covariance shape.
   * A value > 3 suggests the covariance may be underestimated.
   *
   * @param event - Conjunction event with covariance
   * @returns Mahalanobis result or null if no covariance
   */
  static computeMahalanobisDistance(event: ConjunctionEvent): MahalanobisResult | null {
    const distance = event.getMahalanobisDistance();

    if (distance === undefined) {
      return null;
    }

    return {
      distance,
      expectedBound: CovarianceRealism.MAHALANOBIS_3SIGMA_,
      withinBounds: distance <= CovarianceRealism.MAHALANOBIS_3SIGMA_,
      sigmaLevel: distance,
    };
  }

  /**
   * Compute covariance consistency ratio.
   *
   * ratio = miss distance / sigma, with sigma = sqrt(trace(C_pos) / 3) the mean 1-sigma position
   * uncertainty. The ratio indicates whether the covariance is appropriately sized:
   * - < 0.5: the miss is far inside the predicted 1-sigma, so the covariance is too LARGE:
   *   'pessimistic' (it overstates the uncertainty)
   * - 0.5 to 3: 'realistic'
   * - > 3: the miss is more than 3 sigma out, so the covariance is too SMALL: 'optimistic'
   *   (it understates the uncertainty)
   *
   * @param event - Conjunction event with covariance
   * @returns Consistency ratio result or null if no covariance
   */
  static computeConsistencyRatio(event: ConjunctionEvent): ConsistencyRatioResult | null {
    if (!event.combinedCovariance) {
      return null;
    }

    // Extract position covariance (3x3)
    const posCov = CovarianceRealism.extractPositionCovariance_(event.combinedCovariance.matrix);

    // Compute 1-sigma uncertainty in the miss direction
    // Use trace as a simple measure of total variance
    const trace = posCov.elements[0][0] + posCov.elements[1][1] + posCov.elements[2][2];
    const sigma1d = Math.sqrt(trace / 3); // Average 1-sigma

    if (sigma1d < CovarianceRealism.SINGULAR_THRESHOLD_) {
      return null;
    }

    const ratio = event.missDistance / sigma1d;

    let assessment: 'optimistic' | 'realistic' | 'pessimistic';

    if (ratio < 0.5) {
      // Covariance too large for the observed miss
      assessment = 'pessimistic';
    } else if (ratio > 3.0) {
      // Covariance too small for the observed miss
      assessment = 'optimistic';
    } else {
      assessment = 'realistic';
    }

    return {
      ratio,
      isAppropriate: assessment === 'realistic',
      assessment,
    };
  }

  /**
   * Perform eigenvalue analysis on position covariance.
   *
   * Analyzes the covariance matrix structure:
   * - Eigenvalues represent variance along principal axes
   * - Condition number indicates numerical stability
   * - Singular matrices indicate degenerate covariance
   *
   * @param covariance - State covariance to analyze
   * @returns Eigenvalue analysis result
   */
  static analyzeEigenvalues(covariance: StateCovariance): EigenvalueAnalysisResult {
    const posCov = CovarianceRealism.extractPositionCovariance_(covariance.matrix);
    const eigenvalues = CovarianceRealism.computeEigenvalues3x3_(posCov);

    // Sort descending
    eigenvalues.sort((a, b) => b - a);

    const maxEig = eigenvalues[0];
    const minEig = eigenvalues[2];

    const isSingular = minEig < CovarianceRealism.SINGULAR_THRESHOLD_;
    const conditionNumber = isSingular ? Infinity : maxEig / minEig;
    const isWellConditioned = conditionNumber < CovarianceRealism.CONDITION_THRESHOLD_;

    // Principal axes are sqrt of eigenvalues (1-sigma)
    const principalAxes: [Kilometers, Kilometers, Kilometers] = [
      Math.sqrt(Math.max(0, eigenvalues[0])) as Kilometers,
      Math.sqrt(Math.max(0, eigenvalues[1])) as Kilometers,
      Math.sqrt(Math.max(0, eigenvalues[2])) as Kilometers,
    ];

    return {
      eigenvalues: eigenvalues as [number, number, number],
      conditionNumber,
      isWellConditioned,
      isSingular,
      principalAxes,
    };
  }

  /**
   * Assess if covariance scale factor is appropriate.
   *
   * Compares the covariance size to typical TLE-based uncertainties:
   * - LEO: ~100m - 1km position uncertainty
   * - MEO: ~1-10km position uncertainty
   * - GEO: ~1-5km position uncertainty
   *
   * @param event - Conjunction event to assess
   * @returns Scale factor assessment or null if no covariance
   */
  static assessScaleFactor(event: ConjunctionEvent): ScaleFactorResult | null {
    if (!event.combinedCovariance) {
      return null;
    }

    const eigenAnalysis = CovarianceRealism.analyzeEigenvalues(event.combinedCovariance);

    if (eigenAnalysis.isSingular) {
      return {
        scaleFactor: Infinity,
        assessment: 'too_small',
        recommendation: 'Covariance is singular; cannot assess scale factor',
      };
    }

    // Use the largest principal axis as the characteristic size
    const maxSigma = eigenAnalysis.principalAxes[0];

    // Expected TLE uncertainty (combined for two objects) is roughly 0.5-5 km
    // This is a simplified heuristic
    const expectedMinSigma = 0.1 as Kilometers; // 100m minimum
    const expectedMaxSigma = 10.0 as Kilometers; // 10km maximum

    let assessment: 'too_small' | 'appropriate' | 'too_large';
    let scaleFactor: number;
    let recommendation: string;

    if (maxSigma < expectedMinSigma) {
      scaleFactor = expectedMinSigma / maxSigma;
      assessment = 'too_small';
      recommendation = `Covariance appears too small (${maxSigma.toFixed(3)} km); consider scaling by ${scaleFactor.toFixed(1)}x`;
    } else if (maxSigma > expectedMaxSigma) {
      scaleFactor = expectedMaxSigma / maxSigma;
      assessment = 'too_large';
      recommendation = `Covariance appears too large (${maxSigma.toFixed(1)} km); consider scaling by ${scaleFactor.toFixed(2)}x`;
    } else {
      scaleFactor = 1.0;
      assessment = 'appropriate';
      recommendation = 'Covariance size appears appropriate for TLE-based assessment';
    }

    return {
      scaleFactor,
      assessment,
      recommendation,
    };
  }

  /**
   * Extract 3x3 position covariance from 6x6 state covariance.
   */
  private static extractPositionCovariance_(stateCov: Matrix): Matrix {
    const elements = [
      [stateCov.elements[0][0], stateCov.elements[0][1], stateCov.elements[0][2]],
      [stateCov.elements[1][0], stateCov.elements[1][1], stateCov.elements[1][2]],
      [stateCov.elements[2][0], stateCov.elements[2][1], stateCov.elements[2][2]],
    ];

    return new Matrix(elements);
  }

  /**
   * Compute eigenvalues of a 3x3 symmetric matrix.
   *
   * Closed-form trigonometric solution of the characteristic cubic in the numerically robust
   * form of Smith (1961), "Eigenvalues of a symmetric 3 x 3 matrix", Commun. ACM 4(4):168:
   * q = tr(A) / 3, p = sqrt(tr((A - qI)^2) / 6), B = (A - qI) / p, r = det(B) / 2 clamped to
   * [-1, 1], phi = acos(r) / 3; eigenvalues q + 2p cos(phi), q + 2p cos(phi + 2 pi / 3) and
   * 3q minus the other two. A diagonal matrix returns its diagonal exactly and repeated roots
   * (including the identity) are handled without NaN; the clamp absorbs round-off in r.
   *
   * @param matrix - 3x3 symmetric matrix
   * @returns Array of 3 eigenvalues (unsorted)
   */
  private static computeEigenvalues3x3_(matrix: Matrix): number[] {
    const a = matrix.elements;
    const p1 = a[0][1] * a[0][1] + a[0][2] * a[0][2] + a[1][2] * a[1][2];

    if (p1 === 0) {
      // Diagonal: the eigenvalues are the diagonal entries
      return [a[0][0], a[1][1], a[2][2]];
    }

    const q = (a[0][0] + a[1][1] + a[2][2]) / 3;
    const d0 = a[0][0] - q;
    const d1 = a[1][1] - q;
    const d2 = a[2][2] - q;
    const p2 = d0 * d0 + d1 * d1 + d2 * d2 + 2 * p1;
    const p = Math.sqrt(p2 / 6);

    // B = (A - qI) / p
    const b00 = d0 / p;
    const b11 = d1 / p;
    const b22 = d2 / p;
    const b01 = a[0][1] / p;
    const b02 = a[0][2] / p;
    const b12 = a[1][2] / p;
    const detB = b00 * (b11 * b22 - b12 * b12) - b01 * (b01 * b22 - b12 * b02) + b02 * (b01 * b12 - b11 * b02);
    const r = Math.min(Math.max(detB / 2, -1), 1);
    const phi = Math.acos(r) / 3;

    const eig1 = q + 2 * p * Math.cos(phi);
    const eig3 = q + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);
    const eig2 = 3 * q - eig1 - eig3;

    return [eig1, eig2, eig3];
  }
}
