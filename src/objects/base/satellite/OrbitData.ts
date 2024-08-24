// OrbitData.ts
import { CatalogSource, Degrees, FormatTle, jday, Kilometers, KilometersPerSecond, MILLISECONDS_TO_DAYS, Minutes, MINUTES_PER_DAY, PosVel, SatelliteRecord, Sgp4, TimeVariables, Tle, TleLine1, TleLine2 } from '../../../main.js';
import { SatelliteCore } from './SatelliteCore.js';

interface OrbitDataParams {
  sat: SatelliteCore;
  tle1: TleLine1;
  tle2: TleLine2;
}

export class OrbitData {
  private sat_: SatelliteCore;
  apogee!: Kilometers;
  argOfPerigee!: Degrees;
  bstar!: number;
  eccentricity!: number;
  epochDay!: number;
  epochYear!: number;
  inclination!: Degrees;
  intlDes!: string;
  meanAnomaly!: Degrees;
  meanMoDev1!: number;
  meanMoDev2!: number;
  meanMotion!: number;
  perigee!: Kilometers;
  period!: Minutes;
  rightAscension!: Degrees;
  satrec!: SatelliteRecord;
  tle1!: TleLine1;
  tle2!: TleLine2;
  source: CatalogSource = CatalogSource.USSF;
  semiMajorAxis!: Kilometers;
  semiMinorAxis!: Kilometers;

  constructor(params: OrbitDataParams) {
    this.sat_ = params.sat;
    this.tle1 = params.tle1;
    this.tle2 = params.tle2;
    this.parseTleAndUpdateOrbit_(params.tle1, params.tle2, this.sat_.sccNum);
  }

  private parseTleAndUpdateOrbit_(tle1: TleLine1, tle2: TleLine2, sccNum?: string) {
    const tleData = Tle.parse(tle1, tle2);

    this.tle1 = tle1;
    this.tle2 = tle2;

    this.sat_.sccNum = sccNum ?? this.sat_.sccNum ?? tleData.satNum.toString();
    this.sat_.sccNum5 = Tle.convert6DigitToA5(this.sat_.sccNum);
    this.sat_.sccNum6 = Tle.convertA5to6Digit(this.sat_.sccNum5);
    this.source = this.classificationToSource(Tle.classification(tle1));
    this.intlDes = tleData.intlDes;
    this.epochYear = tleData.epochYear;
    this.epochDay = tleData.epochDay;
    this.meanMoDev1 = tleData.meanMoDev1;
    this.meanMoDev2 = tleData.meanMoDev2;
    this.bstar = tleData.bstar;
    this.inclination = tleData.inclination;
    this.rightAscension = tleData.rightAscension;
    this.eccentricity = tleData.eccentricity;
    this.argOfPerigee = tleData.argOfPerigee;
    this.meanAnomaly = tleData.meanAnomaly;
    this.meanMotion = tleData.meanMotion;
    this.period = tleData.period;
    this.semiMajorAxis = ((8681663.653 / this.meanMotion) ** (2 / 3)) as Kilometers;
    this.semiMinorAxis = (this.semiMajorAxis * Math.sqrt(1 - this.eccentricity ** 2)) as Kilometers;
    this.apogee = (this.semiMajorAxis * (1 + this.eccentricity) - 6371) as Kilometers;
    this.perigee = (this.semiMajorAxis * (1 - this.eccentricity) - 6371) as Kilometers;
    this.satrec = Sgp4.createSatrec(tle1, tle2);

    if (!OrbitData.isValidSatrec(this.satrec)) {
      throw new Error('Invalid TLE');
    }

    if (this.source === CatalogSource.VIMPEL) {
      this.setSccNumTo0_();
    }
  }

  static isValidSatrec(satrec: SatelliteRecord): boolean {
    if (
      isNaN(satrec.a) ||
      isNaN(satrec.am) ||
      isNaN(satrec.alta) ||
      isNaN(satrec.em) ||
      isNaN(satrec.mo) ||
      isNaN(satrec.ecco) ||
      isNaN(satrec.no)
    ) {
      return false;
    }

    return true;
  }

  private setSccNumTo0_() {
    this.tle1 = FormatTle.setCharAt(this.tle1, 2, '0') as TleLine1;
    this.tle1 = FormatTle.setCharAt(this.tle1, 3, '0') as TleLine1;
    this.tle1 = FormatTle.setCharAt(this.tle1, 4, '0') as TleLine1;
    this.tle1 = FormatTle.setCharAt(this.tle1, 5, '0') as TleLine1;
    this.tle1 = FormatTle.setCharAt(this.tle1, 6, '0') as TleLine1;
    this.tle2 = FormatTle.setCharAt(this.tle2, 2, '0') as TleLine2;
    this.tle2 = FormatTle.setCharAt(this.tle2, 3, '0') as TleLine2;
    this.tle2 = FormatTle.setCharAt(this.tle2, 4, '0') as TleLine2;
    this.tle2 = FormatTle.setCharAt(this.tle2, 5, '0') as TleLine2;
    this.tle2 = FormatTle.setCharAt(this.tle2, 6, '0') as TleLine2;
  }

  classificationToSource(classification: string): CatalogSource {
    switch (classification) {
      case 'U':
        return CatalogSource.USSF;
      case 'M':
        return CatalogSource.UNIV_OF_MICH;
      case 'P':
        return CatalogSource.CALPOLY;
      case 'N':
        return CatalogSource.NUSPACE;
      case 'C':
        return CatalogSource.CELESTRAK;
      case 'G':
        return CatalogSource.SATNOGS;
      case 'V':
        return CatalogSource.VIMPEL;
      default:
        return CatalogSource.USSF;
    }
  }

  editTle(tle1: TleLine1, tle2: TleLine2, sccNum?: string): void {
    this.parseTleAndUpdateOrbit_(tle1, tle2, sccNum);
  }

  toTle(): Tle {
    return new Tle(this.tle1, this.tle2);
  }

  /**
   * Propagates the satellite's position and velocity to the given date.
   * @param date - The date to which the satellite's position and velocity should be propagated.
   * @returns The position and velocity of the satellite at the given date in ECI coordinates.
   * @throws Will throw an error if the propagation fails.
   */
  propagate(date: Date): PosVel<Kilometers, KilometersPerSecond> {
    const { m } = OrbitData.calculateTimeVariables(date, this.satrec);

    if (!m) {
      throw new Error('Propagation failed!');
    }
    const pv = Sgp4.propagate(this.satrec, m);

    if (!pv) {
      throw new Error('Propagation failed!');
    } else {
      return pv as PosVel<Kilometers, KilometersPerSecond>;
    }
  }

  static calculateTimeVariables(date: Date, satrec?: SatelliteRecord): TimeVariables {
    const j = jday(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    ) + date.getUTCMilliseconds() * MILLISECONDS_TO_DAYS;
    const gmst = Sgp4.gstime(j);
    const m = satrec ? (j - satrec.jdsatepoch) * MINUTES_PER_DAY : null;

    return { gmst, m, j };
  }
}
