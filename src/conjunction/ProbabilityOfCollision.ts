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

/** Gauss-Kronrod 7-15 nodes (non-negative half, descending) and weights (QUADPACK qk15). */
const GK15_XK = [
  0.991455371120812639206854697526329, 0.949107912342758524526189684047851,
  0.864864423359769072789712788640926, 0.741531185599394439863864773280788,
  0.586087235467691130294144845693013, 0.405845151377397166906606412076961,
  0.207784955007898467600689403773245, 0,
];
const GK15_WK = [
  0.022935322010529224963732008058970, 0.063092092629978553290700663189204,
  0.104790010322250183839876322541518, 0.140653259715525918745189590510238,
  0.169004726639267902826583426598550, 0.190350578064785409913256402421014,
  0.204432940075298892414161999234649, 0.209482141084727828012999174891714,
];
/** Gauss 7-point weights for the Kronrod nodes with odd index (1, 3, 5) and the centre. */
const GK15_WG = [
  0.129484966168869693270611432679082, 0.279705391489276667901467771423780,
  0.381830050505118944950369775488975, 0.417959183673469387755102040816327,
];

const SQRT2 = Math.SQRT2;
const SQRT_2PI = Math.sqrt(2 * Math.PI);
const INV_SQRT_PI = 1 / Math.sqrt(Math.PI);

/**
 * Complementary error function erfc(x), accurate to about 1e-14 relative for x >= 0 so that
 * Gaussian tails (and therefore small Pc values) keep their precision.
 *
 * For 0 <= x < 2.5 it uses the all-positive series
 * erf(x) = (2 / sqrt(pi)) e^(-x^2) sum_n 2^n x^(2n+1) / (1 * 3 * ... * (2n+1))
 * (Abramowitz and Stegun 7.1.6); for x >= 2.5 the continued fraction
 * erfc(x) = e^(-x^2) / sqrt(pi) / (x + (1/2) / (x + 1 / (x + (3/2) / (x + ...))))
 * (Abramowitz and Stegun 7.1.14), evaluated with the modified Lentz algorithm.
 * @param x - Argument
 * @returns erfc(x)
 */
function erfc_(x: number): number {
  if (Number.isNaN(x)) {
    return Number.NaN;
  }
  if (x < 0) {
    return 2 - erfc_(-x);
  }
  if (x < 2.5) {
    const x2 = x * x;
    let term = x;
    let sum = x;

    for (let n = 1; n < 200; n++) {
      term *= (2 * x2) / (2 * n + 1);
      sum += term;
      if (term < sum * 1e-17) {
        break;
      }
    }

    return 1 - 2 * INV_SQRT_PI * Math.exp(-x2) * sum;
  }

  // Modified Lentz for f = x + K_{n >= 1} (n / 2) / x
  const tiny = 1e-300;
  let f = x;
  let c = x;
  let d = 0;

  for (let n = 1; n < 500; n++) {
    const an = n / 2;

    d = x + an * d;
    d = Math.abs(d) < tiny ? tiny : d;
    c = x + an / c;
    c = Math.abs(c) < tiny ? tiny : c;
    d = 1 / d;
    const delta = c * d;

    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) {
      break;
    }
  }

  return (Math.exp(-x * x) * INV_SQRT_PI) / f;
}

/**
 * Below this value of (b - a) max(1, |a|, |b|), the standard normal density varies so little over
 * [a, b] that a single 15-point Kronrod rule integrates it to machine precision.
 */
const NARROW_INTERVAL_SPAN = 0.25;

/**
 * P(a <= Z <= b) for a standard normal Z, computed from erfc tails so that probabilities far
 * out in either tail keep their relative precision.
 *
 * Narrow intervals integrate the density directly instead: the erfc difference cancels
 * catastrophically there (relative error about 1e-16 / (b - a), e.g. 4e-8 for a 1e-6 wide
 * interval at z = 3). The Pc integrand evaluates this at chord half-lengths h much smaller than
 * sigma (near the disc edge, or whenever sigma is far larger than the hard body), and that noise
 * used to defeat the 1e-12 quadrature tolerance and drive the adaptive bisection to full depth.
 */
function normalIntervalProbability_(a: number, b: number): number {
  if (!(b > a)) {
    return 0;
  }
  const width = b - a;

  if (width * Math.max(1, Math.abs(a), Math.abs(b)) <= NARROW_INTERVAL_SPAN) {
    const center = 0.5 * (a + b);
    const half = 0.5 * width;
    let sum = GK15_WK[7] * Math.exp(-0.5 * center * center);

    for (let j = 0; j < 7; j++) {
      const z1 = center - half * GK15_XK[j];
      const z2 = center + half * GK15_XK[j];

      sum += GK15_WK[j] * (Math.exp(-0.5 * z1 * z1) + Math.exp(-0.5 * z2 * z2));
    }

    return (sum * half) / SQRT_2PI;
  }
  if (a >= 0) {
    return 0.5 * (erfc_(a / SQRT2) - erfc_(b / SQRT2));
  }
  if (b <= 0) {
    return 0.5 * (erfc_(-b / SQRT2) - erfc_(-a / SQRT2));
  }

  return 1 - 0.5 * (erfc_(-a / SQRT2) + erfc_(b / SQRT2));
}

/**
 * Adaptive Gauss-Kronrod 7-15 quadrature of f over [a, b] (Piessens et al. 1983, QUADPACK).
 * Bisects until the |K15 - G7| error estimate is below `relTol` times the panel's integral of |f|,
 * or below the absolute floor `absTol`. The floor matters when the whole integral is tiny (Pc of
 * 1e-100 and below): rounding noise in the integrand then never meets a relative tolerance and
 * every panel would bisect to full depth (2^depth evaluations).
 */
function adaptiveGk15_(
  f: (x: number) => number,
  a: number,
  b: number,
  relTol: number,
  absTol: number,
  depth: number,
): number {
  const center = 0.5 * (a + b);
  const half = 0.5 * (b - a);

  if (!(half > 0)) {
    return 0;
  }

  const fc = f(center);
  let resK = fc * GK15_WK[7];
  let resG = fc * GK15_WG[3];
  let resAbs = Math.abs(resK);

  for (let j = 0; j < 7; j++) {
    const dx = half * GK15_XK[j];
    const f1 = f(center - dx);
    const f2 = f(center + dx);

    resK += GK15_WK[j] * (f1 + f2);
    resAbs += GK15_WK[j] * (Math.abs(f1) + Math.abs(f2));
    if (j % 2 === 1) {
      resG += GK15_WG[(j - 1) / 2] * (f1 + f2);
    }
  }

  const result = resK * half;
  const err = Math.abs((resK - resG) * half);

  if (depth <= 0 || err <= relTol * resAbs * half || err <= absTol || err < 1e-300) {
    return result;
  }

  return adaptiveGk15_(f, a, center, relTol, absTol, depth - 1) + adaptiveGk15_(f, center, b, relTol, absTol, depth - 1);
}

/**
 * Pc values below this are reported as exactly 0: `ProbabilityOfCollision.calculate` returns 0
 * without integrating when an analytic upper bound on Pc is already below it. Operational
 * thresholds sit around 1e-4 to 1e-7, so nothing near this level can change a screening decision.
 */
export const PC_NEGLIGIBLE = 1e-30;

/** Absolute quadrature error floor, relative to the larger of the running total and the Pc bound. */
const PC_ABS_TOL_FACTOR = 1e-16;

/**
 * Probability of Collision calculator for short-term (linear relative motion) encounters.
 *
 * Projects the combined position covariance onto the encounter plane (perpendicular to the
 * relative velocity) and integrates the resulting 2D Gaussian over the hard-body disc:
 *
 * Pc = 1 / (2 pi sigma_x sigma_y) * integral over x^2 + y^2 <= R^2 of
 *      exp(-(x - x_m)^2 / (2 sigma_x^2) - (y - y_m)^2 / (2 sigma_y^2)) dx dy
 *
 * in the covariance principal axes (Foster and Estes 1992; Alfano 2005, "A Numerical
 * Implementation of Spherical Object Collision Probability"; Chan 2008, "Spacecraft Collision
 * Probability", ch. 4). The inner integral is evaluated in closed form with erfc and the outer one
 * by adaptive Gauss-Kronrod quadrature, so the result is the exact 2D Pc (to about 1e-10
 * relative), including anisotropic covariances, hard-body radii larger than sigma and misses
 * inside the hard body. For an isotropic covariance it equals Chan's series, i.e. the Rice
 * integral 1 - Q1(d / sigma, R / sigma).
 */
export class ProbabilityOfCollision {
  /**
   * Computes the 2D probability of collision in the encounter plane.
   *
   * @param relativePosition Relative position (secondary minus primary) at TCA, in the frame of
   *   the covariance (normally the primary RIC frame), km
   * @param relativeVelocity Relative velocity in the same frame, km/s
   * @param combinedCovariance Combined (primary + secondary) covariance in the same frame; only the
   *   3x3 position block (km^2) is used
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
      // No relative motion: no encounter plane, use the instantaneous 3D overlap probability
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

    return this.calculatePc2D(x, y, cov2D, combinedRadius);
  }

  /**
   * Calculates the 2D probability of collision in the encounter plane: rotates the miss into the
   * covariance principal axes, then integrates the Gaussian over the hard-body disc.
   *
   * @param x X-coordinate of the miss in the encounter plane (km)
   * @param y Y-coordinate of the miss in the encounter plane (km)
   * @param cov2D 2x2 position covariance in the encounter plane (km^2)
   * @param radius Combined hard body radius (km)
   * @returns Probability of collision (0 to 1)
   */
  private static calculatePc2D(x: number, y: number, cov2D: Matrix, radius: number): number {
    const c11 = cov2D.elements[0][0];
    const c12 = cov2D.elements[0][1];
    const c22 = cov2D.elements[1][1];

    // Principal axes: lambda1 >= lambda2, major axis at angle theta from the x axis
    const trace = c11 + c22;
    const discriminant = Math.hypot(c11 - c22, 2 * c12);
    const lambda1 = (trace + discriminant) / 2;
    const lambda2 = (trace - discriminant) / 2;
    const theta = 0.5 * Math.atan2(2 * c12, c11 - c22);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const xm = cosT * x + sinT * y;
    const ym = -sinT * x + cosT * y;

    return this.pcPrincipalAxes_(xm, ym, Math.sqrt(Math.max(lambda1, 0)), Math.sqrt(Math.max(lambda2, 0)), radius);
  }

  /**
   * Exact 2D Pc for a Gaussian with standard deviations sigmaX and sigmaY along the coordinate
   * axes, centred at (xm, ym), integrated over the disc of radius `radius` at the origin:
   *
   * Pc = integral_{-R}^{R} N(xi; xm, sigmaX) P(-h(xi) <= eta <= h(xi)) d xi,  h = sqrt(R^2 - xi^2),
   *
   * with the inner probability from erfc and the substitution xi = R sin(phi), which removes the
   * square-root endpoint singularity. Quadrature breakpoints are graded around the Gaussian peak
   * (xi = xm) and around the chord edges where h = |ym|, so sigmas much smaller than R are still
   * resolved. A zero sigma is handled as the exact degenerate (line or point) limit.
   */
  private static pcPrincipalAxes_(xm: number, ym: number, sigmaX: number, sigmaY: number, radius: number): number {
    if (!(radius > 0)) {
      return 0;
    }

    // Degenerate covariance: a point mass or a line along one axis
    if (!(sigmaX > 0) && !(sigmaY > 0)) {
      return xm * xm + ym * ym <= radius * radius ? 1 : 0;
    }
    if (!(sigmaY > 0) || !(sigmaX > 0)) {
      // Line along the axis with non-zero sigma
      const [along, across, sigma] = sigmaX > 0 ? [xm, ym, sigmaX] : [ym, xm, sigmaY];
      const c2 = radius * radius - across * across;

      if (c2 < 0) {
        return 0;
      }
      const c = Math.sqrt(c2);

      return normalIntervalProbability_((-c - along) / sigma, (c - along) / sigma);
    }

    const upperBound = this.pcUpperBound_(xm, ym, sigmaX, sigmaY, radius);

    if (upperBound < PC_NEGLIGIBLE) {
      return 0;
    }

    const r = radius;
    const integrand = (phi: number): number => {
      const xi = r * Math.sin(phi);
      const h = r * Math.cos(phi);
      const zx = (xi - xm) / sigmaX;
      const gauss = Math.exp(-0.5 * zx * zx) / (SQRT_2PI * sigmaX);

      if (gauss === 0 || h <= 0) {
        return 0;
      }

      return gauss * normalIntervalProbability_((-h - ym) / sigmaY, (h - ym) / sigmaY) * h;
    };

    // Breakpoints in phi, graded geometrically around each feature
    const halfPi = Math.PI / 2;
    const points = [-halfPi, halfPi];
    const addGraded = (center: number, scale: number): void => {
      points.push(center);
      for (let w = scale; w < Math.PI; w *= 2) {
        points.push(center - w, center + w);
      }
    };

    addGraded(Math.asin(Math.min(Math.max(xm / r, -1), 1)), sigmaX / r);
    const edge = Math.acos(Math.min(Math.abs(ym) / r, 1));

    addGraded(edge, sigmaY / r);
    addGraded(-edge, sigmaY / r);

    const grid = [...new Set(points.filter((p) => p >= -halfPi && p <= halfPi))].sort((a, b) => a - b);
    let total = 0;

    for (let i = 0; i < grid.length - 1; i++) {
      const absTol = PC_ABS_TOL_FACTOR * Math.max(Math.abs(total), upperBound);

      total += adaptiveGk15_(integrand, grid[i], grid[i + 1], 1e-12, absTol, 30);
    }

    return Math.min(Math.max(total, 0), 1);
  }

  /**
   * Analytic upper bound on the 2D Pc in principal axes, used to skip the quadrature when Pc is
   * negligible. The hard-body disc lies inside the square [-R, R]^2, so with the miss components
   * clamped to it independently, dx = max(|xm| - R, 0) and dy = max(|ym| - R, 0):
   *
   * - area x peak density: Pc <= pi R^2 / (2 pi sigmaX sigmaY) exp(-(dx^2 / sigmaX^2 + dy^2 / sigmaY^2) / 2)
   * - separable square: Pc <= P(|X| <= R) P(|Y| <= R), X and Y independent in principal axes
   *
   * Both are rigorous; the smaller is returned. The second stays below 1 when sigma is much smaller
   * than R, the first is tight for the usual small hard body.
   */
  private static pcUpperBound_(xm: number, ym: number, sigmaX: number, sigmaY: number, radius: number): number {
    const dx = Math.max(Math.abs(xm) - radius, 0) / sigmaX;
    const dy = Math.max(Math.abs(ym) - radius, 0) / sigmaY;
    const areaTimesPeak = ((radius * radius) / (2 * sigmaX * sigmaY)) * Math.exp(-0.5 * (dx * dx + dy * dy));
    const square =
      normalIntervalProbability_((-radius - xm) / sigmaX, (radius - xm) / sigmaX) *
      normalIntervalProbability_((-radius - ym) / sigmaY, (radius - ym) / sigmaY);

    return Math.min(areaTimesPeak, square);
  }

  /**
   * Fallback for (near) zero relative velocity, where no encounter plane exists: the
   * instantaneous probability that the relative position lies inside the hard-body sphere, using
   * an isotropic Gaussian with the mean position variance sigma^2 = trace(C) / 3.
   *
   * |r| then follows a noncentral chi distribution with 3 degrees of freedom; for miss d and
   * radius R:
   * P = Phi((R - d) / sigma) - Phi((-R - d) / sigma)
   *     - sigma / (d sqrt(2 pi)) [exp(-(d - R)^2 / (2 sigma^2)) - exp(-(d + R)^2 / (2 sigma^2))],
   * which tends to erf(R / (sigma sqrt 2)) - sqrt(2 / pi) (R / sigma) exp(-R^2 / (2 sigma^2)) as
   * d -> 0. It is continuous in d (no 3-sigma cut-off).
   *
   * @param relativePosition Relative position vector (km)
   * @param posCovariance 3x3 position covariance (km^2)
   * @param combinedRadius Combined hard body radius (km)
   * @returns Probability of collision (0 to 1)
   */
  private static calculate3D(
    relativePosition: Vector3D,
    posCovariance: Matrix,
    combinedRadius: number,
  ): number {
    const d = relativePosition.magnitude();
    const avgVariance =
      (posCovariance.elements[0][0] + posCovariance.elements[1][1] + posCovariance.elements[2][2]) / 3;
    const sigma = Math.sqrt(Math.max(avgVariance, 0));
    const rr = combinedRadius;

    if (!(sigma > 1e-12)) {
      return d <= rr ? 1.0 : 0.0;
    }

    const radialTerm = normalIntervalProbability_((-rr - d) / sigma, (rr - d) / sigma);
    let correction: number;

    if (d < 1e-9 * sigma) {
      // d -> 0 limit of the bracketed term
      correction = Math.sqrt(2 / Math.PI) * (rr / sigma) * Math.exp(-(rr * rr) / (2 * sigma * sigma));
    } else {
      const e1 = Math.exp(-((d - rr) ** 2) / (2 * sigma * sigma));
      const e2 = Math.exp(-((d + rr) ** 2) / (2 * sigma * sigma));

      correction = (sigma / (d * SQRT_2PI)) * (e1 - e2);
    }

    return Math.min(Math.max(radialTerm - correction, 0), 1);
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
