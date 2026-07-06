/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
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
import { ValidationError } from '../errors';
import { Sensor } from '../sensor/Sensor';
import { boresightFrameFromAzElRoll } from '../sensor/FieldOfView';
import { rae2ecef } from '../transforms/transforms';
import { DEG2RAD, RAD2DEG } from '../utils/constants';
import {
  Degrees,
  EcefVec3,
  TemeVec3,
  Kilometers,
  KilometersPerSecond,
  Radians,
  RaeVec3,
} from '../types/types';
import { History } from './History';
import { Satellite } from './Satellite';

/**
 * A point on an orbit track with position, velocity, and altitude.
 */
export interface OrbitTrackPoint {
  time: Date;
  position: TemeVec3;
  velocity: TemeVec3<KilometersPerSecond>;
  altitude: Kilometers;
}

/**
 * A point on a ground track with geodetic coordinates.
 */
export interface GroundTrackPoint {
  time: Date;
  lat: Degrees;
  lon: Degrees;
  alt: Kilometers;
}

/**
 * A point on a field of view boundary with cached ECEF coordinates.
 * ECEF coordinates are cached for fast conversion to TEME at render time
 * using `ecef2eci(point.ecef, gmst)`.
 */
export interface FovBoundaryPoint {
  az: Degrees;
  el: Degrees;
  range: Kilometers;
  ecef: EcefVec3<Kilometers>;
}

/**
 * Static utility class for generating visualization data for satellites, ground tracks,
 * and sensor fields of view.
 */
export class VisualizationHelpers {
  private constructor() {
    // Static utility class - prevent instantiation
  }

  /**
   * Converts history entries to a time series using an extractor function.
   * @param history - The history object to convert
   * @param extractor - Function to extract a value from each history entry
   * @returns Array of time-value pairs
   * @example
   * ```typescript
   * // Extract altitude over time
   * const altitudes = VisualizationHelpers.historyToTimeSeries(
   *   satellite.history!,
   *   (entry) => Math.sqrt(
   *     entry.data.position.x ** 2 +
   *     entry.data.position.y ** 2 +
   *     entry.data.position.z ** 2
   *   ) - 6378.137 as Kilometers
   * );
   * ```
   */
  static historyToTimeSeries<T, R>(
    history: History<T>,
    extractor: (entry: { time: Date; data: T }) => R,
  ): Array<{ time: Date; value: R }> {
    const entries = history.getAll();

    return entries.map((entry) => ({
      time: entry.time,
      value: extractor(entry),
    }));
  }

  /**
   * Generates orbit track points for a satellite over multiple orbital periods.
   * @param satellite - The satellite to generate the orbit track for
   * @param start - Start time for the orbit track
   * @param periods - Number of orbital periods to generate (default: 1)
   * @param samplesPerPeriod - Number of sample points per period (default: 90)
   * @example
   * ```typescript
   * import { Satellite, VisualizationHelpers } from 'ootk';
   *
   * const satellite = new Satellite({ tle });
   *
   * // Generate one full orbit with 90 points
   * const track = VisualizationHelpers.generateOrbitTrack(
   *   satellite,
   *   new Date(),
   *   1,    // 1 orbital period
   *   90    // 90 sample points (4-degree spacing)
   * );
   *
   * // Use points for 3D visualization (e.g., Three.js, Cesium)
   * track.forEach(point => {
   *   console.log(`Time: ${point.time.toISOString()}`);
   *   console.log(`  Position: [${point.position.x}, ${point.position.y}, ${point.position.z}] km`);
   *   console.log(`  Altitude: ${point.altitude.toFixed(1)} km`);
   * });
   *
   * // Generate 3 orbits for longer visualization
   * const extendedTrack = VisualizationHelpers.generateOrbitTrack(satellite, new Date(), 3, 120);
   * ```
   * @returns Array of orbit track points with position, velocity, and altitude
   */
  static generateOrbitTrack(
    satellite: Satellite,
    start: Date,
    periods = 1,
    samplesPerPeriod = 90,
  ): OrbitTrackPoint[] {
    if (periods <= 0 || samplesPerPeriod <= 0) {
      return [];
    }

    const periodMs = satellite.period * 60 * 1000; // Convert minutes to ms
    const totalDuration = periods * periodMs;
    const totalSamples = periods * samplesPerPeriod;
    const stepMs = totalDuration / totalSamples;

    const points: OrbitTrackPoint[] = [];
    let currentTime = start.getTime();
    const endTime = currentTime + totalDuration;

    while (currentTime < endTime) {
      const date = new Date(currentTime);
      const pv = satellite.eci(date);

      if (pv) {
        const { position, velocity } = pv;
        const altitude = (Math.sqrt(
          position.x ** 2 + position.y ** 2 + position.z ** 2,
        ) - Earth.radiusEquator) as Kilometers;

        points.push({
          time: date,
          position,
          velocity,
          altitude,
        });
      }

      currentTime += stepMs;
    }

    return points;
  }

  /**
   * Generates ground track points (sub-satellite points) for a satellite.
   * @param satellite - The satellite to generate the ground track for
   * @param start - Start time for the ground track
   * @param end - End time for the ground track
   * @param stepMs - Time step in milliseconds (default: 60000 = 1 minute)
   * @returns Array of ground track points with lat/lon/alt
   */
  static generateGroundTrack(
    satellite: Satellite,
    start: Date,
    end: Date,
    stepMs = 60000,
  ): GroundTrackPoint[] {
    if (start >= end || stepMs <= 0) {
      return [];
    }

    const points: GroundTrackPoint[] = [];
    let currentTime = start.getTime();
    const endTime = end.getTime();

    while (currentTime <= endTime) {
      const date = new Date(currentTime);
      const lla = satellite.lla(date);

      if (lla) {
        points.push({
          time: date,
          lat: lla.lat,
          lon: lla.lon,
          alt: lla.alt,
        });
      }

      currentTime += stepMs;
    }

    return points;
  }

  /**
   * Generates FOV boundary points for a sensor in ECEF coordinates.
   * The ECEF coordinates are cached for fast conversion to TEME at render time.
   *
   * @param sensor - The sensor to generate the FOV boundary for (must have a parent platform)
   * @param samples - Number of sample points around the boundary (default: 72)
   * @param atRange - Range at which to sample the boundary (default: sensor's maxRange)
   * @returns Array of FOV boundary points with az/el and cached ECEF coordinates
   * @throws Error if sensor has no parent platform
   * @example
   * ```typescript
   * // Generate boundary once (cached in ECEF)
   * const boundary = VisualizationHelpers.generateFOVBoundary(sensor, 72);
   *
   * // Convert to TEME at any time
   * const gmst = gstime(jday(renderDate));
   * const temePoints = boundary.map(pt => ({
   *   ...pt,
   *   teme: ecef2eci(pt.ecef, gmst)
   * }));
   * ```
   */
  static generateFOVBoundary(
    sensor: Sensor,
    samples = 72,
    atRange?: Kilometers,
  ): FovBoundaryPoint[] {
    if (!sensor.hasParent()) {
      throw new ValidationError(
        'Sensor must have a parent platform to compute FOV boundary',
        'sensor.parent',
        undefined,
      );
    }

    if (samples <= 0) {
      return [];
    }

    const sensorLla = sensor.parent.lla();

    if (!sensorLla) {
      throw new Error('Sensor parent must have a valid geodetic position (LLA)');
    }

    const fov = sensor.fieldOfView;
    const range = atRange ?? fov.maxRange;

    // Reconstruct boresight frame from public FOV properties
    const frame = boresightFrameFromAzElRoll(
      (fov.boresightAz * DEG2RAD) as Radians,
      (fov.boresightEl * DEG2RAD) as Radians,
      (fov.rollAngle * DEG2RAD) as Radians,
    );
    const { b, u, v } = frame;

    const points: FovBoundaryPoint[] = [];

    for (let i = 0; i < samples; i++) {
      const phi = (2 * Math.PI * i) / samples;

      // For elliptical cone: theta varies with phi based on ellipse equation
      // At boundary, the ellipse equation equals 1
      const theta = Math.sqrt(
        (fov.halfAngle * Math.cos(phi)) ** 2 +
        (fov.minorHalfAngle * Math.sin(phi)) ** 2,
      ) * DEG2RAD;

      // Build direction vector on cone surface
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);

      const dir = {
        x: b.x * cosTheta + u.x * sinTheta * cosPhi + v.x * sinTheta * sinPhi,
        y: b.y * cosTheta + u.y * sinTheta * cosPhi + v.y * sinTheta * sinPhi,
        z: b.z * cosTheta + u.z * sinTheta * cosPhi + v.z * sinTheta * sinPhi,
      };

      // Convert to az/el (ENU frame: x=East, y=North, z=Up)
      // Normalize azimuth to [0, 360)
      const azRaw = Math.atan2(dir.x, dir.y) * RAD2DEG;
      const az = (((azRaw % 360) + 360) % 360) as Degrees;
      const el = (Math.asin(dir.z) * RAD2DEG) as Degrees;

      // Apply elevation mask constraint
      const minEl = fov.getMinElevation(az);
      const effectiveEl = Math.max(el, minEl) as Degrees;

      // Convert RAE to ECEF for caching
      const rae: RaeVec3<Kilometers, Degrees> = { rng: range, az, el: effectiveEl };
      const ecef = rae2ecef(rae, sensorLla);

      points.push({ az, el: effectiveEl, range, ecef });
    }

    return points;
  }
}
