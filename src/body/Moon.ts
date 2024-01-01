import { AngularDiameterMethod } from '../ootk';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { DEG2RAD } from '../utils/constants';
import { angularDiameter } from '../utils/functions';
import { Earth } from './Earth';
import { Sun } from './Sun';

// / Moon metrics and operations.
export class Moon {
  private constructor() {
    // disable constructor
  }

  // / Moon gravitational parameter _(km³/s²)_.
  static mu = 4902.799;

  // / Moon equatorial radius _(km)_.
  static radiusEquator = 1738.0;

  // / Calculate the Moon's ECI position _(km)_ for a given UTC [epoch].
  static position(epoch: EpochUTC): Vector3D {
    const jc = epoch.toJulianCenturies();
    const dtr = DEG2RAD;
    const lamEcl =
      218.32 +
      481267.8813 * jc +
      6.29 * Math.sin((134.9 + 477198.85 * jc) * dtr) -
      1.27 * Math.sin((259.2 - 413335.38 * jc) * dtr) +
      0.66 * Math.sin((235.7 + 890534.23 * jc) * dtr) +
      0.21 * Math.sin((269.9 + 954397.7 * jc) * dtr) -
      0.19 * Math.sin((357.5 + 35999.05 * jc) * dtr) -
      0.11 * Math.sin((186.6 + 966404.05 * jc) * dtr);
    const phiEcl =
      5.13 * Math.sin((93.3 + 483202.03 * jc) * dtr) +
      0.28 * Math.sin((228.2 + 960400.87 * jc) * dtr) -
      0.28 * Math.sin((318.3 + 6003.18 * jc) * dtr) -
      0.17 * Math.sin((217.6 - 407332.2 * jc) * dtr);
    const pllx =
      0.9508 +
      0.0518 * Math.cos((134.9 + 477198.85 * jc) * dtr) +
      0.0095 * Math.cos((259.2 - 413335.38 * jc) * dtr) +
      0.0078 * Math.cos((235.7 + 890534.23 * jc) * dtr) +
      0.0028 * Math.cos((269.9 + 954397.7 * jc) * dtr);
    const obq = 23.439291 - 0.0130042 * jc;
    const rMag = 1 / Math.sin(pllx * dtr);
    const r = new Vector3D(
      rMag * Math.cos(phiEcl * dtr) * Math.cos(lamEcl * dtr),
      rMag *
        (Math.cos(obq * dtr) * Math.cos(phiEcl * dtr) * Math.sin(lamEcl * dtr) -
          Math.sin(obq * dtr) * Math.sin(phiEcl * dtr)),
      rMag *
        (Math.sin(obq * dtr) * Math.cos(phiEcl * dtr) * Math.sin(lamEcl * dtr) +
          Math.cos(obq * dtr) * Math.sin(phiEcl * dtr)),
    );
    const rMOD = r.scale(Earth.radiusEquator);
    const p = Earth.precession(epoch);

    return rMOD.rotZ(p.zed).rotY(-p.theta).rotZ(p.zeta);
  }

  /**
   * Calculates the illumination of the Moon at a given epoch.
   *
   * @param epoch - The epoch in UTC.
   * @param origin - The origin vector. Defaults to the origin vector if not provided.
   * @returns The illumination of the Moon, ranging from 0 to 1.
   */
  static illumination(epoch: EpochUTC, origin?: Vector3D): number {
    const orig = origin ?? Vector3D.origin;
    const sunPos = Sun.position(epoch).subtract(orig);
    const moonPos = this.position(epoch).subtract(orig);
    const phaseAngle = sunPos.angle(moonPos);

    return 0.5 * (1 - Math.cos(phaseAngle));
  }

  /**
   * Calculates the diameter of the Moon.
   *
   * @param obsPos - The position of the observer.
   * @param moonPos - The position of the Moon.
   * @returns The diameter of the Moon.
   */
  static diameter(obsPos: Vector3D, moonPos: Vector3D): number {
    return angularDiameter(this.radiusEquator * 2, obsPos.subtract(moonPos).magnitude(), AngularDiameterMethod.Sphere);
  }
}
