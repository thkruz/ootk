/* eslint-disable class-methods-use-this */
// / Complex Earth gravity model, accounting for EGM-96 zonal, sectoral, and

import { Earth } from '../body/Earth';
import { ITRF } from '../coordinate/ITRF';
import { J2000 } from '../coordinate/J2000';
import { DataHandler } from '../data/DataHandler';
import { Vector3D } from '../operations/Vector3D';
import { Force } from './Force';

// / tesseral geopotential perturbations.
export class EarthGravity implements Force {
  degree: number;
  order: number;
  _asphericalFlag: boolean;

  constructor(degree: number, order: number) {
    this.degree = Math.min(Math.max(degree, 0), 36);
    this.order = Math.min(Math.max(order, 0), 36);
    this._asphericalFlag = degree >= 2;
  }

  _spherical(state: J2000): Vector3D {
    const rMag = state.position.magnitude();

    return state.position.scale(-Earth.mu / (rMag * rMag * rMag));
  }

  // eslint-disable-next-line max-statements
  _aspherical(state: J2000): Vector3D {
    const posEcef = state.toITRF().position;
    const ri = 1.0 / posEcef.magnitude();
    const xor = posEcef.x * ri;
    const yor = posEcef.y * ri;
    const zor = posEcef.z * ri;

    const ep = zor;
    const reor = Earth.radiusEquator * ri;
    let reorn = reor;
    const muor2 = Earth.mu * ri * ri;

    let sumH = 0.0;
    let sumGm = 0.0;
    let sumJ = 0.0;
    let sumK = 0.0;

    const cTil = new Float64Array(this.order + 4);
    const sTil = new Float64Array(this.order + 4);

    const pN = new Float64Array(this.order + 4);
    const pNm1 = new Float64Array(this.order + 4);
    const pNm2 = new Float64Array(this.order + 4);

    pNm2[0] = 1.0;
    pNm1[0] = ep;
    pNm1[1] = 1.0;
    cTil[0] = 1.0;
    cTil[1] = xor;
    sTil[1] = yor;

    const dh = DataHandler.getInstance();

    for (let n = 2, nm1 = 1, nm2 = 0, np1 = 3; n <= this.degree; nm2++, nm1++, n++, np1++) {
      const twonm1 = 2.0 * n - 1.0;

      reorn *= reor;
      const cN0 = dh.getEgm96Coeffs(n, 0)[2];

      pN[0] = (twonm1 * ep * pNm1[0] - nm1 * pNm2[0]) / n;
      pN[1] = pNm2[1] + twonm1 * pNm1[0];
      pN[2] = pNm2[2] + twonm1 * pNm1[1];

      let sumHn = pN[1] * cN0;
      let sumGmn = pN[0] * cN0 * np1;

      if (this.order > 0) {
        let sumJn = 0.0;
        let sumKn = 0.0;

        cTil[n] = cTil[1] * cTil[nm1] - sTil[1] * sTil[nm1];
        sTil[n] = sTil[1] * cTil[nm1] + cTil[1] * sTil[nm1];

        const lim = n < this.order ? n : this.order;

        for (let m = 1, mm1 = 0, mm2 = -1, mp1 = 2, mp2 = 3; m <= lim; mm2++, mm1++, m++, mp1++, mp2++) {
          pN[mp1] = pNm2[mp1] + twonm1 * pNm1[m];

          const dm = m;
          const npmp1 = n + mp1;

          const pNm = pN[m];
          const pNmp1 = pN[mp1];

          const coefs = dh.getEgm96Coeffs(n, m);
          const cNm = coefs[2];
          const sNm = coefs[3];

          const mxPnm = dm * pNm;
          const bNmtil = cNm * cTil[m] + sNm * sTil[m];
          const pNmBnm = pNm * bNmtil;
          const bNmtm1 = cNm * cTil[mm1] + sNm * sTil[mm1];
          const aNmtm1 = cNm * sTil[mm1] - sNm * cTil[mm1];

          sumHn += pNmp1 * bNmtil;
          sumGmn += npmp1 * pNmBnm;
          sumJn += mxPnm * bNmtm1;
          sumKn -= mxPnm * aNmtm1;
        }

        sumJ += reorn * sumJn;
        sumK += reorn * sumKn;
      }

      sumH += reorn * sumHn;
      sumGm += reorn * sumGmn;

      if (n < this.degree) {
        for (let i = 0; i <= n; i++) {
          pNm2[i] = pNm1[i];
          pNm1[i] = pN[i];
        }
      }
    }

    const lambda = sumGm + ep * sumH;
    const g = new Vector3D(
      -muor2 * (lambda * xor - sumJ),
      -muor2 * (lambda * yor - sumK),
      -muor2 * (lambda * zor - sumH),
    );

    return new ITRF(state.epoch, g, Vector3D.origin).toJ2000().position;
  }

  acceleration(state: J2000): Vector3D {
    let accVec = this._spherical(state);

    if (this._asphericalFlag) {
      accVec = accVec.add(this._aspherical(state));
    }

    return accVec;
  }
}
