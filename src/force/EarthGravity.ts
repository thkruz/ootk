/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
 *
 * Orbital Object ToolKit is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Orbital Object ToolKit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * Orbital Object ToolKit. If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-disable class-methods-use-this */
// / Complex Earth gravity model, accounting for EGM-96 zonal, sectoral, and

import { DataHandler, Earth, ITRF, J2000, Kilometers, KilometersPerSecond, Vector3D } from '../main.js';
import { Force } from './Force.js';

/**
 * designed to model the Earth's gravitational field, which is not uniformly distributed due to variations in mass
 * distribution within the Earth and the Earth's shape (it's not a perfect sphere). To accurately model this complex
 * field, the gravity model is expanded into a series of spherical harmonics, characterized by their degree and order.
 *
 * This `degree` parameter is related to the spatial resolution of the gravity model. A higher degree corresponds to a
 * finer resolution, capable of representing smaller-scale variations in the gravity field. The degree essentially
 * denotes how many times the gravitational potential function varies over the surface of the Earth.
 *
 * For each degree, there can be multiple orders ranging from 0 up to the degree. The `order` accounts for the
 * longitudinal variation in the gravity field. Each order within a degree captures different characteristics of the
 * gravity anomalies.
 *
 * `Degree 0` corresponds to the overall, mean gravitational force of the Earth (considered as a point mass).
 *
 * `Degree 1` terms are related to the Earth's center of mass but are usually not used because the center of mass is
 * defined as the origin of the coordinate system.
 *
 * `Degree 2` and higher capture the deviations from this spherical symmetry, such as the flattening at the poles and
 * bulging at the equator (degree 2), and other anomalies at finer scales as the degree increases.
 */
export class EarthGravity implements Force {
  degree: number;
  order: number;
  _asphericalFlag: boolean;

  /**
   * Creates a new instance of the EarthGravity class.
   * @param degree The degree of the Earth's gravity field. Must be between 0 and 36.
   * @param order The order of the Earth's gravity field. Must be between 0 and 36.
   */
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
    const g = new Vector3D<Kilometers>(
      -muor2 * (lambda * xor - sumJ) as Kilometers,
      -muor2 * (lambda * yor - sumK) as Kilometers,
      -muor2 * (lambda * zor - sumH) as Kilometers,
    );

    return new ITRF(state.epoch, g, Vector3D.origin as Vector3D<KilometersPerSecond>).toJ2000().position;
  }

  acceleration(state: J2000): Vector3D {
    let accVec = this._spherical(state);

    if (this._asphericalFlag) {
      accVec = accVec.add(this._aspherical(state));
    }

    return accVec;
  }
}
