/* eslint-disable class-methods-use-this */
import { Earth } from '../body/Earth';
import { ClassicalElements } from './ClassicalElements';
import { ITRF } from './ITRF';
import { StateVector } from './StateVector';
import { TEME } from './TEME';

export class J2000 extends StateVector {
  static fromClassicalElements(elements: ClassicalElements): J2000 {
    const rv = elements.toPositionVelocity();

    return new J2000(elements.epoch, rv.position, rv.velocity);
  }

  get name(): string {
    return 'J2000';
  }

  get inertial(): boolean {
    return true;
  }

  toITRF(): ITRF {
    const p = Earth.precession(this.epoch);
    const n = Earth.nutation(this.epoch);
    const ast = this.epoch.gmstAngle() + n.eqEq;
    const rMOD = this.position.rotZ(-p.zeta).rotY(p.theta).rotZ(-p.zed);
    const vMOD = this.velocity.rotZ(-p.zeta).rotY(p.theta).rotZ(-p.zed);
    const rTOD = rMOD.rotX(n.mEps).rotZ(-n.dPsi).rotX(-n.eps);
    const vTOD = vMOD.rotX(n.mEps).rotZ(-n.dPsi).rotX(-n.eps);
    const rPEF = rTOD.rotZ(ast);
    const vPEF = vTOD.rotZ(ast).add(Earth.rotation.negate().cross(rPEF));

    return new ITRF(this.epoch, rPEF, vPEF);
  }

  toTEME(): TEME {
    const p = Earth.precession(this.epoch);
    const n = Earth.nutation(this.epoch);
    const eps = n.mEps + n.dEps;
    const dPsiCosEps = n.dPsi * Math.cos(eps);
    const rMOD = this.position.rotZ(-p.zeta).rotY(p.theta).rotZ(-p.zed);
    const vMOD = this.velocity.rotZ(-p.zeta).rotY(p.theta).rotZ(-p.zed);
    const rTEME = rMOD.rotX(n.mEps).rotZ(-n.dPsi).rotX(-eps).rotZ(dPsiCosEps);
    const vTEME = vMOD.rotX(n.mEps).rotZ(-n.dPsi).rotX(-eps).rotZ(dPsiCosEps);

    return new TEME(this.epoch, rTEME, vTEME);
  }
}
