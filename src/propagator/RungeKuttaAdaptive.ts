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
import { Thrust } from '../force/Thrust.js';
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Seconds, Vector, Vector3D } from '../main.js';
import { VerletBlendInterpolator } from './../interpolator/VerletBlendInterpolator.js';
import { Propagator } from './Propagator.js';
import { RkCheckpoint } from './RkCheckpoint.js';
import { RkResult } from './RkResult.js';

// / Adaptive Runge-Kutta propagator base class.
export abstract class RungeKuttaAdaptive extends Propagator {
  /**
   * Create a new [RungeKuttaAdaptive] object from an initial state vector
   * along with an optional [ForceModel] and [tolerance].
   * @param initState_ Initial state vector.
   * @param forceModel_ Numerical integration force model.
   * @param tolerance_ Minimum allowable local error tolerance.
   */
  constructor(
    private initState_: J2000,
    private forceModel_: ForceModel = new ForceModel().setGravity(),
    private tolerance_: number = 1e-9,
  ) {
    super();
    this._cacheState = this.initState_;
    this.tolerance_ = Math.max(RungeKuttaAdaptive._minTolerance, Math.abs(tolerance_));
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
    this._cacheState = this.initState_;
    this._stepSize = 60.0;
  }

  // / Set numerical integration force model.
  setForceModel(forceModel: ForceModel): void {
    this.forceModel_ = forceModel;
  }

  private kfn_(
    epoch: EpochUTC,
    rv: Vector<Kilometers|KilometersPerSecond>,
    hArg: Seconds,
    kArg: Vector<Kilometers>,
    step: Seconds,
  ): Vector {
    const t = epoch.roll(hArg * step as Seconds);
    const rvNew = rv.add(kArg);
    const sample = new J2000(
      t,
      rvNew.toVector3D(0) as Vector3D<Kilometers>,
      rvNew.toVector3D(3) as Vector3D<KilometersPerSecond>,
    );

    return this.forceModel_.derivative(sample).scale(step);
  }

  private integrate_(state: J2000, step: Seconds): RkResult {
    const k: Vector[] = new Array(this.a.length).fill(Vector.origin3);
    const y = state.position.join(state.velocity) as Vector<Kilometers>;

    for (let i = 0; i < this.a.length; i++) {
      let kArg = Vector.origin6 as Vector<Kilometers>;

      if (i !== 0) {
        for (let j = 0; j < i; j++) {
          kArg = kArg.add(k[j].scale(this.b[i][j])) as Vector<Kilometers>;
        }
      }
      k[i] = this.kfn_(state.epoch, y, this.a[i] as Seconds, kArg, step);
    }
    let y1 = y;
    let y2 = y;

    for (let i = 0; i < k.length; i++) {
      y1 = y1.add(k[i].scale(this.ch[i])) as Vector<Kilometers>;
      y2 = y2.add(k[i].scale(this.c[i])) as Vector<Kilometers>;
    }
    const teVal = y1.distance(y2);
    let hNew = 0.9 * step * (this.tolerance_ / teVal) ** (1.0 / this.order);
    const hOld = Math.abs(step);

    hNew = Math.max(0.2 * hOld, Math.min(5.0 * hOld, hNew));
    hNew = Math.max(1e-5, Math.min(1000.0, hNew));

    return new RkResult(
      new J2000(
        state.epoch.roll(step),
        y1.toVector3D(0) as Vector3D<Kilometers>,
        y1.toVector3D(3) as Vector3D<KilometersPerSecond>,
      ),
      teVal,
      hNew,
    );
  }

  propagate(epoch: EpochUTC): J2000 {
    let delta = epoch.difference(this._cacheState.epoch);

    while (delta !== 0) {
      const direction = delta >= 0 ? 1 : -1;
      const dt = Math.min(Math.abs(delta), this._stepSize) * direction as Seconds;
      const result = this.integrate_(this._cacheState, dt);

      this._stepSize = result.newStep;
      if (result.error > this.tolerance_) {
        continue;
      }
      this._cacheState = result.state;
      delta = epoch.difference(this._cacheState.epoch);
    }

    return this._cacheState;
  }

  maneuver(maneuver: Thrust, interval = 60.0 as Seconds): J2000[] {
    if (maneuver.isImpulsive) {
      this._cacheState = maneuver.apply(this.propagate(maneuver.center));

      return [this._cacheState];
    }
    let tState = this.propagate(maneuver.start);

    this.forceModel_.loadManeuver(maneuver);
    const ephemeris: J2000[] = [tState];

    while (tState.epoch < maneuver.stop) {
      const step = Math.min(maneuver.stop.difference(tState.epoch), interval) as Seconds;

      tState = this.propagate(tState.epoch.roll(step));
      ephemeris.push(tState);
    }
    this.forceModel_.clearManeuver();

    return ephemeris;
  }

  ephemerisManeuver(
    start: EpochUTC,
    finish: EpochUTC,
    maneuvers: Thrust[],
    interval = 60.0 as Seconds,
  ): VerletBlendInterpolator {
    const tMvr = maneuvers.filter((mvr) => mvr.start >= start || mvr.stop <= finish);
    const ephemeris: J2000[] = [];

    if (tMvr[0].start > start) {
      ephemeris.push(this.propagate(start));
    }
    for (const mvr of tMvr) {
      while (this._cacheState.epoch < mvr.start) {
        const step = Math.min(mvr.start.difference(this._cacheState.epoch), interval) as Seconds;

        this.propagate(this._cacheState.epoch.roll(step));
        if (this._cacheState.epoch.posix !== mvr.start.posix) {
          ephemeris.push(this._cacheState);
        }
      }
      ephemeris.push(...this.maneuver(mvr, interval));
    }
    while (this._cacheState.epoch.posix < finish.posix) {
      const step = Math.min(finish.difference(this._cacheState.epoch), interval) as Seconds;

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
