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
 * Center body for ephemeris data.
 * Extends beyond Earth to support interplanetary missions.
 * Will be extended for AstronomyEngine integration in future.
 */
export enum CenterBody {
  EARTH = 'EARTH',
  MOON = 'MOON',
  SUN = 'SUN',
  MARS = 'MARS',
  MARS_BARYCENTER = 'MARS_BARYCENTER',
  JUPITER_BARYCENTER = 'JUPITER_BARYCENTER',
  SATURN_BARYCENTER = 'SATURN_BARYCENTER',
  // Extensible for Makemake, Io, etc. in future releases
}

/**
 * Gravitational parameters (km³/s²) for supported bodies.
 */
export const CenterBodyMu: Record<CenterBody, number> = {
  [CenterBody.EARTH]: 398600.4418,
  [CenterBody.MOON]: 4902.8,
  [CenterBody.SUN]: 132712440018,
  [CenterBody.MARS]: 42828.37,
  [CenterBody.MARS_BARYCENTER]: 42828.37,
  [CenterBody.JUPITER_BARYCENTER]: 126686534,
  [CenterBody.SATURN_BARYCENTER]: 37931187,
};

/**
 * Maps OEM CENTER_NAME strings to CenterBody enum.
 * Handles various string formats from CCSDS OEM files.
 * @param centerName - The CENTER_NAME value from OEM metadata
 * @returns The corresponding CenterBody enum value, defaults to EARTH
 */
export function parseCenterBody(centerName: string): CenterBody {
  const normalized = centerName.toUpperCase().trim().replace(/\s+/gu, '_');

  // Direct match
  if (normalized in CenterBody) {
    return CenterBody[normalized as keyof typeof CenterBody];
  }

  // Common aliases
  switch (normalized) {
    case 'EARTH':
    case 'GEOCENTRIC':
      return CenterBody.EARTH;
    case 'MOON':
    case 'LUNAR':
    case 'SELENOCENTRIC':
      return CenterBody.MOON;
    case 'SUN':
    case 'SOLAR':
    case 'HELIOCENTRIC':
      return CenterBody.SUN;
    case 'MARS':
    case 'MARS_BARYCENTER':
    case 'AREOCENTRIC':
      return CenterBody.MARS_BARYCENTER;
    case 'JUPITER':
    case 'JUPITER_BARYCENTER':
      return CenterBody.JUPITER_BARYCENTER;
    case 'SATURN':
    case 'SATURN_BARYCENTER':
      return CenterBody.SATURN_BARYCENTER;
    default:
      // Default to Earth for unknown center bodies
      return CenterBody.EARTH;
  }
}
