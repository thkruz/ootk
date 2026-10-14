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
 * - Root validation: a root of the 8th-order polynomial is accepted only if it is at least
 *   `minRadius`, is not the spurious root near the observer's own geocentric radius (rho = 0,
 *   within {@link GaussIOD.FALSE_ROOT_FRACTION} of |R_site|), and gives positive slant ranges at
 *   all three epochs (rho < 0 places the object behind the observer). When Halley iteration does
 *   not give such a root, every positive root is bracketed and the valid ones are kept.
 * - Gibbs or Herrick-Gibbs methods for velocity determination (Lagrange f and g fallback)
 *
 * The polynomial can have up to three positive roots (Descartes' rule of signs with a6 < 0,
 * a3 > 0, a0 < 0); Charlier's analysis shows two of them can be physically valid. When two valid
 * roots remain, the one closer to the Halley iterate is taken (the larger one if Halley did not
 * produce a finite value). There is no iterative refinement of the slant ranges.
 * {@link GaussIOD.estimate} returns null when no valid root exists; it never substitutes a
 * guessed radius.
 */
export class GaussIOD {
  /** Maximum iterations for Halley root finding */
  private static readonly MAX_ROOT_ITERATIONS = 15;
  /** Root convergence tolerance in canonical units (Earth radii) */
  private static readonly ROOT_CONVERGENCE_TOL = 8.0e-5;
  /** Angle threshold for determining if observations are too close */
  private static readonly COPLANAR_THRESHOLD: Radians = (1.0 * DEG2RAD) as Radians;
  /**
   * Roots within this fraction of the observer's geocentric radius are the spurious rho = 0
   * solution (the observer's own position satisfies the range equation) and are discarded.
   */
  static readonly FALSE_ROOT_FRACTION = 0.03;

  private readonly mu_: number;
  private readonly re_: number; // Earth radius in km
  private readonly tusec_: number; // Canonical time unit in seconds
  private readonly minRadius_: number; // km

  /**
   * @param mu Gravitational parameter in km^3/s^2 (default Earth)
   * @param re Reference radius in km used for canonical units (default Earth equatorial radius)
   * @param minRadius Smallest acceptable geocentric radius of the object in km; roots below it are
   *   discarded (default `re`, the surface)
   */
  constructor(mu: number = Earth.mu, re: number = Earth.radiusEquator, minRadius: number = re) {
    this.mu_ = mu;
    this.re_ = re;
    this.minRadius_ = minRadius;
    // Canonical time unit: sqrt(re^3 / mu)
    this.tusec_ = Math.sqrt((re * re * re) / mu);
  }

  /**
   * Find the positive root of the 8th degree polynomial r^8 + a6*r^6 + a3*r^3 + a0 = 0 in
   * canonical units (Earth radii).
   *
   * Halley iteration from a 20,000 km guess. The caller validates the result (see
   * {@link GaussIOD.selectRoot_}); there is no default radius: earlier versions substituted
   * 35,000 km (Vallado's anglesg.m fallback) and returned a made-up state.
   *
   * @param a0 - coefficient of r^0
   * @param a3 - coefficient of r^3
   * @param a6 - coefficient of r^6
   * @returns converged positive root in canonical units (Earth radii), or NaN when the iteration
   *   does not converge to a finite positive value
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

    const converged = Math.abs(r - rPrev) <= GaussIOD.ROOT_CONVERGENCE_TOL;

    return converged && Number.isFinite(r) && r > 0 ? r : NaN;
  }

  /**
   * Choose the physical root of the range polynomial.
   *
   * A root is valid when `isValid` accepts it (radius at least minRadius, not within
   * {@link GaussIOD.FALSE_ROOT_FRACTION} of the site radius, positive slant ranges). The Halley
   * root is returned when valid. Otherwise every positive root is bracketed; one valid root is
   * returned as is, and of two or more the one closest to the Halley iterate (when finite) or else
   * the largest is returned.
   * @param a0 - coefficient of r^0
   * @param a3 - coefficient of r^3
   * @param a6 - coefficient of r^6
   * @param halley - Halley iterate in canonical units, or NaN
   * @param isValid - Physical validity test for a root in canonical units
   * @returns The selected root in canonical units, or NaN when no valid root exists
   */
  private static selectRoot_(a0: number, a3: number, a6: number, halley: number, isValid: (r: number) => boolean): number {
    if (Number.isFinite(halley) && isValid(halley)) {
      return halley;
    }

    const candidates = GaussIOD.findPositiveRoots_(a0, a3, a6).filter(isValid);

    if (candidates.length === 0) {
      return NaN;
    }
    if (candidates.length === 1) {
      return candidates[0];
    }
    if (Number.isFinite(halley)) {
      return candidates.reduce((best, r) => (Math.abs(r - halley) < Math.abs(best - halley) ? r : best));
    }

    return Math.max(...candidates);
  }

  /**
   * Bracket the positive real roots of r^8 + a6*r^6 + a3*r^3 + a0 on a 20,000-point logarithmic
   * grid between 0.5 and Fujiwara's root bound and refine each by bisection.
   * @param a0 - coefficient of r^0
   * @param a3 - coefficient of r^3
   * @param a6 - coefficient of r^6
   * @returns every positive root found in [0.5, Fujiwara bound], ascending (canonical units)
   */
  private static findPositiveRoots_(a0: number, a3: number, a6: number): number[] {
    const f = (x: number) => x ** 8 + a6 * x ** 6 + a3 * x ** 3 + a0;
    const lower = 0.5;
    /*
     * Fujiwara's bound on the root moduli of a monic polynomial, 2 max |a_(n-k)|^(1/k) with the
     * constant term halved (Fujiwara 1916): far tighter than the Cauchy bound, so the grid is fine
     * enough to separate roots that are 0.1 % apart.
     */
    const upper = 2 * Math.max(Math.abs(a6) ** (1 / 2), Math.abs(a3) ** (1 / 5), Math.abs(a0 / 2) ** (1 / 8), lower);

    if (!Number.isFinite(upper) || upper <= lower) {
      return [];
    }

    const steps = 20000;
    const ratio = (upper / lower) ** (1 / steps);
    const roots: number[] = [];
    let xPrev = lower;
    let fPrev = f(xPrev);

    for (let i = 1; i <= steps; i++) {
      const x = lower * ratio ** i;
      const fx = f(x);

      if (fx === 0 || fPrev * fx < 0) {
        let lo = xPrev;
        let hi = x;
        let fLo = fPrev;

        for (let k = 0; k < 200 && hi - lo > 1e-14 * hi; k++) {
          const mid = 0.5 * (lo + hi);
          const fMid = f(mid);

          if (fLo * fMid <= 0) {
            hi = mid;
          } else {
            lo = mid;
            fLo = fMid;
          }
        }
        roots.push(0.5 * (lo + hi));
      }
      xPrev = x;
      fPrev = fx;
    }

    return roots;
  }

  /**
   * Estimate a J2000 state from three optical observations using Gauss IOD.
   * Returns null if the observations are less than 10 s apart, or if the range polynomial has
   * no physically valid root (see the class notes; the root finder never substitutes a default
   * radius).
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

    if (!Number.isFinite(r2Mag) || r2Mag <= 0) {
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

    const halley = this.findRootHalley(poly0, poly3, poly6);
    const minCanonical = this.minRadius_ / this.re_;
    const isValid = (r: number): boolean => {
      if (!(r >= minCanonical) || Math.abs(r - magrs2c) <= GaussIOD.FALSE_ROOT_FRACTION * magrs2c) {
        return false;
      }
      const rho = this.slantRanges_({ o1, o2, o3, tau12, tau32, r2Mag: r * this.re_, lmati });

      return rho.every((x) => Number.isFinite(x) && x > 0);
    };

    return GaussIOD.selectRoot_(poly0, poly3, poly6, halley, isValid) * this.re_;
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
   * Slant ranges rho1, rho2, rho3 (km) for a trial r2 magnitude (Vallado Algorithm 52).
   */
  private slantRanges_(params: {
    o1: ObservationOptical;
    o2: ObservationOptical;
    o3: ObservationOptical;
    tau12: number;
    tau32: number;
    r2Mag: number;
    lmati: Matrix;
  }): [number, number, number] {
    const { o1, o2, o3, tau12, tau32, r2Mag, lmati } = params;
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

    return [rhoMat.elements[0][0] / c1, rhoMat.elements[1][0] / c2, rhoMat.elements[2][0] / c3];
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
    const { o1, o2, o3, l1, l2, l3 } = params;
    const s1 = o1.site.position;
    const s2 = o2.site.position;
    const s3 = o3.site.position;
    const [rho1, rho2, rho3] = this.slantRanges_(params);

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
