import { J2000, Moon, Sun, Vector3D } from 'ootk-core';
import { Force } from './Force';

// / Third-body gravity model.
export class ThirdBodyGravity implements Force {
  // / Create a new [ThirdBodyGravity] object with the selected bodies enabled.
  constructor(public moon: boolean = false, public sun: boolean = false) {
    // Nothing to do here.
  }

  private static _moonGravity(state: J2000): Vector3D {
    const rMoon = Moon.position(state.epoch);
    const aNum = rMoon.subtract(state.position);
    const aDen = aNum.magnitude() ** 3;
    const bNum = rMoon;
    const bDen = rMoon.magnitude() ** 3;
    const gravity = aNum.scale(1 / aDen).add(bNum.scale(-1 / bDen));

    return gravity.scale(Moon.mu);
  }

  private static _sunGravity(state: J2000): Vector3D {
    const rSun = Sun.positionApparent(state.epoch);
    const aNum = rSun.subtract(state.position);
    const aDen = aNum.magnitude() ** 3;
    const bNum = rSun;
    const bDen = rSun.magnitude() ** 3;
    const gravity = aNum.scale(1 / aDen).add(bNum.scale(-1 / bDen));

    return gravity.scale(Sun.mu);
  }

  acceleration(state: J2000): Vector3D {
    let accVec = Vector3D.origin;

    if (this.moon) {
      accVec = accVec.add(ThirdBodyGravity._moonGravity(state));
    }
    if (this.sun) {
      accVec = accVec.add(ThirdBodyGravity._sunGravity(state));
    }

    return accVec;
  }
}
