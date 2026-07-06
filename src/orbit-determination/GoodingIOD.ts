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

import { OrbitDeterminationError } from '../errors';
import { ForceModel } from '../force/ForceModel';
import { Earth } from '../body/Earth';
import { J2000 } from '../coordinate/J2000';
import { Kilometers, KilometersPerSecond, Seconds } from '../types/types';
import { TAU } from '../utils/constants';
import { Vector3D } from '../operations/Vector3D';
import { ObservationOptical } from '../observation/ObservationOptical';
import { RungeKutta89Propagator } from '../propagator/RungeKutta89Propagator';
import { GaussIOD } from './GaussIOD';
import { GibbsIOD } from './GibbsIOD';
import { LambertIOD } from './LambertIOD';

type SolveRangeProblemParams = {
  rho1init: Kilometers;
  rho3init: Kilometers;
  t13: Seconds;
  t12: Seconds;
  nRev: number;
  direction: boolean;
  lineOfSight1: Vector3D<Kilometers>;
  lineOfSight2: Vector3D<Kilometers>;
  lineOfSight3: Vector3D<Kilometers>;
  maxIterations: number;
};

type ComputeDerivativesParams = {
  x: Kilometers;
  y: Kilometers;
  lineOfSight1: Vector3D<Kilometers>;
  lineOfSight3: Vector3D<Kilometers>;
  pin: Vector3D<Kilometers>;
  ein: Vector3D<Kilometers>;
  fc: number;
  gc: number;
  t13: Seconds
  t12: Seconds;
  withHalley: boolean;
  nrev: number;
  direction: boolean;
  fd: Float64Array;
  gd: Float64Array;
};

type GetPositionOnLoS2Params = {
  e1: Vector3D<Kilometers>;
  r01: Kilometers;
  e3: Vector3D<Kilometers>;
  r03: Kilometers;
  t13: Seconds;
  t12: Seconds;
  nRev: number;
  posigrade: boolean;
};

/**
 * Gooding angles-only initial orbit determination.
 *
 * Used for orbit determination from three optical observations.
 */
export class GoodingIOD {
  /** Finite difference factor for numerical derivatives */
  private static readonly FINITE_DIFF_FACTOR = 1e-6;
  /** Convergence tolerance for iterative solver */
  private static readonly CONVERGENCE_TOLERANCE = 1e-14;
  /** Maximum iterations for range problem solver */
  private static readonly MAX_ITERATIONS = 100;
  /** Minimum determinant value to avoid numerical issues */
  private static readonly MIN_DETERMINANT = 1e-16;
  /** Gravitational constant. */
  private readonly _mu: number;
  /** observation 1 */
  private o1_!: ObservationOptical;
  /** observation 2 */
  private o2_!: ObservationOptical;
  /** observation 3 */
  private o3_!: ObservationOptical;
  /** observer position 1 */
  private vObserverPosition1_ = Vector3D.origin as Vector3D<Kilometers>;
  /** observer position 2 */
  private vObserverPosition2_ = Vector3D.origin as Vector3D<Kilometers>;
  /** observer position 3 */
  private vObserverPosition3_ = Vector3D.origin as Vector3D<Kilometers>;
  /** Normalizing constant for distances. */
  private r_ = 0.0;
  /** Normalizing constant for velocities. */
  private v_ = 0.0;
  /** Normalizing constant for duration. */
  private t_ = 0.0;
  /** Radius of point 1 (X-R1). */
  private r1_ = 0.0;
  /** Radius of point 2 (X-R2). */
  private r2_ = 0.0;
  /** Radius of point 3 (X-R3). */
  private r3_ = 0.0;
  /** Range of point 1 (O1-R1). */
  private rho1_ = 0.0 as Kilometers;
  /** Range of point 2 (O1-R1). */
  private rho2_ = 0.0 as Kilometers;
  /** Range of point 3 (O1-R1). */
  private rho3_ = 0.0 as Kilometers;
  /** working variable */
  private d1_ = 0.0 as Kilometers;
  /** working variable */
  private d3_ = 0.0 as Kilometers;
  /** factor for FD. */
  private facFiniteDiff_ = 0.0;
  private readonly _forceModel: ForceModel = new ForceModel().setGravity(1.0);

  constructor(mu: number = Earth.mu) {
    this._mu = mu;
  }

  getRange1(): Kilometers {
    return this.rho1_ * this.r_ as Kilometers;
  }

  getRange2(): Kilometers {
    return this.rho2_ * this.r_ as Kilometers;
  }

  getRange3(): Kilometers {
    return this.rho3_ * this.r_ as Kilometers;
  }

  /**
   * Estimate an orbit from three angular observations (azimuth/elevation).
   * Uses Gauss IOD to derive initial range estimates, so no external range
   * guesses are required.
   *
   * @param o1 - first angular observation
   * @param o2 - second angular observation
   * @param o3 - third angular observation
   * @param nRev - number of full revolutions between observation 1 and 3
   * @param direction - true for prograde (short-way), false for retrograde
   * @returns Orbit estimate referenced to the epoch of the second observation
   */
  estimate(o1: ObservationOptical, o2: ObservationOptical, o3: ObservationOptical,
    rho1init: Kilometers | null = null, rho3init: Kilometers | null = null,
    nRev = 0, direction = true,
  ): J2000 {
    let orbit: J2000 | null = null;


    if (rho1init === null || rho3init === null) {
      const gaussIod = new GaussIOD(this._mu);

      orbit = gaussIod.estimate(o1, o2, o3);

      if (orbit === null) {
        throw new OrbitDeterminationError('Gauss IOD failed to provide initial estimate for Gooding IOD', 'Gooding');
      }

      /*
       * Compute slant ranges (observer-to-satellite distance) from Gauss IOD solution
       * The Gauss solution is at t2 (middle observation), so we use it as approximation
       * Slant range = |satellite position - observer position|
       */
      const rho1Gauss = orbit.position.subtract(o1.site.position).magnitude();
      const rho3Gauss = orbit.position.subtract(o3.site.position).magnitude();

      rho1init = rho1init ?? rho1Gauss;
      rho3init = rho3init ?? rho3Gauss;
    }

    return this.solve(
      o1,
      o2,
      o3,
      rho1init,
      rho3init,
      nRev,
      direction,
    );
  }

  /**
   * @param r1Init - Initial guess for range at first observation
   * @param r3Init - Initial guess for range at third observation
   * @param nRev - Number of revolutions
   * @param direction - Direction of orbit (true for prograde, false for retrograde)
   * @returns
   */
  solve(o1: ObservationOptical, o2: ObservationOptical, o3: ObservationOptical,
    r1Init: Kilometers, r3Init: Kilometers, nRev = 0, direction = true,
  ): J2000 {
    this.o1_ = o1;
    this.o2_ = o2;
    this.o3_ = o3;

    const lineOfSight1 = this.o1_.observation.lineOfSight() as Vector3D<Kilometers>;
    const lineOfSight2 = this.o2_.observation.lineOfSight() as Vector3D<Kilometers>;
    const lineOfSight3 = this.o3_.observation.lineOfSight() as Vector3D<Kilometers>;

    this.r_ = Math.max(r1Init, r3Init) as Kilometers;
    this.v_ = Math.sqrt(this._mu / this.r_);
    this.t_ = this.r_ / this.v_;

    // Normalize observer positions (dimensionless)
    const invR = 1.0 / this.r_;

    this.vObserverPosition1_ = this.o1_.site.position.scale(invR) as Vector3D<Kilometers>;
    this.vObserverPosition2_ = this.o2_.site.position.scale(invR) as Vector3D<Kilometers>;
    this.vObserverPosition3_ = this.o3_.site.position.scale(invR) as Vector3D<Kilometers>;

    const converged = this.solveRangeProblem_({
      rho1init: r1Init / this.r_ as Kilometers,
      rho3init: r3Init / this.r_ as Kilometers,
      t13: this.o3_.epoch.difference(this.o1_.epoch) / this.t_ as Seconds,
      t12: this.o2_.epoch.difference(this.o1_.epoch) / this.t_ as Seconds,
      nRev,
      direction,
      lineOfSight1,
      lineOfSight2,
      lineOfSight3,
      maxIterations: GoodingIOD.MAX_ITERATIONS,
    });

    if (!converged) {
      throw new OrbitDeterminationError(
        `Gooding IOD failed to converge after ${GoodingIOD.MAX_ITERATIONS} iterations. ` +
        'Try different initial range estimates or check observation quality.',
        'Gooding',
      );
    }

    const gibbs = new GibbsIOD(this._mu);
    const p1 = this.vObserverPosition1_.add(lineOfSight1.scale(this.rho1_)).scale(this.r_) as Vector3D<Kilometers>;
    const p2 = this.vObserverPosition2_.add(lineOfSight2.scale(this.rho2_)).scale(this.r_) as Vector3D<Kilometers>;
    const p3 = this.vObserverPosition3_.add(lineOfSight3.scale(this.rho3_)).scale(this.r_) as Vector3D<Kilometers>;

    return gibbs.solve(p1, p2, p3, this.o2_.epoch, this.o3_.epoch);
  }

  /**
   * Solve the range problem when three line of sight are given.
   * @param frame frame to be used (orbit frame)
   * @param rho1init   initial value for range R1, in meters
   * @param rho3init   initial value for range R3, in meters
   * @param T13   time of flight 1->3, in seconds
   * @param T12   time of flight 1->2, in seconds
   * @param nRev number of revolutions
   * @param direction  posigrade (true) or retrograde
   * @param lineOfSight1  line of sight 1
   * @param lineOfSight2  line of sight 2
   * @param lineOfSight3  line of sight 3
   */
  private solveRangeProblem_({
    rho1init,
    rho3init,
    t13,
    t12,
    nRev,
    direction,
    lineOfSight1,
    lineOfSight2,
    lineOfSight3,
    maxIterations,
  }: SolveRangeProblemParams): boolean {
    this.rho1_ = rho1init;
    this.rho3_ = rho3init;

    let iter = 0;
    let withHalley = false; // Start with Newton-Raphson, switch to Halley's method later
    let stoppingCriterion = 10.0 * GoodingIOD.CONVERGENCE_TOLERANCE;

    while (iter < maxIterations && Math.abs(stoppingCriterion) > GoodingIOD.CONVERGENCE_TOLERANCE) {
      this.facFiniteDiff_ = GoodingIOD.FINITE_DIFF_FACTOR;

      // Switch to Halley's method after half the iterations for better convergence
      if (iter >= maxIterations / 2) {
        withHalley = true;
      }

      const p2 = this.getPositionOnLoS2_({
        e1: lineOfSight1,
        r01: this.rho1_,
        e3: lineOfSight3,
        r03: this.rho3_,
        t13,
        t12,
        nRev,
        posigrade: direction,
      });

      if (p2 === null) {
        this.modifyIterate_(lineOfSight1, lineOfSight3);
      } else {
        this.r2_ = p2.magnitude();
        const c = p2.subtract(this.vObserverPosition2_);

        this.rho2_ = c.magnitude();
        const cr = lineOfSight2.dot(c);

        const u = lineOfSight2.cross(c);
        const p = u.cross(lineOfSight2).normalize();
        const ent = lineOfSight2.cross(p);

        const enr = ent.magnitude();

        if (enr === 0.0) {
          break; // Solution found - line of sight and position are aligned
        }

        const en = ent.normalize();

        const fc = p.dot(c);
        const gc = en.dot(c);

        const fd = new Float64Array(2);
        const gd = new Float64Array(2);

        this.computeDerivatives_({
          x: this.rho1_,
          y: this.rho3_,
          lineOfSight1,
          lineOfSight3,
          pin: p,
          ein: en,
          fc,
          gc,
          t13,
          t12,
          withHalley,
          nrev: nRev,
          direction,
          fd,
          gd,
        });

        const fr1 = fd[0];
        const fr3 = fd[1];
        const gr1 = gd[0];
        const gr3 = gd[1];
        const detj = fr1 * gr3 - fr3 * gr1;

        // Check for singular Jacobian matrix
        if (Math.abs(detj) < GoodingIOD.MIN_DETERMINANT) {
          throw new OrbitDeterminationError('Jacobian determinant is near zero - system is ill-conditioned', 'Gooding');
        }

        /**
         * Compute Newton-Raphson corrections
         * Per Gooding's algorithm:
         * D3 is the correction for rho1 (range at obs 1)
         * D1 is the correction for rho3 (range at obs 3)
         */
        this.d3_ = (-gr3 * fc) / detj as Kilometers;
        this.d1_ = (gr1 * fc) / detj as Kilometers;

        // Update range estimates - note the swap per Gooding's algorithm
        this.rho1_ = (this.rho1_ + this.d3_) as Kilometers;
        this.rho3_ = (this.rho3_ + this.d1_) as Kilometers;

        const den = Math.max(cr, this.r2_);

        stoppingCriterion = fc / den;
      }

      ++iter;
    }

    // Store final convergence state for diagnostics
    const converged = Math.abs(stoppingCriterion) <= GoodingIOD.CONVERGENCE_TOLERANCE;

    if (!converged) {
      /* eslint-disable no-console */
      console.warn('Gooding IOD convergence diagnostics:');
      console.warn(`  Iterations: ${iter}/${maxIterations}`);
      console.warn(`  Final residual: ${Math.abs(stoppingCriterion).toExponential(3)}`);
      console.warn(`  Target tolerance: ${GoodingIOD.CONVERGENCE_TOLERANCE.toExponential(3)}`);
      console.warn(`  rho1: ${(this.rho1_ * this.r_).toFixed(2)} km`);
      console.warn(`  rho2: ${(this.rho2_ * this.r_).toFixed(2)} km`);
      console.warn(`  rho3: ${(this.rho3_ * this.r_).toFixed(2)} km`);
      /* eslint-enable no-console */
    }

    return converged;
  }

  private modifyIterate_(lineOfSight1: Vector3D, lineOfSight3: Vector3D): void {
    const r13 = this.vObserverPosition3_.subtract(this.vObserverPosition1_);

    this.d1_ = r13.dot(lineOfSight1) as Kilometers;
    this.d3_ = r13.dot(lineOfSight3) as Kilometers;
    const d2 = lineOfSight1.dot(lineOfSight3);
    const d4 = 1.0 - d2 * d2;

    this.rho1_ = Math.max((this.d1_ - this.d3_ * d2) / d4, 0.0) as Kilometers;
    this.rho3_ = Math.max((this.d1_ * d2 - this.d3_) / d4, 0.0) as Kilometers;
  }

  /**
   * Compute the derivatives by finite-differences for the range problem.
   * Specifically, we are trying to solve the problem:
   *      f(x, y) = 0
   *      g(x, y) = 0
   * So, in a Newton-Raphson process, we would need the derivatives:
   *  fx, fy, gx, gy
   * Enventually,
   *    dx =-f*gy / D
   *    dy = f*gx / D
   * where D is the determinant of the Jacobian matrix.
   *
   * @param frame frame to be used (orbit frame)
   * @param x    current range 1
   * @param y    current range 3
   * @param lineOfSight1  line of sight
   * @param lineOfSight3  line of sight
   * @param Pin   basis vector
   * @param Ein   basis vector
   * @param F     value of the f-function
   * @param T13   time of flight 1->3, in seconds
   * @param T12   time of flight 1->2, in seconds
   * @param withHalley    use Halley iterative method
   * @param nRev  number of revolutions
   * @param direction direction of motion
   * @param FD    derivatives of f wrt (rho1, rho3) by finite differences
   * @param GD    derivatives of g wrt (rho1, rho3) by finite differences
   */

  private computeDerivatives_({
    x,
    y,
    lineOfSight1,
    lineOfSight3,
    pin,
    ein,
    fc,
    gc,
    t13,
    t12,
    withHalley,
    nrev,
    direction,
    fd,
    gd,
  }: ComputeDerivativesParams): void {
    const p = pin.normalize();
    const en = ein.normalize();

    const dx = this.facFiniteDiff_ * x as Kilometers;
    const dy = this.facFiniteDiff_ * y as Kilometers;

    const pm1 = this.getPositionOnLoS2_({
      e1: lineOfSight1,
      r01: (x - dx) as Kilometers,
      e3: lineOfSight3,
      r03: y,
      t13,
      t12,
      nRev: nrev,
      posigrade: direction,
    });

    if (pm1 === null) {
      throw new OrbitDeterminationError('Lambert solver failed during derivative computation (x-dx)', 'Gooding');
    }
    const cm1 = pm1.subtract(this.vObserverPosition2_);
    const fm1 = p.dot(cm1);
    const gm1 = en.dot(cm1);

    const pp1 = this.getPositionOnLoS2_({
      e1: lineOfSight1,
      r01: (x + dx) as Kilometers,
      e3: lineOfSight3,
      r03: y,
      t13,
      t12,
      nRev: nrev,
      posigrade: direction,
    });

    if (pp1 === null) {
      throw new OrbitDeterminationError('Lambert solver failed during derivative computation (x+dx)', 'Gooding');
    }
    const cp1 = pp1.subtract(this.vObserverPosition2_);
    const fp1 = p.dot(cp1);
    const gp1 = en.dot(cp1);

    const fx = (fp1 - fm1) / (2.0 * dx);
    const gx = (gp1 - gm1) / (2.0 * dx);

    const pm3 = this.getPositionOnLoS2_({
      e1: lineOfSight1,
      r01: x,
      e3: lineOfSight3,
      r03: (y - dy) as Kilometers,
      t13,
      t12,
      nRev: nrev,
      posigrade: direction,
    });

    if (pm3 === null) {
      throw new OrbitDeterminationError('Lambert solver failed during derivative computation (y-dy)', 'Gooding');
    }
    const cm3 = pm3.subtract(this.vObserverPosition2_);
    const fm3 = p.dot(cm3);
    const gm3 = en.dot(cm3);

    const pp3 = this.getPositionOnLoS2_({
      e1: lineOfSight1,
      r01: x,
      e3: lineOfSight3,
      r03: (y + dy) as Kilometers,
      t13,
      t12,
      nRev: nrev,
      posigrade: direction,
    });

    if (pp3 === null) {
      throw new OrbitDeterminationError('Lambert solver failed during derivative computation (y+dy)', 'Gooding');
    }
    const cp3 = pp3.subtract(this.vObserverPosition2_);
    const fp3 = p.dot(cp3);
    const gp3 = en.dot(cp3);

    const fy = (fp3 - fm3) / (2.0 * dy);
    const gy = (gp3 - gm3) / (2.0 * dy);

    // Coefficients for the classical Newton-Raphson iterative method
    fd[0] = fx;
    fd[1] = fy;
    gd[0] = gx;
    gd[1] = gy;

    // Modified Newton-Raphson process with Halley's method for cubic convergence
    if (withHalley) {
      const hrho1Sq = dx * dx;
      const hrho3Sq = dy * dy;

      // Second order derivatives: d^2f / drho1^2 and d^2g / drho1^2
      const fxx = (fp1 + fm1 - 2.0 * fc) / hrho1Sq;
      const gxx = (gp1 + gm1 - 2.0 * gc) / hrho1Sq;
      const fyy = (fp3 + fm3 - 2.0 * fc) / hrho3Sq;
      const gyy = (gp3 + gm3 - 2.0 * gc) / hrho3Sq;

      const pp13 = this.getPositionOnLoS2_({
        e1: lineOfSight1,
        r01: (x + dx) as Kilometers,
        e3: lineOfSight3,
        r03: (y + dy) as Kilometers,
        t13,
        t12,
        nRev: nrev,
        posigrade: direction,
      });

      if (pp13 === null) {
        throw new OrbitDeterminationError('Lambert solver failed during Halley derivative computation (x+dx, y+dy)', 'Gooding');
      }

      const cp13 = pp13.subtract(this.vObserverPosition2_);
      const fp13 = p.dot(cp13);
      const gp13 = en.dot(cp13);

      const pm13 = this.getPositionOnLoS2_({
        e1: lineOfSight1,
        r01: (x - dx) as Kilometers,
        e3: lineOfSight3,
        r03: (y - dy) as Kilometers,
        t13,
        t12,
        nRev: nrev,
        posigrade: direction,
      });

      if (pm13 === null) {
        throw new OrbitDeterminationError('Lambert solver failed during Halley derivative computation (x-dx, y-dy)', 'Gooding');
      }

      const cm13 = pm13.subtract(this.vObserverPosition2_);
      const fm13 = p.dot(cm13);
      const gm13 = en.dot(cm13);

      // Second order cross derivatives
      const fxy = (fp13 + fm13) / (2.0 * dx * dy) - 0.5 * (fxx * dx / dy + fyy * dy / dx) - fc / (dx * dy);
      const gxy = (gp13 + gm13) / (2.0 * dx * dy) - 0.5 * (gxx * dx / dy + gyy * dy / dx) - gc / (dx * dy);

      // Determinant of Jacobian
      const detJac = fx * gy - fy * gx;

      // Delta Newton-Raphson, 1st order step
      const dx3NR = (-gy * fc) / detJac;
      const dx1NR = (gx * fc) / detJac;

      // Halley's method Jacobian with second-order corrections
      const fxH = fx + 0.5 * (fxx * dx3NR + fxy * dx1NR);
      const fyH = fy + 0.5 * (fxy * dx3NR + fyy * dx1NR);
      const gxH = gx + 0.5 * (gxx * dx3NR + gxy * dx1NR);
      const gyH = gy + 0.5 * (gxy * dx3NR + gyy * dx1NR);

      // Update with Halley's method coefficients
      fd[0] = fxH;
      fd[1] = fyH;
      gd[0] = gxH;
      gd[1] = gyH;
    }
  }

  /**
   * Calculate the position along sight-line (forced planar mock-up for debugging).
   * @param frame frame to be used (orbit frame)
   * @param E1 line of sight 1 (ignored in planar mock-up)
   * @param RO1 distance along E1 (used for R1)
   * @param E3 line of sight 3 (ignored in planar mock-up)
   * @param RO3 distance along E3 (used for R3)
   * @param T13 time of flight 1->3
   * @param T12 time of flight 1->2
   * @param nRev number of revolutions
   * @param posigrade direction of motion
   * @return (R2-O2) in normalized units
   */
  private getPositionOnLoS2_({
    e1,
    r01,
    e3,
    r03,
    t13,
    t12,
    nRev,
    posigrade,
  }: GetPositionOnLoS2Params): Vector3D<Kilometers> | null {
    const p1 = this.vObserverPosition1_.add(e1.scale(r01));

    this.r1_ = p1.magnitude();

    const p3 = this.vObserverPosition3_.add(e3.scale(r03));

    this.r3_ = p3.magnitude();

    const p13 = p1.cross(p3);

    let th = Math.atan2(p13.magnitude(), p1.dot(p3));

    if (!posigrade) {
      th = TAU - th;
    }

    const v1 = new Float64Array(2);
    const exitflag = LambertIOD.solve(this.r1_, this.r3_, th, t13, nRev, v1);

    if (exitflag) {
      const pn = p1.cross(p3);
      const pt = pn.cross(p1);

      let rt = pt.magnitude();

      if (!posigrade) {
        rt = -rt as Kilometers;
      }

      const vel1 = p1.scale(v1[0] / this.r1_).add(pt.scale(v1[1] / rt)) as Vector3D<KilometersPerSecond>;

      const p2 = new RungeKutta89Propagator(
        new J2000(this.o1_.epoch, p1, vel1),
        this._forceModel,
      ).propagate(this.o1_.epoch.roll(t12)).position;

      return p2;
    }

    return null;
  }
}
