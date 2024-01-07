import { astronomicalUnit, J2000, Sun, Vector3D } from 'ootk-core';
import { Force } from './Force';

// / Solar radiation pressure model.
export class SolarRadiationPressure extends Force {
  // / Create a new [SolarRadiationPressure] object.
  constructor(public mass: number, public area: number, public reflectCoeff: number) {
    super();
  }

  // / Solar pressure _(N/m²)_;
  private static readonly _kRef: number = 4.56e-6 * astronomicalUnit ** 2;

  acceleration(state: J2000): Vector3D {
    const rSun = Sun.positionApparent(state.epoch);
    const r = state.position.subtract(rSun);
    const rMag = r.magnitude();
    const r2 = rMag * rMag;
    const ratio = Sun.lightingRatio(state.position, rSun);
    const p = (ratio * SolarRadiationPressure._kRef) / r2;
    const flux = r.scale(p / rMag);

    return flux.scale(((this.area * this.reflectCoeff) / this.mass) * 1e-3);
  }
}
