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
 * Represents an epoch in International Atomic Time (TAI).
 *
 * TAI is a continuous time scale maintained by atomic clocks worldwide. Unlike
 * UTC, TAI does **not** include leap seconds, making it ideal for applications
 * requiring uniform time intervals.
 *
 * ## Relationship to Other Time Scales
 * ```
 * TAI = UTC + leap_seconds
 * TT  = TAI + 32.184 seconds
 * ```
 *
 * As of 2024, TAI is ahead of UTC by 37 seconds. This offset increases
 * whenever a leap second is added to UTC (typically every few years).
 *
 * ## When to Use EpochTAI
 * - When you need continuous timekeeping without leap second discontinuities
 * - As an intermediate step when converting between UTC and TT/TDB
 * - For precise timing applications where uniform seconds are required
 * - When interfacing with systems that use atomic time
 *
 * ## When NOT to Use EpochTAI
 * - For user-facing timestamps (use EpochUTC instead)
 * - For TLE epoch parsing (TLEs use UTC)
 * - When civil time is expected
 *
 * ## Creating Instances
 * EpochTAI is typically created by converting from EpochUTC:
 * ```typescript
 * const utc = EpochUTC.now();
 * const tai = utc.toTAI();
 * ```
 *
 * @see EpochUTC - Primary time class, use toTAI() to convert
 * @see EpochTT - Terrestrial Time, derived from TAI + 32.184s
 */
export class EpochTAI extends Epoch { }
