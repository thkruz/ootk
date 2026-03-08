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

import type { ClassicalElements } from '../coordinate/ClassicalElements';
import type { ITRF } from '../coordinate/ITRF';
import type { J2000 } from '../coordinate/J2000';
import {
  Degrees,
  EcefVec3,
  Kilometers,
  KilometersPerSecond,
  LlaVec3,
  PosVel,
  RaeVec3,
  TemeVec3,
} from '../types/types';
import { ecef2rae } from '../transforms/transforms';
import { GroundObject } from './GroundObject';
import { BaseObject, BaseObjectParams } from './BaseObject';
import { CommunicationDeviceInterface, SensorInterface } from './ObjectTypes';

/**
 * Parameters for constructing a SpaceObject.
 */
export interface SpaceObjectParams extends BaseObjectParams {
  /** Initial position in TEME frame */
  position?: TemeVec3;
  /** Initial velocity in TEME frame */
  velocity?: TemeVec3<KilometersPerSecond>;
}

/**
 * Abstract base class for all objects in space (satellites, debris, etc.).
 * Provides position/velocity state, coordinate conversion methods,
 * and component attachment capabilities.
 */
export abstract class SpaceObject extends BaseObject {
  /**
   * Current position in TEME (True Equator Mean Equinox) frame.
   * This is a cache of the last computed state.
   */
  position: TemeVec3;
  /**
   * Current velocity in TEME (True Equator Mean Equinox) frame.
   * This is a cache of the last computed state.
   */
  velocity: TemeVec3<KilometersPerSecond>;

  /** Sensors attached to this space object */
  sensors: SensorInterface[] = [];
  /** Communication devices attached to this space object */
  commDevices: CommunicationDeviceInterface[] = [];

  constructor(info: SpaceObjectParams) {
    super(info);

    // Default to origin until position is calculated
    this.position = info.position ?? {
      x: 0 as Kilometers,
      y: 0 as Kilometers,
      z: 0 as Kilometers,
    };

    // Default to zero velocity until calculated
    this.velocity = info.velocity ?? {
      x: 0 as KilometersPerSecond,
      y: 0 as KilometersPerSecond,
      z: 0 as KilometersPerSecond,
    };
  }

  // ==================== Computed Properties ====================

  /**
   * Returns the total velocity magnitude in km/s.
   */
  get totalVelocity(): number {
    return Math.hypot(
      this.velocity.x,
      this.velocity.y,
      this.velocity.z,
    );
  }

  // ==================== Abstract Position Methods ====================

  /**
   * Returns the position and velocity in the TEME (True Equator Mean Equinox) frame at the given time.
   *
   * **Coordinate Frame: TEME (Earth-Centered Inertial)**
   *
   * TEME is the native output frame of SGP4/SDP4 propagation. It is an inertial frame
   * that uses the true equator of date and a simplified mean equinox. For standard J2000
   * ECI coordinates, use {@link toJ2000} instead.
   *
   * **Frame comparison:**
   * | Method | Frame | Inertial | Precision | Use Case |
   * |--------|-------|----------|-----------|----------|
   * | `eci()` | TEME | Yes | Lower | SGP4-native, visualization |
   * | `toJ2000()` | J2000 | Yes | Higher | Force models, interop |
   * | `ecef()` | ECEF | No | Lower | Quick Earth-fixed |
   * | `toITRF()` | ITRF | No | Higher | Precise Earth-fixed |
   *
   * @param date - The time to calculate position for (defaults to now)
   * @returns Position and velocity in TEME frame, or null if propagation fails
   */
  abstract eci(date?: Date): PosVel | null;

  /**
   * Returns the position in ECEF (Earth-Centered Earth-Fixed) coordinates at the given time.
   *
   * **Coordinate Frame: ECEF (Earth-Fixed)**
   *
   * ECEF coordinates rotate with the Earth. This uses a simplified transformation from TEME
   * based on GMST rotation. For higher precision Earth-fixed coordinates, use {@link toITRF}.
   *
   * @param date - The time to calculate position for (defaults to now)
   * @returns ECEF position, or null if propagation fails
   */
  abstract ecef(date?: Date): EcefVec3<Kilometers> | null;

  /**
   * Returns the geodetic position (latitude, longitude, altitude) at the given time.
   *
   * **Coordinate System: Geodetic (WGS84)**
   *
   * Returns geographic coordinates on the WGS84 ellipsoid. Derived from ECEF coordinates.
   *
   * @param date - The time to calculate position for (defaults to now)
   * @returns Geodetic coordinates (lat/lon in degrees, alt in km), or null if propagation fails
   */
  abstract lla(date?: Date): LlaVec3<Degrees, Kilometers> | null;

  // ==================== Observer Methods ====================

  /**
   * Returns the Range, Azimuth, and Elevation from a ground observer.
   * @param observer - The ground observer's position
   * @param date - The time to calculate for (defaults to now)
   * @returns RAE coordinates (range in km, az/el in degrees), or null if position cannot be calculated
   */
  rae(observer: GroundObject, date?: Date): RaeVec3<Kilometers, Degrees> | null {
    const ecef = this.ecef(date);

    if (!ecef) {
      return null;
    }

    return ecef2rae(observer.lla(), ecef);
  }

  /**
   * Returns the azimuth angle from a ground observer.
   * @param observer - The ground observer's position
   * @param date - The time to calculate for (defaults to now)
   * @returns Azimuth in degrees (0-360), or null if position cannot be calculated
   */
  az(observer: GroundObject, date?: Date): Degrees | null {
    return this.rae(observer, date)?.az ?? null;
  }

  /**
   * Returns the elevation angle from a ground observer.
   * @param observer - The ground observer's position
   * @param date - The time to calculate for (defaults to now)
   * @returns Elevation in degrees (-90 to 90), or null if position cannot be calculated
   */
  el(observer: GroundObject, date?: Date): Degrees | null {
    return this.rae(observer, date)?.el ?? null;
  }

  /**
   * Returns the range (distance) from a ground observer.
   * @param observer - The ground observer's position
   * @param date - The time to calculate for (defaults to now)
   * @returns Range in kilometers, or null if position cannot be calculated
   */
  rng(observer: GroundObject, date?: Date): Kilometers | null {
    return this.rae(observer, date)?.rng ?? null;
  }

  // ==================== Abstract Coordinate Conversions ====================

  /**
   * Returns the state vector in J2000 (EME2000) frame at the given time.
   *
   * **Coordinate Frame: J2000 (Earth-Centered Inertial)**
   *
   * J2000 is the standard Earth-Centered Inertial frame defined at the J2000.0 epoch
   * (January 1, 2000, 12:00 TT). Use this frame for:
   * - Force modeling and numerical propagation
   * - Interoperability with external systems
   * - Precise astrodynamics calculations
   *
   * @param date - The time to calculate for (defaults to now)
   * @returns J2000 state vector with position and velocity
   */
  abstract toJ2000(date?: Date): J2000;

  /**
   * Returns the state vector in ITRF (International Terrestrial Reference Frame) at the given time.
   *
   * **Coordinate Frame: ITRF (Earth-Fixed)**
   *
   * ITRF is the standard Earth-fixed frame maintained by IERS. Unlike the simplified ECEF
   * from `ecef()`, ITRF includes full precession/nutation modeling. Use this frame for:
   * - Precise Earth-fixed coordinates
   * - GPS/GNSS interoperability
   * - Ground track calculations requiring high accuracy
   *
   * @param date - The time to calculate for (defaults to now)
   * @returns ITRF state vector with position and velocity
   */
  abstract toITRF(date?: Date): ITRF;

  /**
   * Returns classical orbital elements at the given time.
   *
   * Classical (Keplerian) elements define the orbit shape and orientation:
   * - Semi-major axis (a), Eccentricity (e), Inclination (i)
   * - Right Ascension of Ascending Node (Ω), Argument of Perigee (ω)
   * - True/Mean Anomaly (ν/M)
   *
   * @param date - The time to calculate for (defaults to now)
   * @returns Classical orbital elements
   */
  abstract toClassicalElements(date?: Date): ClassicalElements;

  // ==================== Abstract Clone ====================

  /**
   * Creates a deep copy of this object.
   * @param options - Optional clone options (implementation-specific)
   */
  abstract clone(options?: Record<string, unknown>): SpaceObject;

  // ==================== Component Management ====================

  /**
   * Adds a sensor to this space object.
   * @param sensor - The sensor to add
   */
  addSensor(sensor: SensorInterface): void {
    if (!this.sensors.some((s) => s.id === sensor.id)) {
      this.sensors.push(sensor);
    }
  }

  /**
   * Removes a sensor from this space object.
   * @param sensorId - The ID of the sensor to remove
   */
  removeSensor(sensorId: number): void {
    this.sensors = this.sensors.filter((s) => s.id !== sensorId);
  }

  /**
   * Adds a communication device to this space object.
   * @param device - The device to add
   */
  addCommDevice(device: CommunicationDeviceInterface): void {
    if (!this.commDevices.some((d) => d.id === device.id)) {
      this.commDevices.push(device);
    }
  }

  /**
   * Removes a communication device from this space object.
   * @param deviceId - The ID of the device to remove
   */
  removeCommDevice(deviceId: number): void {
    this.commDevices = this.commDevices.filter((d) => d.id !== deviceId);
  }

  // ==================== Type Checking Overrides ====================

  /**
   * Space objects are satellites by default.
   */
  override isSatellite(): boolean {
    return true;
  }

  /**
   * Space objects are never static.
   */
  override isStatic(): boolean {
    return false;
  }
}
