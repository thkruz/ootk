import { EpochUTC, J2000, RIC, Vector3D } from 'ootk-core';
import { Force } from './Force';

// / Thrust force model.
export class Thrust implements Force {
  constructor(
    public center: EpochUTC,
    public radial: number,
    public intrack: number,
    public crosstrack: number,
    public durationRate: number = 0.0,
  ) {
    this.deltaV = new Vector3D(radial * 1e-3, intrack * 1e-3, crosstrack * 1e-3);
  }

  deltaV: Vector3D;

  get magnitude(): number {
    return this.deltaV.magnitude() * 1000.0;
  }

  get duration(): number {
    return this.magnitude * this.durationRate;
  }

  get start(): EpochUTC {
    return this.center.roll(-0.5 * this.duration);
  }

  get stop(): EpochUTC {
    return this.center.roll(0.5 * this.duration);
  }

  acceleration(state: J2000): Vector3D {
    const relative = new RIC(Vector3D.origin, this.deltaV.scale(1.0 / this.duration));

    return relative.toJ2000(state).velocity.subtract(state.velocity);
  }

  apply(state: J2000): J2000 {
    const relative = new RIC(Vector3D.origin, this.deltaV);

    return relative.toJ2000(state);
  }

  get isImpulsive(): boolean {
    return this.duration <= 0;
  }
}
