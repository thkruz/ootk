/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The Transforms module contains a collection of conversions not contained
 * in the original SGP4 library such as ECI to ECF and ECF to RAE. This almost
 * entirely based on the functions in satellite.js
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const PI = Math.PI;
const TAU = PI * 2; //https://tauday.com/tau-manifesto

type vec3K = {
  x: number;
  y: number;
  z: number;
};

class Transforms {
  static dopplerFactor(location: vec3K, position: vec3K, velocity: vec3K): number {
    const mfactor = 7.292115e-5;
    const c = 299792.458; // Speed of light in km/s

    const range = {
      x: position.x - location.x,
      y: position.y - location.y,
      z: position.z - location.z,
      w: 0,
    };
    range.w = Math.sqrt(range.x ** 2 + range.y ** 2 + range.z ** 2);

    const rangeVel = {
      x: velocity.x + mfactor * location.y,
      y: velocity.y - mfactor * location.x,
      z: velocity.z,
    };

    const sign = (value) => (value >= 0 ? 1 : -1);

    const rangeRate =
      (range.x * rangeVel.x + range.y * rangeVel.y + range.z * rangeVel.z) / range.w;

    return 1 + (rangeRate / c) * sign(rangeRate);
  }

  static rad2deg(radians: number): number {
    return radians * 180 / PI;
  }

  static deg2rad(degrees: number): number {
    return degrees * PI / 180.0;
  }

  static getDegLat(radians: number): number {
    if (radians < -PI / 2 || radians > PI / 2) {
      throw new RangeError('Latitude radians must be in range [-PI/2; PI/2].');
    }
    return Transforms.rad2deg(radians);
  }

  static getDegLon(radians: number): number {
    if (radians < -PI || radians > PI) {
      throw new RangeError('Longitude radians must be in range [-PI; PI].');
    }
    return Transforms.rad2deg(radians);
  }

  static getRadLat(degrees: number): number {
    if (degrees < -90 || degrees > 90) {
      throw new RangeError('Latitude degrees must be in range [-90; 90].');
    }
    return Transforms.deg2rad(degrees);
  }

  static getRadLon(degrees: number): number {
    if (degrees < -180 || degrees > 180) {
      throw new RangeError('Longitude degrees must be in range [-180; 180].');
    }
    return Transforms.deg2rad(degrees);
  }

  static lla2ecf(lla: {
    lat: number;
    lon: number;
    alt: number;
  }): { x: number; y: number; z: number } {
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
      x,
      y,
      z,
    };
  }

  /** eciToGeodetic converts eci coordinates to lla coordinates
   * @param {{array}} eci takes xyz coordinates
   * @param {number} gmst takes a number in gmst time
   * @returns {array} array containing lla coordinates
   */
  static eci2lla(
    eci: { x: number; y: number; z: number },
    gmst: number,
  ): {
    lat: number;
    lon: number;
    alt: number;
  } {
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
    let C;
    while (k < kmax) {
      C = 1 / Math.sqrt(1 - e2 * (Math.sin(lat) * Math.sin(lat)));
      lat = Math.atan2(eci.z + a * C * e2 * Math.sin(lat), R);
      k += 1;
    }
    const alt = R / Math.cos(lat) - a * C;
    return { lon, lat, alt };
  }

  static ecf2eci(
    ecf: { x: number; y: number; z: number },
    gmst: number,
  ): { x: number; y: number; z: number } {
    // ccar.colorado.edu/ASEN5070/handouts/coordsys.doc
    //
    // [X]     [C -S  0][X]
    // [Y]  =  [S  C  0][Y]
    // [Z]eci  [0  0  1][Z]ecf
    //
    const X = ecf.x * Math.cos(gmst) - ecf.y * Math.sin(gmst);
    const Y = ecf.x * Math.sin(gmst) + ecf.y * Math.cos(gmst);
    const Z = ecf.z;
    return { x: X, y: Y, z: Z };
  }

  static eci2ecf(
    eci: { x: number; y: number; z: number },
    gmst: number,
  ): { x: number; y: number; z: number } {
    // ccar.colorado.edu/ASEN5070/handouts/coordsys.doc
    //
    // [X]     [C -S  0][X]
    // [Y]  =  [S  C  0][Y]
    // [Z]eci  [0  0  1][Z]ecf
    //
    //
    // Inverse:
    // [X]     [C  S  0][X]
    // [Y]  =  [-S C  0][Y]
    // [Z]ecf  [0  0  1][Z]eci

    const x = eci.x * Math.cos(gmst) + eci.y * Math.sin(gmst);
    const y = eci.x * -Math.sin(gmst) + eci.y * Math.cos(gmst);
    const { z } = eci;

    return {
      x,
      y,
      z,
    };
  }

  static lla2sez(
    lla: {
      lat: number;
      lon: number;
      alt: number;
    },
    ecf: { x: number; y: number; z: number },
  ): { topS: number; topE: number; topZ: number } {
    // http://www.celestrak.com/columns/v02n02/
    // TS Kelso's method, except I'm using ECF frame
    // and he uses ECI.

    const { lon, lat } = lla;

    const observerEcf = Transforms.lla2ecf(lla);

    const rx = ecf.x - observerEcf.x;
    const ry = ecf.y - observerEcf.y;
    const rz = ecf.z - observerEcf.z;

    // top is short for topocentric
    const topS =
      Math.sin(lat) * Math.cos(lon) * rx +
      Math.sin(lat) * Math.sin(lon) * ry -
      Math.cos(lat) * rz;

    const topE = -Math.sin(lon) * rx + Math.cos(lon) * ry;

    const topZ =
      Math.cos(lat) * Math.cos(lon) * rx +
      Math.cos(lat) * Math.sin(lon) * ry +
      Math.sin(lat) * rz;

    return { topS, topE, topZ };
  }

  /**
   * @param {Object} tc Containing SEZ coordinates
   * @param {Number} tc.topS Positive horizontal vector S due south.
   * @param {Number} tc.topE Positive horizontal vector E due east.
   * @param {Number} tc.topZ Vector Z normal to the surface of the earth (up).
   * @returns {Object} Rng, Az, El array
   */
  static sez2lla(tc: {
    topS: number;
    topE: number;
    topZ: number;
  }): { rng: number; az: number; el: number } {
    const { topS, topE, topZ } = tc;
    const rng = Math.sqrt(topS * topS + topE * topE + topZ * topZ);
    const el = Math.asin(topZ / rng);
    const az = Math.atan2(-topE, topS) + PI;

    return {
      rng, // km
      az: az,
      el: el,
    };
  }

  static ecf2rae(
    lla: {
      lon: number;
      lat: number;
      alt: number;
    },
    ecf: { x: number; y: number; z: number },
  ): { rng: number; az: number; el: number } {
    const sezCoords = Transforms.lla2sez(lla, ecf);
    return Transforms.sez2lla(sezCoords);
  }
}

export { Transforms };
