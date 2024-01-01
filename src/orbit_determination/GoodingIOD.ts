import { Earth } from '../body/Earth';
import { J2000 } from '../coordinate/J2000';
import { ForceModel } from '../force/ForceModel';
import { Vector3D } from '../operations/Vector3D';
import { RungeKutta89Propagator } from '../propagator/RungeKutta89Propagator';
import { tau } from '../utils/constants';
import { ObservationOptical } from './../observation/ObservationOptical';
import { GibbsIOD } from './GibbsIOD';
import { LambertIOD } from './LambertIOD';

type SolveRangeProblemParams = {
  rho1init: number;
  rho3init: number;
  t13: number;
  t12: number;
  nrev: number;
  direction: boolean;
  lineOfSight1: Vector3D;
  lineOfSight2: Vector3D;
  lineOfSight3: Vector3D;
  maxIterations: number;
};

type ComputeDerivativesParams = {
  x: number;
  y: number;
  lineOfSight1: Vector3D;
  lineOfSight3: Vector3D;
  pin: Vector3D;
  ein: Vector3D;
  t13: number;
  t12: number;
  nrev: number;
  direction: boolean;
  fd: Float64Array;
  gd: Float64Array;
};

type GetPositionOnLoS2Params = {
  e1: Vector3D;
  r01: number;
  e3: Vector3D;
  r03: number;
  t13: number;
  t12: number;
  nRev: number;
  posigrade: boolean;
};

export class GoodingIOD {
  private readonly _mu: number;
  private readonly _o1: ObservationOptical;
  private readonly _o2: ObservationOptical;
  private readonly _o3: ObservationOptical;
  private _vObserverPosition1: Vector3D = Vector3D.origin;
  private _vObserverPosition2: Vector3D = Vector3D.origin;
  private _vObserverPosition3: Vector3D = Vector3D.origin;
  private _r = 0.0;
  private _v = 0.0;
  private _t = 0.0;
  private _r1 = 0.0;
  private _r2 = 0.0;
  private _r3 = 0.0;
  private _rho1 = 0.0;
  private _rho2 = 0.0;
  private _rho3 = 0.0;
  private _d1 = 0.0;
  private _d3 = 0.0;
  private _facFiniteDiff = 0.0;
  private readonly _forceModel: ForceModel = new ForceModel().setGravity(1.0);

  constructor(o1: ObservationOptical, o2: ObservationOptical, o3: ObservationOptical, mu: number = Earth.mu) {
    this._mu = mu;
    this._o1 = o1;
    this._o2 = o2;
    this._o3 = o3;
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
  }: GetPositionOnLoS2Params): Vector3D | null {
    const p1 = this._vObserverPosition1.add(e1.scale(r01));

    this._r1 = p1.magnitude();

    const p3 = this._vObserverPosition3.add(e3.scale(r03));

    this._r3 = p3.magnitude();

    const p13 = p1.cross(p3);

    let th = Math.atan2(p13.magnitude(), p1.dot(p3));

    if (!posigrade) {
      th = tau - th;
    }

    const v1 = new Float64Array(2);
    const exitflag = LambertIOD.solve(this._r1, this._r3, th, t13, nRev, v1);

    if (exitflag) {
      const pn = p1.cross(p3);
      const pt = pn.cross(p1);

      let rt = pt.magnitude();

      if (!posigrade) {
        rt = -rt;
      }

      const vel1 = p1.scale(v1[0] / this._r1).add(pt.scale(v1[1] / rt));

      const p2 = new RungeKutta89Propagator(new J2000(this._o1.epoch, p1, vel1), this._forceModel).propagate(
        this._o1.epoch.roll(t12),
      ).position;

      return p2;
    }

    return null;
  }

  private _modifyIterate(lineOfSight1: Vector3D, lineOfSight3: Vector3D): void {
    const r13 = this._vObserverPosition3.subtract(this._vObserverPosition1);

    this._d1 = r13.dot(lineOfSight1);
    this._d3 = r13.dot(lineOfSight3);
    const d2 = lineOfSight1.dot(lineOfSight3);
    const d4 = 1.0 - d2 * d2;

    this._rho1 = Math.max((this._d1 - this._d3 * d2) / d4, 0.0);
    this._rho3 = Math.max((this._d1 * d2 - this._d3) / d4, 0.0);
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

    const dx = this._facFiniteDiff * x;
    const dy = this._facFiniteDiff * y;

    const cm1 = this._getPositionOnLoS2({
      e1: lineOfSight1,
      r01: x - dx,
      e3: lineOfSight3,
      r03: y,
      t13,
      t12,
      nRev: nrev,
      posigrade: direction,
    })!.subtract(this._vObserverPosition2);

    const fm1 = p.dot(cm1);
    const gm1 = en.dot(cm1);

    const cp1 = this._getPositionOnLoS2({
      e1: lineOfSight1,
      r01: x + dx,
      e3: lineOfSight3,
      r03: y,
      t13,
      t12,
      nRev: nrev,
      posigrade: direction,
    })!.subtract(this._vObserverPosition2);

    const fp1 = p.dot(cp1);
    const gp1 = en.dot(cp1);

    const fx = (fp1 - fm1) / (2.0 * dx);
    const gx = (gp1 - gm1) / (2.0 * dx);

    const cm3 = this._getPositionOnLoS2({
      e1: lineOfSight1,
      r01: x,
      e3: lineOfSight3,
      r03: y - dy,
      t13,
      t12,
      nRev: nrev,
      posigrade: direction,
    })!.subtract(this._vObserverPosition2);

    const fm3 = p.dot(cm3);
    const gm3 = en.dot(cm3);

    const cp3 = this._getPositionOnLoS2({
      e1: lineOfSight1,
      r01: x,
      e3: lineOfSight3,
      r03: y + dy,
      t13,
      t12,
      nRev: nrev,
      posigrade: direction,
    })!.subtract(this._vObserverPosition2);

    const fp3 = p.dot(cp3);
    const gp3 = en.dot(cp3);

    const fy = (fp3 - fm3) / (2.0 * dy);
    const gy = (gp3 - gm3) / (2.0 * dy);

    fd[0] = fx;
    fd[1] = fy;
    gd[0] = gx;
    gd[1] = gy;
  }

  solve(r1Init: number, r3Init: number, nRev = 0, direction = true): J2000 {
    const lineOfSight1 = this._o1.observation.lineOfSight();
    const lineOfSight2 = this._o2.observation.lineOfSight();
    const lineOfSight3 = this._o3.observation.lineOfSight();

    this._r = Math.max(r1Init, r3Init);
    this._v = Math.sqrt(this._mu / this._r);
    this._t = this._r / this._v;

    this._vObserverPosition1 = this._o1.site.position.scale(1.0 / this._r);
    this._vObserverPosition2 = this._o2.site.position.scale(1.0 / this._r);
    this._vObserverPosition3 = this._o3.site.position.scale(1.0 / this._r);

    const maxiter = 100;

    this._solveRangeProblem({
      rho1init: r1Init / this._r,
      rho3init: r3Init / this._r,
      t13: this._o3.epoch.difference(this._o1.epoch) / this._t,
      t12: this._o2.epoch.difference(this._o1.epoch) / this._t,
      nrev: nRev,
      direction,
      lineOfSight1,
      lineOfSight2,
      lineOfSight3,
      maxIterations: maxiter,
    });
    const gibbs = new GibbsIOD(this._mu);
    const p1 = this._vObserverPosition1.add(lineOfSight1.scale(this._rho1)).scale(this._r);
    const p2 = this._vObserverPosition2.add(lineOfSight2.scale(this._rho2)).scale(this._r);
    const p3 = this._vObserverPosition3.add(lineOfSight3.scale(this._rho3)).scale(this._r);

    return gibbs.solve(p1, p2, p3, this._o2.epoch, this._o3.epoch);
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

    this._rho1 = rho1init;
    this._rho3 = rho3init;

    let iter = 0;
    let stoppingCriterion = 10.0 * cvtol;

    while (iter < maxIterations && Math.abs(stoppingCriterion) > cvtol) {
      this._facFiniteDiff = arbf;

      const p2 = this._getPositionOnLoS2({
        e1: lineOfSight1,
        r01: this._rho1,
        e3: lineOfSight3,
        r03: this._rho3,
        t13,
        t12,
        nRev: nrev,
        posigrade: direction,
      });

      if (p2 === null) {
        this._modifyIterate(lineOfSight1, lineOfSight3);
      } else {
        this._r2 = p2.magnitude();
        const c = p2.subtract(this._vObserverPosition2);

        this._rho2 = c.magnitude();
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
          x: this._rho1,
          y: this._rho3,
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

        this._d3 = (-gr3 * fc) / detj;
        this._d1 = (gr1 * fc) / detj;

        this._rho1 += this._d3;
        this._rho3 += this._d1;

        const den = Math.max(cr, this._r2);

        stoppingCriterion = fc / den;
      }

      ++iter;
    }
  }
}
