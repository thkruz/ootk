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

// Core Earth constants (unchanged)
export { Earth } from './Earth';

// Celestial body types
export { CelestialBodyType, bodyTypeLookup } from './CelestialBodyType';

// Celestial body base class
export { CelestialBody } from './CelestialBody';
export type { CelestialBodyParams, RiseSetTimes } from './CelestialBody';

// Sun
export { Sun, SunBody } from './SunBody';
export type { SunTime } from './SunBody';

// Moon
export { Moon, MoonBody } from './MoonBody';
export type { MoonPhaseInfo, MoonTimes, LibrationData } from './MoonBody';

// Planets
export {
  PlanetBody,
  Mercury,
  Venus,
  Mars,
  Jupiter,
  Saturn,
  Uranus,
  Neptune,
  Pluto,
} from './PlanetBody';

// Ephemeris-based bodies
export { EphemerisBody } from './EphemerisBody';
export type { EphemerisDataPoint, EphemerisBodyParams, EphemerisInterpolationType } from './EphemerisBody';

// Solar system registry
export { SolarSystem } from './SolarSystem';

// Astronomical angles
export type { NutationAngles } from './NutationAngles';
export type { PrecessionAngles } from './PrecessionAngles';
