/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
import { TLE } from '@src/coordinate/TLE';
import { J2000 } from '../coordinate/J2000';
import { Thrust } from '../force/Thrust';
import { VerletBlendInterpolator } from '../interpolator/VerletBlendInterpolator';
import { EpochUTC } from '../time/EpochUTC';
import { Propagator } from './Propagator';

// / SGP4 propagator.
export class Sgp4Propagator extends Propagator {
  // / Create a new [Sgp4Propagator] object from a [TLE].
  constructor(private tle: TLE) {
    super();
    this._cacheState = tle.state.toJ2000();
  }

  private _cacheState: J2000;
  private _checkpoints: J2000[] = [];

  get state(): J2000 {
    return this._cacheState;
  }

  ephemerisManeuver(start: EpochUTC, finish: EpochUTC, maneuvers: Thrust[], interval = 60.0): VerletBlendInterpolator {
    throw new Error('Maneuvers cannot be modelled with SGP4.');
  }

  maneuver(maneuver: Thrust, interval = 60.0): J2000[] {
    throw new Error('Maneuvers cannot be modelled with SGP4.');
  }

  propagate(epoch: EpochUTC): J2000 {
    this._cacheState = this.tle.propagate(epoch).toJ2000();

    return this._cacheState;
  }

  reset(): void {
    this._cacheState = this.tle.state.toJ2000();
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
