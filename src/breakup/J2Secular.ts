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

import { Earth } from '../body/Earth';

/**
 * Secular (orbit-averaged) J2 rates of the right ascension of the ascending node, the argument of
 * perigee and the mean anomaly (Vallado, Fundamentals of Astrodynamics and Applications, 4th ed.,
 * eqs. 9-41 to 9-43):
 *
 *   p = a (1 - e^2), K = J2 (Re / p)^2
 *   RAAN-dot  = -3/2 n K cos i
 *   argPe-dot =  3/4 n K (5 cos^2 i - 1)
 *   M-dot     =  n + 3/4 n K sqrt(1 - e^2) (3 cos^2 i - 1)
 *
 * The same expressions are used inline by `RepeatGroundTrack` and by
 * `ClassicalElements.nodalPrecessionRate`; this helper exposes all three rates for one element set.
 */
export interface J2SecularRates {
  /** Unperturbed (two-body) mean motion n, rad/s. */
  meanMotion: number;
  /** Secular RAAN rate, rad/s. */
  raanDot: number;
  /** Secular argument-of-perigee rate, rad/s. */
  argPerigeeDot: number;
  /** Total secular mean-anomaly rate (n plus the J2 correction), rad/s. */
  meanAnomalyDot: number;
}

/**
 * Secular J2 rates from a semimajor axis, eccentricity and inclination.
 * @param semimajorAxis Semimajor axis, km.
 * @param eccentricity Eccentricity, 0 <= e < 1.
 * @param inclination Inclination, radians.
 * @param mu Gravitational parameter, km^3/s^2. Defaults to {@link Earth.mu}; pass `Tle.WGS72_MU`
 *   when the semimajor axis came from a TLE mean motion so that n round-trips exactly.
 * @returns The rates in rad/s. Every field is NaN for a non-elliptic or non-finite input.
 */
export const j2SecularRates = (semimajorAxis: number, eccentricity: number, inclination: number, mu: number = Earth.mu): J2SecularRates => {
  if (!(semimajorAxis > 0) || !(eccentricity >= 0 && eccentricity < 1) || !Number.isFinite(inclination)) {
    return { meanMotion: Number.NaN, raanDot: Number.NaN, argPerigeeDot: Number.NaN, meanAnomalyDot: Number.NaN };
  }

  const n = Math.sqrt(mu / semimajorAxis ** 3);
  const e2 = eccentricity * eccentricity;
  const p = semimajorAxis * (1 - e2);
  const k = Earth.j2 * (Earth.radiusEquator / p) ** 2;
  const cosI = Math.cos(inclination);
  const cos2I = cosI * cosI;

  return {
    meanMotion: n,
    raanDot: -1.5 * n * k * cosI,
    argPerigeeDot: 0.75 * n * k * (5 * cos2I - 1),
    meanAnomalyDot: n + 0.75 * n * k * Math.sqrt(1 - e2) * (3 * cos2I - 1),
  };
};
