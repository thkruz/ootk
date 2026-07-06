/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Based on the anglesg.m MATLAB implementation by David Vallado
 * Reference: Vallado 2022, Algorithm 52, Example 7-2
 *
 * This procedure solves the problem of orbit determination using three
 * optical sightings using the Gaussian technique. The 8th order polynomial
 * root is found using Halley iteration with canonical units for numerical
 * stability.
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

import { Earth } from '../body';
import { J2000 } from '../coordinate';
import { Kilometers, KilometersPerSecond, Radians } from '../types/types';
import { Matrix } from '../operations/Matrix';
import { Vector3D } from '../operations/Vector3D';
import { ObservationOptical } from '../observation/ObservationOptical';
import { DEG2RAD } from '../utils';
import { GibbsIOD } from './GibbsIOD';
import { HerrickGibbsIOD } from './HerrickGibbsIOD';

/**
 * Gauss Initial Orbit Determination using three optical observations.
 *
 * This implementation follows Vallado's anglesg.m MATLAB code and uses:
 * - Canonical units for numerical stability when solving the 8th-order polynomial
 * - Halley iteration for root finding (faster convergence than Newton-Raphson)
 * - Gibbs or Herrick-Gibbs methods for velocity determination
 * - Optional iterative refinement (currently disabled)
 */
export class GaussIOD {
  /** Maximum iterations for Halley root finding */
  private static readonly MAX_ROOT_ITERATIONS = 15;
  /** Root convergence tolerance in canonical units (Earth radii) */
  private static readonly ROOT_CONVERGENCE_TOL = 8.0e-5;
  /** Angle threshold for determining if observations are too close */
  private static readonly COPLANAR_THRESHOLD: Radians = (1.0 * DEG2RAD) as Radians;

  private readonly mu_: number;
  private readonly re_: number; // Earth radius in km
  private readonly tusec_: number; // Canonical time unit in seconds

  constructor(mu: number = Earth.mu, re: number = Earth.radiusEquator) {
    this.mu_ = mu;
    this.re_ = re;
    // Canonical time unit: sqrt(re^3 / mu)
    this.tusec_ = Math.sqrt((re * re * re) / mu);
  }

  /**
   * Find the root of the 8th degree polynomial using Halley iteration.
   * Uses canonical units (Earth radii) for numerical stability.
   *
   * Polynomial: r^8 + a6*r^6 + a3*r^3 + a0 = 0
   *
   * @param a0 - coefficient of r^0
   * @param a3 - coefficient of r^3
   * @param a6 - coefficient of r^6
   * @returns root in canonical units (Earth radii) or 0 if no valid solution
   */
  private findRootHalley(a0: number, a3: number, a6: number): number {
    // Initial guess: ~GPS altitude (20000 km) in canonical units
    let r = 20000.0 / this.re_;
    let rPrev = 100.0;
    let iterations = 0;

    while (Math.abs(r - rPrev) > GaussIOD.ROOT_CONVERGENCE_TOL && iterations < GaussIOD.MAX_ROOT_ITERATIONS) {
      rPrev = r;

      // Evaluate polynomial and derivatives
      const r2 = r * r;
      const r3 = r2 * r;
      const r5 = r3 * r2;
      const r6 = r5 * r;
      const r7 = r6 * r;
      const r8 = r7 * r;

      // f(r) = r^8 + a6*r^6 + a3*r^3 + a0
      const f = r8 + a6 * r6 + a3 * r3 + a0;

      // f'(r) = 8*r^7 + 6*a6*r^5 + 3*a3*r^2
      const fp = 8.0 * r7 + 6.0 * a6 * r5 + 3.0 * a3 * r2;

      // f''(r) = 56*r^6 + 30*a6*r^4 + 6*a3*r
      const fpp = 56.0 * r6 + 30.0 * a6 * r ** 4 + 6.0 * a3 * r;

      /* Halley iteration: r_new = r - (2*f*f') / (2*f'^2 - f*f'') */
      r -= (2.0 * f * fp) / (2.0 * fp * fp - f * fpp);
      iterations++;
    }

    /*
     * Validate result - if negative or beyond GEO+, set to GEO altitude
     */
    if (r < 0.0 || r * this.re_ > 50000.0) {
      r = 35000.0 / this.re_;
    }

    return r;
  }

  /**
   * Estimate a J2000 state from three optical observations using Gauss IOD.
   * Returns null if a valid solution cannot be found.
   *
   * @param o1 - First optical observation
   * @param o2 - Second optical observation (middle)
   * @param o3 - Third optical observation
   * @returns J2000 state at epoch of second observation, or null if solution fails
   */
  estimate(o1: ObservationOptical, o2: ObservationOptical, o3: ObservationOptical): J2000 | null {
    const tau12 = o1.epoch.difference(o2.epoch);
    const tau32 = o3.epoch.difference(o2.epoch);

    // Require observations to be spaced in time by at least 10 seconds
    if (Math.abs(tau12) < 10.0 || Math.abs(tau32) < 10.0) {
      return null;
    }

    /* Build line-of-sight matrices and solve for r2 magnitude */
    const { lmati, l1, l2, l3 } = this.buildLosMatrix_(o1, o2, o3);
    const r2Mag = this.solveForR2Magnitude_(o1, o2, o3, tau12, tau32, lmati, l2);

    if (r2Mag === 0 || !isFinite(r2Mag)) {
      return null;
    }

    /* Compute position vectors using slant ranges */
    const { r1, r2, r3 } = this.computePositionVectors_({ o1, o2, o3, tau12, tau32, r2Mag, lmati, l1, l2, l3 });

    /* Determine velocity using Gibbs, Herrick-Gibbs, or Lagrange */
    const v2 = this.computeVelocity_({ r1, r2, r3, o1, o2, o3, tau12, tau32 });

    return new J2000(o2.epoch, r2, v2);
  }

  /**
   * Build line-of-sight matrix and compute its inverse.
   */
  private buildLosMatrix_(o1: ObservationOptical, o2: ObservationOptical, o3: ObservationOptical) {
    const l1 = o1.observation.lineOfSight();
    const l2 = o2.observation.lineOfSight();
    const l3 = o3.observation.lineOfSight();

    const losMatrix = Matrix.allZeros(3, 3);

    losMatrix.elements[0][0] = l1.x;
    losMatrix.elements[1][0] = l1.y;
    losMatrix.elements[2][0] = l1.z;
    losMatrix.elements[0][1] = l2.x;
    losMatrix.elements[1][1] = l2.y;
    losMatrix.elements[2][1] = l2.z;
    losMatrix.elements[0][2] = l3.x;
    losMatrix.elements[1][2] = l3.y;
    losMatrix.elements[2][2] = l3.z;

    return { lmati: losMatrix.inverse(), l1, l2, l3 };
  }

  /**
   * Solve for the magnitude of r2 using canonical units and Halley iteration.
   */
  private solveForR2Magnitude_(
    o1: ObservationOptical,
    o2: ObservationOptical,
    o3: ObservationOptical,
    tau12: number,
    tau32: number,
    lmati: Matrix,
    l2: Vector3D,
  ): number {
    /* Switch to canonical time units */
    const tau12c = tau12 / this.tusec_;
    const tau32c = tau32 / this.tusec_;

    /* Vallado coefficients (equation 7-15, canonical units) */
    const a1c = tau32c / (tau32c - tau12c);
    const a1uc = (tau32c * ((tau32c - tau12c) ** 2 - tau32c * tau32c)) / (6.0 * (tau32c - tau12c));
    const a3c = -tau12c / (tau32c - tau12c);
    const a3uc = (-tau12c * ((tau32c - tau12c) ** 2 - tau12c * tau12c)) / (6.0 * (tau32c - tau12c));

    /* Build site position matrix in canonical units */
    const rsMatrixCanonical = this.buildSiteMatrixCanonical_(o1, o2, o3);

    /* M matrix in canonical units: M = inv(LOS) * R_site */
    const lir = lmati.multiply(rsMatrixCanonical);

    /* Compute d1 and d2 coefficients (Vallado equation 7-15) */
    const d1c = lir.elements[1][0] * a1c - lir.elements[1][1] + lir.elements[1][2] * a3c;
    const d2c = lir.elements[1][0] * a1uc + lir.elements[1][2] * a3uc;

    const s2 = o2.site.position;
    const rs2c = new Vector3D(s2.x / this.re_, s2.y / this.re_, s2.z / this.re_);
    const magrs2c = rs2c.magnitude();
    const l2dotrs = l2.x * rs2c.x + l2.y * rs2c.y + l2.z * rs2c.z;

    /*
     * Solve 8th degree polynomial (Vallado equation 7-16)
     * Note: mu is 1.0 in canonical units
     */
    const poly0 = -d2c * d2c;
    const poly3 = -2.0 * (l2dotrs * d2c + d1c * d2c);
    const poly6 = -(d1c * d1c + 2.0 * d1c * l2dotrs + magrs2c * magrs2c);

    const r2MagCanonical = this.findRootHalley(poly0, poly3, poly6);

    return r2MagCanonical * this.re_;
  }

  /**
   * Build site position matrix in canonical units.
   */
  private buildSiteMatrixCanonical_(o1: ObservationOptical, o2: ObservationOptical, o3: ObservationOptical): Matrix {
    const s1 = o1.site.position;
    const s2 = o2.site.position;
    const s3 = o3.site.position;
    const rsMatrixCanonical = Matrix.allZeros(3, 3);

    rsMatrixCanonical.elements[0][0] = s1.x / this.re_;
    rsMatrixCanonical.elements[1][0] = s1.y / this.re_;
    rsMatrixCanonical.elements[2][0] = s1.z / this.re_;
    rsMatrixCanonical.elements[0][1] = s2.x / this.re_;
    rsMatrixCanonical.elements[1][1] = s2.y / this.re_;
    rsMatrixCanonical.elements[2][1] = s2.z / this.re_;
    rsMatrixCanonical.elements[0][2] = s3.x / this.re_;
    rsMatrixCanonical.elements[1][2] = s3.y / this.re_;
    rsMatrixCanonical.elements[2][2] = s3.z / this.re_;

    return rsMatrixCanonical;
  }

  /**
   * Compute satellite position vectors from slant ranges.
   */
  private computePositionVectors_(params: {
    o1: ObservationOptical;
    o2: ObservationOptical;
    o3: ObservationOptical;
    tau12: number;
    tau32: number;
    r2Mag: number;
    lmati: Matrix;
    l1: Vector3D;
    l2: Vector3D;
    l3: Vector3D;
  }) {
    const { o1, o2, o3, tau12, tau32, r2Mag, lmati, l1, l2, l3 } = params;
    /* Vallado coefficients in regular units */
    const a1 = tau32 / (tau32 - tau12);
    const a1u = (tau32 * ((tau32 - tau12) ** 2 - tau32 * tau32)) / (6.0 * (tau32 - tau12));
    const a3 = -tau12 / (tau32 - tau12);
    const a3u = (-tau12 * ((tau32 - tau12) ** 2 - tau12 * tau12)) / (6.0 * (tau32 - tau12));

    const s1 = o1.site.position;
    const s2 = o2.site.position;
    const s3 = o3.site.position;

    /* Build site matrix in regular units (km) */
    const rsMatrix = Matrix.allZeros(3, 3);

    rsMatrix.elements[0][0] = s1.x;
    rsMatrix.elements[1][0] = s1.y;
    rsMatrix.elements[2][0] = s1.z;
    rsMatrix.elements[0][1] = s2.x;
    rsMatrix.elements[1][1] = s2.y;
    rsMatrix.elements[2][1] = s2.z;
    rsMatrix.elements[0][2] = s3.x;
    rsMatrix.elements[1][2] = s3.y;
    rsMatrix.elements[2][2] = s3.z;

    const lirKm = lmati.multiply(rsMatrix);
    const u = this.mu_ / (r2Mag * r2Mag * r2Mag);

    /* Slant range coefficients */
    const c1 = a1 + a1u * u;
    const c2 = -1.0;
    const c3 = a3 + a3u * u;

    const cMat = new Matrix([[-c1], [-c2], [-c3]]);
    const rhoMat = lirKm.multiply(cMat);

    const rho1 = rhoMat.elements[0][0] / c1;
    const rho2 = rhoMat.elements[1][0] / c2;
    const rho3 = rhoMat.elements[2][0] / c3;

    const r1 = new Vector3D<Kilometers>(
      (rho1 * l1.x + s1.x) as Kilometers,
      (rho1 * l1.y + s1.y) as Kilometers,
      (rho1 * l1.z + s1.z) as Kilometers,
    );
    const r2 = new Vector3D<Kilometers>(
      (rho2 * l2.x + s2.x) as Kilometers,
      (rho2 * l2.y + s2.y) as Kilometers,
      (rho2 * l2.z + s2.z) as Kilometers,
    );
    const r3 = new Vector3D<Kilometers>(
      (rho3 * l3.x + s3.x) as Kilometers,
      (rho3 * l3.y + s3.y) as Kilometers,
      (rho3 * l3.z + s3.z) as Kilometers,
    );

    return { r1, r2, r3 };
  }

  /**
   * Compute velocity using Gibbs, Herrick-Gibbs, or Lagrange method.
   */
  private computeVelocity_(params: {
    r1: Vector3D<Kilometers>;
    r2: Vector3D<Kilometers>;
    r3: Vector3D<Kilometers>;
    o1: ObservationOptical;
    o2: ObservationOptical;
    o3: ObservationOptical;
    tau12: number;
    tau32: number;
  }): Vector3D<KilometersPerSecond> {
    const { r1, r2, r3, o1, o2, o3, tau12, tau32 } = params;
    const theta1 = this.angle_(r1, r2);
    const theta2 = this.angle_(r2, r3);

    if (Math.abs(theta1) < GaussIOD.COPLANAR_THRESHOLD || Math.abs(theta2) < GaussIOD.COPLANAR_THRESHOLD) {
      const hgibbs = new HerrickGibbsIOD(this.mu_);

      try {
        return hgibbs.solve(r1, o1.epoch, r2, o2.epoch, r3, o3.epoch).velocity;
      } catch {
        return this.velocityFromLagrange_(r1, r2, r3, tau12, tau32);
      }
    }
    const gibbs = new GibbsIOD(this.mu_);

    try {
      return gibbs.solve(r1, r2, r3, o2.epoch, o3.epoch).velocity;
    } catch {
      return this.velocityFromLagrange_(r1, r2, r3, tau12, tau32);
    }
  }

  /**
   * Calculate velocity using simplified Lagrange f and g series.
   * This is a fallback method when Gibbs/Herrick-Gibbs cannot be used.
   */
  private velocityFromLagrange_(
    r1: Vector3D<Kilometers>,
    r2: Vector3D<Kilometers>,
    r3: Vector3D<Kilometers>,
    tau12: number,
    tau32: number,
  ): Vector3D<KilometersPerSecond> {
    const magr2 = r2.magnitude();
    const magr2Cubed = magr2 * magr2 * magr2;

    // Second-order Lagrange f and g functions (Vallado section 2.3.1)
    const f1 = 1.0 - (0.5 * this.mu_ * tau12 * tau12) / magr2Cubed;
    const f3 = 1.0 - (0.5 * this.mu_ * tau32 * tau32) / magr2Cubed;
    const g1 = tau12 - ((1.0 / 6.0) * this.mu_ * tau12 * tau12 * tau12) / magr2Cubed;
    const g3 = tau32 - ((1.0 / 6.0) * this.mu_ * tau32 * tau32 * tau32) / magr2Cubed;

    const denom = f1 * g3 - f3 * g1;

    // Velocity at middle observation (Vallado equation 7-17)
    const v2x = ((r3.x * f1 - r1.x * f3) / denom) as KilometersPerSecond;
    const v2y = ((r3.y * f1 - r1.y * f3) / denom) as KilometersPerSecond;
    const v2z = ((r3.z * f1 - r1.z * f3) / denom) as KilometersPerSecond;

    return new Vector3D<KilometersPerSecond>(v2x, v2y, v2z);
  }

  /**
   * Calculate the angle between two position vectors.
   */
  private angle_(r1: Vector3D, r2: Vector3D): Radians {
    const magr1 = r1.magnitude();
    const magr2 = r2.magnitude();
    const dot = r1.dot(r2);
    const cosAngle = dot / (magr1 * magr2);

    // Clamp to avoid numerical issues with acos
    const clamped = Math.max(-1.0, Math.min(1.0, cosAngle));

    return Math.acos(clamped) as Radians;
  }
}
