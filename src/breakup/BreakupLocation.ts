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

import { ClassicalElements } from '../coordinate/ClassicalElements';
import type { Geodetic } from '../coordinate/Geodetic';
import type { J2000 } from '../coordinate/J2000';
import { Tle } from '../coordinate/Tle';
import type { EpochUTC } from '../time/EpochUTC';
import type { Kilometers, Radians } from '../types/types';
import { TAU } from '../utils/constants';
import { newtonM } from '../utils/functions';
import { type BreakupFragmentInput, normalizeFragment } from './BreakupFragments';

/** Where the parent was at the (estimated) breakup epoch. */
export interface BreakupLocation {
  /** The epoch the parent was propagated to. */
  epoch: EpochUTC;
  /** How the parent was propagated: SGP4 for TLE input, secular J2 mean elements otherwise. */
  propagator: 'sgp4' | 'secular-j2';
  /** J2000 (EME2000) state at `epoch`, km and km/s. */
  eci: J2000;
  /** Geodetic point under the parent at `epoch` (latitude and longitude in radians). */
  geodetic: Geodetic;
  latitudeDeg: number;
  longitudeDeg: number;
  /** Altitude above the WGS-84 ellipsoid, km. */
  altitudeKm: number;
}

const wrap2Pi_ = (x: number): number => ((x % TAU) + TAU) % TAU;

/**
 * Propagates the parent object to `epoch` and returns its inertial state and the geodetic point
 * under it: the ground-track point of the breakup.
 *
 * - TLE input (lines or a `Tle`): SGP4 (`Tle.propagate`), TEME rotated to J2000.
 * - `ClassicalElements` or plain mean elements: RAAN, argument of perigee and mean anomaly carried
 *   to `epoch` with the secular J2 rates, then converted with `ClassicalElements.toJ2000`. The
 *   elements are treated as J2000 elements. Plain elements need `meanAnomaly`.
 *
 * Both paths then use `J2000.toITRF` and `ITRF.toGeodetic`.
 * @param parent The parent object's element set (its last one before the event is best).
 * @param epoch The breakup epoch, typically `estimateBreakupEpoch(...).epoch`.
 * @returns The location, or null when the elements are unusable or propagation fails.
 */
export const breakupLocationAtEpoch = (parent: BreakupFragmentInput, epoch: EpochUTC): BreakupLocation | null => {
  let eci: J2000;
  let propagator: BreakupLocation['propagator'];

  try {
    if (parent instanceof Tle || (typeof (parent as Tle).line1 === 'string' && typeof (parent as Tle).line2 === 'string')) {
      const tle = parent instanceof Tle ? parent : new Tle((parent as Tle).line1, (parent as Tle).line2);

      eci = tle.propagate(epoch).toJ2000();
      propagator = 'sgp4';
    } else {
      const f = normalizeFragment(parent);

      if (!f || !Number.isFinite(f.meanAnomaly)) {
        return null;
      }
      const dt = epoch.posix - f.epochPosix;
      const m = wrap2Pi_(f.meanAnomaly + f.meanAnomalyDot * dt);
      const elements = new ClassicalElements({
        epoch,
        semimajorAxis: f.semimajorAxis as Kilometers,
        eccentricity: f.eccentricity,
        inclination: f.inclination as Radians,
        rightAscension: wrap2Pi_(f.rightAscension + f.raanDot * dt) as Radians,
        argPerigee: wrap2Pi_(f.argPerigee + f.argPerigeeDot * dt) as Radians,
        trueAnomaly: wrap2Pi_(newtonM(f.eccentricity, m).nu) as Radians,
        mu: f.mu,
      });

      eci = elements.toJ2000();
      propagator = 'secular-j2';
    }
  } catch {
    return null;
  }

  const geodetic = eci.toITRF().toGeodetic();

  return {
    epoch,
    propagator,
    eci,
    geodetic,
    latitudeDeg: geodetic.latDeg,
    longitudeDeg: geodetic.lonDeg,
    altitudeKm: geodetic.alt,
  };
};
