/**
 * @author Theodore Kruczek.
 * @license MIT
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

import { DEG2RAD, Degrees, RAD2DEG, Radians, SpaceObjectType } from 'ootk-core';
import { azel2uv, uv2azel, RfSensorParams } from '../main';
import { DetailedSensor } from './DetailedSensor';

export class RfSensor extends DetailedSensor {
  boresightAz: Degrees;
  boresightEl: Degrees;
  freqBand?: string;
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
    this.beamwidth = info.beamwidth;
    this.freqBand = info.freqBand;
  }

  uvFromAzEl(az: Degrees, el: Degrees) {
    const azRad = (az * DEG2RAD) as Radians;
    const elRad = (el * DEG2RAD) as Radians;
    const azDiff = (azRad - this.boresightAzRad) as Radians;
    const elDiff = (elRad - this.boresightElRad) as Radians;

    return azel2uv(azDiff, elDiff, this.beamwidthRad);
  }

  azElFromUV(u: number, v: number) {
    const { az, el } = uv2azel(u, v, this.beamwidthRad);

    return {
      az: ((az + this.boresightAz) * RAD2DEG) as Degrees,
      el: ((el + this.boresightEl) * RAD2DEG) as Degrees,
    };
  }

  get boresightAzRad() {
    return (this.boresightAz * DEG2RAD) as Radians;
  }

  get boresightElRad() {
    return (this.boresightEl * DEG2RAD) as Radians;
  }

  get beamwidthRad() {
    return (this.beamwidth * DEG2RAD) as Radians;
  }
}
