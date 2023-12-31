import { Earth } from '../body/Earth';
import { deg2rad, rad2deg } from '../operations/constants';
import { angularDistance, AngularDistanceMethod } from '../operations/functions';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { ITRF } from './ITRF';

// / Geodetic coordinates.
export class Geodetic {
  latitude: number;
  longitude: number;
  altitude: number;

  constructor(latitude: number, longitude: number, altitude: number) {
    this.latitude = latitude;
    this.longitude = longitude;
    this.altitude = altitude;
  }

  static fromDegrees(latDeg: number, lonDeg: number, alt: number): Geodetic {
    return new Geodetic(latDeg * deg2rad, lonDeg * deg2rad, alt);
  }

  toString(): string {
    return [
      'Geodetic',
      `  Latitude:  ${this.latitudeDegrees.toFixed(4)}°`,
      `  Longitude: ${this.longitudeDegrees.toFixed(4)}°`,
      `  Altitude:  ${this.altitude.toFixed(3)} km`,
    ].join('\n');
  }

  get latitudeDegrees(): number {
    return this.latitude * rad2deg;
  }

  get longitudeDegrees(): number {
    return this.longitude * rad2deg;
  }

  toITRF(epoch: EpochUTC): ITRF {
    const sLat = Math.sin(this.latitude);
    const cLat = Math.cos(this.latitude);
    const nVal = Earth.radiusEquator / Math.sqrt(1 - Earth.eccentricitySquared * sLat * sLat);
    const r = new Vector3D(
      (nVal + this.altitude) * cLat * Math.cos(this.longitude),
      (nVal + this.altitude) * cLat * Math.sin(this.longitude),
      (nVal * (1 - Earth.eccentricitySquared) + this.altitude) * sLat,
    );

    return new ITRF(epoch, r, Vector3D.origin);
  }

  angle(g: Geodetic, method: AngularDistanceMethod = AngularDistanceMethod.Haversine): number {
    return angularDistance(this.longitude, this.latitude, g.longitude, g.latitude, method);
  }

  angleDegrees(g: Geodetic, method: AngularDistanceMethod = AngularDistanceMethod.Haversine): number {
    return this.angle(g, method) * rad2deg;
  }

  distance(g: Geodetic, method: AngularDistanceMethod = AngularDistanceMethod.Haversine): number {
    return this.angle(g, method) * Earth.radiusMean;
  }

  fieldOfView(): number {
    return Math.acos(Earth.radiusMean / (Earth.radiusMean + this.altitude));
  }

  sight(g: Geodetic, method: AngularDistanceMethod = AngularDistanceMethod.Haversine): boolean {
    const fov = Math.max(this.fieldOfView(), g.fieldOfView());

    return this.angle(g, method) <= fov;
  }
}
