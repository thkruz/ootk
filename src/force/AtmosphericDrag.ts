import { DataHandler, DEG2RAD, Earth, ITRF, J2000, Sun, Vector3D } from 'ootk-core';
import { Force } from './Force';

/**
 * Harris-Priester atmospheric drag force model.
 * Atmospheric density model assumes mean solar flux.
 */
export class AtmosphericDrag implements Force {
  mass: number;
  area: number;
  dragCoeff: number;
  cosine: number;

  constructor(mass: number, area: number, dragCoeff: number, cosine: number) {
    this.mass = mass;
    this.area = area;
    this.dragCoeff = dragCoeff;
    this.cosine = cosine;
  }

  private static _getHPDensity(state: ITRF, n: number): number {
    const hpa = DataHandler.getInstance().getHpAtmosphere(state.getHeight());

    if (hpa === null) {
      return 0.0;
    }
    const sunPos = Sun.positionApparent(state.epoch);
    const sunVec = new J2000(state.epoch, sunPos, Vector3D.origin).toITRF().position.normalize();
    const bulVec = sunVec.rotZ(-30.0 * DEG2RAD);
    const cosPsi = bulVec.normalize().dot(state.position.normalize());
    const c2Psi2 = 0.5 * (1.0 + cosPsi);
    const cPsi2 = Math.sqrt(c2Psi2);
    const cosPow = cPsi2 > 1e-12 ? c2Psi2 * cPsi2 ** (n - 2) : 0.0;
    const altitude = hpa.height;
    const [h0, min0, max0] = hpa.hp0;
    const [h1, min1, max1] = hpa.hp1;
    const dH = (h0 - altitude) / (h0 - h1);
    const rhoMin = min0 * (min1 / min0) ** dH;

    if (cosPow === 0) {
      return rhoMin;
    }
    const rhoMax = max0 * (max1 / max0) ** dH;

    return rhoMin + (rhoMax - rhoMin) * cosPow;
  }

  acceleration(state: J2000): Vector3D {
    const itrfState = state.toITRF();
    const density = AtmosphericDrag._getHPDensity(itrfState, this.cosine);

    if (density === 0) {
      return Vector3D.origin;
    }
    const rotation = new ITRF(state.epoch, Earth.rotation, Vector3D.origin).toJ2000().position;
    const vRel = state.velocity.subtract(rotation.cross(state.position)).scale(1000.0);
    const vm = vRel.magnitude();
    const fScale = -0.5 * density * ((this.dragCoeff * this.area) / this.mass) * vm;

    return vRel.scale(fScale / 1000.0);
  }
}
