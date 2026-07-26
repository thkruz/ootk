/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
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

import { SensorType } from '../enums/SensorType';
import { ObservationOptical } from '../observation/ObservationOptical';
import { RadecTopocentric } from '../observation/RadecTopocentric';
import type { SpaceObject } from '../objects/SpaceObject';
import { Sensor, SensorParams } from './Sensor';

/**
 * Parameters for constructing a TtcAntenna.
 */
export interface TtcAntennaParams extends SensorParams {
  /** Antenna dish diameter in meters */
  antennaDiameter?: number;
  /** Antenna gain in dB */
  antennaGain?: number;
  /** Whether the station supports two-way ranging */
  hasRanging?: boolean;
  /** Whether the station can uplink commands (vs receive-only) */
  hasUplink?: boolean;
}

/**
 * Telemetry, tracking, and command (TT&C) antenna.
 *
 * A steerable dish used to communicate with cooperative spacecraft. Unlike
 * radars and telescopes, a TT&C antenna cannot detect non-cooperative
 * objects; its "observations" come from tracking a transponding target
 * (angles from autotrack, range/range-rate from two-way ranging and
 * doppler). Range is limited by the link budget rather than a radar
 * equation, so deep space networks can track targets millions of
 * kilometers away.
 *
 * @example
 * ```typescript
 * const dss14 = new TtcAntenna({
 *   id: 'dss-14',
 *   name: 'Goldstone 70m',
 *   sensorType: SensorType.TT_C_ANTENNA,
 *   antennaDiameter: 70,
 *   hasRanging: true,
 *   hasUplink: true,
 *   fieldOfView: {
 *     minRange: 0 as Kilometers,
 *     maxRange: 1e9 as Kilometers,
 *     minAzimuth: 0 as Degrees,
 *     maxAzimuth: 360 as Degrees,
 *     minElevation: 6 as Degrees,
 *     maxElevation: 90 as Degrees,
 *   },
 * });
 * ```
 */
export class TtcAntenna extends Sensor {
  /** Antenna dish diameter in meters */
  antennaDiameter?: number;
  /** Antenna gain in dB */
  antennaGain?: number;
  /** Whether the station supports two-way ranging */
  hasRanging: boolean;
  /** Whether the station can uplink commands */
  hasUplink: boolean;

  constructor(params: TtcAntennaParams) {
    const paramsWithType = {
      ...params,
      sensorType: SensorType.TT_C_ANTENNA,
    };

    super(paramsWithType);

    this.antennaDiameter = params.antennaDiameter;
    this.antennaGain = params.antennaGain;
    this.hasRanging = params.hasRanging ?? true;
    this.hasUplink = params.hasUplink ?? true;
  }

  /**
   * Creates an angle observation (Ra/Dec) of a cooperative target.
   * Angles come from antenna autotrack while locked to the target's downlink.
   * @param target - The space object to observe
   * @param date - Time of observation (defaults to now)
   * @returns ObservationOptical or null if target not in FOV
   */
  observe(target: SpaceObject, date: Date = new Date()): ObservationOptical | null {
    if (!this.canObserve(target, date)) {
      return null;
    }

    const sensorJ2000 = this.getJ2000(date);
    const targetJ2000 = target.toJ2000(date);

    const radec = RadecTopocentric.fromStateVector(targetJ2000, sensorJ2000);

    return new ObservationOptical(sensorJ2000, radec);
  }

  protected override serializeSpecific(): Record<string, unknown> {
    return {
      antennaDiameter: this.antennaDiameter,
      antennaGain: this.antennaGain,
      hasRanging: this.hasRanging,
      hasUplink: this.hasUplink,
    };
  }

  /**
   * Creates a deep copy of this TT&C antenna.
   * The cloned sensor will not have a parent assigned.
   * @returns A new TtcAntenna instance with the same properties
   */
  override clone(): TtcAntenna {
    return new TtcAntenna({
      id: this.id,
      name: this.name,
      sensorType: this.sensorType,
      fieldOfView: this.fieldOfView.serialize(),
      antennaDiameter: this.antennaDiameter,
      antennaGain: this.antennaGain,
      hasRanging: this.hasRanging,
      hasUplink: this.hasUplink,
      shortName: this.shortName,
      system: this.system,
      country: this.country,
      operator: this.operator,
      dwellTime: this.dwellTime,
      freqBand: this.freqBand,
      isVolumetric: this.isVolumetric,
      url: this.url,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });
  }
}
