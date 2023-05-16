/* eslint-disable init-declarations */
/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The Transforms module contains a collection of conversions not contained
 * in the original SGP4 library such as ECI to ECF and ECF to RAE. This was based
 * on some of the functions in satellite.js.
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2023 Theodore Kruczek
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

import { Degrees, EcfVec3, EciVec3, Kilometers, LlaVec3, Radians, RaeVec3, SezVec3 } from '../types/types';
import { PI, TAU } from '../utils/constants';

class Transforms {
  public static getDegLat(radians: Radians): Degrees {
    if (radians < -PI / 2 || radians > PI / 2) {
      throw new RangeError('Latitude radians must be in range [-PI/2; PI/2].');
    }

    return Transforms.rad2deg(radians);
  }

  public static getDegLon(radians: Radians): Degrees {
    if (radians < -PI || radians > PI) {
      throw new RangeError('Longitude radians must be in range [-PI; PI].');
    }

    return Transforms.rad2deg(radians);
  }

  public static getRadLat(degrees: Degrees): Radians {
    if (degrees < -90 || degrees > 90) {
      throw new RangeError('Latitude degrees must be in range [-90; 90].');
    }

    return Transforms.deg2rad(degrees);
  }

  public static getRadLon(degrees: Degrees): Radians {
    if (degrees < -180 || degrees > 180) {
      throw new RangeError('Longitude degrees must be in range [-180; 180].');
    }

    return Transforms.deg2rad(degrees);
  }

  public static rad2deg(radians: Radians): Degrees {
    return <Degrees>((radians * 180) / PI);
  }

  public static deg2rad(degrees: Degrees): Radians {
    return <Radians>((degrees * PI) / 180.0);
  }

  public static ecf2eci(ecf: EcfVec3, gmst: number): EciVec3 {
    /*
     * Ccar.colorado.edu/ASEN5070/handouts/coordsys.doc
     *
     * [X]     [C -S  0][X]
     * [Y]  =  [S  C  0][Y]
     * [Z]eci  [0  0  1][Z]ecf
     *
     */
    const X = <Kilometers>(ecf.x * Math.cos(gmst) - ecf.y * Math.sin(gmst));
    const Y = <Kilometers>(ecf.x * Math.sin(gmst) + ecf.y * Math.cos(gmst));
    const Z = <Kilometers>ecf.z;

    return { x: X, y: Y, z: Z };
  }

  public static ecf2rae(lla: LlaVec3, ecf: EcfVec3): RaeVec3 {
    const sezCoords = Transforms.lla2sez(lla, ecf);

    return Transforms.sez2rae(sezCoords);
  }

  /**
   * EciToGeodetic converts eci coordinates to lla coordinates
   * @param {vec3} eci takes xyz coordinates
   * @param {number} gmst takes a number in gmst time
   * @returns {array} array containing lla coordinates
   */
  public static eci2lla(eci: EciVec3, gmst: number): LlaVec3 {
    // http://www.celestrak.com/columns/v02n03/
    const a = 6378.137;
    const b = 6356.7523142;
    const R = Math.sqrt(eci.x * eci.x + eci.y * eci.y);
    const f = (a - b) / a;
    const e2 = 2 * f - f * f;

    let lon = Math.atan2(eci.y, eci.x) - gmst;

    while (lon < -PI) {
      lon += TAU;
    }
    while (lon > PI) {
      lon -= TAU;
    }

    const kmax = 20;
    let k = 0;
    let lat = Math.atan2(eci.z, Math.sqrt(eci.x * eci.x + eci.y * eci.y));
    let C: number;

    while (k < kmax) {
      C = 1 / Math.sqrt(1 - e2 * (Math.sin(lat) * Math.sin(lat)));
      lat = Math.atan2(eci.z + a * C * e2 * Math.sin(lat), R);
      k += 1;
    }
    const alt = R / Math.cos(lat) - a * C;

    return { lon: <Radians>lon, lat: <Radians>lat, alt: <Kilometers>alt };
  }

  public static eci2ecf(eci: EciVec3, gmst: number): EcfVec3 {
    /*
     * Ccar.colorado.edu/ASEN5070/handouts/coordsys.doc
     *
     * [X]     [C -S  0][X]
     * [Y]  =  [S  C  0][Y]
     * [Z]eci  [0  0  1][Z]ecf
     *
     *
     * Inverse:
     * [X]     [C  S  0][X]
     * [Y]  =  [-S C  0][Y]
     * [Z]ecf  [0  0  1][Z]eci
     */

    const x = <Kilometers>(eci.x * Math.cos(gmst) + eci.y * Math.sin(gmst));
    const y = <Kilometers>(eci.x * -Math.sin(gmst) + eci.y * Math.cos(gmst));
    const z = <Kilometers>eci.z;

    return {
      x,
      y,
      z,
    };
  }

  public static lla2ecf(lla: LlaVec3): EcfVec3 {
    const { lon, lat, alt } = lla;

    const a = 6378.137;
    const b = 6356.7523142;
    const f = (a - b) / a;
    const e2 = 2 * f - f * f;
    const normal = a / Math.sqrt(1 - e2 * (Math.sin(lat) * Math.sin(lat)));

    const x = (normal + alt) * Math.cos(lat) * Math.cos(lon);
    const y = (normal + alt) * Math.cos(lat) * Math.sin(lon);
    const z = (normal * (1 - e2) + alt) * Math.sin(lat);

    return {
      x: <Kilometers>x,
      y: <Kilometers>y,
      z: <Kilometers>z,
    };
  }

  public static lla2sez(lla: LlaVec3, ecf: EcfVec3): SezVec3 {
    /*
     * http://www.celestrak.com/columns/v02n02/
     * TS Kelso's method, except I'm using ECF frame
     * and he uses ECI.
     */

    const { lon, lat } = lla;

    const observerEcf = Transforms.lla2ecf(lla);

    const rx = ecf.x - observerEcf.x;
    const ry = ecf.y - observerEcf.y;
    const rz = ecf.z - observerEcf.z;

    // Top is short for topocentric
    const south = Math.sin(lat) * Math.cos(lon) * rx + Math.sin(lat) * Math.sin(lon) * ry - Math.cos(lat) * rz;

    const east = -Math.sin(lon) * rx + Math.cos(lon) * ry;

    const zenith = Math.cos(lat) * Math.cos(lon) * rx + Math.cos(lat) * Math.sin(lon) * ry + Math.sin(lat) * rz;

    return { s: <Kilometers>south, e: <Kilometers>east, z: <Kilometers>zenith };
  }

  public static rae2sez(rae: RaeVec3): SezVec3 {
    // Az,el,range to sez convertion
    const south = -rae.rng * Math.cos(rae.el) * Math.cos(rae.az);
    const east = rae.rng * Math.cos(rae.el) * Math.sin(rae.az);
    const zenith = rae.rng * Math.sin(rae.el);

    return {
      s: <Kilometers>south,
      e: <Kilometers>east,
      z: <Kilometers>zenith,
    };
  }

  public static rae2ecf(rae: RaeVec3, lla: LlaVec3): EcfVec3 {
    const obsEcf = Transforms.lla2ecf(lla);
    const sez = Transforms.rae2sez(rae);

    // Some needed calculations
    const slat = Math.sin(lla.lat);
    const slon = Math.sin(lla.lon);
    const clat = Math.cos(lla.lat);
    const clon = Math.cos(lla.lon);

    const x = slat * clon * sez.s + -slon * sez.e + clat * clon * sez.z + obsEcf.x;
    const y = slat * slon * sez.s + clon * sez.e + clat * slon * sez.z + obsEcf.y;
    const z = -clat * sez.s + slat * sez.z + obsEcf.z;

    return { x: <Kilometers>x, y: <Kilometers>y, z: <Kilometers>z };
  }

  /**
   * @param {Object} sez Containing SEZ coordinates
   * @param {Number} sez.s Positive horizontal vector S due south.
   * @param {Number} sez.e Positive horizontal vector E due east.
   * @param {Number} sez.z Vector Z normal to the surface of the earth (up).
   * @returns {RaeVec3} Rng, Az, El array
   */
  public static sez2rae(sez: SezVec3): RaeVec3 {
    const rng = <Kilometers>Math.sqrt(sez.s * sez.s + sez.e * sez.e + sez.z * sez.z);
    const el = <Degrees>Math.asin(sez.z / rng);
    const az = <Degrees>(Math.atan2(-sez.e, sez.s) + PI);

    return <RaeVec3>{
      rng,
      az,
      el,
    };
  }
}

export { Transforms };
