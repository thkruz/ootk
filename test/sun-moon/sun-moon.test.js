/**
 * @file   Test Suite to verify tle functions work as expected
 * @author Theodore Kruczek.
 * @since  1.3.0
 */

import { Utils } from '../../lib/ootk';

const { SunMath, MoonMath } = Utils;
const dateObj = new Date(2022, 7, 25);

describe('Sun and Moon', () => {
  test('SunMath Unit Tests', () => {
    SunMath.julian2date(SunMath.date2julian(dateObj));
    SunMath.toDays(dateObj);
    const d = SunMath.toDays(dateObj);
    const c = SunMath.getSunRaDec(d);

    SunMath.getStarAzEl(dateObj, 0, 0, c.ra, c.dec);
    SunMath.getSunAzEl(dateObj, 0, 0);
  });

  test('MoonMath Unit Tests', () => {
    expect(MoonMath.getMoonIllumination(dateObj)).toMatchSnapshot();

    MoonMath.getMoonPosition(dateObj, 0, 0);
    MoonMath.getMoonTimes(dateObj, 0, 0, true);
    MoonMath.getMoonTimes(dateObj, -10, -10, false);
  });
});

describe('Suncalc.js tests', () => {
  const date = new Date('2013-03-05UTC');
  const lat = 50.5;
  const lon = 30.5;
  const alt = 2000;

  const testTimes = {
    solarNoon: '2013-03-05T10:10:57Z',
    nadir: '2013-03-04T22:10:57Z',
    sunrise: '2013-03-05T04:34:56Z',
    sunset: '2013-03-05T15:46:57Z',
    sunriseEnd: '2013-03-05T04:38:19Z',
    sunsetStart: '2013-03-05T15:43:34Z',
    dawn: '2013-03-05T04:02:17Z',
    dusk: '2013-03-05T16:19:36Z',
    nauticalDawn: '2013-03-05T03:24:31Z',
    nauticalDusk: '2013-03-05T16:57:22Z',
    nightEnd: '2013-03-05T02:46:17Z',
    night: '2013-03-05T17:35:36Z',
    goldenHourEnd: '2013-03-05T05:19:01Z',
    goldenHour: '2013-03-05T15:02:52Z',
  };

  const heightTestTimes = {
    solarNoon: '2013-03-05T10:10:57Z',
    nadir: '2013-03-04T22:10:57Z',
    sunrise: '2013-03-05T04:25:07Z',
    sunset: '2013-03-05T15:56:46Z',
  };

  test('getTimes returns sun phases for the given date and location', () => {
    const times = SunMath.getTimes(date, lat, lon);

    // eslint-disable-next-line guard-for-in
    for (const i in testTimes) {
      expect(times[i].toUTCString()).toEqual(new Date(testTimes[i]).toUTCString());
    }
  });

  test('getTimes adjusts sun phases when additionally given the observer height', () => {
    const times = SunMath.getTimes(date, lat, lon, alt);

    // eslint-disable-next-line guard-for-in
    for (const i in heightTestTimes) {
      expect(times[i].toUTCString()).toEqual(new Date(heightTestTimes[i]).toUTCString());
    }
  });

  test('getSunAzEl returns azimuth and altitude for the given time and location', () => {
    const sunPos = SunMath.getSunAzEl(date, lat, lon);

    expect(sunPos.az).toBeCloseTo(-2.5003175907168385);
    expect(sunPos.el).toBeCloseTo(-0.7000406838781611);
  });

  test('getMoonIllumination returns fraction and angle of moons illuminated limb and phase', () => {
    const moonIllum = MoonMath.getMoonIllumination(date);

    expect(moonIllum.fraction).toBeCloseTo(0.4848068202456373);
    expect(moonIllum.phase).toBeCloseTo(0.7548368838538762);
    expect(moonIllum.angle).toBeCloseTo(1.6732942678578346);
  });

  test('getMoonPosition returns moon position data given time and location', () => {
    const moonPos = MoonMath.getMoonPosition(date, lat, lon);

    expect(moonPos.az).toBeCloseTo(-0.9783999522438226);
    expect(moonPos.el).toBeCloseTo(0.014551482243892251);
    expect(moonPos.rng).toBeCloseTo(364121.37256256194);
  });

  test('getMoonTimes returns moon rise and set times', () => {
    const moonTimes = MoonMath.getMoonTimes(new Date('2013-03-04UTC'), lat, lon, true);

    expect(moonTimes.rise.toUTCString()).toEqual('Mon, 04 Mar 2013 23:54:29 GMT');
    expect(moonTimes.set.toUTCString()).toEqual('Mon, 04 Mar 2013 07:47:58 GMT');
  });
});
