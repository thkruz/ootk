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
  /** Secondary Maximum Azimuth in Degrees */
  maxAz2?: Degrees;
  /** Maximum Elevation in Degrees */
  maxEl: Degrees;
  /** Secondary Maximum Elevation in Degrees */
  maxEl2?: Degrees;
  /** Maximum Range in Kilometers */
  maxRng: Kilometers;
  /** Secondary Maximum Range in Kilometers */
  maxRng2?: Kilometers;
  /** Minimum Azimuth in Degrees */
  minAz: Degrees;
  /** Secondary Minimum Azimuth in Degrees */
  minAz2?: Degrees;
  /** Minimum Elevation in Degrees */
  minEl: Degrees;
  /** Secondary Minimum Elevation in Degrees */
  minEl2?: Degrees;
  /** Minimum Range in Kilometers */
  minRng: Kilometers;
  /** Secondary Minimum Range in Kilometers */
  minRng2?: Kilometers;
  /** Name as a string */
  name?: string;
  /** Type of sensor */
  type?: SpaceObjectType;
}
