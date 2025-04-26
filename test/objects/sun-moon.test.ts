import { Celestial } from '../../src/body/Celestial';
import { Moon } from '../../src/body/Moon';
import { Sun } from '../../src/body/Sun';
import { Degrees, Meters, SunTime } from '../../src/main';

/*
 * Use number of milliseconds since epoch instead of local year, month, day, etc
 * for consistency across machines
 */
const dateObj = new Date(1661406000000);

describe('Sun and Moon', () => {
  test('Sun Unit Tests', () => {
    const d = Sun.julian2date(Sun.date2jSince2000(dateObj));
    const c = Sun.raDec(d);

    Celestial.azEl(dateObj, 0 as Degrees, 0 as Degrees, c.ra, c.dec);
    Sun.azEl(dateObj, 0 as Degrees, 0 as Degrees);
  });

  test('Moon Unit Tests', () => {
    expect(Moon.getMoonIllumination(dateObj)).toMatchSnapshot();

    Moon.rae(dateObj, 0 as Degrees, 0 as Degrees);

    /*
     * TODO: #4 Fix this test to work on ci/cd pipeline
     * Moon.getMoonTimes(dateObj, 0 as Degrees, 0 as Degrees, true);
     * Moon.getMoonTimes(dateObj, -10 as Degrees, -10 as Degrees, false);
     */
  });

  test('getMoonIllumination returns fraction and angle of moons illuminated limb and phase', () => {
    const moonIllum = Moon.getMoonIllumination(dateObj);

    expect(moonIllum).toMatchSnapshot();
  });
});

/**
 * @author Robert Myers @xqjibz See: https://github.com/mourner/suncalc/pull/35
 */
describe('Test for #6 fix', () => {
  test('Test for #6 fix', () => {
    const date = new Date('2013-03-05UTC');
    const result = (Sun.azEl(date, 50.5 as Degrees, 30.5 as Degrees).az * 180) / Math.PI;

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
        const date = new Date(testDateStrings[i] as string);
        const testDateDay = date.getDate();

        const times = Sun.getTimes(date, lat as Degrees, lng as Degrees);

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
    solarNoon: new Date('2013-03-05T10:10:57Z'),
    nadir: new Date('2013-03-05T22:10:57Z'),
    sunriseStart: new Date('2013-03-05T04:34:56Z'),
    sunsetEnd: new Date('2013-03-05T15:46:57Z'),
    sunriseEnd: new Date('2013-03-05T04:38:19Z'),
    sunsetStart: new Date('2013-03-05T15:43:34Z'),
    civilDawn: new Date('2013-03-05T04:02:17Z'),
    civilDusk: new Date('2013-03-05T16:19:36Z'),
    nauticalDawn: new Date('2013-03-05T03:24:31Z'),
    nauticalDusk: new Date('2013-03-05T16:57:22Z'),
    astronomicalDawn: new Date('2013-03-05T02:46:17Z'),
    astronomicalDusk: new Date('2013-03-05T17:35:36Z'),
    goldenHourDawnEnd: new Date('2013-03-05T05:19:01Z'),
    goldenHourDuskStart: new Date('2013-03-05T15:02:52Z'),
  };

  const heightTestTimes = {
    solarNoon: new Date('2013-03-05T10:10:57Z'),
    nadir: new Date('2013-03-05T22:10:57Z'),
    sunriseStart: new Date('2013-03-05T04:25:07Z'),
    sunsetEnd: new Date('2013-03-05T15:56:46Z'),
  };

  test('getTimes returns sun phases for the given date and location', () => {
    const times = Sun.getTimes(date, lat as Degrees, lon as Degrees, 0 as Meters, true);

    // eslint-disable-next-line guard-for-in
    for (const i in testTimes) {
      const key = i as keyof typeof testTimes;

      expect(times[key].toUTCString()).toEqual(new Date(testTimes[key]).toUTCString());
    }
  });

  test('getTimes adjusts sun phases when additionally given the observer height', () => {
    const times = Sun.getTimes(date, lat as Degrees, lon as Degrees, alt as Meters, true);

    // eslint-disable-next-line guard-for-in
    for (const i in heightTestTimes) {
      const key = i as keyof typeof heightTestTimes;

      expect(times[key].toUTCString()).toEqual(new Date(heightTestTimes[key]).toUTCString());
    }
  });

  test('getSunAzEl returns azimuth and altitude for the given time and location', () => {
    const sunPos = Sun.azEl(date, lat as Degrees, lon as Degrees);

    expect(sunPos).toMatchSnapshot();
  });

  test('getMoonIllumination returns fraction and angle of moons illuminated limb and phase', () => {
    const moonIllum = Moon.getMoonIllumination(date);

    expect(moonIllum).toMatchSnapshot();
  });

  test('getMoonPosition returns moon position data given time and location', () => {
    const moonPos = Moon.rae(date, lat as Degrees, lon as Degrees);

    expect(moonPos).toMatchSnapshot();
  });

  test('getMoonTimes returns moon rise and set times', () => {
    const moonTimes = Moon.getMoonTimes(new Date('2013-03-04UTC'), lat as Degrees, lon as Degrees, true);

    expect(moonTimes.rise?.toUTCString()).toEqual('Mon, 04 Mar 2013 23:54:29 GMT');
    expect(moonTimes.set?.toUTCString()).toEqual('Mon, 04 Mar 2013 07:47:58 GMT');
  });
});

describe('Tests from Hypnos3', () => {
  const date = new Date('2013-03-05UTC');
  const lat = -34.0;
  const lon = 151.0;

  const testTimes: SunTime = {
    // southern hemisphere
    solarNoon: new Date('2013-03-05T02:09:01.832Z'),
    nadir: new Date('2013-03-05T14:09:01.832Z'),
    goldenHourDuskStart: new Date('2013-03-05T07:56:33.416Z'),
    goldenHourDawnEnd: new Date('2013-03-04T20:21:30.248Z'),
    sunsetStart: new Date('2013-03-05T08:27:05.997Z'),
    sunriseEnd: new Date('2013-03-04T19:50:57.667Z'),
    sunsetEnd: new Date('2013-03-05T08:29:41.731Z'),
    sunriseStart: new Date('2013-03-04T19:48:21.933Z'),
    goldenHourDuskEnd: new Date('2013-03-05T08:30:30.554Z'),
    goldenHourDawnStart: new Date('2013-03-04T19:47:33.110Z'),
    blueHourDuskStart: new Date('2013-03-05T08:45:10.179Z'),
    blueHourDawnEnd: new Date('2013-03-04T19:32:53.485Z'),
    civilDusk: new Date('2013-03-05T08:54:59.722Z'),
    civilDawn: new Date('2013-03-04T19:23:03.942Z'),
    blueHourDuskEnd: new Date('2013-03-05T09:04:52.263Z'),
    blueHourDawnStart: new Date('2013-03-04T19:13:11.401Z'),
    nauticalDusk: new Date('2013-03-05T09:24:48.289Z'),
    nauticalDawn: new Date('2013-03-04T18:53:15.375Z'),
    amateurDusk: new Date('2013-03-05T09:39:57.120Z'),
    amateurDawn: new Date('2013-03-04T18:38:06.544Z'),
    astronomicalDusk: new Date('2013-03-05T09:55:18.657Z'),
    astronomicalDawn: new Date('2013-03-04T18:22:45.007Z'),
  };

  test('southern hemisphere', () => {
    const times = Sun.getTimes(date, lat as Degrees, lon as Degrees);

    // eslint-disable-next-line guard-for-in
    for (const i in testTimes) {
      const key = i as keyof typeof testTimes;

      expect(times[key].toUTCString()).toEqual(new Date(testTimes[key]).toUTCString());
    }
  });
});
