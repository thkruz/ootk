import { Earth, J2000, Vector, Vector3D } from 'ootk-core';
import { AtmosphericDrag } from './AtmosphericDrag';
import { EarthGravity } from './EarthGravity';
import { Force } from './Force';
import { Gravity } from './Gravity';
import { SolarRadiationPressure } from './SolarRadiationPressure';
import { ThirdBodyGravity } from './ThirdBodyGravity';
import { Thrust } from './Thrust';

// / Force model for spacecraft propagation.

export class ForceModel {
  private _centralGravity?: Force;
  private _thirdBodyGravity?: Force;
  private _solarRadiationPressure?: Force;
  private _atmosphericDrag?: Force;
  private _maneuverThrust?: Force;

  setGravity(mu: number = Earth.mu): this {
    this._centralGravity = new Gravity(mu);

    return this;
  }

  setEarthGravity(degree: number, order: number): void {
    this._centralGravity = new EarthGravity(degree, order);
  }

  setThirdBodyGravity({ moon = false, sun = false }): void {
    this._thirdBodyGravity = new ThirdBodyGravity(moon, sun);
  }

  setSolarRadiationPressure(mass: number, area: number, coeff = 1.2): void {
    this._solarRadiationPressure = new SolarRadiationPressure(mass, area, coeff);
  }

  setAtmosphericDrag(mass: number, area: number, coeff = 2.2, cosine = 4): void {
    this._atmosphericDrag = new AtmosphericDrag(mass, area, coeff, cosine);
  }

  loadManeuver(maneuver: Thrust): void {
    this._maneuverThrust = maneuver;
  }

  clearManeuver(): void {
    this._maneuverThrust = null;
  }

  acceleration(state: J2000): Vector3D {
    let accVec = Vector3D.origin;

    if (this._centralGravity) {
      accVec = accVec.add(this._centralGravity.acceleration(state));
    }
    if (this._thirdBodyGravity) {
      accVec = accVec.add(this._thirdBodyGravity.acceleration(state));
    }
    if (this._solarRadiationPressure) {
      accVec = accVec.add(this._solarRadiationPressure.acceleration(state));
    }
    if (this._atmosphericDrag) {
      accVec = accVec.add(this._atmosphericDrag.acceleration(state));
    }
    if (this._maneuverThrust) {
      accVec = accVec.add(this._maneuverThrust.acceleration(state));
    }

    return accVec;
  }

  derivative(state: J2000): Vector {
    return state.velocity.join(this.acceleration(state));
  }
}
