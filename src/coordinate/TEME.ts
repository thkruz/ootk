/* eslint-disable class-methods-use-this */
import { Earth } from '../body/Earth';
import { ClassicalElements } from './ClassicalElements';
import { J2000 } from './J2000';
import { StateVector } from './StateVector';

// / True Equator Mean Equinox _(TEME)_ state vector
export class TEME extends StateVector {
  // / Create a new [TEME] object from a [ClassicalElements] object.
  static fromClassicalElements(elements: ClassicalElements): TEME {
    const rv = elements.toPositionVelocity();

    return new TEME(elements.epoch, rv.position, rv.velocity);
  }

  get name(): string {
    return 'TEME';
  }

  get inertial(): boolean {
    return true;
  }

  // / Convert this to a [J2000] state vector object.
  toJ2000(): J2000 {
    const p = Earth.precession(this.epoch);
    const n = Earth.nutation(this.epoch);
    const eps = n.mEps + n.dEps;
    const dPsiCosEps = n.dPsi * Math.cos(eps);
    const rMOD = this.position.rotZ(-dPsiCosEps).rotX(eps).rotZ(n.dPsi).rotX(-n.mEps);
    const vMOD = this.velocity.rotZ(-dPsiCosEps).rotX(eps).rotZ(n.dPsi).rotX(-n.mEps);
    const rJ2K = rMOD.rotZ(p.zed).rotY(-p.theta).rotZ(p.zeta);
    const vJ2K = vMOD.rotZ(p.zed).rotY(-p.theta).rotZ(p.zeta);

    return new J2000(this.epoch, rJ2K, vJ2K);
  }
}
