import { EpochGPS, EpochUTC } from '../../src/main';

describe('EpochGPS', () => {
  let reference: EpochUTC;

  beforeAll(() => {
    reference = EpochUTC.fromDateTimeString('1980-01-06T00:00:00.000Z');
  });

  it('should be constructed from a week and seconds', () => {
    const week = 1;
    const seconds = 5;
    const epoch = new EpochGPS(week, seconds, reference);

    expect(epoch.week).toEqual(week);
    expect(epoch.seconds).toEqual(seconds);
    expect(epoch.week10Bit).toMatchSnapshot();
    expect(epoch.week13Bit).toMatchSnapshot();
  });

  // toString
  it('should convert to a string', () => {
    const week = 1;
    const seconds = 5;
    const epoch = new EpochGPS(week, seconds, reference);

    expect(epoch.toString()).toMatchSnapshot();
  });

  // toUTC
  it('should convert to a UTC epoch', () => {
    const week = 1;
    const seconds = 5;
    const epoch = new EpochGPS(week, seconds, reference);

    expect(epoch.toUTC()).toMatchSnapshot();
  });
});
