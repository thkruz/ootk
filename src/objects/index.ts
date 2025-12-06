export { BaseObject } from './BaseObject';
export { CenterBody, CenterBodyMu, parseCenterBody } from './CenterBody';
export { EphemerisSatellite } from './EphemerisSatellite';
export type { EphemerisSatelliteParams } from './EphemerisSatellite';
export { GroundObject } from './GroundObject';
export type { GroundObjectParams } from './GroundObject';
export { GroundStation } from './GroundStation';
export type { GroundStationParams } from './GroundStation';
export { DynamicGroundObject } from './DynamicGroundObject';
export type { DynamicGroundObjectParams, GroundInterpolationMethod, WaypointData } from './DynamicGroundObject';
export { History } from './History';
export type { HistoryConfig, HistoryEntry } from './History';
export { DEFAULT_INTERPOLATOR, DEFAULT_LAGRANGE_ORDER, InterpolatorType } from './InterpolatorType';
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

// Backward compatibility - DetailedSatellite is now just Satellite
// All detailed properties have been merged into Satellite
/**
 * @deprecated Use Satellite directly - DetailedSatellite properties have been merged into Satellite
 */
export { Satellite as DetailedSatellite } from './Satellite';
