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

import { Epoch } from './Epoch';

/**
 * Represents an epoch in Terrestrial Time (TT).
 *
 * Terrestrial Time is the modern successor to Ephemeris Time (ET) and is the
 * primary time scale used for geocentric (Earth-centered) astronomical
 * calculations. It provides a uniform time scale tied to the Earth's geoid.
 *
 * ## Relationship to Other Time Scales
 * ```
 * TT = TAI + 32.184 seconds
 * TT = UTC + leap_seconds + 32.184 seconds
 * ```
 *
 * The 32.184 second offset is a fixed constant that was chosen to maintain
 * continuity with Ephemeris Time when TT was introduced in 1991.
 *
 * ## When to Use EpochTT
 * - **Earth-centered force models**: Precession, nutation, and polar motion
 *   calculations typically require TT
 * - **Astronomical almanacs**: Most published ephemerides for Earth-based
 *   observations use TT
 * - **High-precision Earth orientation**: IERS Earth Orientation Parameters
 *   are referenced to TT
 * - **Satellite orbit propagation**: When using force models that reference
 *   Earth's orientation
 *
 * ## When NOT to Use EpochTT
 * - For user-facing timestamps (use EpochUTC)
 * - For solar system barycentric calculations (use EpochTDB)
 * - For GPS applications (use EpochGPS)
 *
 * ## Creating Instances
 * EpochTT is typically created by converting from EpochUTC:
 * ```typescript
 * const utc = EpochUTC.now();
 * const tt = utc.toTT();
 *
 * // TT is used internally for Julian centuries calculations
 * const julianCenturies = tt.toJulianCenturies();
 * ```
 *
 * ## J2000.0 Epoch
 * The standard astronomical epoch J2000.0 (January 1, 2000, 12:00:00 TT) is
 * defined in Terrestrial Time. This is the reference point for many
 * astronomical coordinate systems and ephemerides.
 *
 * @see EpochUTC - Primary time class, use toTT() to convert
 * @see EpochTAI - TAI + 32.184s = TT
 * @see EpochTDB - For solar system barycentric calculations
 */
export class EpochTT extends Epoch { }
