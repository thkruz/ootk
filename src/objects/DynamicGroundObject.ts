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

import { Geodetic } from '../coordinate/Geodetic';
import { J2000 } from '../coordinate/J2000';
import { Degrees, EcefVec3, Kilometers, LlaVec3, SpaceObjectType, TemeVec3 } from '../types/types';
import { calcGmst, ecef2eci, llaRad2ecef } from '../transforms/transforms';
import { EpochUTC } from '../time/EpochUTC';
import { DEG2RAD, RAD2DEG } from '../utils/constants';
import { BaseObjectParams } from './BaseObject';
import { GroundObject } from './GroundObject';
import { CommunicationDevice } from '../comm/CommunicationDevice';
import { Sensor } from '../sensor/Sensor';
import { History, HistoryConfig } from './History';
import { HistoricalState } from './ObjectTypes';

/**
 * Data for a single waypoint in a dynamic ground object's path.
 */
export interface WaypointData {
  /** The time at which the object is at this waypoint */
  time: Date;
  /** Latitude in degrees */
  lat: Degrees;
  /** Longitude in degrees */
  lon: Degrees;
  /** Altitude in kilometers */
  alt: Kilometers;
  /** Optional metadata associated with this waypoint */
  metadata?: Record<string, unknown>;
}

/**
 * Interpolation method for calculating positions between waypoints.
 * - 'linear': Simple linear interpolation of lat/lon/alt (fastest, least accurate)
 * - 'greatCircle': Spherical linear interpolation along great circle path (recommended for surface objects)
 * - 'spline': Cubic spline interpolation for smooth paths through all waypoints
 */
export type GroundInterpolationMethod = 'linear' | 'greatCircle' | 'spline';

/**
 * Parameters for constructing a DynamicGroundObject.
 */
export interface DynamicGroundObjectParams extends Omit<BaseObjectParams, 'type'> {
  /** Array of waypoints defining the object's path */
  waypoints: WaypointData[];
  /** Interpolation method to use (defaults to 'greatCircle') */
  interpolationMethod?: GroundInterpolationMethod;
  /** Optional history configuration for position tracking */
  historyConfig?: HistoryConfig;
}

/**
 * Options for the DynamicGroundObject.clone() method.
 */
export interface DynamicGroundObjectCloneOptions {
  /** If true, clone history entries. If false (default), start with empty history but same config. */
  cloneHistory?: boolean;
}

/**
 * A ground object that moves along Earth's surface following a series of waypoints.
 * Useful for tracking aircraft, ships, vehicles, or special events like Santa tracking.
 *
 * Unlike static GroundObject, DynamicGroundObject's position is time-dependent and
 * must be queried with a specific time.
 *
 * @example
 * ```typescript
 * // Track Santa's journey
 * const santa = new DynamicGroundObject({
 *   id: 'SANTA-2025',
 *   name: 'Santa Claus',
 *   waypoints: [
 *     { time: new Date('2025-12-24T22:00:00Z'), lat: 90 as Degrees, lon: 0 as Degrees, alt: 10 as Kilometers },
 *     { time: new Date('2025-12-24T23:00:00Z'), lat: 64.1 as Degrees, lon: -21.9 as Degrees, alt: 10 as Kilometers },
 *   ],
 *   interpolationMethod: 'greatCircle'
 * });
 *
 * // Get position at specific time
 * const position = santa.getLLA(new Date('2025-12-24T22:30:00Z'));
 * ```
 */
export class DynamicGroundObject extends GroundObject {
  private waypoints_: WaypointData[];
  private interpolationMethod_: GroundInterpolationMethod;
  private positionHistory_: History<LlaVec3<Degrees, Kilometers>> | null = null;
  private splineCoeffs_: { latCoeffs: number[][]; lonCoeffs: number[][]; altCoeffs: number[][] } | null = null;

  constructor(params: DynamicGroundObjectParams) {
    if (!params.waypoints || params.waypoints.length === 0) {
      throw new Error('DynamicGroundObject requires at least one waypoint');
    }

    for (const wp of params.waypoints) {
      GroundObject.validateLla(wp.lat, wp.lon, wp.alt);
    }

    // Sort waypoints by time
    const sortedWaypoints = [...params.waypoints].sort((a, b) => a.time.getTime() - b.time.getTime());

    // Initialize with first waypoint position for parent class
    const firstWp = sortedWaypoints[0];

    super({
      ...params,
      type: SpaceObjectType.DYNAMIC_GROUND_OBJECT,
      lat: firstWp.lat,
      lon: firstWp.lon,
      alt: firstWp.alt,
    });

    this.waypoints_ = sortedWaypoints;
    this.interpolationMethod_ = params.interpolationMethod ?? 'greatCircle';

    // Initialize history if config provided
    if (params.historyConfig) {
      this.positionHistory_ = new History<LlaVec3<Degrees, Kilometers>>(params.historyConfig);
    }

    // Pre-compute spline coefficients if using spline interpolation
    if (this.interpolationMethod_ === 'spline' && this.waypoints_.length >= 2) {
      this.computeSplineCoefficients_();
    }
  }

  // ==================== Position Methods (Override) ====================

  /**
   * Throws an error - use getLLA(time) for DynamicGroundObject.
   * @throws Error always
   */
  override lla(): LlaVec3<Degrees, Kilometers> {
    throw new Error('DynamicGroundObject position is time-dependent. Use getLLA(time) instead.');
  }

  /**
   * Throws an error - use getEcef(time) for DynamicGroundObject.
   * @throws Error always
   */
  override ecef(): EcefVec3<Kilometers> {
    throw new Error('DynamicGroundObject position is time-dependent. Use getEcef(time) instead.');
  }

  /**
   * TEME position at `date` (same model as {@link getEci}, without recording to history).
   * @param date - The time of interest. Required: a moving object has no time-independent position.
   * @returns TEME position in km.
   * @throws Error if `date` is omitted or outside the waypoint time range.
   */
  override eci(date?: Date): TemeVec3<Kilometers> {
    if (!date) {
      throw new Error('DynamicGroundObject position is time-dependent. Use getEci(time) instead.');
    }
    const eci = this.eciAt(date);

    if (!eci) {
      throw new Error(`DynamicGroundObject has no position at ${date.toISOString()} (outside the waypoint range)`);
    }

    return eci;
  }

  /**
   * Interpolated position at `date`, without recording to history. Used by observer
   * calculations such as `Satellite.rae()` and `AccessCalculator`.
   * @param date - The time of interest.
   * @returns Latitude and longitude in degrees and altitude in km, or null outside the waypoint range.
   */
  override llaAt(date: Date): LlaVec3<Degrees, Kilometers> | null {
    return this.computeLla_(date);
  }

  // ==================== Time-Dependent Position Methods ====================

  /**
   * Gets the latitude, longitude, and altitude at a specific time.
   * Interpolates between waypoints using the configured method.
   * @param time - The time to get position for
   * @returns Position as lat/lon/alt, or null if time is outside waypoint range
   */
  getLLA(time: Date): LlaVec3<Degrees, Kilometers> | null {
    const result = this.computeLla_(time);

    if (result) {
      this.recordPosition_(time, result);
    }

    return result;
  }

  /**
   * Interpolated position at `time` without recording to history.
   * @param time - The time of interest.
   * @returns Position, or null if `time` is outside the waypoint range.
   */
  private computeLla_(time: Date): LlaVec3<Degrees, Kilometers> | null {
    const bracket = this.findBracketingWaypoints_(time);

    if (!bracket) {
      return null;
    }

    const { before, after } = bracket;

    // If exactly at a waypoint or only one waypoint exists
    if (!after || before.time.getTime() === time.getTime()) {
      return { lat: before.lat, lon: before.lon, alt: before.alt };
    }

    if (after.time.getTime() === time.getTime()) {
      return { lat: after.lat, lon: after.lon, alt: after.alt };
    }

    return this.interpolate_(before, after, time);
  }

  /**
   * Gets the ECEF (Earth-Centered Earth-Fixed) position at a specific time.
   * @param time - The time to get position for
   * @returns ECEF position vector, or null if time is outside waypoint range
   */
  getEcef(time: Date): EcefVec3<Kilometers> | null {
    const lla = this.getLLA(time);

    if (!lla) {
      return null;
    }

    const geodetic = Geodetic.fromDegrees(lla.lat, lla.lon, lla.alt);

    return llaRad2ecef(geodetic);
  }

  /**
   * Gets the ECI (Earth-Centered Inertial) position at a specific time.
   *
   * The WGS84 position from {@link getEcef} rotated into TEME by GMST, the same model
   * `GroundObject.eci()` uses (not the spherical-Earth `lla2eci()`).
   * @param time - The time to get position for
   * @returns ECI (TEME) position vector, or null if time is outside waypoint range
   */
  getEci(time: Date): TemeVec3<Kilometers> | null {
    const ecef = this.getEcef(time);

    if (!ecef) {
      return null;
    }

    const { gmst } = calcGmst(time);

    return ecef2eci(ecef, gmst);
  }

  /**
   * Converts position at a specific time to J2000 inertial coordinates.
   *
   * The WGS84 position is rotated from ITRF into J2000 with precession, nutation and
   * sidereal time, as in `GroundObject.toJ2000()`. The velocity is the Earth-rotation
   * velocity (omega x r); the platform's own motion between waypoints is not included.
   * @param time - The time for the conversion
   * @returns J2000 state vector, or null if time is outside waypoint range
   */
  getJ2000(time: Date): J2000 | null {
    const geodetic = this.getGeodetic(time);

    if (!geodetic) {
      return null;
    }

    return geodetic.toITRF(EpochUTC.fromDateTime(time)).toJ2000();
  }

  /**
   * Converts position at a specific time to Geodetic coordinates.
   * @param time - The time for the conversion
   * @returns Geodetic position, or null if time is outside waypoint range
   */
  getGeodetic(time: Date): Geodetic | null {
    const lla = this.getLLA(time);

    if (!lla) {
      return null;
    }

    return Geodetic.fromDegrees(lla.lat, lla.lon, lla.alt);
  }

  // ==================== Convenience Methods ====================

  /**
   * Gets the current position (using system time).
   * @returns Current lat/lon/alt, or null if current time is outside waypoint range
   */
  getCurrentLLA(): LlaVec3<Degrees, Kilometers> | null {
    return this.getLLA(new Date());
  }

  /**
   * Gets the current ECI position (using system time).
   * @returns Current ECI position, or null if current time is outside waypoint range
   */
  getCurrentEci(): TemeVec3<Kilometers> | null {
    return this.getEci(new Date());
  }

  // ==================== Waypoint Management ====================

  /**
   * Adds a new waypoint to the path.
   * Waypoints are automatically sorted by time.
   * @param waypoint - The waypoint to add
   */
  addWaypoint(waypoint: WaypointData): void {
    // Finite lat/lon in range and a finite (possibly negative) altitude
    GroundObject.validateLla(waypoint.lat, waypoint.lon, waypoint.alt);

    this.waypoints_.push(waypoint);
    this.waypoints_.sort((a, b) => a.time.getTime() - b.time.getTime());

    // Recompute spline coefficients if using spline interpolation
    if (this.interpolationMethod_ === 'spline') {
      this.computeSplineCoefficients_();
    }
  }

  /**
   * Removes a waypoint at a specific time.
   * @param time - The exact time of the waypoint to remove
   * @returns true if a waypoint was removed, false otherwise
   */
  removeWaypoint(time: Date): boolean {
    const timeMs = time.getTime();
    const initialLength = this.waypoints_.length;

    this.waypoints_ = this.waypoints_.filter((wp) => wp.time.getTime() !== timeMs);

    if (this.waypoints_.length === 0) {
      throw new Error('Cannot remove last waypoint - DynamicGroundObject requires at least one waypoint');
    }

    const removed = this.waypoints_.length < initialLength;

    // Recompute spline coefficients if using spline interpolation and waypoint was removed
    if (removed && this.interpolationMethod_ === 'spline') {
      this.computeSplineCoefficients_();
    }

    return removed;
  }

  /**
   * Returns all waypoints (copy to prevent external modification).
   */
  get waypoints(): WaypointData[] {
    return this.waypoints_.map((wp) => ({
      time: new Date(wp.time.getTime()),
      lat: wp.lat,
      lon: wp.lon,
      alt: wp.alt,
      metadata: wp.metadata ? { ...wp.metadata } : undefined,
    }));
  }

  /**
   * Returns the number of waypoints.
   */
  get waypointCount(): number {
    return this.waypoints_.length;
  }

  // ==================== Time Window ====================

  /**
   * Returns the start time of the waypoint path.
   */
  get startTime(): Date {
    return new Date(this.waypoints_[0].time.getTime());
  }

  /**
   * Returns the end time of the waypoint path.
   */
  get endTime(): Date {
    return new Date(this.waypoints_[this.waypoints_.length - 1].time.getTime());
  }

  /**
   * Checks if a given time is within the waypoint path time range.
   * @param time - The time to check
   */
  isValidAt(time: Date): boolean {
    const timeMs = time.getTime();

    return timeMs >= this.waypoints_[0].time.getTime() && timeMs <= this.waypoints_[this.waypoints_.length - 1].time.getTime();
  }

  /**
   * Returns the total duration of the waypoint path in milliseconds.
   */
  get duration(): number {
    return this.endTime.getTime() - this.startTime.getTime();
  }

  // ==================== Trail / History ====================

  /**
   * Enables position history tracking.
   * @param config - History configuration options
   */
  override enableHistory(config?: HistoryConfig): void {
    this.positionHistory_ = new History<LlaVec3<Degrees, Kilometers>>(config);
  }

  /**
   * Disables position history tracking and clears existing history.
   */
  override disableHistory(): void {
    this.positionHistory_ = null;
  }

  /**
   * Returns the position history, or null if not enabled.
   * Note: This is separate from the base class history which tracks HistoricalState.
   */
  get positionHistory(): History<LlaVec3<Degrees, Kilometers>> | null {
    return this.positionHistory_;
  }

  /**
   * The inherited TEME state history (`History<HistoricalState>`), which a DynamicGroundObject
   * does not record: always null. The LLA trail is in {@link positionHistory}.
   *
   * @remarks
   * Before v8 this getter returned the LLA history under the base-class name with an
   * incompatible type, which made a DynamicGroundObject unassignable to GroundObject (so it
   * could not be passed as an observer to `Satellite.rae()`).
   */
  override get history(): History<HistoricalState> | null {
    return null;
  }

  /**
   * Returns true if position (LLA) history tracking is enabled ({@link positionHistory}).
   */
  override get isHistoryEnabled(): boolean {
    return this.positionHistory_ !== null;
  }

  /**
   * Override to prevent use of base class history recording.
   * DynamicGroundObject uses recordPosition_ for LLA tracking instead.
   */
  protected override recordToHistory(_time: Date, _state: HistoricalState): void {
    // Intentionally empty - DynamicGroundObject uses recordPosition_ instead
  }

  /**
   * Returns recent positions as a trail.
   * Uses history if enabled, otherwise samples from waypoints.
   * @param maxPoints - Maximum number of points to return (defaults to 100)
   * @returns Array of time/position pairs
   */
  getTrail(maxPoints = 100): Array<{ time: Date; lla: LlaVec3<Degrees, Kilometers> }> {
    // If history is enabled, use it
    if (this.positionHistory_ && this.positionHistory_.length > 0) {
      const entries = this.positionHistory_.getLast(maxPoints);

      return entries.map((entry) => ({ time: entry.time, lla: entry.data }));
    }

    // Otherwise, sample from waypoints
    if (this.waypoints_.length <= maxPoints) {
      return this.waypoints_.map((wp) => ({
        time: new Date(wp.time.getTime()),
        lla: { lat: wp.lat, lon: wp.lon, alt: wp.alt },
      }));
    }

    // Sample evenly across waypoints
    const result: Array<{ time: Date; lla: LlaVec3<Degrees, Kilometers> }> = [];
    const step = (this.waypoints_.length - 1) / (maxPoints - 1);

    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.min(Math.round(i * step), this.waypoints_.length - 1);
      const wp = this.waypoints_[idx];

      result.push({
        time: new Date(wp.time.getTime()),
        lla: { lat: wp.lat, lon: wp.lon, alt: wp.alt },
      });
    }

    return result;
  }

  // ==================== Configuration ====================

  /**
   * Returns the current interpolation method.
   */
  get interpolationMethod(): GroundInterpolationMethod {
    return this.interpolationMethod_;
  }

  /**
   * Sets the interpolation method.
   * @param method - The new interpolation method
   */
  set interpolationMethod(method: GroundInterpolationMethod) {
    this.interpolationMethod_ = method;
    if (method === 'spline' && this.waypoints_.length >= 2) {
      this.computeSplineCoefficients_();
    }
  }

  // ==================== Type Checking ====================

  override isGroundObject(): boolean {
    return true;
  }

  // ==================== Cloning ====================

  /**
   * Creates a deep copy of this dynamic ground object.
   *
   * By default, history configuration is preserved but starts empty.
   * Pass `{ cloneHistory: true }` to also clone the history entries.
   *
   * @param options - Clone options
   */
  clone(options?: DynamicGroundObjectCloneOptions): DynamicGroundObject {
    const cloned = new DynamicGroundObject({
      id: this.id,
      name: this.name,
      waypoints: this.waypoints_.map((wp) => ({
        time: new Date(wp.time.getTime()),
        lat: wp.lat,
        lon: wp.lon,
        alt: wp.alt,
        metadata: wp.metadata ? { ...wp.metadata } : undefined,
      })),
      interpolationMethod: this.interpolationMethod_,
      active: this.active,
      metadata: this.metadata ? { ...this.metadata } : undefined,
      // Preserve history config if enabled (starts with empty history)
      historyConfig: this.isHistoryEnabled ? this.positionHistory_!.config : undefined,
    });

    // Deep clone sensors and comm devices so their parent is the clone, not this object
    cloned.sensors = this.sensors.map((sensor) => {
      const clonedSensor = (sensor as Sensor).clone();

      clonedSensor.setParent(cloned);

      return clonedSensor;
    });
    cloned.commDevices = this.commDevices.map((device) => {
      const clonedDevice = (device as CommunicationDevice).clone();

      clonedDevice.setParent(cloned);

      return clonedDevice;
    });

    // Clone history data if requested
    if (options?.cloneHistory && this.positionHistory_) {
      cloned.disableHistory();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cloned as any).positionHistory_ = this.positionHistory_.clone();
    }

    return cloned;
  }

  // ==================== Serialization ====================

  protected serializeSpecific(): Record<string, unknown> {
    return {
      waypoints: this.waypoints_.map((wp) => ({
        time: wp.time.toISOString(),
        lat: wp.lat,
        lon: wp.lon,
        alt: wp.alt,
        metadata: wp.metadata,
      })),
      interpolationMethod: this.interpolationMethod_,
      sensorIds: this.sensors.map((s) => s.id),
      commDeviceIds: this.commDevices.map((d) => d.id),
    };
  }

  // ==================== Private Methods ====================

  /**
   * Finds the two waypoints that bracket the given time.
   */
  private findBracketingWaypoints_(time: Date): { before: WaypointData; after: WaypointData | null } | null {
    const timeMs = time.getTime();
    const n = this.waypoints_.length;

    // Check if time is before first waypoint
    if (timeMs < this.waypoints_[0].time.getTime()) {
      return null;
    }

    // Check if time is after last waypoint
    if (timeMs > this.waypoints_[n - 1].time.getTime()) {
      return null;
    }

    // Binary search for bracketing waypoints
    let left = 0;
    let right = n - 1;

    while (left <= right) {
      const mid = (left + right) >>> 1;
      const midTime = this.waypoints_[mid].time.getTime();

      if (midTime === timeMs) {
        return { before: this.waypoints_[mid], after: null };
      }

      if (midTime < timeMs) {
        // Check if next waypoint is after the target time
        if (mid + 1 < n && this.waypoints_[mid + 1].time.getTime() > timeMs) {
          return { before: this.waypoints_[mid], after: this.waypoints_[mid + 1] };
        }
        left = mid + 1;
      } else {
        // midTime > timeMs
        // Check if previous waypoint is before the target time
        if (mid > 0 && this.waypoints_[mid - 1].time.getTime() <= timeMs) {
          return { before: this.waypoints_[mid - 1], after: this.waypoints_[mid] };
        }
        right = mid - 1;
      }
    }

    // Shouldn't reach here if logic is correct
    return null;
  }

  /**
   * Interpolates position between two waypoints.
   */
  private interpolate_(before: WaypointData, after: WaypointData, time: Date): LlaVec3<Degrees, Kilometers> {
    switch (this.interpolationMethod_) {
      case 'linear':
        return this.linearInterpolate_(before, after, time);
      case 'greatCircle':
        return this.greatCircleInterpolate_(before, after, time);
      case 'spline':
        return this.splineInterpolate_(time);
      default:
        return this.greatCircleInterpolate_(before, after, time);
    }
  }

  /**
   * Simple linear interpolation of lat/lon/alt.
   */
  private linearInterpolate_(before: WaypointData, after: WaypointData, time: Date): LlaVec3<Degrees, Kilometers> {
    const t0 = before.time.getTime();
    const t1 = after.time.getTime();
    const t = time.getTime();
    const fraction = (t - t0) / (t1 - t0);

    return {
      lat: (before.lat + (after.lat - before.lat) * fraction) as Degrees,
      lon: this.interpolateLongitude_(before.lon, after.lon, fraction),
      alt: (before.alt + (after.alt - before.alt) * fraction) as Kilometers,
    };
  }

  /**
   * Great circle (spherical linear) interpolation.
   * Uses SLERP for accurate surface paths.
   */
  private greatCircleInterpolate_(before: WaypointData, after: WaypointData, time: Date): LlaVec3<Degrees, Kilometers> {
    const t0 = before.time.getTime();
    const t1 = after.time.getTime();
    const t = time.getTime();
    const fraction = (t - t0) / (t1 - t0);

    // Convert to radians
    const lat1 = before.lat * DEG2RAD;
    const lon1 = before.lon * DEG2RAD;
    const lat2 = after.lat * DEG2RAD;
    const lon2 = after.lon * DEG2RAD;

    // Calculate angular distance between points
    const d = this.angularDistance_(lat1, lon1, lat2, lon2);

    // Handle case where points are the same or nearly the same
    if (d < 1e-10) {
      return {
        lat: before.lat,
        lon: before.lon,
        alt: (before.alt + (after.alt - before.alt) * fraction) as Kilometers,
      };
    }

    // Antipodal (or nearly antipodal) points: every great circle through them is equally short,
    // so SLERP is undefined (sin d = 0 gives NaN). Fall back to linear lat/lon interpolation.
    const sinD = Math.sin(d);

    if (sinD < 1e-9) {
      return this.linearInterpolate_(before, after, time);
    }

    // Spherical linear interpolation (SLERP)
    const a = Math.sin((1 - fraction) * d) / sinD;
    const b = Math.sin(fraction * d) / sinD;

    // Convert to Cartesian for interpolation
    const x1 = Math.cos(lat1) * Math.cos(lon1);
    const y1 = Math.cos(lat1) * Math.sin(lon1);
    const z1 = Math.sin(lat1);

    const x2 = Math.cos(lat2) * Math.cos(lon2);
    const y2 = Math.cos(lat2) * Math.sin(lon2);
    const z2 = Math.sin(lat2);

    // Interpolated Cartesian coordinates
    const x = a * x1 + b * x2;
    const y = a * y1 + b * y2;
    const z = a * z1 + b * z2;

    // Convert back to lat/lon
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);

    // Linear interpolation for altitude
    const alt = before.alt + (after.alt - before.alt) * fraction;

    return {
      lat: (lat * RAD2DEG) as Degrees,
      lon: (lon * RAD2DEG) as Degrees,
      alt: alt as Kilometers,
    };
  }

  /**
   * Cubic spline interpolation for smooth paths.
   */
  private splineInterpolate_(time: Date): LlaVec3<Degrees, Kilometers> {
    if (!this.splineCoeffs_ || this.waypoints_.length < 2) {
      // Fall back to linear interpolation
      const bracket = this.findBracketingWaypoints_(time);

      if (!bracket || !bracket.after) {
        return { lat: this.waypoints_[0].lat, lon: this.waypoints_[0].lon, alt: this.waypoints_[0].alt };
      }

      return this.linearInterpolate_(bracket.before, bracket.after, time);
    }

    const t = time.getTime();
    const n = this.waypoints_.length;

    // Find the segment
    let segIdx = 0;

    for (let i = 0; i < n - 1; i++) {
      if (t <= this.waypoints_[i + 1].time.getTime()) {
        segIdx = i;
        break;
      }
      segIdx = i;
    }

    const t0 = this.waypoints_[segIdx].time.getTime();
    const t1 = this.waypoints_[segIdx + 1].time.getTime();

    if (t1 === t0) {
      return { lat: this.waypoints_[segIdx].lat, lon: this.waypoints_[segIdx].lon, alt: this.waypoints_[segIdx].alt };
    }

    // Seconds since the start of the segment (the spline is built on the real knot times)
    const u = (t - t0) / 1000;

    // Evaluate spline for each coordinate
    const lat = this.evalCubic_(this.splineCoeffs_.latCoeffs[segIdx], u);
    const lon = this.evalCubic_(this.splineCoeffs_.lonCoeffs[segIdx], u);
    const alt = this.evalCubic_(this.splineCoeffs_.altCoeffs[segIdx], u);

    return {
      lat: lat as Degrees,
      lon: this.normalizeLongitude_(lon) as Degrees,
      alt: alt as Kilometers,
    };
  }

  /**
   * Computes cubic spline coefficients for all segments.
   * Uses natural cubic spline (second derivative = 0 at endpoints) on the real waypoint times.
   */
  private computeSplineCoefficients_(): void {
    const n = this.waypoints_.length;

    if (n < 2) {
      this.splineCoeffs_ = null;

      return;
    }

    // For longitude, we need to handle wrapping
    const unwrappedLons = this.unwrapLongitudes_();
    // Knot times in seconds
    const knots = this.waypoints_.map((wp) => wp.time.getTime() / 1000);

    this.splineCoeffs_ = {
      latCoeffs: this.computeNaturalCubicSpline_(knots, this.waypoints_.map((wp) => wp.lat)),
      lonCoeffs: this.computeNaturalCubicSpline_(knots, unwrappedLons),
      altCoeffs: this.computeNaturalCubicSpline_(knots, this.waypoints_.map((wp) => wp.alt)),
    };
  }

  /**
   * Natural cubic spline through (x_i, y_i) with unequal knot spacing (Burden and Faires,
   * Numerical Analysis, Algorithm 3.4). Returns per-segment coefficients [a, b, c, d] with
   * S_i(dx) = a + b dx + c dx^2 + d dx^3 and dx = x - x_i in the units of x (seconds here).
   * With two points, or when two waypoints share a time, the result is piecewise linear.
   * @param x - Non-decreasing knot abscissae.
   * @param y - Values at the knots.
   * @returns Coefficients for each of the x.length - 1 segments.
   */
  private computeNaturalCubicSpline_(x: number[], y: number[]): number[][] {
    const n = y.length;

    if (n < 2) {
      return [];
    }

    const h: number[] = [];

    for (let i = 0; i < n - 1; i++) {
      h.push(x[i + 1] - x[i]);
    }

    if (n === 2 || h.some((hi) => hi <= 0)) {
      return h.map((hi, i) => [y[i], hi > 0 ? (y[i + 1] - y[i]) / hi : 0, 0, 0]);
    }

    const alpha: number[] = new Array(n).fill(0);

    for (let i = 1; i < n - 1; i++) {
      alpha[i] = (3 / h[i]) * (y[i + 1] - y[i]) - (3 / h[i - 1]) * (y[i] - y[i - 1]);
    }

    // Thomas algorithm for the tridiagonal system in the second-derivative terms c_i
    const l: number[] = new Array(n).fill(1);
    const mu: number[] = new Array(n).fill(0);
    const z: number[] = new Array(n).fill(0);

    for (let i = 1; i < n - 1; i++) {
      l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
      mu[i] = h[i] / l[i];
      z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }

    const c: number[] = new Array(n).fill(0);
    // c[n-1] = 0 (natural spline)

    for (let j = n - 2; j >= 0; j--) {
      c[j] = z[j] - mu[j] * c[j + 1];
    }

    const coeffs: number[][] = [];

    for (let i = 0; i < n - 1; i++) {
      const b = (y[i + 1] - y[i]) / h[i] - (h[i] * (c[i + 1] + 2 * c[i])) / 3;
      const d = (c[i + 1] - c[i]) / (3 * h[i]);

      coeffs.push([y[i], b, c[i], d]);
    }

    return coeffs;
  }

  /**
   * Evaluates a cubic polynomial at u (seconds from the segment start).
   */
  private evalCubic_(coeffs: number[], u: number): number {
    // f(u) = a + b*u + c*u^2 + d*u^3
    return coeffs[0] + coeffs[1] * u + coeffs[2] * u * u + coeffs[3] * u * u * u;
  }

  /**
   * Unwraps longitudes to avoid discontinuities at -180/180 boundary.
   */
  private unwrapLongitudes_(): number[] {
    const unwrapped: number[] = [this.waypoints_[0].lon];

    for (let i = 1; i < this.waypoints_.length; i++) {
      let lon: number = this.waypoints_[i].lon;
      const prevLon = unwrapped[i - 1];
      let diff = lon - prevLon;

      // Adjust if crossing -180/180 boundary
      while (diff > 180) {
        lon -= 360;
        diff = lon - prevLon;
      }
      while (diff < -180) {
        lon += 360;
        diff = lon - prevLon;
      }

      unwrapped.push(lon);
    }

    return unwrapped;
  }

  /**
   * Normalizes longitude to [-180, 180] range.
   */
  private normalizeLongitude_(lon: number): number {
    while (lon > 180) {
      lon -= 360;
    }
    while (lon < -180) {
      lon += 360;
    }

    return lon;
  }

  /**
   * Interpolates longitude with proper handling of -180/180 wrap.
   */
  private interpolateLongitude_(lon1: Degrees, lon2: Degrees, fraction: number): Degrees {
    let diff = lon2 - lon1;

    // Handle wrap-around
    if (diff > 180) {
      diff -= 360;
    }
    if (diff < -180) {
      diff += 360;
    }

    let result = lon1 + diff * fraction;

    // Normalize to [-180, 180]
    if (result > 180) {
      result -= 360;
    }
    if (result < -180) {
      result += 360;
    }

    return result as Degrees;
  }

  /**
   * Calculates angular distance between two points using Haversine formula.
   */
  private angularDistance_(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = lon2 - lon1;
    const dLat = lat2 - lat1;
    const sinHalfDLat = Math.sin(dLat / 2);
    const sinHalfDLon = Math.sin(dLon / 2);
    const a = sinHalfDLat * sinHalfDLat + Math.cos(lat1) * Math.cos(lat2) * sinHalfDLon * sinHalfDLon;

    return 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /**
   * Records a position to history if enabled.
   */
  private recordPosition_(time: Date, lla: LlaVec3<Degrees, Kilometers>): void {
    if (this.positionHistory_) {
      this.positionHistory_.add(time, lla);
    }
  }
}
