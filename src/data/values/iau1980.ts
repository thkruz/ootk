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

import type { Iau1980Entry } from './Iau1980Data';

/**
 * The complete IAU 1980 nutation series (106 terms).
 *
 * Each row is `[l, l', F, D, Om, A, B, C, D']` where the first five are the integer multipliers
 * of the Delaunay arguments (Moon mean anomaly, Sun mean anomaly, Moon argument of latitude,
 * Moon mean elongation from the Sun, longitude of the Moon's ascending node) and
 *
 *   Delta-psi     = sum (A + B t) sin(arg)
 *   Delta-epsilon = sum (C + D' t) cos(arg)
 *
 * with coefficients in units of 0.0001 arcsec (0.1 mas) and t in Julian centuries of TT
 * since J2000.
 *
 * Source: Seidelmann, P. K. (1982), "1980 IAU Theory of Nutation: The Final Report of the
 * IAU Working Group on Nutation", Celestial Mechanics 27, 79-106; reproduced in the
 * Explanatory Supplement to the Astronomical Almanac (1992), Table 3.222.1, and Vallado,
 * Fundamentals of Astrodynamics and Applications, Table D-6. Row order and values are
 * transcribed from the SOFA/ERFA routine `nut80` (iau_NUT80 / eraNut80), which follows the
 * original Seidelmann ordering (largest term first, then grouped by period).
 */
export const iau1980: Iau1980Entry[] = [
  [0, 0, 0, 0, 1, -171996, -174.2, 92025, 8.9],
  [0, 0, 0, 0, 2, 2062, 0.2, -895, 0.5],
  [-2, 0, 2, 0, 1, 46, 0, -24, 0],
  [2, 0, -2, 0, 0, 11, 0, 0, 0],
  [-2, 0, 2, 0, 2, -3, 0, 1, 0],
  [1, -1, 0, -1, 0, -3, 0, 0, 0],
  [0, -2, 2, -2, 1, -2, 0, 1, 0],
  [2, 0, -2, 0, 1, 1, 0, 0, 0],
  [0, 0, 2, -2, 2, -13187, -1.6, 5736, -3.1],
  [0, 1, 0, 0, 0, 1426, -3.4, 54, -0.1],
  [0, 1, 2, -2, 2, -517, 1.2, 224, -0.6],
  [0, -1, 2, -2, 2, 217, -0.5, -95, 0.3],
  [0, 0, 2, -2, 1, 129, 0.1, -70, 0],
  [2, 0, 0, -2, 0, 48, 0, 1, 0],
  [0, 0, 2, -2, 0, -22, 0, 0, 0],
  [0, 2, 0, 0, 0, 17, -0.1, 0, 0],
  [0, 1, 0, 0, 1, -15, 0, 9, 0],
  [0, 2, 2, -2, 2, -16, 0.1, 7, 0],
  [0, -1, 0, 0, 1, -12, 0, 6, 0],
  [-2, 0, 0, 2, 1, -6, 0, 3, 0],
  [0, -1, 2, -2, 1, -5, 0, 3, 0],
  [2, 0, 0, -2, 1, 4, 0, -2, 0],
  [0, 1, 2, -2, 1, 4, 0, -2, 0],
  [1, 0, 0, -1, 0, -4, 0, 0, 0],
  [2, 1, 0, -2, 0, 1, 0, 0, 0],
  [0, 0, -2, 2, 1, 1, 0, 0, 0],
  [0, 1, -2, 2, 0, -1, 0, 0, 0],
  [0, 1, 0, 0, 2, 1, 0, 0, 0],
  [-1, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 1, 2, -2, 0, -1, 0, 0, 0],
  [0, 0, 2, 0, 2, -2274, -0.2, 977, -0.5],
  [1, 0, 0, 0, 0, 712, 0.1, -7, 0],
  [0, 0, 2, 0, 1, -386, -0.4, 200, 0],
  [1, 0, 2, 0, 2, -301, 0, 129, -0.1],
  [1, 0, 0, -2, 0, -158, 0, -1, 0],
  [-1, 0, 2, 0, 2, 123, 0, -53, 0],
  [0, 0, 0, 2, 0, 63, 0, -2, 0],
  [1, 0, 0, 0, 1, 63, 0.1, -33, 0],
  [-1, 0, 0, 0, 1, -58, -0.1, 32, 0],
  [-1, 0, 2, 2, 2, -59, 0, 26, 0],
  [1, 0, 2, 0, 1, -51, 0, 27, 0],
  [0, 0, 2, 2, 2, -38, 0, 16, 0],
  [2, 0, 0, 0, 0, 29, 0, -1, 0],
  [1, 0, 2, -2, 2, 29, 0, -12, 0],
  [2, 0, 2, 0, 2, -31, 0, 13, 0],
  [0, 0, 2, 0, 0, 26, 0, -1, 0],
  [-1, 0, 2, 0, 1, 21, 0, -10, 0],
  [-1, 0, 0, 2, 1, 16, 0, -8, 0],
  [1, 0, 0, -2, 1, -13, 0, 7, 0],
  [-1, 0, 2, 2, 1, -10, 0, 5, 0],
  [1, 1, 0, -2, 0, -7, 0, 0, 0],
  [0, 1, 2, 0, 2, 7, 0, -3, 0],
  [0, -1, 2, 0, 2, -7, 0, 3, 0],
  [1, 0, 2, 2, 2, -8, 0, 3, 0],
  [1, 0, 0, 2, 0, 6, 0, 0, 0],
  [2, 0, 2, -2, 2, 6, 0, -3, 0],
  [0, 0, 0, 2, 1, -6, 0, 3, 0],
  [0, 0, 2, 2, 1, -7, 0, 3, 0],
  [1, 0, 2, -2, 1, 6, 0, -3, 0],
  [0, 0, 0, -2, 1, -5, 0, 3, 0],
  [1, -1, 0, 0, 0, 5, 0, 0, 0],
  [2, 0, 2, 0, 1, -5, 0, 3, 0],
  [0, 1, 0, -2, 0, -4, 0, 0, 0],
  [1, 0, -2, 0, 0, 4, 0, 0, 0],
  [0, 0, 0, 1, 0, -4, 0, 0, 0],
  [1, 1, 0, 0, 0, -3, 0, 0, 0],
  [1, 0, 2, 0, 0, 3, 0, 0, 0],
  [1, -1, 2, 0, 2, -3, 0, 1, 0],
  [-1, -1, 2, 2, 2, -3, 0, 1, 0],
  [-2, 0, 0, 0, 1, -2, 0, 1, 0],
  [3, 0, 2, 0, 2, -3, 0, 1, 0],
  [0, -1, 2, 2, 2, -3, 0, 1, 0],
  [1, 1, 2, 0, 2, 2, 0, -1, 0],
  [-1, 0, 2, -2, 1, -2, 0, 1, 0],
  [2, 0, 0, 0, 1, 2, 0, -1, 0],
  [1, 0, 0, 0, 2, -2, 0, 1, 0],
  [3, 0, 0, 0, 0, 2, 0, 0, 0],
  [0, 0, 2, 1, 2, 2, 0, -1, 0],
  [-1, 0, 0, 0, 2, 1, 0, -1, 0],
  [1, 0, 0, -4, 0, -1, 0, 0, 0],
  [-2, 0, 2, 2, 2, 1, 0, -1, 0],
  [-1, 0, 2, 4, 2, -2, 0, 1, 0],
  [2, 0, 0, -4, 0, -1, 0, 0, 0],
  [1, 1, 2, -2, 2, 1, 0, -1, 0],
  [1, 0, 2, 2, 1, -1, 0, 1, 0],
  [-2, 0, 2, 4, 2, -1, 0, 1, 0],
  [-1, 0, 4, 0, 2, 1, 0, 0, 0],
  [1, -1, 0, -2, 0, 1, 0, 0, 0],
  [2, 0, 2, -2, 1, 1, 0, -1, 0],
  [2, 0, 2, 2, 2, -1, 0, 0, 0],
  [1, 0, 0, 2, 1, -1, 0, 0, 0],
  [0, 0, 4, -2, 2, 1, 0, 0, 0],
  [3, 0, 2, -2, 2, 1, 0, 0, 0],
  [1, 0, 2, -2, 0, -1, 0, 0, 0],
  [0, 1, 2, 0, 1, 1, 0, 0, 0],
  [-1, -1, 0, 2, 1, 1, 0, 0, 0],
  [0, 0, -2, 0, 1, -1, 0, 0, 0],
  [0, 0, 2, -1, 2, -1, 0, 0, 0],
  [0, 1, 0, 2, 0, -1, 0, 0, 0],
  [1, 0, -2, -2, 0, -1, 0, 0, 0],
  [0, -1, 2, 0, 1, -1, 0, 0, 0],
  [1, 1, 0, -2, 1, -1, 0, 0, 0],
  [1, 0, -2, 2, 0, -1, 0, 0, 0],
  [2, 0, 0, 2, 0, 1, 0, 0, 0],
  [0, 0, 2, 4, 2, -1, 0, 0, 0],
  [0, 1, 0, 1, 0, 1, 0, 0, 0],
];
