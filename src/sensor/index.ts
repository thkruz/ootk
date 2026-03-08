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

/**
 * Sensor Module
 *
 * This module provides a component-based sensor architecture where sensors
 * attach to platforms (ground stations or satellites) rather than inheriting
 * location information.
 *
 * @example
 * ```typescript
 * import {
 *   PhasedArrayRadar,
 *   OpticalSensor,
 *   FieldOfView,
 * } from 'ootk/sensor';
 *
 * // Create a phased array radar
 * const radar = new PhasedArrayRadar({
 *   id: 'radar-1',
 *   name: 'Tracking Radar',
 *   beamwidth: 2 as Degrees,
 *   boresightAz: [0 as Degrees],
 *   boresightEl: [45 as Degrees],
 *   fieldOfView: {
 *     minRange: 100 as Kilometers,
 *     maxRange: 40000 as Kilometers,
 *     minAzimuth: 0 as Degrees,
 *     maxAzimuth: 120 as Degrees,
 *     minElevation: 5 as Degrees,
 *     maxElevation: 85 as Degrees,
 *   },
 * });
 *
 * // Attach to a ground station
 * groundStation.addSensor(radar);
 * radar.setParent(groundStation);
 *
 * // Observe a satellite
 * if (radar.canObserve(satellite)) {
 *   const observation = radar.observe(satellite);
 * }
 * ```
 */

// Base classes and types
export { boresightFrameFromAzElRoll, FieldOfView } from './FieldOfView';
export type { BoresightFrame, ElevationMask, FieldOfViewParams } from './FieldOfView';
export { Sensor } from './Sensor';
export type { SensorParams, SensorPlatform, SerializedSensor } from './Sensor';

// Radar sensors
export { RadarSensor } from './RadarSensor';
export type { RadarSensorParams } from './RadarSensor';
export { PhasedArrayRadar } from './PhasedArrayRadar';
export type { PhasedArrayRadarParams } from './PhasedArrayRadar';
export { MechanicalRadar } from './MechanicalRadar';
export type { MechanicalRadarParams } from './MechanicalRadar';

// Optical and passive sensors
export { OpticalSensor } from './OpticalSensor';
export type { OpticalSensorParams } from './OpticalSensor';
export { LaserRangingSensor, SLR_WAVELENGTHS } from './LaserRangingSensor';
export type { LaserRangingSensorParams } from './LaserRangingSensor';
export { PassiveRFSensor } from './PassiveRFSensor';
export type { PassiveRFSensorParams } from './PassiveRFSensor';
