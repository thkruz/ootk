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

import {
  angularDiameter,
  AngularDiameterMethod,
  asec2rad,
  DataHandler,
  DEG2RAD,
  earthGravityParam,
  EpochUTC,
  evalPoly,
  Kilometers,
  RAD2DEG,
  Radians,
  RadiansPerSecond,
  secondsPerDay,
  secondsPerSiderealDay,
  TAU,
  ttasec2rad,
  Vector3D,
} from '../main.js';
import { NutationAngles } from './NutationAngles.js';
import { PrecessionAngles } from './PrecessionAngles.js';

// / Earth metrics and operations.
export class Earth {
  private constructor() {
    // disable constructor
  }

  // / Earth gravitational parameter _(km²/s³)_.
  static readonly mu: number = earthGravityParam;

  // / Earth equatorial radius.
  static readonly radiusEquator = 6378.1363 as Kilometers;

  // / Earth coefficient of flattening _(unitless)_.
  static readonly flattening: number = 1.0 / 298.257223563;

  // / Earth polar radius.
  static readonly radiusPolar = (Earth.radiusEquator * (1.0 - Earth.flattening)) as Kilometers;

  // / Earth mean radius.
  static readonly radiusMean = ((2.0 * Earth.radiusEquator + Earth.radiusPolar) / 3.0) as Kilometers;

  // / Earth eccentricity squared _(unitless)_.
  static readonly eccentricitySquared: number = Earth.flattening * (2.0 - Earth.flattening);

  // / Earth J2 effect coefficient _(unitless)_.
  static readonly j2: number = 1.08262668355315e-3;

  // / Earth J3 effect coefficient _(unitless)_.
  static readonly j3: number = -2.53265648533224e-6;

  // / Earth J4 effect coefficient _(unitless)_.
  static readonly j4: number = -1.619621591367e-6;

  // / Earth J5 effect coefficient _(unitless)_.
  static readonly j5: number = -2.27296082868698e-7;

  // / Earth J6 effect coefficient _(unitless)_.
  static readonly j6: number = 5.40681239107085e-7;

  // / Earth rotation vector _(rad/s)_.
  static readonly rotation = new Vector3D<RadiansPerSecond>(
    0 as RadiansPerSecond,
    0 as RadiansPerSecond,
    7.292115146706979e-5 as RadiansPerSecond,
  );

  // / Calculate mean motion _(rad/s)_ from a given [semimajorAxis] _(km)_.
  static smaToMeanMotion(semimajorAxis: Kilometers): RadiansPerSecond {
    return Math.sqrt(Earth.mu / (semimajorAxis * semimajorAxis * semimajorAxis)) as RadiansPerSecond;
  }

  /**
   * Converts revolutions per day to semi-major axis.
   * @param rpd - The number of revolutions per day.
   * @returns The semi-major axis value.
   */
  static revsPerDayToSma(rpd: number): number {
    return Earth.mu ** (1 / 3) / ((TAU * rpd) / secondsPerDay) ** (2 / 3);
  }

  // / Calculate Earth [PrecessionAngles] at a given UTC [epoch].
  static precession(epoch: EpochUTC): PrecessionAngles {
    const t = epoch.toTT().toJulianCenturies();
    const zeta = evalPoly(t, Earth.zetaPoly_);
    const theta = evalPoly(t, Earth.thetaPoly_);
    const zed = evalPoly(t, Earth.zedPoly_);

    return { zeta: zeta as Radians, theta: theta as Radians, zed: zed as Radians };
  }

  // / Calculate Earth [NutationAngles] for a given UTC [epoch].
  static nutation(epoch: EpochUTC): NutationAngles {
    const t = epoch.toTT().toJulianCenturies();
    const moonAnom = evalPoly(t, Earth.moonAnomPoly_);
    const sunAnom = evalPoly(t, Earth.sunAnomPoly_);
    const moonLat = evalPoly(t, Earth.moonLatPoly_);
    const sunElong = evalPoly(t, Earth.sunElongPoly_);
    const moonRaan = evalPoly(t, Earth.moonRaanPoly_);
    let deltaPsi = 0.0;
    let deltaEpsilon = 0.0;
    const dh = DataHandler.getInstance();

    for (let i = 0; i < 4; i++) {
      const [a1, a2, a3, a4, a5, ai, bi, ci, di] = dh.getIau1980Coeffs(i);
      const arg = a1 * moonAnom + a2 * sunAnom + a3 * moonLat + a4 * sunElong + a5 * moonRaan;
      const sinC = ai + bi * t;
      const cosC = ci + di * t;

      deltaPsi += sinC * Math.sin(arg);
      deltaEpsilon += cosC * Math.cos(arg);
    }
    deltaPsi *= ttasec2rad;
    deltaEpsilon *= ttasec2rad;
    const meanEpsilon = evalPoly(t, Earth.meanEpsilonPoly_);
    const epsilon = meanEpsilon + deltaEpsilon;
    const eqEq =
      deltaPsi * Math.cos(meanEpsilon) +
      0.00264 * asec2rad * Math.sin(moonRaan) +
      0.000063 * asec2rad * Math.sin(2.0 * moonRaan);
    const gast = epoch.gmstAngle() + eqEq;

    return {
      dPsi: deltaPsi as Radians,
      dEps: deltaEpsilon as Radians,
      mEps: meanEpsilon as Radians,
      eps: epsilon as Radians,
      eqEq: eqEq as Radians,
      gast: gast as Radians,
    };
  }

  // / Convert a [semimajorAxis] _(km)_ to an eastward drift rate _(rad/day)_.
  static smaToDrift(semimajorAxis: number): number {
    const t = (TAU * Math.sqrt(semimajorAxis ** 3 / Earth.mu)) / secondsPerSiderealDay;

    return (1.0 - t) * TAU;
  }

  // / Convert a [semimajorAxis] _(km)_ to an eastward drift rate _(°/day)_.
  static smaToDriftDegrees(semimajorAxis: number): number {
    return Earth.smaToDrift(semimajorAxis) * RAD2DEG;
  }

  // / Convert an eastward [driftRate] _(rad/day)_ to a semimajor-axis _(km)_.
  static driftToSemimajorAxis(driftRate: number): number {
    const t = (-driftRate / TAU + 1) * secondsPerSiderealDay;

    return ((Earth.mu * t * t) / (4 * Math.PI * Math.PI)) ** (1 / 3);
  }

  // / Convert an eastward [driftRate] _(°/day)_ to a semimajor-axis _(km)_.
  static driftDegreesToSma(driftRate: number): number {
    return Earth.driftToSemimajorAxis(DEG2RAD * driftRate);
  }

  /**
   * Calculates the diameter of the Earth based on the satellite position.
   * @param satPos The position of the satellite.
   * @returns The diameter of the Earth.
   */
  static diameter(satPos: Vector3D): number {
    return angularDiameter(Earth.radiusEquator * 2, satPos.magnitude(), AngularDiameterMethod.Sphere);
  }

  // / Earth precession `zeta` polynomial coefficients.
  private static zetaPoly_: Float64Array = Float64Array.from([
    0.017998 * asec2rad,
    0.30188 * asec2rad,
    2306.2181 * asec2rad,
    0.0,
  ]);

  // / Earth precession `theta` polynomial coefficients.
  private static thetaPoly_: Float64Array = Float64Array.from([
    -0.041833 * asec2rad,
    -0.42665 * asec2rad,
    2004.3109 * asec2rad,
    0.0,
  ]);

  // / Earth precession `zed` polynomial coefficients.
  private static zedPoly_: Float64Array = Float64Array.from([
    0.018203 * asec2rad,
    1.09468 * asec2rad,
    2306.2181 * asec2rad,
    0,
  ]);

  private static moonAnomPoly_: Float64Array = Float64Array.from([
    1.4343e-5 * DEG2RAD,
    0.0088553 * DEG2RAD,
    (1325.0 * 360.0 + 198.8675605) * DEG2RAD,
    134.96340251 * DEG2RAD,
  ]);

  // / Earth nutation Sun anomaly polynomial coefficients.
  private static sunAnomPoly_: Float64Array = Float64Array.from([
    3.8e-8 * DEG2RAD,
    -0.0001537 * DEG2RAD,
    (99.0 * 360.0 + 359.0502911) * DEG2RAD,
    357.52910918 * DEG2RAD,
  ]);

  // / Earth nutation Moon latitude polynomial coefficients.
  private static moonLatPoly_: Float64Array = Float64Array.from([
    -2.88e-7 * DEG2RAD,
    -0.003542 * DEG2RAD,
    (1342.0 * 360.0 + 82.0174577) * DEG2RAD,
    93.27209062 * DEG2RAD,
  ]);

  // / Earth nutation Sun elongation polynomial coefficients.
  private static sunElongPoly_: Float64Array = Float64Array.from([
    1.831e-6 * DEG2RAD,
    -0.0017696 * DEG2RAD,
    (1236.0 * 360.0 + 307.1114469) * DEG2RAD,
    297.85019547 * DEG2RAD,
  ]);

  // / Earth nutation Moon right-ascension polynomial coefficients.
  private static moonRaanPoly_: Float64Array = Float64Array.from([
    2.139e-6 * DEG2RAD,
    0.0020756 * DEG2RAD,
    -(5.0 * 360.0 + 134.1361851) * DEG2RAD,
    125.04455501 * DEG2RAD,
  ]);

  // / Earth nutation mean epsilon polynomial coefficients.
  private static meanEpsilonPoly_: Float64Array = Float64Array.from([
    0.001813 * asec2rad,
    -0.00059 * asec2rad,
    -46.815 * asec2rad,
    84381.448 * asec2rad,
  ]);
}
