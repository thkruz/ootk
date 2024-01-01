/* eslint-disable no-undefined */
import { J2000 } from '../coordinate/J2000';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { AngularDistanceMethod } from '../types/types';
import { DEG2RAD, RAD2DEG, TAU } from '../utils/constants';
import { angularDistance } from '../utils/functions';
import { radecToPosition, radecToVelocity } from './ObservationUtils';

// / Topocentric right-ascension and declination.
export class RadecTopocentric {
  // / Create a new [RadecTopocentric] object.
  constructor(
    public epoch: EpochUTC,
    public rightAscension: number,
    public declination: number,
    public range?: number,
    public rightAscensionRate?: number,
    public declinationRate?: number,
    public rangeRate?: number,
  ) {
    // Nothing to do here.
  }

  /**
   * Create a new [RadecTopocentric] object, using degrees for the
   * angular values.
   */
  static fromDegrees(
    epoch: EpochUTC,
    rightAscensionDegrees: number,
    declinationDegrees: number,
    range?: number,
    rightAscensionRateDegrees?: number,
    declinationRateDegrees?: number,
    rangeRate?: number,
  ): RadecTopocentric {
    const rightAscensionRate = rightAscensionRateDegrees !== null ? rightAscensionRateDegrees * DEG2RAD : undefined;
    const declinationRate = declinationRateDegrees !== null ? declinationRateDegrees * DEG2RAD : undefined;

    return new RadecTopocentric(
      epoch,
      rightAscensionDegrees * DEG2RAD,
      declinationDegrees * DEG2RAD,
      range,
      rightAscensionRate,
      declinationRate,
      rangeRate,
    );
  }

  /**
   * Create a [RadecTopocentric] object from an inertial [state] and
   * [site] vector.
   */
  static fromStateVectors(state: J2000, site: J2000): RadecTopocentric {
    const p = state.position.subtract(site.position);
    const pI = p.x;
    const pJ = p.y;
    const pK = p.z;
    const pMag = p.magnitude();
    const declination = Math.asin(pK / pMag);
    const pDot = state.velocity.subtract(site.velocity);
    const pIDot = pDot.x;
    const pJDot = pDot.y;
    const pKDot = pDot.z;
    const pIJMag = Math.sqrt(pI * pI + pJ * pJ);
    let rightAscension;

    if (pIJMag !== 0) {
      rightAscension = Math.atan2(pJ, pI);
    } else {
      rightAscension = Math.atan2(pJDot, pIDot);
    }
    const rangeRate = p.dot(pDot) / pMag;
    const rightAscensionRate = (pIDot * pJ - pJDot * pI) / (-(pJ * pJ) - pI * pI);
    const declinationRate = (pKDot - rangeRate * Math.sin(declination)) / pIJMag;

    return new RadecTopocentric(
      state.epoch,
      rightAscension % TAU,
      declination,
      pMag,
      rightAscensionRate,
      declinationRate,
      rangeRate,
    );
  }

  // / Right-ascension _(°)_.
  get rightAscensionDegrees(): number {
    return this.rightAscension * RAD2DEG;
  }

  // / Declination _(°)_.
  get declinationDegrees(): number {
    return this.declination * RAD2DEG;
  }

  // / Right-ascension rate _(°/s)_.
  get rightAscensionRateDegrees(): number | undefined {
    return this.rightAscensionRate !== null ? this.rightAscensionRate * RAD2DEG : undefined;
  }

  // / Declination rate _(°/s)_.
  get declinationRateDegrees(): number | undefined {
    return this.declinationRate !== null ? this.declinationRate * RAD2DEG : undefined;
  }

  /**
   * Return the position relative to the observer [site].
   *
   * An optional [range] _(km)_ value can be passed to override the value
   * contained in this observation.
   */
  position(site: J2000, range?: number): Vector3D {
    const r = range ?? this.range ?? 1.0;

    return radecToPosition(this.rightAscension, this.declination, r).add(site.position);
  }

  /**
   * Return the velocity relative to the observer [site].
   *
   * An optional [range] _(km)_ and [rangeRate] _(km/s)_ value can be passed
   * to override the values contained in this observation.
   */
  velocity(site: J2000, range?: number, rangeRate?: number): Vector3D {
    if (this.rightAscensionRate === null || this.declinationRate === null) {
      throw new Error('Velocity unsolvable, missing ra/dec rates.');
    }
    const r = range ?? this.range ?? 1.0;
    const rd = rangeRate ?? this.rangeRate ?? 0.0;

    return radecToVelocity(
      this.rightAscension,
      this.declination,
      r,
      this.rightAscensionRate,
      this.declinationRate,
      rd,
    ).add(site.velocity);
  }

  // / Convert this observation into a line-of-sight vector.
  lineOfSight(): Vector3D {
    const ca = Math.cos(this.rightAscension);
    const cd = Math.cos(this.declination);
    const sa = Math.sin(this.rightAscension);
    const sd = Math.sin(this.declination);

    return new Vector3D(cd * ca, cd * sa, sd);
  }

  /**
   * Calculate the angular distance _(rad)_ between this and another
   * [RadecTopocentric] object.
   */
  angle(radec: RadecTopocentric, method: AngularDistanceMethod = AngularDistanceMethod.Cosine): number {
    return angularDistance(this.rightAscension, this.declination, radec.rightAscension, radec.declination, method);
  }

  /**
   * Calculate the angular distance _(°)_ between this and another
   * [RadecTopocentric] object.
   */
  angleDegrees(radec: RadecTopocentric, method: AngularDistanceMethod = AngularDistanceMethod.Cosine): number {
    return this.angle(radec, method) * RAD2DEG;
  }
}
