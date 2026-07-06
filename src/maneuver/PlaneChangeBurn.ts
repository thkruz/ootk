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
import { Kilometers, Radians, Seconds } from '../types/types';
import { EpochUTC } from '../time/EpochUTC';
import { clamp, matchHalfPlane } from '../utils/functions';

const TAU = 2 * Math.PI;

/** Result of a plane change burn computation. */
export interface PlaneChangeBurnResult {
  /** Delta-V magnitude in km/s for the plane change. */
  deltaV: number;
  /** Epoch at which the burn occurs. */
  burnEpoch: EpochUTC;
  /** Classical elements of the orbit after the burn. */
  postBurnElements: ClassicalElements;
  /** Which node the burn occurs at. */
  nodeType: 'ascending' | 'descending';
}

/**
 * Computes an impulsive inclination-change (plane change) maneuver.
 *
 * A pure plane change rotates the orbital plane around the line of nodes.
 * The most fuel-efficient location is at a node crossing, where the velocity
 * vector lies in the equatorial plane and the required rotation is minimized.
 *
 * Delta-v formula: Δv = 2 · v · sin(|Δi| / 2)
 */
export class PlaneChangeBurn {
  /**
   * Compute the delta-v for a pure inclination plane change at a node.
   *
   * @param velocityAtNode Orbital velocity magnitude at the node (km/s).
   * @param deltaIncRad Inclination change in radians (can be negative).
   * @returns Delta-v in km/s.
   */
  static computeDeltaV(velocityAtNode: number, deltaIncRad: number): number {
    return 2 * velocityAtNode * Math.abs(Math.sin(deltaIncRad / 2));
  }

  /**
   * Compute the time (seconds) from the current true anomaly to the next
   * ascending and descending node crossings.
   *
   * At an ascending node: argPerigee + trueAnomaly = 0 (mod 2π)
   * At a descending node: argPerigee + trueAnomaly = π (mod 2π)
   *
   * @param elements Classical orbital elements.
   * @returns Time in seconds to the next ascending and descending nodes.
   */
  static timeToNodes(elements: ClassicalElements): { ascending: number; descending: number } {
    const e = elements.eccentricity;
    const n = elements.meanMotion; // rad/s
    const w = elements.argPerigee;
    const v = elements.trueAnomaly;

    // True anomaly at ascending node: v_an = -w (mod 2π) = (2π - w)
    const vAscending = ((TAU - w) % TAU) as Radians;
    // True anomaly at descending node: v_dn = π - w (mod 2π)
    const vDescending = ((Math.PI - w + TAU) % TAU) as Radians;

    const tAscending = PlaneChangeBurn.timeFromTrueAnomaly_(v, vAscending, e, n);
    const tDescending = PlaneChangeBurn.timeFromTrueAnomaly_(v, vDescending, e, n);

    return { ascending: tAscending, descending: tDescending };
  }

  /**
   * Compute the full plane change maneuver.
   *
   * @param elements Pre-burn classical elements.
   * @param targetInclinationRad Desired inclination after the burn (radians).
   * @param burnDelayOrbits Number of complete orbits to coast before the burn (default 0).
   * @param preferredNode Which node to burn at ('ascending', 'descending', or 'nearest').
   * @returns PlaneChangeBurnResult with burn epoch, delta-v, and post-burn elements.
   */
  static compute(
    elements: ClassicalElements,
    targetInclinationRad: number,
    burnDelayOrbits = 0,
    preferredNode: 'ascending' | 'descending' | 'nearest' = 'nearest',
  ): PlaneChangeBurnResult {
    const { ascending, descending } = PlaneChangeBurn.timeToNodes(elements);
    const periodSec = elements.period * 60; // period is in Minutes

    // Determine which node to use
    let timeToBurn: number;
    let nodeType: 'ascending' | 'descending';

    if (preferredNode === 'ascending') {
      timeToBurn = ascending;
      nodeType = 'ascending';
    } else if (preferredNode === 'descending') {
      timeToBurn = descending;
      nodeType = 'descending';
      // 'nearest' — pick whichever node comes first
    } else if (ascending <= descending) {
      timeToBurn = ascending;
      nodeType = 'ascending';
    } else {
      timeToBurn = descending;
      nodeType = 'descending';
    }

    // Add delay orbits
    timeToBurn += burnDelayOrbits * periodSec;

    const burnEpoch = elements.epoch.roll(timeToBurn as Seconds);

    // Propagate to the burn epoch to get the true anomaly at the node
    const elementsAtBurn = elements.propagate(burnEpoch);

    // Velocity magnitude at the burn point
    const r = elementsAtBurn.semimajorAxis * (1 - elementsAtBurn.eccentricity ** 2) /
      (1 + elementsAtBurn.eccentricity * Math.cos(elementsAtBurn.trueAnomaly));
    const vMag = Math.sqrt(elements.mu * (2 / r - 1 / elements.semimajorAxis));

    const deltaInc = targetInclinationRad - elements.inclination;
    const deltaV = PlaneChangeBurn.computeDeltaV(vMag, deltaInc);

    // Post-burn elements: same orbit shape, new inclination
    // At an ascending node, the RAAN stays the same and only inclination changes.
    // At a descending node, the geometry is symmetric.
    const postBurnElements = new ClassicalElements({
      epoch: burnEpoch,
      semimajorAxis: elementsAtBurn.semimajorAxis,
      eccentricity: elementsAtBurn.eccentricity,
      inclination: targetInclinationRad as Radians,
      rightAscension: elementsAtBurn.rightAscension,
      argPerigee: elementsAtBurn.argPerigee,
      trueAnomaly: elementsAtBurn.trueAnomaly,
      mu: elementsAtBurn.mu,
    });

    return {
      deltaV,
      burnEpoch,
      postBurnElements,
      nodeType,
    };
  }

  /**
   * Compute the time (seconds) to travel from true anomaly v1 to v2
   * in a Keplerian orbit with the given eccentricity and mean motion.
   * Always returns a positive value (forward in time).
   */
  private static timeFromTrueAnomaly_(v1: Radians, v2: Radians, e: number, n: number): number {
    // Convert both true anomalies to mean anomalies
    const ma1 = PlaneChangeBurn.trueToMeanAnomaly_(v1, e);
    const ma2 = PlaneChangeBurn.trueToMeanAnomaly_(v2, e);

    // Mean anomaly difference (always positive, forward in time)
    let deltaMa = ma2 - ma1;

    if (deltaMa < 0) {
      deltaMa += TAU;
    }
    // If delta is essentially zero, it means we're already at the node
    // and need a full orbit
    if (deltaMa < 1e-10) {
      deltaMa = TAU;
    }

    return deltaMa / n;
  }

  /**
   * Convert true anomaly to mean anomaly.
   */
  private static trueToMeanAnomaly_(v: Radians, e: number): number {
    const cosV = Math.cos(v);
    let ea = Math.acos(clamp((e + cosV) / (1 + e * cosV), -1, 1));

    ea = matchHalfPlane(ea, v);
    let ma = ea - e * Math.sin(ea);

    ma = matchHalfPlane(ma, ea);

    return ma;
  }

  /**
   * Compute the velocity magnitude at a given true anomaly in a Keplerian orbit.
   *
   * @param semimajorAxis Semi-major axis in km.
   * @param eccentricity Orbital eccentricity.
   * @param trueAnomaly True anomaly in radians.
   * @param mu Gravitational parameter (km³/s²).
   * @returns Velocity magnitude in km/s.
   */
  static velocityAtTrueAnomaly(semimajorAxis: Kilometers, eccentricity: number, trueAnomaly: Radians, mu: number): number {
    const r = semimajorAxis * (1 - eccentricity ** 2) / (1 + eccentricity * Math.cos(trueAnomaly));

    return Math.sqrt(mu * (2 / r - 1 / semimajorAxis));
  }
}
