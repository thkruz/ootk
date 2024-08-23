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

import { Earth, EpochUTC, J2000, Kilometers, KilometersPerSecond, Radians, Vector3D } from '../main.js';

// / Lambert two-position and time initial orbit determination.
export class LambertIOD {
  constructor(public mu: number = Earth.mu) {
    // Nothing to do here.
  }

  /**
   * Try to guess the short path argument given an [interceptor] and
   * [target] state.
   * @param interceptor Interceptor
   * @param target Target
   * @returns True if the short path should be used, false otherwise.
   */
  static useShortPath(interceptor: J2000, target: J2000): boolean {
    const transN = interceptor.position.cross(target.position);
    const h = interceptor.position.cross(interceptor.velocity);

    return h.dot(transN) >= 0;
  }

  private static timeOfFlight_(
    x: number,
    longway: number,
    mrev: number,
    minSma: number,
    speri: number,
    chord: number,
  ): number {
    const a = minSma / (1.0 - x * x);
    let tof: number;

    if (Math.abs(x) < 1) {
      const beta = longway * 2.0 * Math.asin(Math.sqrt((speri - chord) / (2.0 * a)));
      const alpha = 2.0 * Math.acos(x);

      tof = a * Math.sqrt(a) * (alpha - Math.sin(alpha) - (beta - Math.sin(beta)) + 2.0 * Math.PI * mrev);
    } else {
      const alpha = 2.0 * Math.acosh(x);
      const beta = longway * 2.0 * Math.asinh(Math.sqrt((speri - chord) / (-2.0 * a)));

      tof = -a * Math.sqrt(-a) * (Math.sinh(alpha) - alpha - (Math.sinh(beta) - beta));
    }

    return tof;
  }

  /**
   * Attempt to solve output velocity [v1] _(km/s)_ given radii [r1] and
   * [r2] _(canonical)_, sweep angle [dth] _(rad)_, time of flight [tau]
   * _(canonical)_, and number of revolutions _(mRev)_.
   * @param r1 Radius 1
   * @param r2 Radius 2
   * @param dth Sweep angle
   * @param tau Time of flight
   * @param mRev Number of revolutions
   * @param v1 Output velocity
   * @returns True if successful, false otherwise.
   */
  static solve(r1: number, r2: number, dth: number, tau: number, mRev: number, v1: Float64Array): boolean {
    const leftBranch = dth < Math.PI;
    let longway = 1;

    if (dth > Math.PI) {
      longway = -1;
    }

    const m = Math.abs(mRev);
    const rtof = Math.abs(tau);
    const theta = dth;

    const chord = Math.sqrt(r1 * r1 + r2 * r2 - 2.0 * r1 * r2 * Math.cos(theta));
    const speri = 0.5 * (r1 + r2 + chord);

    const minSma = 0.5 * speri;
    const lambda = longway * Math.sqrt(1.0 - chord / speri);
    const logt = Math.log(rtof);

    let in1: number;
    let in2: number;
    let x1: number;
    let x2: number;

    if (m === 0) {
      in1 = -0.6523333;
      in2 = 0.6523333;
      x1 = Math.log(1.0 + in1);
      x2 = Math.log(1.0 + in2);
    } else {
      if (!leftBranch) {
        in1 = -0.523334;
        in2 = -0.223334;
      } else {
        in1 = 0.723334;
        in2 = 0.523334;
      }
      x1 = Math.tan((in1 * Math.PI) / 2);
      x2 = Math.tan((in2 * Math.PI) / 2);
    }
    const tof1 = LambertIOD.timeOfFlight_(in1, longway, m, minSma, speri, chord);
    const tof2 = LambertIOD.timeOfFlight_(in2, longway, m, minSma, speri, chord);

    let y1: number;
    let y2: number;

    if (m === 0) {
      y1 = Math.log(tof1) - logt;
      y2 = Math.log(tof2) - logt;
    } else {
      y1 = tof1 - rtof;
      y2 = tof2 - rtof;
    }
    let err = 1e20;
    let iterations = 0;
    const tol = 1e-13;
    const maxiter = 50;
    let xnew = 0.0;

    while (err > tol && iterations < maxiter) {
      xnew = (x1 * y2 - y1 * x2) / (y2 - y1);
      let xt: number;

      if (m === 0) {
        xt = Math.exp(xnew) - 1.0;
      } else {
        xt = (Math.atan(xnew) * 2.0) / Math.PI;
      }

      const tof = LambertIOD.timeOfFlight_(xt, longway, m, minSma, speri, chord);

      let ynew: number;

      if (m === 0) {
        ynew = Math.log(tof) - logt;
      } else {
        ynew = tof - rtof;
      }

      x1 = x2;
      x2 = xnew;
      y1 = y2;
      y2 = ynew;

      err = Math.abs(x1 - xnew);
      ++iterations;
    }

    if (err > tol) {
      return false;
    }

    let x: number;

    if (m === 0) {
      x = Math.exp(xnew) - 1.0;
    } else {
      x = (Math.atan(xnew) * 2.0) / Math.PI;
    }

    const sma = minSma / (1.0 - x * x);

    let eta: number;

    if (x < 1) {
      const alfa = 2.0 * Math.acos(x);
      const beta = longway * 2.0 * Math.asin(Math.sqrt((speri - chord) / (2.0 * sma)));
      const psi = (alfa - beta) / 2.0;
      const sinPsi = Math.sin(psi);
      const etaSq = (2.0 * sma * sinPsi * sinPsi) / speri;

      eta = Math.sqrt(etaSq);
    } else {
      const gamma = 2.0 * Math.acosh(x);
      const delta = longway * 2.0 * Math.asinh(Math.sqrt((chord - speri) / (2.0 * sma)));
      const psi = (gamma - delta) / 2.0;
      const sinhPsi = Math.sinh(psi);
      const etaSq = (-2.0 * sma * sinhPsi * sinhPsi) / speri;

      eta = Math.sqrt(etaSq);
    }

    const vr1 = (1.0 / eta) * Math.sqrt(1.0 / minSma) * ((2.0 * lambda * minSma) / r1 - (lambda + x * eta));
    const vt1 = (1.0 / eta) * Math.sqrt(1.0 / minSma) * Math.sqrt(r2 / r1) * Math.sin(dth / 2.0);

    v1[0] = vr1;
    v1[1] = vt1;

    return true;
  }

  /**
   * Estimate a state vector for inertial position [p1] _(km)_ given the
   * two epoch and positions.
   * @param p1 Position vector 1
   * @param p2 Position vector 2
   * @param t1 Epoch 1
   * @param t2 Epoch 2
   * @param root0 Optional parameters
   * @param root0.posigrade If true, use the positive root (default: true)
   * @param root0.nRev Number of revolutions (default: 0)
   * @returns A [J2000] object with the estimated state vector.
   */
  estimate(
    p1: Vector3D<Kilometers>,
    p2: Vector3D<Kilometers>,
    t1: EpochUTC,
    t2: EpochUTC,
    { posigrade = true, nRev = 0 }: { posigrade?: boolean; nRev?: number } = {},
  ): J2000 | null {
    const r1 = p1.magnitude();
    const r2 = p2.magnitude();
    const tof = t2.difference(t1);

    const r = Math.max(r1, r2);
    const v = Math.sqrt(this.mu / r);
    const t = r / v;

    let dth = p1.angle(p2);

    if (!posigrade) {
      dth = 2 * Math.PI - dth as Radians;
    }

    const vDep = new Float64Array(2);
    const exitFlag = LambertIOD.solve(r1 / r, r2 / r, dth, tof / t, nRev, vDep);

    if (exitFlag) {
      const pn = p1.cross(p2);
      const pt = pn.cross(p1);
      let rt = pt.magnitude();

      if (!posigrade) {
        rt = -rt as Kilometers;
      }
      const vel1 = p1.scale((v * vDep[0]) / r1).add(pt.scale((v * vDep[1]) / rt)) as Vector3D<KilometersPerSecond>;

      return new J2000(t1, p1, vel1);
    }

    return null;
  }
}
