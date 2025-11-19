import { Degrees, Kilometers, SpaceObjectType } from '../types/types.js';
import { BaseObjectParams } from './BaseObjectParams.js';

export interface SensorParams extends BaseObjectParams{
  /** Altitude in Kilometers */
  alt: Kilometers;
  /** Latitude in Degrees */
  lat: Degrees;
  /** Longitude in Degrees */
  lon: Degrees;
  /** Maximum Azimuth in Degrees */
  maxAz: Degrees;
  /** Maximum Elevation in Degrees */
  maxEl: Degrees;
  /** Maximum Range in Kilometers */
  maxRng: Kilometers;
  /** Minimum Azimuth in Degrees */
  minAz: Degrees;
  /** Minimum Elevation in Degrees */
  minEl: Degrees;
  /** Minimum Range in Kilometers */
  minRng: Kilometers;
  /** Name as a string */
  name?: string;
  /** Type of sensor */
  type?: SpaceObjectType;
}
