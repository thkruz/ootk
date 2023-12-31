/* eslint-disable class-methods-use-this */
import { Earth } from '../body/Earth';
import { ClassicalElements } from './ClassicalElements';
import { ITRF } from './ITRF';
import { StateVector } from './StateVector';
import { TEME } from './TEME';

export class J2000 extends StateVector {
  /**
   * Creates a J2000 instance from classical elements.
   */
  static fromClassicalElements(elements: ClassicalElements): J2000 {
    const rv = elements.toPositionVelocity();

    return new J2000(elements.epoch, rv.position, rv.velocity);
  }

  /**
   * Gets the name of the coordinate system.
   */
  get name(): string {
    return 'J2000';
  }

  /**
   * Gets a value indicating whether the coordinate system is inertial.
   */
  get inertial(): boolean {
    return true;
  }

  /**
   * Converts the coordinates from J2000 to the International Terrestrial Reference Frame (ITRF).
   *
   * This is an ECI to ECF transformation.
   */
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
