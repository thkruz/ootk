import { EpochUTC, J2000, Vector } from 'ootk-core';
import { ForceModel } from '../force/ForceModel';
import { Thrust } from '../force/Thrust';
import { VerletBlendInterpolator } from '../interpolator/VerletBlendInterpolator';
import { Propagator } from './Propagator';

// / Runge-Kutta 4 fixed numerical propagator.
export class RungeKutta4Propagator extends Propagator {
  /**
   * Create a new [RungeKutta4Propagator] object from an initial state vector and
   * along with an optional [ForceModel] and [stepSize] in seconds.
   */
  constructor(
    private _initState: J2000,
    private _forceModel: ForceModel = new ForceModel().setGravity(),
    private _stepSize: number = 15.0,
    private _cacheState: J2000 = _initState,
    private _checkpoints: J2000[] = [],
  ) {
    super();
    this._stepSize = Math.abs(_stepSize);
  }

  // / Set the integrator step size to the provided number of [seconds].
  setStepSize(seconds: number): void {
    this._stepSize = Math.abs(seconds);
  }

  // / Set numerical integration force model.
  setForceModel(forceModel: ForceModel): void {
    this._forceModel = forceModel;
  }

  ephemerisManeuver(start: EpochUTC, finish: EpochUTC, maneuvers: Thrust[], interval = 60.0): VerletBlendInterpolator {
    const tMvr = maneuvers.slice(0).filter((mvr) => mvr.start >= start || mvr.stop <= finish);
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

  private _kFn(state: J2000, hArg: number, kArg: Vector): Vector {
    const epoch = state.epoch.roll(hArg);
    const posvel = state.position.join(state.velocity);
    const result = posvel.add(kArg);
    const sample = new J2000(epoch, result.toVector3D(0), result.toVector3D(3));

    return this._forceModel.derivative(sample);
  }

  private _integrate(state: J2000, step: number): J2000 {
    const k1 = this._kFn(state, 0, Vector.zero(6)).scale(step);
    const k2 = this._kFn(state, 0.5 * step, k1.scale(0.5)).scale(step);
    const k3 = this._kFn(state, 0.5 * step, k2.scale(0.5)).scale(step);
    const k4 = this._kFn(state, step, k3).scale(step);
    const v1 = k1;
    const v2 = v1.add(k2.scale(2));
    const v3 = v2.add(k3.scale(2));
    const v4 = v3.add(k4);
    const tNext = state.epoch.roll(step);
    const posvel = state.position.join(state.velocity);
    const result = posvel.add(v4.scale(1 / 6));

    return new J2000(tNext, result.toVector3D(0), result.toVector3D(3));
  }

  propagate(epoch: EpochUTC): J2000 {
    let delta = epoch.difference(this._cacheState.epoch);

    while (delta !== 0) {
      const direction = delta >= 0 ? 1 : -1;
      const dt = Math.min(Math.abs(delta), this._stepSize) * direction;

      this._cacheState = this._integrate(this._cacheState, dt);
      delta = epoch.difference(this._cacheState.epoch);
    }

    return this._cacheState;
  }

  reset(): void {
    this._cacheState = this._initState;
  }

  get state(): J2000 {
    return this._cacheState;
  }

  checkpoint(): number {
    this._checkpoints.push(this._cacheState);

    return this._checkpoints.length - 1;
  }

  clearCheckpoints(): void {
    this._checkpoints = [];
  }

  restore(index: number): void {
    this._cacheState = this._checkpoints[index];
  }
}
