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
import { Earth } from '../body/Earth.js';
import { Kilometers, KilometersPerSecond, Radians, Vector3D } from '../main.js';
import { Geodetic } from './Geodetic.js';
import { J2000 } from './J2000.js';
import { StateVector } from './StateVector.js';

/**
 * The International Terrestrial Reference Frame (ITRF) is a geocentric reference frame for the Earth. It is the
 * successor to the International Terrestrial Reference System (ITRS). The ITRF definition is maintained by the
 * International Earth Rotation and Reference Systems Service (IERS). Several versions of ITRF exist, each with a
 * different epoch, to address the issue of crustal motion. The latest version is ITRF2014, based on data collected from
 * 1980 to 2014.
 * @see https://en.wikipedia.org/wiki/International_Terrestrial_Reference_Frame
 *
 * This is a geocentric coordinate system, also referenced as ECF/ECEF (Earth Centered Earth Fixed). It is a Cartesian
 * coordinate system with the origin at the center of the Earth. The x-axis intersects the sphere of the Earth at 0°
 * latitude (the equator) and 0° longitude (the Prime Meridian). The z-axis goes through the North Pole. The y-axis goes
 * through 90° East longitude.
 * @see https://en.wikipedia.org/wiki/Earth-centered,_Earth-fixed_coordinate_system
 */
export class ITRF extends StateVector {
  /**
   * Gets the name of the ITRF coordinate system.
   * @returns The name of the coordinate system.
   */
  get name(): string {
    return 'ITRF';
  }

  /**
   * Gets a value indicating whether the coordinate system is inertial.
   * @returns A boolean value indicating whether the coordinate system is inertial.
   */
  get inertial(): boolean {
    return false;
  }

  /**
   * Gets the height of the ITRF coordinate above the surface of the Earth in kilometers.
   * @returns The height in kilometers.
   */
  get height(): Kilometers {
    const a = Earth.radiusEquator;
    const e2 = Earth.eccentricitySquared;
    const r = this.position.magnitude();
    const sl = this.position.z / r;
    const cl2 = 1 - sl * sl;
    const coeff = Math.sqrt((1 - e2) / (1 - e2 * cl2));

    return (r - a * coeff) as Kilometers;
  }

  /**
   * Gets the altitude in kilometers.
   * @returns The altitude in kilometers.
   */
  get alt(): Kilometers {
    return this.height;
  }

  /**
   * Converts the current coordinate to the J2000 coordinate system. This is an Earth-Centered Inertial (ECI) coordinate
   * system with the origin at the center of the Earth.
   * @see https://en.wikipedia.org/wiki/Epoch_(astronomy)#Julian_years_and_J2000
   * @returns The coordinate in the J2000 coordinate system.
   */
  toJ2000(): J2000 {
    const p = Earth.precession(this.epoch);
    const n = Earth.nutation(this.epoch);
    const ast = this.epoch.gmstAngle() + n.eqEq;
    const rTOD = this.position.rotZ(-ast as Radians);
    const vTOD = this.velocity
    // TODO: #13 Intermediate unit type is incorrect.
      .add(Earth.rotation.cross(this.position) as unknown as Vector3D<KilometersPerSecond>)
      .rotZ(-ast as Radians);
    const rMOD = rTOD.rotX(n.eps).rotZ(n.dPsi).rotX(-n.mEps);
    const vMOD = vTOD.rotX(n.eps).rotZ(n.dPsi).rotX(-n.mEps);
    const rJ2000 = rMOD
      .rotZ(p.zed)
      .rotY(-p.theta as Radians)
      .rotZ(p.zeta) as Vector3D<Kilometers>;
    const vJ2000 = vMOD
      .rotZ(p.zed)
      .rotY(-p.theta as Radians)
      .rotZ(p.zeta) as Vector3D<KilometersPerSecond>;

    return new J2000(this.epoch, rJ2000, vJ2000);
  }

  /**
   * Converts the current ITRF coordinate to Geodetic coordinate. This is a coordinate system for latitude, longitude,
   * and altitude.
   * @returns The converted Geodetic coordinate.
   */
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
    let alt: Kilometers;
    let c = 0.0;

    if (x === 0 && y === 0) {
      lat = phi;
      alt = z > 0 ? ((z - Earth.radiusPolar) as Kilometers) : ((z + Earth.radiusPolar) as Kilometers);
    } else {
      for (let i = 0; i < 20; i++) {
        const slat = Math.sin(lat);

        c = 1 / Math.sqrt(1 - esq * slat * slat);
        lat = Math.atan((z + sma * c * esq * slat) / r);
      }
      alt = (r / Math.cos(lat) - sma * c) as Kilometers;
    }

    return new Geodetic(lat as Radians, lon as Radians, alt);
  }
}
