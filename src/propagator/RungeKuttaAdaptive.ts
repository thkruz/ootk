import { EpochUTC, J2000, Vector } from 'ootk-core';
import { ForceModel } from '../force/ForceModel';
import { Thrust } from '../force/Thrust';
import { VerletBlendInterpolator } from './../interpolator/VerletBlendInterpolator';
import { Propagator } from './Propagator';
import { RkCheckpoint } from './RkCheckpoint';
import { RkResult } from './RkResult';

// / Adaptive Runge-Kutta propagator base class.
export abstract class RungeKuttaAdaptive extends Propagator {
  /**
   * Create a new [RungeKuttaAdaptive] object from an initial state vector
   * along with an optional [ForceModel] and [tolerance].
   */
  constructor(
    private _initState: J2000,
    private _forceModel: ForceModel = new ForceModel().setGravity(),
    private _tolerance: number = 1e-9,
  ) {
    super();
    this._cacheState = this._initState;
    this._tolerance = Math.max(RungeKuttaAdaptive._minTolerance, Math.abs(_tolerance));
  }

  // / Initial state vector.
  private _cacheState: J2000;

  private readonly _checkpoints: RkCheckpoint[] = [];

  // / Integration step size _(seconds)_.
  private _stepSize = 60.0;

  // / Minimum allowable local error tolerance.
  private static readonly _minTolerance: number = 1e-15;

  // / Butcher tableau `A` values.
  protected abstract get a(): Float64Array;

  // / Butcher tableau `B` values.
  protected abstract get b(): Float64Array[];

  // / Butcher tableau `CH` values.
  protected abstract get ch(): Float64Array;

  // / Butcher tableau `C` values
  protected abstract get c(): Float64Array;

  // / Integrator order.
  protected abstract get order(): number;

  get state(): J2000 {
    return this._cacheState;
  }

  reset(): void {
    this._cacheState = this._initState;
    this._stepSize = 60.0;
  }

  // / Set numerical integration force model.
  setForceModel(forceModel: ForceModel): void {
    this._forceModel = forceModel;
  }

  private _kfn(epoch: EpochUTC, rv: Vector, hArg: number, kArg: Vector, step: number): Vector {
    const t = epoch.roll(hArg * step);
    const rvNew = rv.add(kArg);
    const sample = new J2000(t, rvNew.toVector3D(0), rvNew.toVector3D(3));

    return this._forceModel.derivative(sample).scale(step);
  }

  private _integrate(state: J2000, step: number): RkResult {
    const k: Vector[] = new Array(this.a.length).fill(Vector.origin3);
    const y = state.position.join(state.velocity);

    for (let i = 0; i < this.a.length; i++) {
      let kArg = Vector.origin6 as Vector<number>;

      if (i !== 0) {
        for (let j = 0; j < i; j++) {
          kArg = kArg.add(k[j].scale(this.b[i][j]));
        }
      }
      k[i] = this._kfn(state.epoch, y, this.a[i], kArg, step);
    }
    let y1 = y;
    let y2 = y;

    for (let i = 0; i < k.length; i++) {
      y1 = y1.add(k[i].scale(this.ch[i]));
      y2 = y2.add(k[i].scale(this.c[i]));
    }
    const teVal = y1.distance(y2);
    let hNew = 0.9 * step * (this._tolerance / teVal) ** (1.0 / this.order);
    const hOld = Math.abs(step);

    hNew = Math.max(0.2 * hOld, Math.min(5.0 * hOld, hNew));
    hNew = Math.max(1e-5, Math.min(1000.0, hNew));

    return new RkResult(new J2000(state.epoch.roll(step), y1.toVector3D(0), y1.toVector3D(3)), teVal, hNew);
  }

  propagate(epoch: EpochUTC): J2000 {
    let delta = epoch.difference(this._cacheState.epoch);

    while (delta !== 0) {
      const direction = delta >= 0 ? 1 : -1;
      const dt = Math.min(Math.abs(delta), this._stepSize) * direction;
      const result = this._integrate(this._cacheState, dt);

      this._stepSize = result.newStep;
      if (result.error > this._tolerance) {
        continue;
      }
      this._cacheState = result.state;
      delta = epoch.difference(this._cacheState.epoch);
    }

    return this._cacheState;
  }

  maneuver(maneuver: Thrust, interval = 60.0): J2000[] {
    if (maneuver.isImpulsive) {
      this._cacheState = maneuver.apply(this.propagate(maneuver.center));

      return [this._cacheState];
    }
    let tState = this.propagate(maneuver.start);

    this._forceModel.loadManeuver(maneuver);
    const ephemeris: J2000[] = [tState];

    while (tState.epoch < maneuver.stop) {
      const step = Math.min(maneuver.stop.difference(tState.epoch), interval);

      tState = this.propagate(tState.epoch.roll(step));
      ephemeris.push(tState);
    }
    this._forceModel.clearManeuver();

    return ephemeris;
  }

  ephemerisManeuver(start: EpochUTC, finish: EpochUTC, maneuvers: Thrust[], interval = 60.0): VerletBlendInterpolator {
    const tMvr = maneuvers.filter((mvr) => mvr.start >= start || mvr.stop <= finish);
    const ephemeris: J2000[] = [];

    if (tMvr[0].start > start) {
      ephemeris.push(this.propagate(start));
    }
    for (const mvr of tMvr) {
      while (this._cacheState.epoch < mvr.start) {
        const step = Math.min(mvr.start.difference(this._cacheState.epoch), interval);

        this.propagate(this._cacheState.epoch.roll(step));
        if (this._cacheState.epoch.posix !== mvr.start.posix) {
          ephemeris.push(this._cacheState);
        }
      }
      ephemeris.push(...this.maneuver(mvr, interval));
    }
    while (this._cacheState.epoch.posix < finish.posix) {
      const step = Math.min(finish.difference(this._cacheState.epoch), interval);

      this.propagate(this._cacheState.epoch.roll(step));
      ephemeris.push(this._cacheState);
    }

    return new VerletBlendInterpolator(ephemeris);
  }

  checkpoint(): number {
    this._checkpoints.push(new RkCheckpoint(this._cacheState, this._stepSize));

    return this._checkpoints.length - 1;
  }

  clearCheckpoints(): void {
    this._checkpoints.length = 0;
  }

  restore(index: number): void {
    const checkpoint = this._checkpoints[index];

    this._cacheState = checkpoint.cacheState;
    this._stepSize = checkpoint.stepSize;
  }
}
