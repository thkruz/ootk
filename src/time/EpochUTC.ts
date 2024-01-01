import { DEG2RAD, MS_PER_DAY, RAD2DEG, secondsPerWeek, TAU } from '../utils/constants';
import { evalPoly } from '../utils/functions';
import { DataHandler } from './../data/DataHandler';
import { Epoch } from './Epoch';
import { EpochGPS } from './EpochGPS';
import { EpochTAI } from './EpochTAI';
import { EpochTDB } from './EpochTDB';
import { EpochTT } from './EpochTT';

type FromDateParams = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
};

type DateToPosixParams = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export class EpochUTC extends Epoch {
  static now() {
    return new EpochUTC(new Date().getTime() / 1000);
  }

  static fromDate({ year, month, day, hour = 0, minute = 0, second = 0 }: FromDateParams) {
    return new EpochUTC(EpochUTC.dateToPosix_({ year, month, day, hour, minute, second }));
  }

  static fromDateTime(dt: Date) {
    return new EpochUTC(dt.getTime() / 1000);
  }

  static fromDateTimeString(dateTimeString: string): EpochUTC {
    const dts = dateTimeString.trim().toUpperCase().endsWith('Z') ? dateTimeString : `${dateTimeString}Z`;

    return new EpochUTC(new Date(dts).getTime() / 1000);
  }

  static fromJ2000TTSeconds(seconds: number): EpochUTC {
    const tInit = new EpochUTC(seconds + 946728000);
    const ls = DataHandler.getInstance().getLeapSeconds(tInit.toJulianDate());

    return tInit.roll(-32.184 - ls);
  }

  static fromDefinitiveString(definitiveString: string): EpochUTC {
    const fields = definitiveString.trim().split(' ');
    const dateFields = fields[0].split('/');
    const day = parseInt(dateFields[0]);
    const year = parseInt(dateFields[1]);
    // eslint-disable-next-line prefer-destructuring
    const timeField = fields[1];
    // Add day - 1 days in milliseconds to the epoch.
    const dts = new Date(`${year}-01-01T${timeField}Z`).getTime() + (day - 1) * MS_PER_DAY;

    return new EpochUTC(dts / 1000);
  }

  roll(seconds: number): EpochUTC {
    return new EpochUTC(this.posix + seconds);
  }

  toMjd(): number {
    return this.toJulianDate() - 2400000.5;
  }

  toMjdGsfc(): number {
    return this.toMjd() - 29999.5;
  }

  toTAI(): EpochTAI {
    const ls = DataHandler.getInstance().getLeapSeconds(this.toJulianDate());

    return new EpochTAI(this.posix + ls);
  }

  toTT(): EpochTT {
    return new EpochTT(this.toTAI().posix + 32.184);
  }

  toTDB(): EpochTDB {
    const tt = this.toTT();
    const tTT = tt.toJulianCenturies();
    const mEarth = (357.5277233 + 35999.05034 * tTT) * DEG2RAD;
    const seconds = 0.001658 * Math.sin(mEarth) + 0.00001385 * Math.sin(2 * mEarth);

    return new EpochTDB(tt.posix + seconds);
  }

  toGPS(): EpochGPS {
    const ls = DataHandler.getInstance().getLeapSeconds(this.toJulianDate());
    const delta = this.roll(ls - EpochGPS.offset).difference(EpochGPS.reference);
    const week = delta / secondsPerWeek;
    const weekFloor = Math.floor(week);
    const seconds = (week - weekFloor) * secondsPerWeek;

    return new EpochGPS(weekFloor, seconds, EpochUTC.fromDateTimeString('1980-01-06T00:00:00.000Z'));
  }

  gmstAngle(): number {
    const t = this.toJulianCenturies();
    const seconds = evalPoly(t, EpochUTC.gmstPoly_);
    let result = ((seconds / 240) * DEG2RAD) % TAU;

    if (result < 0) {
      result += TAU;
    }

    return result;
  }

  gmstAngleDegrees(): number {
    return this.gmstAngle() * RAD2DEG;
  }

  private static gmstPoly_: Float64Array = new Float64Array([
    -6.2e-6,
    0.093104,
    876600 * 3600 + 8640184.812866,
    67310.54841,
  ]);

  private static dayOfYearLookup_: number[][] = [
    [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334],
    [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335],
  ];

  private static isLeapYear_(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  private static dayOfYear_(year: number, month: number, day: number): number {
    const dex = EpochUTC.isLeapYear_(year) ? 1 : 0;

    return EpochUTC.dayOfYearLookup_[dex][month - 1] + day - 1;
  }

  private static dateToPosix_({ year, month, day, hour, minute, second }: DateToPosixParams): number {
    const days = EpochUTC.dayOfYear_(year, month, day);
    const yearMod = year - 1900;

    return (
      minute * 60 +
      hour * 3600 +
      days * 86400 +
      (yearMod - 70) * 31536000 +
      Math.floor((yearMod - 69) / 4) * 86400 -
      Math.floor((yearMod - 1) / 100) * 86400 +
      Math.floor((yearMod + 299) / 400) * 86400 +
      second
    );
  }
}
