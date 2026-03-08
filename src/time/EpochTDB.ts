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
 * Represents an epoch in Barycentric Dynamical Time (TDB).
 *
 * TDB is the time scale used for solar system barycentric calculations. It
 * accounts for relativistic time dilation effects due to Earth's motion
 * around the Sun and its position in the solar system's gravitational field.
 *
 * ## Relationship to Other Time Scales
 * ```
 * TDB ≈ TT + 0.001658·sin(M) + 0.000014·sin(2M)
 * ```
 * Where M is the mean anomaly of Earth's orbit. The difference between TDB
 * and TT is periodic with amplitude of approximately ±1.6 milliseconds.
 *
 * ## When to Use EpochTDB
 * - **JPL planetary ephemerides**: DE430, DE440, etc. use TDB as their
 *   time argument
 * - **Solar system body positions**: Calculating positions of planets,
 *   moons, and asteroids
 * - **Interplanetary mission planning**: Trajectories involving multiple
 *   solar system bodies
 * - **Barycentric coordinate systems**: ICRF/BCRS calculations
 *
 * ## When NOT to Use EpochTDB
 * - For Earth-centered calculations (use EpochTT)
 * - For user-facing timestamps (use EpochUTC)
 * - For satellite orbit propagation around Earth (use EpochTT or EpochUTC)
 *
 * ## Creating Instances
 * EpochTDB is typically created by converting from EpochUTC:
 * ```typescript
 * const utc = EpochUTC.now();
 * const tdb = utc.toTDB();
 *
 * // Use TDB for querying planetary ephemerides
 * const sunPosition = solarSystem.getSunPosition(tdb);
 * const moonPosition = solarSystem.getMoonPosition(tdb);
 * ```
 *
 * ## Technical Note
 * The conversion from TT to TDB uses a simplified formula based on Earth's
 * mean anomaly. For sub-microsecond precision, more complex models from
 * IERS conventions may be required.
 *
 * @see EpochUTC - Primary time class, use toTDB() to convert
 * @see EpochTT - Geocentric time scale, TDB differs by ~1.6ms periodic
 */
export class EpochTDB extends Epoch { }
