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

import { Antenna } from '../comm/Antenna';
import type { Decibels, SerializedAntenna } from '../comm/CommTypes';
import { ValidationError } from '../errors';
import type { Degrees } from '../types/types';

/** One point of an elevation gain table. */
export interface GnssElevationGain {
  /** Elevation above the local horizon in degrees, -90 to 90. */
  el: number;
  /** Antenna gain toward that elevation in dBic (RHCP), any azimuth. */
  gainDbic: number;
}

/** Parameters for {@link GnssAntenna}. */
export interface GnssAntennaParams {
  /**
   * Gain versus elevation in dBic. At least one point; points need not be sorted but elevations
   * must be unique. Between points the gain is linearly interpolated in dB; outside the table it
   * is held at the nearest end value.
   */
  elevationGainTable: readonly GnssElevationGain[];
}

/** Serialized form of a {@link GnssAntenna}. */
export interface SerializedGnssAntenna extends SerializedAntenna {
  /** Discriminator. */
  type: 'gnss';
  /** Gain versus elevation in dBic. */
  elevationGainTable: GnssElevationGain[];
}

/**
 * A GNSS receiving antenna whose gain depends on elevation only (azimuth independent), as for a
 * fixed-reception-pattern antenna (FRPA) on a horizontal mount. Gains are in dBic, the gain toward
 * a right-hand circularly polarized wave, which is the quantity the GNSS interface documents'
 * minimum received powers combine with (see {@link GnssSignal}).
 *
 * The base `gain` property is the peak of the table. The same pattern is applied to interferers,
 * evaluated at the interferer's elevation from the receiver. Polarization mismatch for a linearly
 * polarized jammer is a separate loss on the interferer.
 *
 * @example
 * ```typescript
 * // A patch antenna: 3 dB down at 5 degrees, 0 dB at 30 degrees, +4 dB at zenith (illustrative).
 * const antenna = new GnssAntenna({
 *   elevationGainTable: [
 *     { el: 0, gainDbic: -6 },
 *     { el: 5, gainDbic: -3 },
 *     { el: 30, gainDbic: 0 },
 *     { el: 90, gainDbic: 4 },
 *   ],
 * });
 * antenna.getGainToward(0 as Degrees, 15 as Degrees); // -1.5 dBic by interpolation
 * ```
 */
export class GnssAntenna extends Antenna {
  /** Gain versus elevation (dBic), sorted by increasing elevation. */
  readonly elevationGainTable: readonly GnssElevationGain[];

  constructor(params: GnssAntennaParams) {
    const table = params.elevationGainTable;

    if (table.length === 0) {
      throw new ValidationError('GnssAntenna needs at least one elevation gain point', 'elevationGainTable', table);
    }

    for (const p of table) {
      if (!Number.isFinite(p.el) || p.el < -90 || p.el > 90) {
        throw new ValidationError('Elevation must be between -90 and 90 degrees', 'el', p.el);
      }
      if (!Number.isFinite(p.gainDbic)) {
        throw new ValidationError('Gain must be finite', 'gainDbic', p.gainDbic);
      }
    }

    const sorted = table.map((p) => ({ el: p.el, gainDbic: p.gainDbic })).sort((a, b) => a.el - b.el);

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].el === sorted[i - 1].el) {
        throw new ValidationError('Elevation values must be unique', 'elevationGainTable', sorted[i].el);
      }
    }

    super({
      gain: Math.max(...sorted.map((p) => p.gainDbic)) as Decibels,
      beamwidth: 360,
      efficiency: 1,
    });
    this.elevationGainTable = sorted;
  }

  /**
   * A typical fixed-reception-pattern antenna pattern from the two anchor values Kaplan and
   * Hegarty give: about -3 dBic at the 5 degree elevation mask and +1.5 dBic at zenith (Understanding
   * GPS: Principles and Applications, 2nd ed., 2006, pp. 262 to 263). Kaplan states that between
   * these elevations the gain "tends to increase slightly" and gives no curve, so the straight line
   * in dB between the anchors is an assumption of this library, and gain below 5 degrees, including
   * below the horizon, is held at -3 dBic (a floor, not a Kaplan value; a real antenna rolls off
   * further, so low-elevation and below-horizon jammer power is overestimated). For anything else build a {@link GnssAntenna} from the
   * antenna's measured pattern.
   */
  static typicalFrpa(): GnssAntenna {
    return new GnssAntenna({
      elevationGainTable: [
        { el: 5, gainDbic: -3 },
        { el: 90, gainDbic: 1.5 },
      ],
    });
  }

  /**
   * Gain toward a direction. Azimuth is ignored.
   * @param _lookAz - Azimuth in degrees (unused).
   * @param lookEl - Elevation in degrees above the local horizon.
   * @returns Gain in dBic, linearly interpolated in dB from the table and clamped at its ends.
   */
  override getGainToward(_lookAz: Degrees, lookEl: Degrees): Decibels {
    const t = this.elevationGainTable;

    if (lookEl <= t[0].el) {
      return t[0].gainDbic as Decibels;
    }
    if (lookEl >= t[t.length - 1].el) {
      return t[t.length - 1].gainDbic as Decibels;
    }

    let i = 1;

    while (t[i].el < lookEl) {
      i++;
    }

    const lo = t[i - 1];
    const hi = t[i];
    const f = (lookEl - lo.el) / (hi.el - lo.el);

    return (lo.gainDbic + f * (hi.gainDbic - lo.gainDbic)) as Decibels;
  }

  override clone(): GnssAntenna {
    return new GnssAntenna({ elevationGainTable: this.elevationGainTable });
  }

  override serialize(): SerializedGnssAntenna {
    return {
      ...super.serialize(),
      type: 'gnss',
      elevationGainTable: this.elevationGainTable.map((p) => ({ ...p })),
    };
  }

  /**
   * Creates a GnssAntenna from serialized data.
   * @param data - Output of {@link GnssAntenna.serialize}.
   */
  static deserialize(data: SerializedGnssAntenna): GnssAntenna {
    return new GnssAntenna({ elevationGainTable: data.elevationGainTable });
  }
}
