/**
 * @file   Test Suite to verify tle functions work as expected
 * @author Theodore Kruczek.
 * @since  1.3.0
 */

import { Celestial } from '../../lib/body/Celestial';
import { Sun } from '../../lib/body/Sun';
import { Utils } from '../../lib/ootk';

const { MoonMath } = Utils;
// Use number of milliseconds since epoch instead of local year, month, day, etc for consistency across machines
const dateObj = new Date(1661400000000);

describe('Sun and Moon', () => {
  test('Sun Unit Tests', () => {
    const d = Sun.julian2date(Sun.date2jSince2000(dateObj));
    const c = Sun.raDec(d);

    Celestial.getStarAzEl(dateObj, 0, 0, c.ra, c.dec);
    Sun.azEl(dateObj, 0, 0);
  });

  test('Local Solar Time', () => {
    // Use number of milliseconds since epoch instead of local year, month, day, etc for consistency across machines
    const lst = Sun.getSolarTime(new Date(1658807880000), -5, -71);

    expect(lst.toUTCString()).toEqual('Tue, 26 Jul 2022 04:07:49 GMT');
  });

  test('MoonMath Unit Tests', () => {
    expect(MoonMath.getMoonIllumination(dateObj)).toMatchSnapshot();

    MoonMath.getMoonPosition(dateObj, 0, 0);
    MoonMath.getMoonTimes(dateObj, 0, 0, true);
    MoonMath.getMoonTimes(dateObj, -10, -10, false);
  });

  test('getMoonIllumination returns fraction and angle of moons illuminated limb and phase', () => {
    const moonIllum = MoonMath.getMoonIllumination(dateObj);

    expect(moonIllum).toMatchSnapshot();
  });
});

/**
 * @author Robert Myers @xqjibz
 * See: https://github.com/mourner/suncalc/pull/35
 */
describe('Test for #6 fix', () => {
  test('Test for #6 fix', () => {
    const date = new Date('2013-03-05UTC');
    const result = (Sun.azEl(date, 50.5, 30.5).az * 180) / Math.PI;

    expect(result).toBeCloseTo(36.742354609606814);
  });
});

describe('Test for variety of date/time stamps', () => {
  describe('getTimes day detection works with a variety of date times', () => {
    const lat = 47.606209;
    const lng = -122.332069;
    // const testDateDay = 4;
    const testDateStrings = [
      'Mon, 04 Mar 2013 00:00:01 UTC+2',
      'Mon, 04 Mar 2013 00:00:01 PDT',
      'Mon, 04 Mar 2013 00:00:01 PST',
      'Mon, 04 Mar 2013 00:00:01 EDT',
      'Mon, 04 Mar 2013 00:00:01 EST',
      'Mon, 04 Mar 2013 00:00:01 UTC',
      'Mon, 04 Mar 2013 12:00:00 PDT',
      'Mon, 04 Mar 2013 12:00:00 PST',
      'Mon, 04 Mar 2013 12:00:00 EDT',
      'Mon, 04 Mar 2013 12:00:00 EST',
      'Mon, 04 Mar 2013 12:00:00 UTC',
      'Mon, 04 Mar 2013 23:59:59 PDT',
      'Mon, 04 Mar 2013 23:59:59 PST',
      'Mon, 04 Mar 2013 23:59:59 EDT',
      'Mon, 04 Mar 2013 23:59:59 EST',
      'Mon, 04 Mar 2013 23:59:59 UTC',
    ];

    for (let i = 0, l = testDateStrings.length; i < l; i++) {
      test(`${testDateStrings[i]}`, () => {
        const date = new Date(testDateStrings[i]);
        const testDateDay = date.getDate();

        const times = Sun.getTimes(date, lat, lng);

        expect(times.solarNoon.getDate()).toEqual(testDateDay);
      });
    }
  });
});

describe('Suncalc.js tests', () => {
  const date = new Date('2013-03-05 UTC');
  const lat = 50.5;
  const lon = 30.5;
  const alt = 2000;

  const testTimes = {
    solarNoon: '2013-03-05T10:10:57Z',
    nadir: '2013-03-05T22:10:57Z',
    sunriseStart: '2013-03-05T04:34:56Z',
    sunsetEnd: '2013-03-05T15:46:57Z',
    sunriseEnd: '2013-03-05T04:38:19Z',
    sunsetStart: '2013-03-05T15:43:34Z',
    civilDawn: '2013-03-05T04:02:17Z',
    civilDusk: '2013-03-05T16:19:36Z',
    nauticalDawn: '2013-03-05T03:24:31Z',
    nauticalDusk: '2013-03-05T16:57:22Z',
    astronomicalDawn: '2013-03-05T02:46:17Z',
    astronomicalDusk: '2013-03-05T17:35:36Z',
    goldenHourDawnEnd: '2013-03-05T05:19:01Z',
    goldenHourDuskStart: '2013-03-05T15:02:52Z',
  };

  const heightTestTimes = {
    solarNoon: '2013-03-05T10:10:57Z',
    nadir: '2013-03-05T22:10:57Z',
    sunriseStart: '2013-03-05T04:25:07Z',
    sunsetEnd: '2013-03-05T15:56:46Z',
  };

  test('getTimes returns sun phases for the given date and location', () => {
    const times = Sun.getTimes(date, lat, lon, 0, true);

    // eslint-disable-next-line guard-for-in
    for (const i in testTimes) {
      expect(times[i].toUTCString()).toEqual(new Date(testTimes[i]).toUTCString());
    }
  });

  test('getTimes adjusts sun phases when additionally given the observer height', () => {
    const times = Sun.getTimes(date, lat, lon, alt, true);

    // eslint-disable-next-line guard-for-in
    for (const i in heightTestTimes) {
      expect(times[i].toUTCString()).toEqual(new Date(heightTestTimes[i]).toUTCString());
    }
  });

  test('getSunAzEl returns azimuth and altitude for the given time and location', () => {
    const sunPos = Sun.azEl(date, lat, lon);

    expect(sunPos.az).toBeCloseTo(0.6412750628729547);
    expect(sunPos.el).toBeCloseTo(-0.7000406838781611);
  });

  test('getMoonIllumination returns fraction and angle of moons illuminated limb and phase', () => {
    const moonIllum = MoonMath.getMoonIllumination(date);

    expect(moonIllum.fraction).toBeCloseTo(0.4848068202456373);
    expect(moonIllum.phaseValue).toBeCloseTo(0.7548368838538762);
    expect(moonIllum.angle).toBeCloseTo(1.6732942678578346);
  });

  test('getMoonPosition returns moon position data given time and location', () => {
    const moonPos = MoonMath.getMoonPosition(date, lat, lon);

    expect(moonPos.az).toBeCloseTo(2.1631927013459706);
    expect(moonPos.el).toBeCloseTo(0.014551482243892251);
    expect(moonPos.rng).toBeCloseTo(364121.37256256194);
  });

  test('getMoonTimes returns moon rise and set times', () => {
    const moonTimes = MoonMath.getMoonTimes(new Date('2013-03-04UTC'), lat, lon, true);

    expect(moonTimes.rise.toUTCString()).toEqual('Mon, 04 Mar 2013 23:54:29 GMT');
    expect(moonTimes.set.toUTCString()).toEqual('Mon, 04 Mar 2013 07:47:58 GMT');
  });
});

describe('Tests from Hypnos3', () => {
  const date = new Date('2013-03-05UTC');
  const lat = -34.0;
  const lon = 151.0;

  const testTimes = {
    // southern hemisphere
    solarNoon: '2013-03-05T02:09:01.832Z',
    nadir: '2013-03-05T14:09:01.832Z',
    goldenHourDuskStart: '2013-03-05T07:56:33.416Z',
    goldenHourDawnEnd: '2013-03-04T20:21:30.248Z',
    sunsetStart: '2013-03-05T08:27:05.997Z',
    sunriseEnd: '2013-03-04T19:50:57.667Z',
    sunsetEnd: '2013-03-05T08:29:41.731Z',
    sunriseStart: '2013-03-04T19:48:21.933Z',
    goldenHourDuskEnd: '2013-03-05T08:30:30.554Z',
    goldenHourDawnStart: '2013-03-04T19:47:33.110Z',
    blueHourDuskStart: '2013-03-05T08:45:10.179Z',
    blueHourDawnEnd: '2013-03-04T19:32:53.485Z',
    civilDusk: '2013-03-05T08:54:59.722Z',
    civilDawn: '2013-03-04T19:23:03.942Z',
    blueHourDuskEnd: '2013-03-05T09:04:52.263Z',
    blueHourDawnStart: '2013-03-04T19:13:11.401Z',
    nauticalDusk: '2013-03-05T09:24:48.289Z',
    nauticalDawn: '2013-03-04T18:53:15.375Z',
    amateurDusk: '2013-03-05T09:39:57.120Z',
    amateurDawn: '2013-03-04T18:38:06.544Z',
    astronomicalDusk: '2013-03-05T09:55:18.657Z',
    astronomicalDawn: '2013-03-04T18:22:45.007Z',
  };

  test('southern hemisphere', () => {
    const times = Sun.getTimes(date, lat, lon);

    // eslint-disable-next-line guard-for-in
    for (const i in testTimes) {
      expect(times[i].toUTCString()).toEqual(new Date(testTimes[i]).toUTCString());
    }
  });

  test('getSolarTime returns the solar time', () => {
    const solarTime = Sun.getSolarTime(date, -5, -71);

    expect(solarTime.toUTCString()).toEqual('Tue, 05 Mar 2013 00:03:33 GMT');
  });
});
