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

  // Error handling
  it('should throw an error if week is negative', () => {
    expect(() => new EpochGPS(-1, 5, reference)).toThrow('GPS week must be non-negative.');
  });

  it('should throw an error if seconds is negative', () => {
    expect(() => new EpochGPS(1, -1, reference)).toThrow('GPS seconds must be within a week.');
  });

  it('should throw an error if seconds is greater than or equal to seconds per week', () => {
    expect(() => new EpochGPS(1, 604800, reference)).toThrow('GPS seconds must be within a week.');
  });

  // week10Bit rollover
  it('should correctly calculate week10Bit for values exceeding 1024', () => {
    const epoch = new EpochGPS(1024, 0, reference);

    expect(epoch.week10Bit).toEqual(0);
  });

  it('should correctly calculate week10Bit for values below rollover', () => {
    const epoch = new EpochGPS(500, 0, reference);

    expect(epoch.week10Bit).toEqual(500);
  });

  // week13Bit rollover
  it('should correctly calculate week13Bit for values exceeding 8192', () => {
    const epoch = new EpochGPS(8192, 0, reference);

    expect(epoch.week13Bit).toEqual(0);
  });

  it('should correctly calculate week13Bit for values below rollover', () => {
    const epoch = new EpochGPS(5000, 0, reference);

    expect(epoch.week13Bit).toEqual(5000);
  });
});
