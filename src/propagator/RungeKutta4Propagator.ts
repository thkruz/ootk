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
import { VerletBlendInterpolator } from '../interpolator/VerletBlendInterpolator.js';
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Seconds, Vector, Vector3D } from '../main.js';
import { Propagator } from './Propagator.js';

// / Runge-Kutta 4 fixed numerical propagator.
export class RungeKutta4Propagator extends Propagator {
  /**
   * Create a new [RungeKutta4Propagator] object from an initial state vector and
   * along with an optional [ForceModel] and [stepSize] in seconds.
   * @param initState_ Initial state vector.
   * @param forceModel_ Numerical integration force model.
   * @param stepSize_ Integration step size _(seconds)_.
   * @param cacheState_ Cached state vector.
   * @param checkpoints_ Cached state vector checkpoints.
   */
  constructor(
    private initState_: J2000,
    private forceModel_: ForceModel = new ForceModel().setGravity(),
    private stepSize_: number = 15.0,
    private cacheState_: J2000 = initState_,
    private checkpoints_: J2000[] = [],
  ) {
    super();
    this.stepSize_ = Math.abs(stepSize_);
  }

  // / Set the integrator step size to the provided number of [seconds].
  setStepSize(seconds: number): void {
    this.stepSize_ = Math.abs(seconds);
  }

  // / Set numerical integration force model.
  setForceModel(forceModel: ForceModel): void {
    this.forceModel_ = forceModel;
  }

  ephemerisManeuver(
    start: EpochUTC,
    finish: EpochUTC,
    maneuvers: Thrust[],
    interval = 60.0 as Seconds,
  ): VerletBlendInterpolator {
    const tMvr = maneuvers.slice(0).filter((mvr) => mvr.start >= start || mvr.stop <= finish);
    const ephemeris: J2000[] = [];

    if (tMvr[0].start > start) {
      ephemeris.push(this.propagate(start));
    }
    for (const mvr of tMvr) {
      while (this.cacheState_.epoch < mvr.start) {
        const step = Math.min(mvr.start.difference(this.cacheState_.epoch), interval) as Seconds;

        this.propagate(this.cacheState_.epoch.roll(step));
        if (this.cacheState_.epoch.posix !== mvr.start.posix) {
          ephemeris.push(this.cacheState_);
        }
      }
      ephemeris.push(...this.maneuver(mvr, interval));
    }
    while (this.cacheState_.epoch.posix < finish.posix) {
      const step = Math.min(finish.difference(this.cacheState_.epoch), interval) as Seconds;

      this.propagate(this.cacheState_.epoch.roll(step));
      ephemeris.push(this.cacheState_);
    }

    return new VerletBlendInterpolator(ephemeris);
  }

  maneuver(maneuver: Thrust, interval = 60.0): J2000[] {
    if (maneuver.isImpulsive) {
      this.cacheState_ = maneuver.apply(this.propagate(maneuver.center));

      return [this.cacheState_];
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

  private _kFn(state: J2000, hArg: Seconds, kArg: Vector): Vector {
    const epoch = state.epoch.roll(hArg);
    const posvel = state.position.join(state.velocity);
    const result = posvel.add(kArg);
    const sample = new J2000(
      epoch,
      result.toVector3D(0) as Vector3D<Kilometers>,
      result.toVector3D(3) as Vector3D<KilometersPerSecond>,
    );

    return this.forceModel_.derivative(sample);
  }

  private _integrate(state: J2000, step: Seconds): J2000 {
    const k1 = this._kFn(state, 0 as Seconds, Vector.zero(6)).scale(step);
    const k2 = this._kFn(state, 0.5 * step as Seconds, k1.scale(0.5)).scale(step);
    const k3 = this._kFn(state, 0.5 * step as Seconds, k2.scale(0.5)).scale(step);
    const k4 = this._kFn(state, step, k3).scale(step);
    const v1 = k1;
    const v2 = v1.add(k2.scale(2));
    const v3 = v2.add(k3.scale(2));
    const v4 = v3.add(k4);
    const tNext = state.epoch.roll(step);
    const posvel = state.position.join(state.velocity);
    const result = posvel.add(v4.scale(1 / 6));

    return new J2000(
      tNext,
      result.toVector3D(0) as Vector3D<Kilometers>,
      result.toVector3D(3) as Vector3D<KilometersPerSecond>,
    );
  }

  propagate(epoch: EpochUTC): J2000 {
    let delta = epoch.difference(this.cacheState_.epoch);

    while (delta !== 0) {
      const direction = delta >= 0 ? 1 : -1;
      const dt = Math.min(Math.abs(delta), this.stepSize_) * direction as Seconds;

      this.cacheState_ = this._integrate(this.cacheState_, dt);
      delta = epoch.difference(this.cacheState_.epoch);
    }

    return this.cacheState_;
  }

  reset(): void {
    this.cacheState_ = this.initState_;
  }

  get state(): J2000 {
    return this.cacheState_;
  }

  checkpoint(): number {
    this.checkpoints_.push(this.cacheState_);

    return this.checkpoints_.length - 1;
  }

  clearCheckpoints(): void {
    this.checkpoints_ = [];
  }

  restore(index: number): void {
    this.cacheState_ = this.checkpoints_[index];
  }
}
