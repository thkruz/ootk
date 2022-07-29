/**
 * @file   Tests from Sgp4.js to ensure compatibility
 * @since  0.2.0
 */

import { Sgp4 } from '@lib/ootk';
import { compareVectors } from '@test/lib/compareVectors';

describe('Julian date / time', () => {
  // Use number of milliseconds since epoch instead of local year, month, day, etc for consistency across machines
  let now = new Date(1661400000000);

  beforeAll(() => {
    now = new Date(1661400000000);
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

    it('invjday gives different results with jdfrac', () => {
      const { jd } = Sgp4.jday(now);
      const jday = Sgp4.invjday(jd);
      const jdayWFrac = Sgp4.invjday(jd, 10);

      expect(jday).not.toEqual(jdayWFrac);
    });

    it('date to jday and inverse conversion', () => {
      const { jd, jdFrac } = Sgp4.jday(now);
      const expected = (now.getTime() - now.getMilliseconds()) / 1000;
      // Allow a single millisecond margin of error
      const time = Sgp4.invjday(jd, jdFrac);
      const date = new Date();

      date.setUTCFullYear(time.year, time.mon - 1, time.day);
      date.setUTCHours(time.hr, time.min, time.sec);

      expect(date.getTime() / 1000).toBeCloseTo(expected, -1);
    });
  });
});
