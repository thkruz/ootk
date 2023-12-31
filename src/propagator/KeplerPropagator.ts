import { ClassicalElements } from '../coordinate/ClassicalElements';
import { J2000 } from '../coordinate/J2000';
import { Thrust } from '../force/Thrust';
import { VerletBlendInterpolator } from '../interpolator/VerletBlendInterpolator';
import { EpochUTC } from '../time/EpochUTC';
import { Propagator } from './Propagator';

// / Kepler analytical two-body propagator.
export class KeplerPropagator extends Propagator {
  private _initElements: ClassicalElements;
  private _elements: ClassicalElements;
  private _cacheState: J2000;
  private _checkpoints: J2000[];

  constructor(initElements: ClassicalElements) {
    super();
    this._initElements = initElements;
    this._elements = initElements;
    this._cacheState = J2000.fromClassicalElements(initElements);
    this._checkpoints = [];
  }

  get state(): J2000 {
    return this._cacheState;
  }

  propagate(epoch: EpochUTC): J2000 {
    this._cacheState = J2000.fromClassicalElements(this._elements.propagate(epoch));

    return this._cacheState;
  }

  reset(): void {
    this._elements = this._initElements;
    this._cacheState = J2000.fromClassicalElements(this._elements);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  maneuver(maneuver: Thrust, interval = 60): J2000[] {
    this._cacheState = maneuver.apply(this.propagate(maneuver.center));
    this._elements = this._cacheState.toClassicalElements();

    return [this._cacheState];
  }

  ephemerisManeuver(start: EpochUTC, finish: EpochUTC, maneuvers: Thrust[], interval = 60.0): VerletBlendInterpolator {
    const tMvr = maneuvers.slice(0).filter((mvr) => mvr.center >= start || mvr.center <= finish);
    const ephemeris: J2000[] = [];

    if (tMvr[0].start > start) {
      ephemeris.push(this.propagate(start));
    }
    for (const mvr of tMvr) {
      while (this._cacheState.epoch < mvr.center) {
        const step = Math.min(mvr.center.difference(this._cacheState.epoch), interval);

        this.propagate(this._cacheState.epoch.roll(step));
        if (this._cacheState.epoch.posix !== mvr.center.posix) {
          ephemeris.push(this._cacheState);
        }
      }
      ephemeris.push(...this.maneuver(mvr, interval));
    }
    while (this._cacheState.epoch < finish) {
      const step = Math.min(finish.difference(this._cacheState.epoch), interval);

      this.propagate(this._cacheState.epoch.roll(step));
      ephemeris.push(this._cacheState);
    }

    return new VerletBlendInterpolator(ephemeris);
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
