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

/**
 * Classification of celestial bodies in the solar system.
 */
export enum CelestialBodyType {
  /** The Sun - center of the solar system */
  STAR = 'star',
  /** Mercury, Venus, Earth, Mars */
  TERRESTRIAL_PLANET = 'terrestrial_planet',
  /** Jupiter, Saturn */
  GAS_GIANT = 'gas_giant',
  /** Uranus, Neptune */
  ICE_GIANT = 'ice_giant',
  /** Pluto, Ceres, Eris, Makemake, Haumea */
  DWARF_PLANET = 'dwarf_planet',
  /** Natural satellites (Earth's Moon, Jupiter's moons, etc.) */
  MOON = 'moon',
  /** Minor planets, NEOs */
  ASTEROID = 'asteroid',
  /** Periodic and non-periodic comets */
  COMET = 'comet',
}

/**
 * Maps astronomy-engine Body enum to CelestialBodyType.
 */
export const bodyTypeLookup: Record<string, CelestialBodyType> = {
  Sun: CelestialBodyType.STAR,
  Moon: CelestialBodyType.MOON,
  Mercury: CelestialBodyType.TERRESTRIAL_PLANET,
  Venus: CelestialBodyType.TERRESTRIAL_PLANET,
  Earth: CelestialBodyType.TERRESTRIAL_PLANET,
  Mars: CelestialBodyType.TERRESTRIAL_PLANET,
  Jupiter: CelestialBodyType.GAS_GIANT,
  Saturn: CelestialBodyType.GAS_GIANT,
  Uranus: CelestialBodyType.ICE_GIANT,
  Neptune: CelestialBodyType.ICE_GIANT,
  Pluto: CelestialBodyType.DWARF_PLANET,
};
