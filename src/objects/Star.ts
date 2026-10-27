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

// eslint-disable-next-line camelcase -- astronomy-engine's exported name
import { EquatorFromVector, Horizon, MakeTime, Observer, RotateVector, Rotation_EQJ_EQD, Vector } from 'astronomy-engine';
import { J2000 } from '../coordinate/J2000';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { Degrees, Kilometers, KilometersPerSecond, LlaVec3, RaeVec3, Radians, SpaceObjectType, TemeVec3 } from '../types/types';
import { StarObjectParams } from '../interfaces/StarObjectParams';
import { BaseObject } from './BaseObject';

/** Default observer for {@link Star.rae} and {@link Star.eci}: on the equator at the prime meridian. */
const DEFAULT_OBSERVER: LlaVec3<Degrees, Kilometers> = { lat: 0 as Degrees, lon: 0 as Degrees, alt: 0 as Kilometers };

/**
 * Distance (km) at which {@link Star.eci} places a star and that {@link Star.rae} reports as
 * range. It is a rendering convenience, not a physical distance.
 */
const STAR_RENDER_DISTANCE_KM = 250000 as Kilometers;

/**
 * A star with a catalog position: `ra` and `dec` are the J2000 (ICRS) right ascension and
 * declination in radians. Proper motion, parallax and aberration are not modeled.
 */
export class Star extends BaseObject {
  ra: Radians;
  dec: Radians;
  bf: string;
  h: string;
  pname: string;
  vmag?: number;
  constellation?: string;
  colorTemp?: number;
  hr?: number;
  flamsteed?: string;
  bayer?: string;

  constructor(info: StarObjectParams) {
    super(info);
    this.type = SpaceObjectType.STAR;

    this.ra = info.ra;
    this.dec = info.dec;

    this.pname = info.pname ?? '';
    this.bf = info.bf ?? '';
    this.h = info.h ?? '';
    this.vmag = info.vmag;
    this.constellation = info.constellation;
    this.colorTemp = info.colorTemp;
    this.hr = info.hr;
    this.flamsteed = info.flamsteed;
    this.bayer = info.bayer;
  }

  /**
   * Position of the star in TEME, placed {@link STAR_RENDER_DISTANCE_KM} from the Earth's center
   * along its catalog direction.
   *
   * The J2000 unit vector (cos dec cos ra, cos dec sin ra, sin dec) is scaled to 250000 km and
   * rotated J2000 to TEME at `date` (precession and nutation) with `J2000.toTEME()`, the frame of
   * `Satellite.eci()`. A star has no measurable geocentric parallax, so the result does not
   * depend on the observer.
   * @param _lla - Unused; kept for call compatibility (the direction is geocentric).
   * @param date - The date (defaults to now).
   * @returns TEME position in km.
   */
  eci(_lla: LlaVec3 = DEFAULT_OBSERVER, date: Date = new Date()): TemeVec3 {
    const r = STAR_RENDER_DISTANCE_KM;
    const cd = Math.cos(this.dec);
    const position = new Vector3D(
      (r * cd * Math.cos(this.ra)) as Kilometers,
      (r * cd * Math.sin(this.ra)) as Kilometers,
      (r * Math.sin(this.dec)) as Kilometers,
    );
    const teme = new J2000(
      EpochUTC.fromDateTime(date),
      position,
      Vector3D.origin as Vector3D<KilometersPerSecond>,
    ).toTEME();

    return { x: teme.position.x, y: teme.position.y, z: teme.position.z };
  }

  /**
   * Geometric azimuth and elevation of the star from an observer.
   *
   * The J2000 catalog direction is precessed and nutated to the true equator and equinox of
   * `date` (astronomy-engine `Rotation_EQJ_EQD`) and converted to horizontal coordinates with
   * no atmospheric refraction, which matches the geometric elevations `Satellite.rae()` returns.
   * @param lla - Observer latitude/longitude in degrees and altitude in km (defaults to 0, 0, 0).
   * @param date - The date (defaults to now).
   * @returns Azimuth (deg, from north through east) and elevation (deg); range is the fixed
   * rendering distance of 250000 km.
   */
  rae(
    lla: LlaVec3<Degrees, Kilometers> = DEFAULT_OBSERVER,
    date: Date = new Date(),
  ): RaeVec3 {
    const time = MakeTime(date);
    const cd = Math.cos(this.dec);
    const j2000Dir = new Vector(cd * Math.cos(this.ra), cd * Math.sin(this.ra), Math.sin(this.dec), time);
    const ofDate = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(time), j2000Dir));
    const observer = new Observer(lla.lat, lla.lon, lla.alt * 1000); // Convert km to meters
    const horizontal = Horizon(time, observer, ofDate.ra, ofDate.dec);

    return { az: horizontal.azimuth as Degrees, el: horizontal.altitude as Degrees, rng: STAR_RENDER_DISTANCE_KM };
  }

  /**
   * Creates a deep copy of this star.
   */
  clone(): Star {
    return new Star({
      id: this.id,
      name: this.name,
      ra: this.ra,
      dec: this.dec,
      bf: this.bf,
      h: this.h,
      pname: this.pname,
      vmag: this.vmag,
      constellation: this.constellation,
      colorTemp: this.colorTemp,
      hr: this.hr,
      flamsteed: this.flamsteed,
      bayer: this.bayer,
      active: this.active,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });
  }

  /**
   * Returns type-specific serialization data.
   */
  protected serializeSpecific(): Record<string, unknown> {
    return {
      ra: this.ra,
      dec: this.dec,
      bf: this.bf,
      h: this.h,
      pname: this.pname,
      vmag: this.vmag,
      constellation: this.constellation,
      colorTemp: this.colorTemp,
      hr: this.hr,
      flamsteed: this.flamsteed,
      bayer: this.bayer,
    };
  }
}
