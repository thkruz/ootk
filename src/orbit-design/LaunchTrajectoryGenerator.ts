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
import { ClassicalElements } from '../coordinate/ClassicalElements';
import { J2000 } from '../coordinate/J2000';
import { Thrust } from '../force/Thrust';
import { Kilometers, KilometersPerSecond, MetersPerSecond, Seconds } from '../types/types';
import { PlaneChangeBurn } from '../maneuver/PlaneChangeBurn';
import { Vector3D } from '../operations/Vector3D';
import { KeplerPropagator } from '../propagator/KeplerPropagator';
import { EpochUTC } from '../time/EpochUTC';
import { DEG2RAD, RAD2DEG } from '../utils/constants';

/** Configuration for generating a launch trajectory. */
export interface LaunchTrajectoryConfig {
  /** Launch site latitude in degrees. */
  launchLatDeg: number;
  /** Launch site longitude in degrees. */
  launchLonDeg: number;
  /** Launch site altitude in km (default 0). */
  launchAltKm?: number;
  /** Target orbit perigee altitude in km. */
  perigeeAltKm: number;
  /** Target orbit apogee altitude in km. */
  apogeeAltKm: number;
  /** Target orbit inclination in degrees. */
  inclinationDeg: number;
  /** Launch direction: 'N' for northbound, 'S' for southbound. */
  direction: 'N' | 'S';
  /** Launch epoch. */
  launchTime: Date;
  /** Duration to propagate on the final orbit (hours, default 48). */
  orbitDurationHours?: number;
  /** Ascent timestep in seconds (default 5). */
  ascentStepSec?: number;
  /** Orbital phase timestep in seconds (default 60). */
  orbitalStepSec?: number;
}

/** Result of trajectory generation including phase boundary metadata. */
export interface LaunchTrajectoryResult {
  /** All J2000 state vectors for the trajectory. */
  states: J2000[];
  /** Index of the last ascent state (insertion point). Orbital states begin at insertionIndex + 1. */
  insertionIndex: number;
  /** Index of the first state on the final orbit after a transfer (e.g. GTO→GEO circularization). */
  transferEndIndex?: number;
  /** Index of the last pre-burn state when a plane change is included. */
  planeChangeIndex?: number;
}

/** Configuration for a plane change burn phase. */
export interface PlaneChangeConfig {
  /** Desired final inclination in degrees. */
  targetInclinationDeg: number;
  /** Number of complete orbits to coast before the burn (default 0). */
  burnDelayOrbits?: number;
  /** Which node to burn at (default 'nearest'). */
  preferredNode?: 'ascending' | 'descending' | 'nearest';
}

/** Threshold below which we use direct insertion (no transfer orbit). */
const LEO_DIRECT_APOGEE_THRESHOLD_KM = 2000;
/** Eccentricity threshold for LEO direct insertion. */
const LEO_DIRECT_ECC_THRESHOLD = 0.1;
/** Default parking orbit altitude for transfer scenarios. */
const PARKING_ORBIT_ALT_KM = 185;

/**
 * Generates realistic launch trajectories from ground to orbit.
 *
 * Produces an array of J2000 state vectors covering:
 * 1. Parametric ascent from launch site to parking/target orbit
 * 2. (Optional) Hohmann/generalized transfer to final orbit
 * 3. On-orbit propagation for the specified duration
 *
 * The output can be fed directly into an OemSatellite for visualization.
 */
export class LaunchTrajectoryGenerator {
  /**
   * Generate the full launch trajectory as J2000 state vectors.
   */
  static generate(config: LaunchTrajectoryConfig): J2000[] {
    return LaunchTrajectoryGenerator.generateWithBoundary(config).states;
  }

  /**
   * Generate the full launch trajectory with phase boundary metadata.
   * Use the insertionIndex to create a SegmentedLagrangeInterpolator
   * that avoids interpolating across the ascent→orbit physics boundary.
   */
  static generateWithBoundary(config: LaunchTrajectoryConfig): LaunchTrajectoryResult {
    const {
      launchLatDeg,
      launchLonDeg,
      launchAltKm = 0,
      perigeeAltKm,
      apogeeAltKm,
      inclinationDeg,
      direction,
      launchTime,
      orbitDurationHours = 48,
      ascentStepSec = 5,
      orbitalStepSec = 60,
    } = config;

    const launchEpoch = EpochUTC.fromDateTime(launchTime);
    const rPerigee = perigeeAltKm + Earth.radiusMean;
    const rApogee = apogeeAltKm + Earth.radiusMean;
    const eccentricity = (rApogee - rPerigee) / (rApogee + rPerigee);
    const isLeoDirect = apogeeAltKm < LEO_DIRECT_APOGEE_THRESHOLD_KM && eccentricity < LEO_DIRECT_ECC_THRESHOLD;

    // Determine the altitude we ascend to
    const insertionAltKm = isLeoDirect ? (perigeeAltKm + apogeeAltKm) / 2 : PARKING_ORBIT_ALT_KM;
    const rInsertion = insertionAltKm + Earth.radiusMean;

    // Phase 1: Ascent
    const azimuthRad = LaunchTrajectoryGenerator.computeLaunchAzimuth(inclinationDeg, launchLatDeg, direction);
    const ascentDurationSec = LaunchTrajectoryGenerator.estimateAscentDuration_(insertionAltKm);
    const downrangeAtInsertionKm = LaunchTrajectoryGenerator.estimateDownrange_(insertionAltKm, ascentDurationSec);

    const ascentStates = LaunchTrajectoryGenerator.generateAscentProfile_({
      launchEpoch, launchLatDeg, launchLonDeg, launchAltKm, insertionAltKm,
      azimuthRad, ascentDurationSec, downrangeKm: downrangeAtInsertionKm, stepSec: ascentStepSec,
    });

    if (ascentStates.length === 0) {
      return { states: [], insertionIndex: -1 };
    }

    // Get insertion state from the end of ascent
    const insertionState = ascentStates[ascentStates.length - 1];
    const insertionElements = insertionState.toClassicalElements();
    const insertionIndex = ascentStates.length - 1;

    if (isLeoDirect) {
      // LEO direct: ascent places us in the target orbit, just propagate
      const orbitalPhase = LaunchTrajectoryGenerator.generateOrbitalPhase_(
        insertionElements, orbitDurationHours, orbitalStepSec,
      );

      return { states: [...ascentStates, ...orbitalPhase], insertionIndex };
    }

    // Transfer required: parking orbit → transfer → final orbit
    const transferAndOrbit = LaunchTrajectoryGenerator.generateTransferPhase_(
      insertionElements, rInsertion, rPerigee, rApogee, orbitDurationHours, orbitalStepSec,
    );

    return { states: [...ascentStates, ...transferAndOrbit], insertionIndex };
  }

  /**
   * Generate a launch trajectory with an optional plane change burn phase.
   *
   * When the target inclination is lower than the minimum achievable from the launch site
   * (|launchLatDeg|), this method:
   * 1. Generates ascent + any Hohmann transfer + on-orbit at the minimum achievable inclination
   * 2. Identifies the transfer→final orbit boundary (for GEO/HEO)
   * 3. Computes the plane change burn on the circularized final orbit
   * 4. Truncates the base trajectory at the burn point and appends corrected orbit states
   *
   * For GEO this produces 4 phases: Ascent → Transfer (GTO) → Inclined GEO → Corrected GEO.
   * For LEO (no transfer) this produces 3 phases: Ascent → Inclined Orbit → Corrected Orbit.
   *
   * When no plane change is needed, delegates to generateWithBoundary unchanged.
   */
  static generateWithPlaneChange(
    config: LaunchTrajectoryConfig,
    planeChange?: PlaneChangeConfig,
  ): LaunchTrajectoryResult {
    if (!planeChange) {
      return LaunchTrajectoryGenerator.generateWithBoundary(config);
    }

    const { targetInclinationDeg, burnDelayOrbits = 0, preferredNode = 'nearest' } = planeChange;
    const minInclination = Math.abs(config.launchLatDeg);

    // If target inclination is achievable directly, no plane change needed
    if (targetInclinationDeg >= minInclination) {
      return LaunchTrajectoryGenerator.generateWithBoundary(config);
    }

    const orbitalStepSec = config.orbitalStepSec ?? 60;
    const orbitDurationHours = config.orbitDurationHours ?? 48;

    // Generate the FULL trajectory at minimum achievable inclination.
    // This includes ascent + any Hohmann transfer + circularized on-orbit propagation.
    // We need the full trajectory so the circularization burn completes and we can
    // extract correct final orbit elements (not GTO elements from a truncated transfer).
    const inclinedConfig: LaunchTrajectoryConfig = {
      ...config,
      inclinationDeg: minInclination,
      orbitDurationHours: Math.max(orbitDurationHours, 1),
    };
    const baseResult = LaunchTrajectoryGenerator.generateWithBoundary(inclinedConfig);

    if (baseResult.states.length === 0) {
      return baseResult;
    }

    const { insertionIndex } = baseResult;
    const insertionState = baseResult.states[insertionIndex];

    // Detect transfer orbit (GEO/HEO) vs LEO direct insertion
    const rPerigee = config.perigeeAltKm + Earth.radiusMean;
    const rApogee = config.apogeeAltKm + Earth.radiusMean;
    const ecc = (rApogee - rPerigee) / (rApogee + rPerigee);
    const isLeoDirect = config.apogeeAltKm < LEO_DIRECT_APOGEE_THRESHOLD_KM && ecc < LEO_DIRECT_ECC_THRESHOLD;

    let transferEndIndex: number | undefined;
    let finalOrbitElements: ClassicalElements;

    if (!isLeoDirect) {
      // Compute transfer duration analytically so we know when the circularization occurs
      const rInsertion = PARKING_ORBIT_ALT_KM + Earth.radiusMean;
      const { tTransfer } = LaunchTrajectoryGenerator.computeGeneralizedTransfer(rInsertion, rPerigee, rApogee);
      const transferEndPosix = insertionState.epoch.posix + tTransfer;

      // Find the first state on the circularized orbit (after the second burn)
      transferEndIndex = baseResult.states.length - 1;
      for (let i = insertionIndex + 1; i < baseResult.states.length; i++) {
        if (baseResult.states[i].epoch.posix >= transferEndPosix) {
          transferEndIndex = i;
          break;
        }
      }

      // Get elements from the first post-circularization state for the plane change
      finalOrbitElements = baseResult.states[transferEndIndex].toClassicalElements();
    } else {
      // LEO direct: insertion is already on the final orbit
      const firstOrbitalIdx = Math.min(insertionIndex + 1, baseResult.states.length - 1);

      finalOrbitElements = baseResult.states[firstOrbitalIdx].toClassicalElements();
    }

    // Compute plane change burn on the circularized final orbit
    const targetIncRad = targetInclinationDeg * DEG2RAD;
    const burnResult = PlaneChangeBurn.compute(finalOrbitElements, targetIncRad, burnDelayOrbits, preferredNode);
    const burnPosix = burnResult.burnEpoch.posix;
    const lastBasePosix = baseResult.states[baseResult.states.length - 1].epoch.posix;

    // Build states before the burn — either truncate base or extend with coast
    let statesBeforeBurn: J2000[];
    let planeChangeIndex: number;

    if (burnPosix <= lastBasePosix) {
      // Burn falls within the base trajectory — truncate at the burn point
      let truncIdx = baseResult.states.length - 1;

      for (let i = 0; i < baseResult.states.length; i++) {
        if (baseResult.states[i].epoch.posix > burnPosix) {
          truncIdx = i - 1;
          break;
        }
      }

      // Keep at least up to the transfer end
      if (transferEndIndex !== undefined && truncIdx < transferEndIndex) {
        truncIdx = transferEndIndex;
      }

      statesBeforeBurn = baseResult.states.slice(0, truncIdx + 1);
      planeChangeIndex = truncIdx;
    } else {
      // Burn is beyond the base trajectory — coast from last base state to burn
      const lastBaseElements = baseResult.states[baseResult.states.length - 1].toClassicalElements();
      const coastSec = burnPosix - lastBasePosix;
      const coastHours = coastSec / 3600;
      const coastStates = LaunchTrajectoryGenerator.generateOrbitalPhase_(
        lastBaseElements, coastHours, orbitalStepSec,
      );

      statesBeforeBurn = [...baseResult.states, ...coastStates];
      planeChangeIndex = statesBeforeBurn.length - 1;
    }

    // Corrected orbit after the burn — fill remaining duration
    const ascentDurationSec = insertionState.epoch.posix - baseResult.states[0].epoch.posix;
    const plannedEndPosix = baseResult.states[0].epoch.posix + ascentDurationSec + orbitDurationHours * 3600;
    const remainingSec = Math.max(plannedEndPosix - burnPosix, 3600);
    const remainingHours = remainingSec / 3600;
    const postBurnStates = LaunchTrajectoryGenerator.generateOrbitalPhase_(
      burnResult.postBurnElements, remainingHours, orbitalStepSec,
    );

    const allStates = [...statesBeforeBurn, ...postBurnStates];

    return {
      states: allStates,
      insertionIndex,
      transferEndIndex,
      planeChangeIndex,
    };
  }

  /**
   * Compute launch azimuth from inclination and launch site latitude.
   * @param incDeg Target inclination in degrees.
   * @param latDeg Launch site latitude in degrees.
   * @param direction 'N' for northbound, 'S' for southbound.
   * @returns Launch azimuth in radians (from north, clockwise).
   */
  static computeLaunchAzimuth(incDeg: number, latDeg: number, direction: 'N' | 'S'): number {
    const inc = incDeg * DEG2RAD;
    const lat = latDeg * DEG2RAD;

    // Inclination must be >= |latitude| for a valid launch
    const cosRatio = Math.cos(inc) / Math.cos(lat);

    // Clamp to [-1, 1] to handle floating point edge cases
    const clamped = Math.max(-1, Math.min(1, cosRatio));
    let azimuth = Math.asin(clamped);

    if (direction === 'S') {
      azimuth = Math.PI - azimuth;
    }

    return azimuth;
  }

  /**
   * Compute orbital inclination from a launch azimuth and launch site latitude.
   *
   * Inverse of {@link computeLaunchAzimuth}: from the spherical-triangle relation
   * `cos(i) = sin(azimuth) * cos(latitude)`. The result is the magnitude of the
   * inclination in degrees (always in [0, 180]); the launch direction (N/S) is
   * implied by the azimuth quadrant, not by this value.
   *
   * @param azimuthDeg Launch azimuth in degrees (from north, clockwise).
   * @param latDeg Launch site latitude in degrees.
   * @returns Orbital inclination in degrees, in [0, 180].
   */
  static computeInclinationFromAzimuth(azimuthDeg: number, latDeg: number): number {
    const az = azimuthDeg * DEG2RAD;
    const lat = latDeg * DEG2RAD;

    // Clamp to [-1, 1] to handle floating point edge cases before acos.
    const cosInc = Math.max(-1, Math.min(1, Math.sin(az) * Math.cos(lat)));

    return Math.acos(cosInc) * RAD2DEG;
  }

  /**
   * Estimate ascent duration based on target insertion altitude.
   * Loosely calibrated: ~480s for 200km, ~540s for 400km, ~600s for 800km.
   */
  private static estimateAscentDuration_(insertionAltKm: number): number {
    return 420 + insertionAltKm * 0.225;
  }

  /**
   * Estimate downrange distance at orbital insertion.
   * Based on average velocity during ascent being roughly half the orbital velocity.
   */
  private static estimateDownrange_(insertionAltKm: number, ascentDurationSec: number): number {
    const rInsert = insertionAltKm + Earth.radiusMean;
    const vOrbital = Math.sqrt(Earth.mu / rInsert);

    // Average downrange velocity ≈ vOrbital / 2 (ramps from 0 to vOrbital)
    return 0.5 * vOrbital * ascentDurationSec;
  }

  /**
   * Generate the parametric ascent profile as J2000 state vectors.
   *
   * Uses Hermite splines for altitude and downrange distance to produce
   * a gravity-turn-like trajectory.
   */
  private static generateAscentProfile_(params: {
    launchEpoch: EpochUTC;
    launchLatDeg: number;
    launchLonDeg: number;
    launchAltKm: number;
    insertionAltKm: number;
    azimuthRad: number;
    ascentDurationSec: number;
    downrangeKm: number;
    stepSec: number;
  }): J2000[] {
    const {
      launchEpoch, launchLatDeg, launchLonDeg, launchAltKm, insertionAltKm,
      azimuthRad, ascentDurationSec, downrangeKm, stepSec,
    } = params;
    const states: J2000[] = [];
    const nSteps = Math.ceil(ascentDurationSec / stepSec);

    // Compute the orbital velocity at insertion for downrange derivative matching
    const rInsert = (insertionAltKm + Earth.radiusMean);
    const vOrbital = Math.sqrt(Earth.mu / rInsert); // km/s

    // Generate positions at each timestep
    const positions: { epoch: EpochUTC; pos: Vector3D<Kilometers> }[] = [];

    for (let i = 0; i <= nSteps; i++) {
      const t = (i / nSteps);
      const tSec = t * ascentDurationSec;
      const epoch = launchEpoch.roll(tSec as Seconds);

      // Hermite altitude: starts at launchAlt, ends at insertionAlt
      // h'(0) > 0 (vertical launch velocity), h'(1) ≈ 0 (horizontal at insertion)
      const alt = LaunchTrajectoryGenerator.hermiteAltitude_(t, launchAltKm, insertionAltKm);

      // Hermite downrange: starts at 0, ends at downrangeKm
      // d'(0) = 0 (vertical start), d'(1) matches orbital velocity
      const dr = LaunchTrajectoryGenerator.hermiteDownrange_(t, downrangeKm, vOrbital * ascentDurationSec);

      // Convert downrange to lat/lon via great-circle from launch site
      const { lat, lon } = LaunchTrajectoryGenerator.greatCirclePoint_(
        launchLatDeg * DEG2RAD, launchLonDeg * DEG2RAD, azimuthRad, dr,
      );

      // Convert geodetic to ECI (using GMST for Earth rotation)
      const gmst = epoch.gmstAngle();
      const pos = LaunchTrajectoryGenerator.geodeticToEci_(lat, lon, alt, gmst);

      positions.push({ epoch, pos });
    }

    // Compute velocities via central finite differencing
    for (let i = 0; i < positions.length; i++) {
      const { epoch, pos } = positions[i];
      let vel: Vector3D<KilometersPerSecond>;

      if (i === 0) {
        // Forward difference
        const dt = stepSec;
        const next = positions[i + 1].pos;

        vel = new Vector3D<KilometersPerSecond>(
          (next.x - pos.x) / dt as KilometersPerSecond,
          (next.y - pos.y) / dt as KilometersPerSecond,
          (next.z - pos.z) / dt as KilometersPerSecond,
        );
      } else if (i === positions.length - 1) {
        // Backward difference for direction — stays consistent with the
        // ascent trajectory so there is no "dogleg" at insertion.  The
        // local bearing drifts from the launch azimuth over 1000+ km of
        // great-circle travel, so reusing the launch azimuth here would
        // introduce a sudden heading change.
        const prev = positions[i - 1].pos;
        const rawVx = (pos.x - prev.x) / stepSec;
        const rawVy = (pos.y - prev.y) / stepSec;
        const rawVz = (pos.z - prev.z) / stepSec;
        const rawMag = Math.sqrt(rawVx * rawVx + rawVy * rawVy + rawVz * rawVz);

        if (rawMag > 1e-10) {
          // Scale to correct orbital speed while preserving trajectory direction
          const scale = vOrbital / rawMag;

          vel = new Vector3D<KilometersPerSecond>(
            rawVx * scale as KilometersPerSecond,
            rawVy * scale as KilometersPerSecond,
            rawVz * scale as KilometersPerSecond,
          );
        } else {
          // Degenerate case — fall back to azimuth-based computation
          vel = LaunchTrajectoryGenerator.computeInsertionVelocity_(pos, azimuthRad, positions[i].epoch, vOrbital);
        }
      } else {
        // Central difference
        const dt = 2 * stepSec;
        const prev = positions[i - 1].pos;
        const next = positions[i + 1].pos;

        vel = new Vector3D<KilometersPerSecond>(
          (next.x - prev.x) / dt as KilometersPerSecond,
          (next.y - prev.y) / dt as KilometersPerSecond,
          (next.z - prev.z) / dt as KilometersPerSecond,
        );
      }

      states.push(new J2000(epoch, pos, vel));
    }

    return states;
  }

  /**
   * Hermite spline for altitude profile.
   * Starts at launchAlt with positive derivative (vertical launch).
   * Ends at insertionAlt with near-zero derivative (horizontal insertion).
   *
   * Uses smoothstep easing (3t²-2t³) to create an S-curve profile:
   * - Slow initial altitude gain (vertical phase, dense atmosphere)
   * - Rapid gain in middle (gravity turn, thinning atmosphere)
   * - Flattening approach to insertion altitude
   *
   * The verticalBoost term adds an early vertical kick that compensates
   * for smoothstep's zero derivative at t=0, modeling the initial
   * vertical launch phase before the gravity turn begins.
   */
  private static hermiteAltitude_(t: number, h0: number, h1: number): number {
    // Smoothstep provides an S-curve matching real launch altitude profiles:
    // slow start (vertical/atmospheric phase), fast middle (gravity turn), flat end
    const s = t * t * (3 - 2 * t); // Smoothstep: slow-fast-slow S-curve

    // Standard Hermite with zero end-derivatives plus vertical launch derivative
    const dh = h1 - h0;
    const verticalBoost = dh * 0.3 * t * (1 - t) * (1 - t); // Extra vertical kick early on

    return h0 + dh * s + verticalBoost;
  }

  /**
   * Hermite cubic spline for downrange distance.
   * d(0) = 0, d'(0) = 0 (vertical start)
   * d(1) = dMax, d'(1) = endDerivative (matches orbital velocity at insertion)
   *
   * @param t Normalized time [0, 1].
   * @param dMax Downrange distance at insertion (km).
   * @param endDerivative d'(1) in unit-t coordinates = vOrbital * ascentDuration (km).
   */
  private static hermiteDownrange_(t: number, dMax: number, endDerivative: number): number {
    // Cubic Hermite basis functions for p0=0, m0=0, p1=dMax, m1=endDerivative:
    // h01(t) = -2t³ + 3t² = t²(3-2t)
    // h11(t) = t³ - t²    = t²(t-1)
    return t * t * (3 - 2 * t) * dMax + t * t * (t - 1) * endDerivative;
  }

  /**
   * Compute a point on a great circle from a starting point.
   * @param lat0 Starting latitude in radians.
   * @param lon0 Starting longitude in radians.
   * @param azimuth Azimuth from north in radians.
   * @param distanceKm Distance along the great circle in km.
   * @returns Latitude and longitude in radians.
   */
  private static greatCirclePoint_(lat0: number, lon0: number, azimuth: number, distanceKm: number): { lat: number; lon: number } {
    const angDist = distanceKm / Earth.radiusMean;
    const sinAngDist = Math.sin(angDist);
    const cosAngDist = Math.cos(angDist);
    const sinLat0 = Math.sin(lat0);
    const cosLat0 = Math.cos(lat0);

    const lat = Math.asin(sinLat0 * cosAngDist + cosLat0 * sinAngDist * Math.cos(azimuth));
    const lon = lon0 + Math.atan2(
      Math.sin(azimuth) * sinAngDist * cosLat0,
      cosAngDist - sinLat0 * Math.sin(lat),
    );

    return { lat, lon };
  }

  /**
   * Convert geodetic coordinates to ECI position.
   * Uses spherical Earth approximation (consistent with lla2eci in transforms.ts).
   */
  private static geodeticToEci_(latRad: number, lonRad: number, altKm: number, gmst: number): Vector3D<Kilometers> {
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);
    const cosLon = Math.cos(lonRad + gmst);
    const sinLon = Math.sin(lonRad + gmst);
    const r = Earth.radiusMean + altKm;

    return new Vector3D<Kilometers>(
      r * cosLat * cosLon as Kilometers,
      r * cosLat * sinLon as Kilometers,
      r * sinLat as Kilometers,
    );
  }

  /**
   * Compute the orbital velocity vector at the insertion point.
   * The velocity is tangent to the orbit (perpendicular to the radial direction),
   * in the orbital plane defined by the launch azimuth.
   */
  private static computeInsertionVelocity_(
    pos: Vector3D<Kilometers>,
    azimuthRad: number,
    _epoch: EpochUTC,
    vMagnitude: number,
  ): Vector3D<KilometersPerSecond> {
    // Radial unit vector (position direction)
    const rMag = pos.magnitude();
    const rHat = new Vector3D(pos.x / rMag, pos.y / rMag, pos.z / rMag);

    // Earth's rotation axis (Z-axis in ECI)
    const zHat = new Vector3D(0, 0, 1);

    // East direction at the current position: Z × R (normalized)
    const east = new Vector3D(
      zHat.y * rHat.z - zHat.z * rHat.y,
      zHat.z * rHat.x - zHat.x * rHat.z,
      zHat.x * rHat.y - zHat.y * rHat.x,
    );
    const eastMag = Math.sqrt(east.x * east.x + east.y * east.y + east.z * east.z);

    if (eastMag < 1e-10) {
      // Polar launch — velocity is purely along Z-cross-R
      return new Vector3D<KilometersPerSecond>(
        0 as KilometersPerSecond,
        0 as KilometersPerSecond,
        vMagnitude as KilometersPerSecond,
      );
    }

    const eHat = new Vector3D(east.x / eastMag, east.y / eastMag, east.z / eastMag);

    // North direction at current position: R × East (normalized)
    const north = new Vector3D(
      rHat.y * eHat.z - rHat.z * eHat.y,
      rHat.z * eHat.x - rHat.x * eHat.z,
      rHat.x * eHat.y - rHat.y * eHat.x,
    );

    // Velocity direction from azimuth: north * cos(az) + east * sin(az)
    const cosAz = Math.cos(azimuthRad);
    const sinAz = Math.sin(azimuthRad);

    return new Vector3D<KilometersPerSecond>(
      (north.x * cosAz + eHat.x * sinAz) * vMagnitude as KilometersPerSecond,
      (north.y * cosAz + eHat.y * sinAz) * vMagnitude as KilometersPerSecond,
      (north.z * cosAz + eHat.z * sinAz) * vMagnitude as KilometersPerSecond,
    );
  }

  /**
   * Generate the transfer phase from a parking orbit to the target orbit.
   * Uses a generalized two-burn transfer (Hohmann for circular targets).
   *
   * @returns Combined transfer + final orbit ephemeris.
   */
  private static generateTransferPhase_(
    parkingElements: ClassicalElements,
    rParking: number,
    rPerigeeTarget: number,
    rApogeeTarget: number,
    orbitDurationHours: number,
    orbitalStepSec: number,
  ): J2000[] {
    const epoch = parkingElements.epoch;

    // Compute generalized two-burn transfer
    const { dv1, dv2, tTransfer } = LaunchTrajectoryGenerator.computeGeneralizedTransfer(
      rParking, rPerigeeTarget, rApogeeTarget,
    );

    // Create thrust maneuvers in the in-track (prograde) direction
    const thrust1 = new Thrust(
      epoch,
      0 as MetersPerSecond,
      dv1 * 1000 as MetersPerSecond,
      0 as MetersPerSecond,
    );

    const thrust2 = new Thrust(
      epoch.roll(tTransfer as Seconds),
      0 as MetersPerSecond,
      dv2 * 1000 as MetersPerSecond,
      0 as MetersPerSecond,
    );

    // Use KeplerPropagator to generate ephemeris through both maneuvers
    const propagator = new KeplerPropagator(parkingElements);
    const totalDuration = tTransfer + orbitDurationHours * 3600;
    const endEpoch = epoch.roll(totalDuration as Seconds);

    // ephemerisManeuver handles coasting + burns + final propagation
    const interpolator = propagator.ephemerisManeuver(
      epoch, endEpoch, [thrust1, thrust2], orbitalStepSec,
    );

    // Extract J2000 states from the interpolator at regular intervals
    const states: J2000[] = [];
    let currentEpoch = epoch.roll(orbitalStepSec as Seconds);

    while (currentEpoch.posix <= endEpoch.posix) {
      const state = interpolator.interpolate(currentEpoch);

      if (state) {
        states.push(state);
      }
      currentEpoch = currentEpoch.roll(orbitalStepSec as Seconds);
    }

    return states;
  }

  /**
   * Generate on-orbit propagation using Kepler two-body.
   */
  static generateOrbitalPhase_(
    elements: ClassicalElements,
    durationHours: number,
    stepSec: number,
  ): J2000[] {
    const propagator = new KeplerPropagator(elements);
    const states: J2000[] = [];
    const totalSec = durationHours * 3600;
    const nSteps = Math.ceil(totalSec / stepSec);

    for (let i = 1; i <= nSteps; i++) {
      const epoch = elements.epoch.roll((i * stepSec) as Seconds);

      states.push(propagator.propagate(epoch));
    }

    return states;
  }

  /**
   * Compute a generalized two-burn transfer between a circular parking orbit
   * and an arbitrary target orbit (circular or elliptical).
   *
   * @param rPark Parking orbit radius (km).
   * @param rPerigeeTarget Target orbit perigee radius (km).
   * @param rApogeeTarget Target orbit apogee radius (km).
   * @returns Delta-V values (km/s) for both burns and transfer time (seconds).
   */
  static computeGeneralizedTransfer(
    rPark: number,
    rPerigeeTarget: number,
    rApogeeTarget: number,
  ): { dv1: number; dv2: number; tTransfer: number } {
    const mu = Earth.mu;

    // Circular parking orbit velocity
    const vPark = Math.sqrt(mu / rPark);

    // Transfer orbit: perigee at rPark, apogee at rApogeeTarget
    const aTransfer = (rPark + rApogeeTarget) / 2;
    const vTransferAtPark = Math.sqrt(mu * (2 / rPark - 1 / aTransfer));
    const vTransferAtApogee = Math.sqrt(mu * (2 / rApogeeTarget - 1 / aTransfer));

    // Target orbit semi-major axis
    const aTarget = (rPerigeeTarget + rApogeeTarget) / 2;
    const vTargetAtApogee = Math.sqrt(mu * (2 / rApogeeTarget - 1 / aTarget));

    // Burn 1: At parking orbit, boost to transfer orbit
    const dv1 = vTransferAtPark - vPark;

    // Burn 2: At apogee, adjust to target orbit velocity
    const dv2 = vTargetAtApogee - vTransferAtApogee;

    // Transfer time: half-period of the transfer ellipse
    const tTransfer = Math.PI * Math.sqrt(aTransfer * aTransfer * aTransfer / mu);

    return { dv1, dv2, tTransfer };
  }
}
