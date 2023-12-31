/* eslint-disable class-methods-use-this */
import { Earth } from '../body/Earth';
import { Geodetic } from './Geodetic';
import { J2000 } from './J2000';
import { StateVector } from './StateVector';

/**
 * The International Terrestrial Reference Frame (ITRF) is a geocentric
 * reference frame for the Earth. It is the successor to the International
 * Terrestrial Reference System (ITRS). The ITRF definition is maintained by
 * the International Earth Rotation and Reference Systems Service (IERS).
 * Several versions of ITRF exist, each with a different epoch, to address the
 * issue of crustal motion. The latest version is ITRF2014, based on data
 * collected from 1980 to 2014.
 * @see https://en.wikipedia.org/wiki/International_Terrestrial_Reference_Frame
 *
 * This is a geocentric coordinate system, also referenced as ECEF (Earth
 * Centered Earth Fixed). It is a Cartesian coordinate system with the origin
 * at the center of the Earth. The x-axis intersects the sphere of the Earth
 * at 0° latitude (the equator) and 0° longitude (the Prime Meridian). The
 * z-axis goes through the North Pole. The y-axis goes through 90° East
 * longitude.
 * @see https://en.wikipedia.org/wiki/Earth-centered,_Earth-fixed_coordinate_system
 */
export class ITRF extends StateVector {
  get name(): string {
    return 'ITRF';
  }

  get inertial(): boolean {
    return false;
  }

  getHeight(): number {
    const a = Earth.radiusEquator;
    const e2 = Earth.eccentricitySquared;
    const r = this.position.magnitude();
    const sl = this.position.z / r;
    const cl2 = 1 - sl * sl;
    const coeff = Math.sqrt((1 - e2) / (1 - e2 * cl2));

    return r - a * coeff;
  }

  /**
   * Converts the current coordinate to the J2000 coordinate system.
   * @returns The coordinate in the J2000 coordinate system.
   */
  toJ2000(): J2000 {
    const p = Earth.precession(this.epoch);
    const n = Earth.nutation(this.epoch);
    const ast = this.epoch.gmstAngle() + n.eqEq;
    const rTOD = this.position.rotZ(-ast);
    const vTOD = this.velocity.add(Earth.rotation.cross(this.position)).rotZ(-ast);
    const rMOD = rTOD.rotX(n.eps).rotZ(n.dPsi).rotX(-n.mEps);
    const vMOD = vTOD.rotX(n.eps).rotZ(n.dPsi).rotX(-n.mEps);
    const rJ2000 = rMOD.rotZ(p.zed).rotY(-p.theta).rotZ(p.zeta);
    const vJ2000 = vMOD.rotZ(p.zed).rotY(-p.theta).rotZ(p.zeta);

    return new J2000(this.epoch, rJ2000, vJ2000);
  }

  /**
   * Converts the coordinate from ITRF (ECEF) to J2000 (ECI) reference frame.
   * @returns The coordinate in J2000 (ECI) reference frame.
   */
  toEci(): J2000 {
    return this.toJ2000();
  }

  /**
   * Converts the current ITRF coordinate to Geodetic coordinate.
   * @returns {Geodetic} The converted Geodetic coordinate.
   */
  toGeodetic(): Geodetic {
    const sma = Earth.radiusEquator;
    const esq = Earth.eccentricitySquared;
    const x = this.position.x;
    const y = this.position.y;
    const z = this.position.z;
    const lon = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const phi = Math.atan(z / r);
    let lat = phi;
    let c = 0.0;

    for (let i = 0; i < 12; i++) {
      const slat = Math.sin(lat);

      c = 1 / Math.sqrt(1 - esq * slat * slat);
      lat = Math.atan((z + sma * c * esq * slat) / r);
    }
    const alt = r / Math.cos(lat) - sma * c;

    return new Geodetic(lat, lon, alt);
  }

  /**
   * Converts the current ECI coordinate to latitude, longitude, and altitude.
   */
  toLla(): Geodetic {
    return this.toGeodetic();
  }
}
