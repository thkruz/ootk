/**
 * @file   Tests from Sgp4.js to ensure compatibility
 * @since  0.2.0
 */

import { compareVectors } from '@test/lib/compareVectors';
import { Sgp4 } from '@lib/sgp4.js'; // eslint-disable-line

describe.skip('Julian date / time', () => {
  let now;
  beforeAll(() => {
    now = new Date();
  });

  describe('jday & invjday', () => {
    it('gives the same result with different arguments describing the same time', () => {
      expect(Sgp4.jday(now)).toEqual(
        Sgp4.jday(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          now.getUTCDate(),
          now.getUTCHours(),
          now.getUTCMinutes(),
          now.getUTCSeconds(),
          now.getUTCMilliseconds(),
        ),
      );
    });

    it('outputs different results when milliseconds are passed', () => {
      const date = new Date('2018-01-01T05:30:30.123Z');

      const jdayNoMs = Sgp4.jday(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      );

      const jdayMs = Sgp4.jday(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds(),
      );

      expect(jdayNoMs).not.toEqual(jdayMs);
    });

    it('outputs different results with millisecond precision', () => {
      const jday1 = Sgp4.jday(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds(),
        (now.getUTCMilliseconds() + 1) % 1000,
      );

      const jday2 = Sgp4.jday(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds(),
        now.getUTCMilliseconds(),
      );

      expect(jday1).not.toEqual(jday2);
    });

    it('invjday gives the same result as date and array', () => {
      const jd = Sgp4.jday(now);
      const date = Sgp4.invjday(jd);
      const dateArray = Sgp4.invjday(jd, true);
      expect(date.getUTCFullYear()).toEqual(dateArray[0]);
      expect(date.getUTCMonth() + 1).toEqual(dateArray[1]);
      expect(date.getUTCDate()).toEqual(dateArray[2]);
      expect(date.getUTCHours()).toEqual(dateArray[3]);
      expect(date.getUTCMinutes()).toEqual(dateArray[4]);
      expect(date.getUTCSeconds()).toEqual(dateArray[5]);
    });

    it('date to jday and inverse conversion', () => {
      const jd = Sgp4.jday(now);
      const expected = (now.getTime() - now.getMilliseconds()) / 1000;
      // Allow a single millisecond margin of error
      expect(Sgp4.invjday(jd).getTime() / 1000).toBeCloseTo(expected, -1);
    });
  });

  it('gstime gives the same result with different arguments describing the same time', () => {
    expect(Sgp4.gstime(now)).toEqual(
      Sgp4.gstime(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds(),
        now.getUTCMilliseconds(),
      ),
    );
  });

  it('propagation gives the same result with different arguments describing the same time', () => {
    const date = new Date(2016, 7, 22);
    const tleLine1 = '1 27424U 02022A   16235.86686911  .00000105  00000-0  33296-4 0  9990';
    const tleLine2 = '2 27424  98.2022 175.3843 0001285  39.9183  23.2024 14.57119903760831';
    const satrec = Sgp4.createSatrec(tleLine1, tleLine2);

    const propagationByDate = Sgp4.propagate(satrec, date);
    const propagationByDateItems = Sgp4.propagate(
      satrec,
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    );

    compareVectors(propagationByDate.position, propagationByDateItems.position);
    compareVectors(propagationByDate.velocity, propagationByDateItems.velocity);
  });
});
