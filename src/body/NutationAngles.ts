/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
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

import { Radians } from '../main.js';

/** Represents the nutation angles. */
export type NutationAngles = {
  /** The nutation in longitude (Δψ) in radians. */
  dPsi: Radians;
  /** The nutation in obliquity (Δε) in radians. */
  dEps: Radians;
  /** The mean obliquity of the ecliptic (ε₀) in radians. */
  mEps: Radians;
  /** The true obliquity of the ecliptic (ε) in radians. */
  eps: Radians;
  /** The equation of the equinoxes (ΔΔt) in radians. */
  eqEq: Radians;
  /** The Greenwich Apparent Sidereal Time (GAST) in radians. */
  gast: Radians;
};
