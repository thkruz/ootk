/**
 * Integration test: Time Systems and Epoch Conversions
 * Migrated from examples/time-systems.ts
 */
import {
  calcGmst,
  EpochUTC,
  jday,
  Seconds,
} from '../../dist/main.js';

describe('Time Systems', () => {
  const date = new Date('2024-01-28T12:00:00.000Z');

  describe('Epoch Creation', () => {
    it('should create UTC epoch from DateTime', () => {
      const utcEpoch = EpochUTC.fromDateTime(date);

      expect(utcEpoch).toBeDefined();
      expect(utcEpoch.toDateTime()).toEqual(date);
    });

    it('should create TAI epoch via UTC conversion', () => {
      const utcEpoch = EpochUTC.fromDateTime(date);
      const taiEpoch = utcEpoch.toTAI();

      expect(taiEpoch).toBeDefined();
    });

    it('should create TT epoch via UTC conversion', () => {
      const utcEpoch = EpochUTC.fromDateTime(date);
      const ttEpoch = utcEpoch.toTT();

      expect(ttEpoch).toBeDefined();
    });

    it('should create TDB epoch via UTC conversion', () => {
      const utcEpoch = EpochUTC.fromDateTime(date);
      const tdbEpoch = utcEpoch.toTDB();

      expect(tdbEpoch).toBeDefined();
    });

    it('should create GPS epoch via UTC conversion', () => {
      const utcEpoch = EpochUTC.fromDateTime(date);
      const gpsEpoch = utcEpoch.toGPS();

      expect(gpsEpoch).toBeDefined();
    });
  });

  describe('Time System Conversions from UTC', () => {
    const utcEpoch = EpochUTC.fromDateTime(date);

    it('should convert UTC to TAI', () => {
      const taiEpoch = utcEpoch.toTAI();

      expect(taiEpoch).toBeDefined();
      // TAI is ahead of UTC by leap seconds
      expect(taiEpoch.toDateTime().getTime()).toBeGreaterThan(utcEpoch.toDateTime().getTime());
    });

    it('should convert UTC to TT', () => {
      const ttEpoch = utcEpoch.toTT();

      expect(ttEpoch).toBeDefined();
      // TT is ahead of TAI by 32.184 seconds, so ahead of UTC
      expect(ttEpoch.toDateTime().getTime()).toBeGreaterThan(utcEpoch.toDateTime().getTime());
    });

    it('should convert UTC to TDB', () => {
      const tdbEpoch = utcEpoch.toTDB();

      expect(tdbEpoch).toBeDefined();
    });

    it('should convert UTC to GPS', () => {
      const gpsEpoch = utcEpoch.toGPS();

      expect(gpsEpoch).toBeDefined();
    });
  });

  describe('Julian Dates', () => {
    it('should calculate Julian Date', () => {
      const jd = jday(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      );

      expect(jd).toBeDefined();
      expect(jd).toBeGreaterThan(2400000);
    });

    it('should calculate Modified Julian Date', () => {
      const jd = jday(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      );

      const mjd = jd - 2400000.5;

      expect(mjd).toBeGreaterThan(50000);
    });

    it('should calculate J2000 epoch correctly', () => {
      const j2000Date = new Date('2000-01-01T12:00:00.000Z');
      const j2000Jd = jday(
        j2000Date.getUTCFullYear(),
        j2000Date.getUTCMonth() + 1,
        j2000Date.getUTCDate(),
        j2000Date.getUTCHours(),
        j2000Date.getUTCMinutes(),
        j2000Date.getUTCSeconds(),
      );

      // J2000 epoch is JD 2451545.0
      expect(j2000Jd).toBeCloseTo(2451545.0, 0);
    });
  });

  describe('Greenwich Mean Sidereal Time', () => {
    it('should calculate GMST in radians', () => {
      const gmstResult = calcGmst(date);

      expect(gmstResult).toBeDefined();
      expect(gmstResult.gmst).toBeDefined();
      expect(gmstResult.gmst).toBeGreaterThanOrEqual(0);
      expect(gmstResult.gmst).toBeLessThan(2 * Math.PI);
    });

    it('should convert GMST to degrees', () => {
      const gmstResult = calcGmst(date);
      const gmstDeg = gmstResult.gmst * (180 / Math.PI);

      expect(gmstDeg).toBeGreaterThanOrEqual(0);
      expect(gmstDeg).toBeLessThan(360);
    });

    it('should convert GMST to hours', () => {
      const gmstResult = calcGmst(date);
      const gmstHours = (gmstResult.gmst * (180 / Math.PI)) / 15;

      expect(gmstHours).toBeGreaterThanOrEqual(0);
      expect(gmstHours).toBeLessThan(24);
    });
  });

  describe('Time System Offsets', () => {
    const utcEpoch = EpochUTC.fromDateTime(date);

    it('should have TAI-UTC offset equal to leap seconds', () => {
      const taiEpoch = utcEpoch.toTAI();
      const taiUtcDiff = (taiEpoch.toDateTime().getTime() - utcEpoch.toDateTime().getTime()) / 1000;

      // As of 2024, there are 37 leap seconds
      expect(taiUtcDiff).toBeGreaterThan(30);
      expect(taiUtcDiff).toBeLessThan(40);
    });

    it('should have TT-TAI offset of 32.184 seconds', () => {
      const taiEpoch = utcEpoch.toTAI();
      const ttEpoch = utcEpoch.toTT();
      const ttTaiDiff = (ttEpoch.toDateTime().getTime() - taiEpoch.toDateTime().getTime()) / 1000;

      expect(ttTaiDiff).toBeCloseTo(32.184, 1);
    });
  });

  describe('Epoch Arithmetic', () => {
    it('should add seconds to epoch', () => {
      const startEpoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const oneDayInSeconds = (1 * 24 * 60 * 60) as Seconds;
      const oneDayLater = startEpoch.roll(oneDayInSeconds);

      expect(oneDayLater).toBeDefined();

      const startDate = startEpoch.toDateTime();
      const laterDate = oneDayLater.toDateTime();

      const diffMs = laterDate.getTime() - startDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeCloseTo(1, 5);
    });

    it('should add multiple days worth of seconds to epoch', () => {
      const startEpoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const oneWeekInSeconds = (7 * 24 * 60 * 60) as Seconds;
      const oneWeekLater = startEpoch.roll(oneWeekInSeconds);

      const startDate = startEpoch.toDateTime();
      const laterDate = oneWeekLater.toDateTime();

      const diffMs = laterDate.getTime() - startDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeCloseTo(7, 5);
    });
  });

  describe('Common Date/Time Scenarios', () => {
    const scenarios = [
      { name: 'GPS Epoch Start', date: new Date('1980-01-06T00:00:00.000Z') },
      { name: 'J2000.0', date: new Date('2000-01-01T12:00:00.000Z') },
      { name: 'Unix Epoch', date: new Date('1970-01-01T00:00:00.000Z') },
      { name: 'Current Example', date: new Date('2024-01-28T12:00:00.000Z') },
    ];

    scenarios.forEach((scenario) => {
      it(`should calculate values for ${scenario.name}`, () => {
        const jd = jday(
          scenario.date.getUTCFullYear(),
          scenario.date.getUTCMonth() + 1,
          scenario.date.getUTCDate(),
          scenario.date.getUTCHours(),
          scenario.date.getUTCMinutes(),
          scenario.date.getUTCSeconds(),
        );

        const gmst = calcGmst(scenario.date);

        expect(jd).toBeGreaterThan(0);
        expect(gmst.gmst).toBeGreaterThanOrEqual(0);
        expect(gmst.gmst).toBeLessThan(2 * Math.PI);
      });
    });
  });

  describe('High-Precision Time', () => {
    it('should handle millisecond precision', () => {
      const preciseDate = new Date('2024-01-28T12:34:56.789Z');
      const utcPrecise = EpochUTC.fromDateTime(preciseDate);

      expect(utcPrecise.posix).toBeDefined();
    });

    it('should show difference between time systems', () => {
      const preciseDate = new Date('2024-01-28T12:34:56.789Z');
      const utcPrecise = EpochUTC.fromDateTime(preciseDate);
      const taiPrecise = utcPrecise.toTAI();
      const ttPrecise = utcPrecise.toTT();

      const utcMillis = utcPrecise.toDateTime().getTime();
      const taiMillis = taiPrecise.toDateTime().getTime();
      const ttMillis = ttPrecise.toDateTime().getTime();

      // TAI and TT should be ahead of UTC
      expect(taiMillis).toBeGreaterThan(utcMillis);
      expect(ttMillis).toBeGreaterThan(utcMillis);
      expect(ttMillis).toBeGreaterThan(taiMillis);
    });
  });

  describe('EpochUTC String Methods', () => {
    it('should create epoch from date time string', () => {
      const epoch = EpochUTC.fromDateTimeString('2024-01-28T12:00:00.000Z');

      expect(epoch).toBeDefined();
      expect(epoch.toDateTime().getTime()).toBe(date.getTime());
    });

    it('should convert to string via toDateTime', () => {
      const epoch = EpochUTC.fromDateTime(date);
      const isoString = epoch.toDateTime().toISOString();

      expect(isoString).toBeDefined();
      expect(typeof isoString).toBe('string');
    });
  });
});
