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
import { Tle } from '../coordinate/Tle';
import { J2000 } from '../coordinate/J2000';
import { Sgp4 } from '../sgp4/sgp4';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { Kilometers, KilometersPerSecond, Radians } from '../types/types';
import { TAU } from '../utils/constants';

/** Cartesian vector in km (position) or km/s (velocity). */
export interface RvVector {
  x: number;
  y: number;
  z: number;
}

export interface Rv2TleOptions {
  /** Maximum fixed-point iterations before giving up. */
  maxIterations?: number;
  /** Position convergence tolerance at the epoch in km. */
  toleranceKm?: number;
}

export interface Rv2TleResult {
  tle1: string;
  tle2: string;
  /** Position error at the epoch between the fitted TLE and the input state, in km. */
  positionErrorKm: number;
  /** Number of fixed-point iterations performed. */
  iterations: number;
}

/** Smallest signed angular difference a - b, wrapped to (-pi, pi]. */
const angleDiff_ = (a: number, b: number): number => {
  let diff = (a - b) % TAU;

  if (diff > Math.PI) {
    diff -= TAU;
  } else if (diff < -Math.PI) {
    diff += TAU;
  }

  return diff;
};

const wrapTau_ = (angle: number): Radians => {
  let wrapped = angle % TAU;

  if (wrapped < 0) {
    wrapped += TAU;
  }

  return wrapped as Radians;
};

const toElements_ = (epoch: EpochUTC, position: RvVector, velocity: RvVector): ClassicalElements => new J2000(
  epoch,
  new Vector3D(position.x as Kilometers, position.y as Kilometers, position.z as Kilometers),
  new Vector3D(velocity.x as KilometersPerSecond, velocity.y as KilometersPerSecond, velocity.z as KilometersPerSecond),
).toClassicalElements();

/**
 * Fits SGP4 mean elements to an osculating TEME state vector at a single epoch.
 *
 * A TLE built directly from osculating elements places the satellite kilometers
 * away from the input state (SGP4 expects Brouwer mean elements), so this runs
 * the classic fixed-point correction instead: build a TLE from the current
 * element guess, propagate it at the epoch, and shift each element by the
 * difference between the target and achieved osculating elements until the
 * propagated position matches the input state.
 *
 * Position and velocity are treated as TEME (the SGP4 output frame), which is
 * the frame KeepTrack uses for satellite states.
 *
 * @param epoch Epoch of the state vector.
 * @param position TEME position in km.
 * @param velocity TEME velocity in km/s.
 * @param options Iteration limits.
 * @returns The fitted TLE with its residual epoch position error, or null when
 * the state cannot be represented (propagation failure on every iteration).
 */
export const rv2tle = (epoch: Date, position: RvVector, velocity: RvVector, options: Rv2TleOptions = {}): Rv2TleResult | null => {
  const maxIterations = options.maxIterations ?? 15;
  const toleranceKm = options.toleranceKm ?? 1e-4;

  const epochUtc = EpochUTC.fromDateTime(epoch);
  const target = toElements_(epochUtc, position, velocity);

  let mean = new ClassicalElements({
    epoch: epochUtc,
    semimajorAxis: target.semimajorAxis,
    eccentricity: target.eccentricity,
    inclination: target.inclination,
    rightAscension: target.rightAscension,
    argPerigee: target.argPerigee,
    trueAnomaly: target.trueAnomaly,
  });

  let best: Rv2TleResult | null = null;

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    let tle: Tle;
    let sv: ReturnType<typeof Sgp4.propagate>;

    try {
      tle = Tle.fromClassicalElements(mean);
      /*
       * Propagate relative to the TLE's PARSED epoch, not an assumed zero
       * offset: the written epoch is quantized to the TLE field precision, and
       * consumers compute tsince from what the TLE actually says. Comparing at
       * the input epoch makes the fit absorb any quantization.
       */
      const tsinceMin = (epoch.getTime() - tle.epoch.toDateTime().getTime()) / 60_000;

      sv = Sgp4.propagate(Sgp4.createSatrec(tle.line1, tle.line2), tsinceMin);
    } catch {
      return best;
    }

    if (!sv.position || typeof sv.position === 'boolean' || !sv.velocity || typeof sv.velocity === 'boolean') {
      return best;
    }

    const achievedPos = sv.position as RvVector;
    const achievedVel = sv.velocity as RvVector;
    const dx = achievedPos.x - position.x;
    const dy = achievedPos.y - position.y;
    const dz = achievedPos.z - position.z;
    const positionErrorKm = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (!best || positionErrorKm < best.positionErrorKm) {
      best = { tle1: tle.line1, tle2: tle.line2, positionErrorKm, iterations: iteration };
    }

    if (positionErrorKm < toleranceKm) {
      break;
    }

    const achieved = toElements_(epochUtc, achievedPos, achievedVel);

    mean = new ClassicalElements({
      epoch: epochUtc,
      semimajorAxis: (mean.semimajorAxis + (target.semimajorAxis - achieved.semimajorAxis)) as Kilometers,
      eccentricity: Math.min(Math.max(mean.eccentricity + (target.eccentricity - achieved.eccentricity), 0), 0.999),
      inclination: Math.min(Math.max(mean.inclination + angleDiff_(target.inclination, achieved.inclination), 0), Math.PI) as Radians,
      rightAscension: wrapTau_(mean.rightAscension + angleDiff_(target.rightAscension, achieved.rightAscension)),
      argPerigee: wrapTau_(mean.argPerigee + angleDiff_(target.argPerigee, achieved.argPerigee)),
      trueAnomaly: wrapTau_(mean.trueAnomaly + angleDiff_(target.trueAnomaly, achieved.trueAnomaly)),
    });
  }

  return best;
};
