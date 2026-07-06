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
   * The ratio of actual miss distance to predicted 1-sigma uncertainty
   * indicates whether the covariance is appropriately sized:
   * - < 1: Miss within 1-sigma (optimistic if consistently < 0.5)
   * - 1-2: Typical range for realistic covariance
   * - > 3: Covariance likely underestimated (pessimistic)
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
      assessment = 'optimistic';
    } else if (ratio > 3.0) {
      assessment = 'pessimistic';
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
   * Uses the analytical solution for the cubic characteristic equation
   * (Cardano's formula), which is more stable than iterative methods
   * for small matrices.
   *
   * @param matrix - 3x3 symmetric matrix
   * @returns Array of 3 eigenvalues
   */
  private static computeEigenvalues3x3_(matrix: Matrix): number[] {
    const a = matrix.elements;

    // For symmetric matrix, eigenvalues are real
    // Characteristic polynomial: det(A - λI) = 0
    // -λ³ + tr(A)λ² - (sum of 2x2 minors)λ + det(A) = 0

    // Coefficients of cubic: λ³ + p*λ² + q*λ + r = 0
    const p = -(a[0][0] + a[1][1] + a[2][2]); // -trace

    const q =
      a[0][0] * a[1][1] +
      a[0][0] * a[2][2] +
      a[1][1] * a[2][2] -
      a[0][1] * a[0][1] -
      a[0][2] * a[0][2] -
      a[1][2] * a[1][2];

    const r =
      -a[0][0] * a[1][1] * a[2][2] -
      2 * a[0][1] * a[1][2] * a[0][2] +
      a[0][0] * a[1][2] * a[1][2] +
      a[1][1] * a[0][2] * a[0][2] +
      a[2][2] * a[0][1] * a[0][1];

    // Solve using Cardano's formula for depressed cubic
    // Substitute λ = t - p/3 to get t³ + at + b = 0
    const p3 = p / 3;
    const aa = q - p * p3;
    const bb = r + 2 * p3 * p3 * p3 - p3 * q;

    // Discriminant for roots
    const aa3 = aa / 3;
    const bb2 = bb / 2;
    const discriminant = bb2 * bb2 + aa3 * aa3 * aa3;

    const eigenvalues: number[] = [];

    if (discriminant > 0) {
      // One real root (shouldn't happen for symmetric positive definite)
      const sqrtD = Math.sqrt(discriminant);
      const u = Math.cbrt(-bb2 + sqrtD);
      const v = Math.cbrt(-bb2 - sqrtD);

      eigenvalues.push(u + v - p3);
      // Complex roots - return 0 as fallback
      eigenvalues.push(0);
      eigenvalues.push(0);
    } else {
      // Three real roots (normal case for covariance matrices)
      const phi = Math.acos(-bb2 / Math.sqrt(-aa3 * aa3 * aa3));
      const t = 2 * Math.sqrt(-aa3);

      eigenvalues.push(t * Math.cos(phi / 3) - p3);
      eigenvalues.push(t * Math.cos((phi + 2 * Math.PI) / 3) - p3);
      eigenvalues.push(t * Math.cos((phi + 4 * Math.PI) / 3) - p3);
    }

    return eigenvalues;
  }
}
