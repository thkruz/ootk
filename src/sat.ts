import { EcfVec3, EciVec3, LlaVec3, SatelliteRecord, StateVector, TleLine1, TleLine2 } from './types';
import { MILLISECONDS_PER_DAY, MINUTES_PER_DAY } from './utils/constants';
import { Sgp4 } from './sgp4';
import { Tle } from './tle';
import { Transforms } from './transforms';
import { Utils } from './utils';

type GreenwichMeanSiderealTime = number;

export class Sat {
  public satNum: number;

  public satrec: SatelliteRecord;

  public options: any;

  public intlDes: string;

  public epochYear: number;

  public epochDay: number;

  public meanMoDev1: number;

  public meanMoDev2: number;

  public bstar: number;

  public inclination: number;

  public raan: number;

  public eccentricity: number;

  public argOfPerigee: number;

  public meanAnomaly: number;

  public meanMotion: number;

  public period: number;

  constructor(tle1: TleLine1, tle2: TleLine2, options) {
    const tleData = Tle.parseTle(tle1, tle2);

    this.satNum = tleData.satNum;
    this.intlDes = tleData.intlDes;
    this.epochYear = tleData.epochYear;
    this.epochDay = tleData.epochDay;
    this.meanMoDev1 = tleData.meanMoDev1;
    this.meanMoDev2 = tleData.meanMoDev2;
    this.bstar = tleData.bstar;
    this.inclination = tleData.inclination;
    this.raan = tleData.raan;
    this.eccentricity = tleData.eccentricity;
    this.argOfPerigee = tleData.argOfPerigee;
    this.meanAnomaly = tleData.meanAnomaly;
    this.meanMotion = tleData.meanMotion;
    this.period = 1440 / this.meanMotion;

    this.satrec = Sgp4.createSatrec(tle1, tle2);
    this.options = options;
  }

  /**
   * Calculates position and velocity in ECI coordinates at a given time.
   * @param {Date} date Date to calculate the state vector for
   * @returns {StateVector} State vector for the given date
   */
  public getStateVec(date: Date): StateVector {
    const { m } = Sat.calculateTimeVariables(date, this.satrec);

    return Sgp4.propagate(this.satrec, m);
  }

  /**
   * Calculates ECI position at a given time.
   * @param {Date} date Date to calculate
   * @returns {EciVec3} ECI position vector
   */
  public getEci(date: Date): EciVec3 {
    const { m } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = Sgp4.propagate(this.satrec, m).position;

    return eci ? (eci as EciVec3) : { x: 0, y: 0, z: 0 };
  }

  /**
   * Calculates ECF position at a given time.
   * @param {Date} date Date to calculate
   * @returns {EcfVec3} ECF position vector
   */
  public getEcf(date: Date): EcfVec3 {
    const { m, gmst } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = (Sgp4.propagate(this.satrec, m).position as EciVec3) || { x: 0, y: 0, z: 0 };

    return Transforms.eci2ecf(eci, gmst);
  }

  /**
   * Calculates LLA position at a given time.
   * @param {Date} date Date to calculate
   * @returns {LlaVec3} LLA position vector
   */
  public getLla(date: Date): LlaVec3 {
    const { m, gmst } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = (Sgp4.propagate(this.satrec, m).position as EciVec3) || { x: 0, y: 0, z: 0 };

    return Transforms.eci2lla(eci, gmst);
  }

  /**
   * Calculates the time variables for a given date relative to the TLE epoch.
   * @param {Date} date Date to calculate
   * @param {SatelliteRecord} satrec Satellite orbital information
   * @returns {{m: number, gmst: GreenwichMeanSiderealTime, j: number}} Time variables
   */
  private static calculateTimeVariables(
    date: Date,
    satrec?: SatelliteRecord,
  ): { gmst: GreenwichMeanSiderealTime; m: number; j: number } {
    const j =
      Utils.jday(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      ) +
      date.getUTCMilliseconds() * MILLISECONDS_PER_DAY;
    const gmst = Sgp4.gstime(j);

    const m = satrec ? (j - satrec.jdsatepoch) * MINUTES_PER_DAY : null;

    return { gmst, m, j };
  }
}
