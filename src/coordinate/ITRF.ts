/* eslint-disable class-methods-use-this */
import { Earth } from '../body/Earth';
import { Geodetic } from './Geodetic';
import { J2000 } from './J2000';
import { StateVector } from './StateVector';

// / International Terrestrial Reference Frame _(ITRF)_
export class ITRF extends StateVector {
  get name(): string {
    return 'ITRF';
  }

  get inertial(): boolean {
    return false;
  }

  getHeight(): number {
    const a = Earth.radiusEquator;
    const e2 = Earth.eccentricitySquared;
    const r = this.position.magnitude();
    const sl = this.position.z / r;
    const cl2 = 1 - sl * sl;
    const coeff = Math.sqrt((1 - e2) / (1 - e2 * cl2));

    return r - a * coeff;
  }

  toJ2000(): J2000 {
    const p = Earth.precession(this.epoch);
    const n = Earth.nutation(this.epoch);
    const ast = this.epoch.gmstAngle() + n.eqEq;
    const rTOD = this.position.rotZ(-ast);
    const vTOD = this.velocity.add(Earth.rotation.cross(this.position)).rotZ(-ast);
    const rMOD = rTOD.rotX(n.eps).rotZ(n.dPsi).rotX(-n.mEps);
    const vMOD = vTOD.rotX(n.eps).rotZ(n.dPsi).rotX(-n.mEps);
    const rJ2000 = rMOD.rotZ(p.zed).rotY(-p.theta).rotZ(p.zeta);
    const vJ2000 = vMOD.rotZ(p.zed).rotY(-p.theta).rotZ(p.zeta);

    return new J2000(this.epoch, rJ2000, vJ2000);
  }

  toGeodetic(): Geodetic {
    const sma = Earth.radiusEquator;
    const esq = Earth.eccentricitySquared;
    const x = this.position.x;
    const y = this.position.y;
    const z = this.position.z;
    const lon = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const phi = Math.atan(z / r);
    let lat = phi;
    let c = 0.0;

    for (let i = 0; i < 12; i++) {
      const slat = Math.sin(lat);

      c = 1 / Math.sqrt(1 - esq * slat * slat);
      lat = Math.atan((z + sma * c * esq * slat) / r);
    }
    const alt = r / Math.cos(lat) - sma * c;

    return new Geodetic(lat, lon, alt);
  }
}
