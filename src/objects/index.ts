export { BaseObject } from './BaseObject';
export { DetailedSatellite } from './DetailedSatellite';
export { GroundObject } from './GroundObject';
export type { GroundObjectParams } from './GroundObject';
export { GroundStation } from './GroundStation';
export type { GroundStationParams } from './GroundStation';
export { History } from './History';
export type { HistoryConfig, HistoryEntry } from './History';
export { LandObject } from './LandObject';
export { Marker } from './Marker';
export type {
  CommunicationDeviceInterface,
  HistoricalState,
  PropagatorType,
  SensorInterface,
  SerializedObject,
} from './ObjectTypes';
export { Satellite } from './Satellite';
export { SpaceObject } from './SpaceObject';
export type { SpaceObjectParams } from './SpaceObject';
export { Star } from './Star';

// Legacy sensor exports - deprecated, use sensor module instead
// These will be removed in a future version
/**
 * @deprecated Use sensor classes from the sensor module (e.g., PhasedArrayRadar, OpticalSensor)
 */
export { Sensor as LegacySensor } from './Sensor';
/**
 * @deprecated Use sensor classes from the sensor module
 */
export { DetailedSensor as LegacyDetailedSensor } from './DetailedSensor';
/**
 * @deprecated Use PhasedArrayRadar from sensor module instead
 */
export { RfSensor as LegacyRfSensor } from './RfSensor';
