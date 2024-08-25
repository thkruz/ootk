/**
 * @author Theodore Kruczek.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2022-2024 Theodore Kruczek Permission is
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

import { azel2uv, DEG2RAD, Degrees, RAD2DEG, Radians, SpaceObjectType, uv2azel } from '../main.js';
import { RfSensorParams } from '../interfaces/RfSensorParams.js';
import { DetailedSensor } from './DetailedSensor.js';

export class RfSensor extends DetailedSensor {
  boresightAz: Degrees[];
  boresightEl: Degrees[];
  faces: number;
  beamwidth: Degrees;

  constructor(info: RfSensorParams) {
    super(info);

    switch (info.type) {
      case SpaceObjectType.BISTATIC_RADIO_TELESCOPE:
      case SpaceObjectType.MECHANICAL:
      case SpaceObjectType.PHASED_ARRAY_RADAR:
        break;
      default:
        throw new Error('Invalid sensor type');
    }

    this.boresightAz = info.boresightAz;
    this.boresightEl = info.boresightEl;
    if (info.boresightAz.length !== info.boresightEl.length) {
      throw new Error('Boresight azimuth and elevation arrays must be the same length');
    }
    this.faces = info.boresightAz.length;
    this.beamwidth = info.beamwidth;
  }

  /**
   * Converts azimuth and elevation angles to unit vector coordinates.
   * @param az - The azimuth angle in degrees.
   * @param el - The elevation angle in degrees.
   * @param face - The face number (optional).
   * @returns The unit vector coordinates.
   */
  uvFromAzEl(az: Degrees, el: Degrees, face?: number) {
    const azRad = (az * DEG2RAD) as Radians;
    const elRad = (el * DEG2RAD) as Radians;
    const azDiff = (azRad - this.boresightAzRad(face ?? 0)) as Radians;
    const elDiff = (elRad - this.boresightElRad(face ?? 0)) as Radians;

    return azel2uv(azDiff, elDiff, this.beamwidthRad);
  }

  /**
   * Converts the given UV coordinates to azimuth and elevation angles.
   * @param u - The U coordinate.
   * @param v - The V coordinate.
   * @param face - The face number for multi-faced sensors. (optional)
   * @returns An object containing the azimuth and elevation angles in degrees.
   * @throws Error if face number is not specified for multi-faced sensors.
   */
  azElFromUV(u: number, v: number, face?: number) {
    if (!face && this.faces > 1) {
      throw new Error('Face number must be specified for multi-faced sensors');
    }

    const { az, el } = uv2azel(u, v, this.beamwidthRad);

    return {
      az: ((az + this.boresightAz[face ?? 0]) * RAD2DEG) as Degrees,
      el: ((el + this.boresightEl[face ?? 0]) * RAD2DEG) as Degrees,
    };
  }

  /**
   * Converts the boresight azimuth angle to radians.
   * @param face - The face number for multi-faced sensors. (Optional)
   * @returns The boresight azimuth angle in radians.
   * @throws An error if the face number is not specified for multi-faced sensors.
   */
  boresightAzRad(face?: number) {
    if (!face && this.faces > 1) {
      throw new Error('Face number must be specified for multi-faced sensors');
    }

    return (this.boresightAz[face ?? 0] * DEG2RAD) as Radians;
  }

  /**
   * Converts the boresight elevation angle of the sensor to radians.
   * @param face - The face number of the sensor (optional for single-faced sensors).
   * @returns The boresight elevation angle in radians.
   * @throws Error if the face number is not specified for multi-faced sensors.
   */
  boresightElRad(face?: number) {
    if (!face && this.faces > 1) {
      throw new Error('Face number must be specified for multi-faced sensors');
    }

    return (this.boresightEl[face ?? 0] * DEG2RAD) as Radians;
  }

  /**
   * Gets the beamwidth in radians.
   * @returns The beamwidth in radians.
   */
  get beamwidthRad() {
    return (this.beamwidth * DEG2RAD) as Radians;
  }
}
