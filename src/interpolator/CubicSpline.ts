import { Vector3D } from 'ootk-core';

// / Container for cubic spline data.
export class CubicSpline {
  // / Create a new [CubicSpline] object.
  constructor(
    public t0: number,
    public p0: Vector3D,
    public m0: Vector3D,
    public t1: number,
    public p1: Vector3D,
    public m1: Vector3D,
  ) {
    // Nothing to do here.
  }

  // / Interpolate position at the provided time [t] _(POSIX seconds)_.
  private _position(t: number): Vector3D {
    const t2 = t * t;
    const t3 = t2 * t;
    const r0 = this.p0.scale(2 * t3 - 3 * t2 + 1);
    const v0 = this.m0.scale((t3 - 2 * t2 + t) * (this.t1 - this.t0));
    const r1 = this.p1.scale(-2 * t3 + 3 * t2);
    const v1 = this.m1.scale((t3 - t2) * (this.t1 - this.t0));

    return r0.add(v0).add(r1).add(v1);
  }

  // / Interpolate velocity at the provided time [t] _(POSIX seconds)_.
  private _velocity(t: number): Vector3D {
    const t2 = t * t;
    const r0 = this.p0.scale(6 * t2 - 6 * t);
    const v0 = this.m0.scale((3 * t2 - 4 * t + 1) * (this.t1 - this.t0));
    const r1 = this.p1.scale(-6 * t2 + 6 * t);
    const v1 = this.m1.scale((3 * t2 - 2 * t) * (this.t1 - this.t0));

    return r0
      .add(v0)
      .add(r1)
      .add(v1)
      .scale(1 / (this.t1 - this.t0));
  }

  /**
   * Interpolates the position and velocity at a given time.
   * (km) and velocity (km/s) vectors at the provided time.
   * @param t The time value to interpolate at _(POSIX seconds)_.
   * @returns An array containing the interpolated position and velocity as Vector3D objects.
   */
  interpolate(t: number): Vector3D[] {
    const n = (t - this.t0) / (this.t1 - this.t0);

    return [this._position(n), this._velocity(n)];
  }
}
