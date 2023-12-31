import { Kilometers, Radians } from '@src/ootk';
import { astronomicalUnit, deg2rad, speedOfLight } from '../operations/constants';
import { angularDiameter, AngularDiameterMethod } from '../operations/functions';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { Earth } from './Earth';

// / Sun metrics and operations.
export class Sun {
  private constructor() {
    // disable constructor
  }

  /**
   * Gravitational parameter of the Sun. (km³/s²)
   */
  static readonly mu = 1.32712428e11;

  /**
   * The mean solar flux of the Sun. (W/m²)
   */
  static readonly solarFlux = 1367.0;

  /**
   * The solar pressure exerted by the Sun. (N/m²)
   * It is calculated as the solar flux divided by the speed of light.
   */
  static readonly solarPressure = Sun.solarFlux / (speedOfLight * 1000);

  /**
   * The angle of the umbra, in radians.
   */
  static readonly umbraAngle = (0.26411888 * deg2rad) as Radians;

  /**
   * The angle of the penumbra of the Sun, in radians.
   */
  static readonly penumbraAngle = (0.26900424 * deg2rad) as Radians;

  /**
   * The radius of the Sun in kilometers.
   */
  static readonly radius = 695500.0 as Kilometers;

  /**
   * Calculates the position vector of the Sun at a given epoch in the Earth-centered inertial (ECI) coordinate system.
   * @param epoch - The epoch in UTC.
   * @returns The position vector of the Sun in meters.
   */
  static position(epoch: EpochUTC): Vector3D {
    const jc = epoch.toJulianCenturies();
    const dtr = deg2rad;
    const lamSun = 280.46 + 36000.77 * jc;
    const mSun = 357.5291092 + 35999.05034 * jc;
    const lamEc = lamSun + 1.914666471 * Math.sin(mSun * dtr) + 0.019994643 * Math.sin(2.0 * mSun * dtr);
    const obliq = 23.439291 - 0.0130042 * jc;
    const rMag = 1.000140612 - 0.016708617 * Math.cos(mSun * dtr) - 0.000139589 * Math.cos(2.0 * mSun * dtr);
    const r = new Vector3D(
      rMag * Math.cos(lamEc * dtr),
      rMag * Math.cos(obliq * dtr) * Math.sin(lamEc * dtr),
      rMag * Math.sin(obliq * dtr) * Math.sin(lamEc * dtr),
    );
    const rMOD = r.scale(astronomicalUnit);
    const p = Earth.precession(epoch);

    return rMOD.rotZ(p.zed).rotY(-p.theta).rotZ(p.zeta);
  }

  /**
   * Calculate the Sun's apparent ECI position _(km)_ from Earth for a given UTC [epoch].
   */
  static positionApparent(epoch: EpochUTC): Vector3D {
    const distance = Sun.position(epoch).magnitude();
    const dSec = distance / speedOfLight;

    return Sun.position(epoch.roll(-dSec));
  }

  /**
   * Return `true` if the ECI satellite position [posSat] is in eclipse at the given UTC [epoch].
   */
  static shadow(epoch: EpochUTC, posSat: Vector3D): boolean {
    const posSun = Sun.positionApparent(epoch);
    let shadow = false;

    if (posSun.dot(posSat) < 0) {
      const angle = posSun.angle(posSat);
      const r = posSat.magnitude();
      const satHoriz = r * Math.cos(angle);
      const satVert = r * Math.sin(angle);
      const penVert = Earth.radiusEquator + Math.tan(this.penumbraAngle) * satHoriz;

      if (satVert <= penVert) {
        shadow = true;
      }
    }

    return shadow;
  }

  /**
   * Calculate eclipse angles given a satellite ECI position [satPos] _(km)_
   * and Sun ECI position [sunPos] _(km)_.
   *
   * Returns a tuple containing the following three values:
   *   - central body angle _(rad)_
   *   - central body apparant radius _(rad)_
   *   - sun apparant radius _(rad)_
   */
  static eclipseAngles(satPos: Vector3D, sunPos: Vector3D): [number, number, number] {
    const satSun = sunPos.subtract(satPos);
    const r = satPos.magnitude();

    return [
      // central body angle
      satSun.angle(satPos.negate()),
      // central body apparent radius
      Math.asin(Earth.radiusEquator / r),
      // sun apparent radius
      Math.asin(this.radius / satSun.magnitude()),
    ];
  }

  /**
   * Calculate the lighting ratio given a satellite ECI position [satPos]
   * _(km)_ and Sun ECI position [sunPos] _(km)_.
   *
   * Returns `1.0` if the satellite is fully illuminated and `0.0` when
   * fully eclipsed.
   */
  static lightingRatio(satPos: Vector3D, sunPos: Vector3D): number {
    const [sunSatAngle, aCent, aSun] = Sun.eclipseAngles(satPos, sunPos);

    if (sunSatAngle - aCent + aSun <= 1e-10) {
      return 0.0;
    } else if (sunSatAngle - aCent - aSun < -1e-10) {
      const ssa2 = sunSatAngle * sunSatAngle;
      const ssaInv = 1.0 / (2.0 * sunSatAngle);
      const ac2 = aCent * aCent;
      const as2 = aSun * aSun;
      const acAsDiff = ac2 - as2;
      const a1 = (ssa2 - acAsDiff) * ssaInv;
      const a2 = (ssa2 + acAsDiff) * ssaInv;
      const asr1 = a1 / aSun;
      const asr2 = as2 - a1 * a1;
      const acr1 = a2 / aCent;
      const acr2 = ac2 - a2 * a2;
      const p1 = as2 * Math.acos(asr1) - a1 * Math.sqrt(asr2);
      const p2 = ac2 * Math.acos(acr1) - a2 * Math.sqrt(acr2);

      return 1.0 - (p1 + p2) / (Math.PI * as2);
    }

    return 1.0;
  }

  /**
   * Calculate the Sun's angular diameter _(rad)_ from an ECI observer
   * position [obsPos] and Sun position [sunPos] _(km)_.
   */
  static diameter(obsPos: Vector3D, sunPos: Vector3D): number {
    return angularDiameter(this.radius * 2, obsPos.subtract(sunPos).magnitude(), AngularDiameterMethod.Sphere);
  }
}
