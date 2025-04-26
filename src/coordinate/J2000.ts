/**
 * @author Theodore Kruczek.
 * @license MIT
 * @copyright (c) 2022-2025 Theodore Kruczek Permission is
 * hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Kilometers, KilometersPerSecond, Radians, Vector3D } from '../main.js';
import { Earth } from '../body/Earth.js';
import { ClassicalElements } from './ClassicalElements.js';
import { ITRF } from './ITRF.js';
import { StateVector } from './StateVector.js';
import { TEME } from './TEME.js';

/**
 * Represents a position and velocity in the J2000 coordinate system. This is an Earth-centered inertial (ECI)
 * coordinate system.
 *
 * Commonly used ECI frame is defined with the Earth's Mean Equator and Mean Equinox (MEME) at 12:00 Terrestrial Time on
 * 1 January 2000. It can be referred to as J2K, J2000 or EME2000. The x-axis is aligned with the mean vernal equinox.
 * The z-axis is aligned with the Earth's rotation axis (or equivalently, the celestial North Pole) as it was at that
 * time. The y-axis is rotated by 90° East about the celestial equator.
 * @see https://en.wikipedia.org/wiki/Earth-centered_inertial
 */
export class J2000 extends StateVector {
  /**
   * Creates a J2000 coordinate from classical elements.
   * @param elements The classical elements.
   * @returns The J2000 coordinate.
   */
  static fromClassicalElements(elements: ClassicalElements): J2000 {
    const rv = elements.toPositionVelocity();

    return new J2000(elements.epoch, rv.position, rv.velocity);
  }

  /**
   * Gets the name of the coordinate system.
   * @returns The name of the coordinate system.
   */
  get name(): string {
    return 'J2000';
  }

  /**
   * Gets a value indicating whether the coordinate system is inertial.
   * @returns A boolean value indicating whether the coordinate system is inertial.
   */
  get inertial(): boolean {
    return true;
  }

  /**
   * Converts the coordinates from J2000 to the International Terrestrial Reference Frame (ITRF).
   * This is an ECI to ECF transformation.
   * @returns The ITRF coordinates.
   */
  toITRF(): ITRF {
    const p = Earth.precession(this.epoch);
    const n = Earth.nutation(this.epoch);
    const ast = (this.epoch.gmstAngle() + n.eqEq) as Radians;
    const rMOD = this.position
      .rotZ(-p.zeta as Radians)
      .rotY(p.theta)
      .rotZ(-p.zed as Radians);
    const vMOD = this.velocity
      .rotZ(-p.zeta as Radians)
      .rotY(p.theta)
      .rotZ(-p.zed as Radians);
    const rTOD = rMOD
      .rotX(n.mEps)
      .rotZ(-n.dPsi as Radians)
      .rotX(-n.eps);
    const vTOD = vMOD
      .rotX(n.mEps)
      .rotZ(-n.dPsi as Radians)
      .rotX(-n.eps);
    const rPEF = rTOD.rotZ(ast) as Vector3D<Kilometers>;
    const vPEF = vTOD.rotZ(ast).add(Earth.rotation.negate().cross(rPEF)) as Vector3D<KilometersPerSecond>;

    return new ITRF(this.epoch, rPEF, vPEF);
  }

  /**
   * Converts the J2000 coordinate to the TEME coordinate.
   * @returns The TEME coordinate.
   */
  toTEME(): TEME {
    const p = Earth.precession(this.epoch);
    const n = Earth.nutation(this.epoch);
    const eps = n.mEps + n.dEps;
    const dPsiCosEps = (n.dPsi * Math.cos(eps)) as Radians;
    const rMOD = this.position
      .rotZ(-p.zeta as Radians)
      .rotY(p.theta)
      .rotZ(-p.zed as Radians);
    const vMOD = this.velocity
      .rotZ(-p.zeta as Radians)
      .rotY(p.theta)
      .rotZ(-p.zed as Radians);
    const rTEME = rMOD
      .rotX(n.mEps)
      .rotZ(-n.dPsi as Radians)
      .rotX(-eps)
      .rotZ(dPsiCosEps) as Vector3D<Kilometers>;
    const vTEME = vMOD
      .rotX(n.mEps)
      .rotZ(-n.dPsi as Radians)
      .rotX(-eps)
      .rotZ(dPsiCosEps) as Vector3D<KilometersPerSecond>;

    return new TEME(this.epoch, rTEME, vTEME);
  }
}
