/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
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

import { ForceModel } from '../force/ForceModel.js';
import { Earth, J2000, Kilometers, KilometersPerSecond, Seconds, TAU, Vector3D } from '../main.js';
import { RungeKutta89Propagator } from '../propagator/RungeKutta89Propagator.js';
import { ObservationOptical } from './../observation/ObservationOptical.js';
import { GibbsIOD } from './GibbsIOD.js';
import { LambertIOD } from './LambertIOD.js';

type SolveRangeProblemParams = {
  rho1init: Kilometers;
  rho3init: Kilometers;
  t13: Seconds;
  t12: Seconds;
  nrev: number;
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
  t13: Seconds
  t12: Seconds;
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
  private readonly _mu: number;
  private readonly o1_: ObservationOptical;
  private readonly o2_: ObservationOptical;
  private readonly o3_: ObservationOptical;
  private vObserverPosition1_ = Vector3D.origin as Vector3D<Kilometers>;
  private vObserverPosition2_ = Vector3D.origin as Vector3D<Kilometers>;
  private vObserverPosition3_ = Vector3D.origin as Vector3D<Kilometers>;
  private r_ = 0.0 as Kilometers;
  private v_ = 0.0;
  private t_ = 0.0;
  private r1_ = 0.0;
  private r2_ = 0.0;
  private r3_ = 0.0;
  private rho1_ = 0.0 as Kilometers;
  private rho2_ = 0.0 as Kilometers;
  private rho3_ = 0.0 as Kilometers;
  private d1_ = 0.0 as Kilometers;
  private d3_ = 0.0 as Kilometers;
  private facFiniteDiff_ = 0.0;
  private readonly _forceModel: ForceModel = new ForceModel().setGravity(1.0);

  constructor(o1: ObservationOptical, o2: ObservationOptical, o3: ObservationOptical, mu: number = Earth.mu) {
    this._mu = mu;
    this.o1_ = o1;
    this.o2_ = o2;
    this.o3_ = o3;
  }

  private _getPositionOnLoS2({
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

      const p2 = new RungeKutta89Propagator(new J2000(this.o1_.epoch, p1, vel1), this._forceModel).propagate(
        this.o1_.epoch.roll(t12),
      ).position;

      return p2;
    }

    return null;
  }

  private _modifyIterate(lineOfSight1: Vector3D, lineOfSight3: Vector3D): void {
    const r13 = this.vObserverPosition3_.subtract(this.vObserverPosition1_);

    this.d1_ = r13.dot(lineOfSight1) as Kilometers;
    this.d3_ = r13.dot(lineOfSight3) as Kilometers;
    const d2 = lineOfSight1.dot(lineOfSight3);
    const d4 = 1.0 - d2 * d2;

    this.rho1_ = Math.max((this.d1_ - this.d3_ * d2) / d4, 0.0) as Kilometers;
    this.rho3_ = Math.max((this.d1_ * d2 - this.d3_) / d4, 0.0) as Kilometers;
  }

  private _computeDerivatives({
    x,
    y,
    lineOfSight1,
    lineOfSight3,
    pin,
    ein,
    t13,
    t12,
    nrev,
    direction,
    fd,
    gd,
  }: ComputeDerivativesParams): void {
    const p = pin.normalize();
    const en = ein.normalize();

    const dx = this.facFiniteDiff_ * x as Kilometers;
    const dy = this.facFiniteDiff_ * y as Kilometers;

    const cm1 = this._getPositionOnLoS2({
      e1: lineOfSight1,
      r01: x - dx as Kilometers,
      e3: lineOfSight3,
      r03: y,
      t13,
      t12,
      nRev: nrev,
      posigrade: direction,
    })!.subtract(this.vObserverPosition2_);

    const fm1 = p.dot(cm1);
    const gm1 = en.dot(cm1);

    const cp1 = this._getPositionOnLoS2({
      e1: lineOfSight1,
      r01: x + dx as Kilometers,
      e3: lineOfSight3,
      r03: y,
      t13,
      t12,
      nRev: nrev,
      posigrade: direction,
    })!.subtract(this.vObserverPosition2_);

    const fp1 = p.dot(cp1);
    const gp1 = en.dot(cp1);

    const fx = (fp1 - fm1) / (2.0 * dx);
    const gx = (gp1 - gm1) / (2.0 * dx);

    const cm3 = this._getPositionOnLoS2({
      e1: lineOfSight1,
      r01: x,
      e3: lineOfSight3,
      r03: y - dy as Kilometers,
      t13,
      t12,
      nRev: nrev,
      posigrade: direction,
    })!.subtract(this.vObserverPosition2_);

    const fm3 = p.dot(cm3);
    const gm3 = en.dot(cm3);

    const cp3 = this._getPositionOnLoS2({
      e1: lineOfSight1,
      r01: x,
      e3: lineOfSight3,
      r03: y + dy as Kilometers,
      t13,
      t12,
      nRev: nrev,
      posigrade: direction,
    })!.subtract(this.vObserverPosition2_);

    const fp3 = p.dot(cp3);
    const gp3 = en.dot(cp3);

    const fy = (fp3 - fm3) / (2.0 * dy);
    const gy = (gp3 - gm3) / (2.0 * dy);

    fd[0] = fx;
    fd[1] = fy;
    gd[0] = gx;
    gd[1] = gy;
  }

  solve(r1Init: Kilometers, r3Init: Kilometers, nRev = 0, direction = true): J2000 {
    const lineOfSight1 = this.o1_.observation.lineOfSight() as Vector3D<Kilometers>;
    const lineOfSight2 = this.o2_.observation.lineOfSight() as Vector3D<Kilometers>;
    const lineOfSight3 = this.o3_.observation.lineOfSight() as Vector3D<Kilometers>;

    this.r_ = Math.max(r1Init, r3Init) as Kilometers;
    this.v_ = Math.sqrt(this._mu / this.r_);
    this.t_ = this.r_ / this.v_;

    this.vObserverPosition1_ = this.o1_.site.position.scale(1.0 / this.r_ as Kilometers);
    this.vObserverPosition2_ = this.o2_.site.position.scale(1.0 / this.r_ as Kilometers);
    this.vObserverPosition3_ = this.o3_.site.position.scale(1.0 / this.r_ as Kilometers);

    const maxiter = 100;

    this._solveRangeProblem({
      rho1init: r1Init / this.r_ as Kilometers,
      rho3init: r3Init / this.r_ as Kilometers,
      t13: this.o3_.epoch.difference(this.o1_.epoch) / this.t_ as Seconds,
      t12: this.o2_.epoch.difference(this.o1_.epoch) / this.t_ as Seconds,
      nrev: nRev,
      direction,
      lineOfSight1,
      lineOfSight2,
      lineOfSight3,
      maxIterations: maxiter,
    });
    const gibbs = new GibbsIOD(this._mu);
    const p1 = this.vObserverPosition1_.add(lineOfSight1.scale(this.rho1_)).scale(this.r_);
    const p2 = this.vObserverPosition2_.add(lineOfSight2.scale(this.rho2_)).scale(this.r_);
    const p3 = this.vObserverPosition3_.add(lineOfSight3.scale(this.rho3_)).scale(this.r_);

    return gibbs.solve(p1, p2, p3, this.o2_.epoch, this.o3_.epoch);
  }

  private _solveRangeProblem({
    rho1init,
    rho3init,
    t13,
    t12,
    nrev,
    direction,
    lineOfSight1,
    lineOfSight2,
    lineOfSight3,
    maxIterations,
  }: SolveRangeProblemParams): void {
    const arbf = 1e-6;
    const cvtol = 1e-14;

    this.rho1_ = rho1init;
    this.rho3_ = rho3init;

    let iter = 0;
    let stoppingCriterion = 10.0 * cvtol;

    while (iter < maxIterations && Math.abs(stoppingCriterion) > cvtol) {
      this.facFiniteDiff_ = arbf;

      const p2 = this._getPositionOnLoS2({
        e1: lineOfSight1,
        r01: this.rho1_,
        e3: lineOfSight3,
        r03: this.rho3_,
        t13,
        t12,
        nRev: nrev,
        posigrade: direction,
      });

      if (p2 === null) {
        this._modifyIterate(lineOfSight1, lineOfSight3);
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
          return;
        }

        const en = ent.normalize();

        const fc = p.dot(c);

        const fd = new Float64Array(2);
        const gd = new Float64Array(2);

        this._computeDerivatives({
          x: this.rho1_,
          y: this.rho3_,
          lineOfSight1,
          lineOfSight3,
          pin: p,
          ein: en,
          t13,
          t12,
          nrev,
          direction,
          fd,
          gd,
        });

        const fr1 = fd[0];
        const fr3 = fd[1];
        const gr1 = gd[0];
        const gr3 = gd[1];
        const detj = fr1 * gr3 - fr3 * gr1;

        this.d3_ = (-gr3 * fc) / detj as Kilometers;
        this.d1_ = (gr1 * fc) / detj as Kilometers;

        this.rho1_ = this.rho1_ + this.d3_ as Kilometers;
        this.rho3_ = this.rho3_ + this.d1_ as Kilometers;

        const den = Math.max(cr, this.r2_);

        stoppingCriterion = fc / den;
      }

      ++iter;
    }
  }
}
