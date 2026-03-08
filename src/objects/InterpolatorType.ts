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
 * Supported interpolator types for ephemeris satellites.
 *
 * Each type has different trade-offs:
 * - LAGRANGE: General purpose, good accuracy, moderate speed
 * - CHEBYSHEV: Compressed storage, very fast lookup, slightly reduced accuracy
 * - CUBIC_SPLINE: Fast and accurate, higher memory usage
 * - VERLET_BLEND: Physics-aware, highest accuracy, slowest
 */
export enum InterpolatorType {
  /** Lagrange polynomial interpolation (default) */
  LAGRANGE = 'lagrange',
  /** Chebyshev polynomial interpolation (compressed) */
  CHEBYSHEV = 'chebyshev',
  /** Cubic spline interpolation */
  CUBIC_SPLINE = 'cubic-spline',
  /** Verlet blend interpolation (physics-aware) */
  VERLET_BLEND = 'verlet-blend',
}

/** Default interpolator type for EphemerisSatellite */
export const DEFAULT_INTERPOLATOR = InterpolatorType.LAGRANGE;

/** Default Lagrange interpolation order */
export const DEFAULT_LAGRANGE_ORDER = 10;
