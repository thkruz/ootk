import { J2000 } from '../coordinate/J2000';

// / Runge-Kutta adaptive state checkpoint.
export class RkCheckpoint {
  constructor(public cacheState: J2000, public stepSize: number) {
    // Nothing to do here.
  }
}
