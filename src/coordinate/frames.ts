/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Many of the classes are based off of the work of @david-rc-dayton and his
 * Pious Squid library (https://github.com/david-rc-dayton/pious_squid) which
 * is licensed under the MIT license.
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

/* eslint-disable max-classes-per-file -- the frame hierarchy is intentionally co-located; see below. */

/*
 * `StateVector` and its concrete subclasses (`J2000`, `ITRF`, `TEME`) live in
 * this single module ON PURPOSE. Each subclass does `extends StateVector`, and
 * the frames convert into one another (`J2000.toITRF()`, `ITRF.toJ2000()`, ...).
 * Keeping them in separate files created a cross-module cycle that crossed a
 * top-level `extends`, which can throw at load time ("Cannot access
 * 'StateVector' before initialization" / "Class extends value undefined")
 * depending on module-evaluation order. Co-locating them makes every `extends`
 * intra-module (StateVector is declared first, below), so the hazard cannot
 * occur. The original file names re-export from here to preserve import paths.
 */

import { Earth } from '../body/Earth';
import { ClassicalElements } from './ClassicalElements';
import { Geodetic } from './Geodetic';
import { EpochUTC } from '../time/EpochUTC';
import { Kilometers, KilometersPerSecond, Minutes, Radians } from '../types/types';
import { TAU } from '../utils/constants';
import { Vector3D } from '../operations/Vector3D';

/**
 * A state vector is a set of coordinates used to specify the position and
 * velocity of an object in a particular reference frame.
 */
export abstract class StateVector {
  epoch: EpochUTC;
  position: Vector3D<Kilometers>;
  velocity: Vector3D<KilometersPerSecond>;
  constructor(epoch: EpochUTC, position: Vector3D<Kilometers>, velocity: Vector3D<KilometersPerSecond>) {
    this.epoch = epoch;
    this.position = position;
    this.velocity = velocity;
  }

  /**
   * The name of the reference frame in which the state vector is defined.
   * @returns The name of the reference frame.
   */
  abstract get name(): string;

  /**
   * Whether the state vector is defined in an inertial reference frame.
   * @returns True if the state vector is defined in an inertial reference
   */
  abstract get inertial(): boolean;

  /**
   * Returns a string representation of the StateVector object. The string includes the name, epoch, position, and
   * velocity.
   * @returns A string representation of the StateVector object.
   */
  toString(): string {
    return [
      `[${this.name}]`,
      `  Epoch: ${this.epoch}`,
      `  Position: ${this.position.toString(6)} km`,
      `  Velocity: ${this.velocity.toString(9)} km/s`,
    ].join('\n');
  }

  /**
   * Calculates the mechanical energy of the state vector.
   * @returns The mechanical energy value.
   */
  get mechanicalEnergy(): number {
    const r = this.position.magnitude();
    const v = this.velocity.magnitude();

    return v * v * 0.5 - Earth.mu / r;
  }

  /**
   * Calculates the semimajor axis of the state vector.
   * @returns The semimajor axis in kilometers.
   */
  get semimajorAxis(): Kilometers {
    const energy = this.mechanicalEnergy;

    return (-Earth.mu / (2.0 * energy)) as Kilometers;
  }

  /**
   * Gets the period of the state vector in minutes.
   * @returns The period in minutes.
   */
  get period(): Minutes {
    const a = this.semimajorAxis;
    const periodSeconds = TAU * Math.sqrt((a * a * a) / Earth.mu);

    return (periodSeconds / 60.0) as Minutes;
  }

  /**
   * Gets the angular rate of the state vector.
   * @returns The angular rate.
   */
  get angularRate(): number {
    const a = this.semimajorAxis;

    return Math.sqrt(Earth.mu / (a * a * a));
  }

  /**
   * Converts the state vector to classical elements.
   * @param mu The gravitational parameter of the celestial body. Defaults to Earth's gravitational parameter.
   * @returns The classical elements corresponding to the state vector.
   * @throws Error if classical elements are undefined for fixed frames.
   */
  toClassicalElements(mu = Earth.mu): ClassicalElements {
    if (!this.inertial) {
      throw new Error('Classical elements are undefined for fixed frames.');
    }

    return ClassicalElements.fromStateVector(this, mu);
  }
}

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
   * This is an ECI to ECEF transformation.
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

/**
 * True Equator Mean Equinox (TEME) is a coordinate system commonly used in satellite tracking and orbit prediction. It
 * is a reference frame that defines the position and orientation of an object relative to the Earth's equator and
 * equinox.
 *
 * By using the True Equator Mean Equinox (TEME) coordinate system, we can accurately describe the position and motion
 * of satellites relative to the Earth's equator and equinox. This is particularly useful for tracking and predicting
 * satellite orbits in various applications, such as satellite communication, navigation, and remote sensing.
 */
export class TEME extends StateVector {
  /**
   * Gets the name of the coordinate system.
   * @returns The name of the coordinate system.
   */
  get name(): string {
    return 'TEME';
  }

  /**
   * Gets a value indicating whether the coordinate is inertial.
   * @returns A boolean value indicating whether the coordinate is inertial.
   */
  get inertial(): boolean {
    return true;
  }

  /**
   * Creates a TEME (True Equator Mean Equinox) object from classical orbital elements.
   * @param elements - The classical orbital elements.
   * @returns A new TEME object.
   */
  static fromClassicalElements(elements: ClassicalElements): TEME {
    const rv = elements.toPositionVelocity();

    return new TEME(elements.epoch, rv.position, rv.velocity);
  }

  /**
   * Converts the TEME (True Equator Mean Equinox) coordinates to J2000 coordinates.
   * @returns The J2000 coordinates.
   */
  toJ2000(): J2000 {
    const p = Earth.precession(this.epoch);
    const n = Earth.nutation(this.epoch);
    const eps = n.mEps + n.dEps;
    const dPsiCosEps = n.dPsi * Math.cos(eps);
    const rMOD = this.position
      .rotZ(-dPsiCosEps as Radians)
      .rotX(eps)
      .rotZ(n.dPsi)
      .rotX(-n.mEps);
    const vMOD = this.velocity
      .rotZ(-dPsiCosEps as Radians)
      .rotX(eps)
      .rotZ(n.dPsi)
      .rotX(-n.mEps);
    const rJ2K = rMOD
      .rotZ(p.zed)
      .rotY(-p.theta as Radians)
      .rotZ(p.zeta) as Vector3D<Kilometers>;
    const vJ2K = vMOD
      .rotZ(p.zed)
      .rotY(-p.theta as Radians)
      .rotZ(p.zeta) as Vector3D<KilometersPerSecond>;

    return new J2000(this.epoch, rJ2K, vJ2K);
  }
}
