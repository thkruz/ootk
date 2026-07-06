import { Epoch, Seconds } from '../../main';

describe('Epoch', () => {
  it('should be constructed from a POSIX timestamp', () => {
    const posix = 1614556800 as Seconds;
    const epoch = new Epoch(posix);

    expect(epoch.posix).toEqual(posix);
  });

  // toString
  it('should convert to a string', () => {
    const posix = 1614556800 as Seconds;
    const epoch = new Epoch(posix);

    expect(epoch.toString()).toMatchSnapshot();
  });

  // toExcelString
  it('should convert to an Excel string', () => {
    const posix = 1614556800 as Seconds;
    const epoch = new Epoch(posix);

    expect(epoch.toExcelString()).toMatchSnapshot();
  });

  // difference
  it('should calculate the difference between two epochs', () => {
    const posix1 = 1614556800 as Seconds;
    const posix2 = (1614556800 + 60) as Seconds;
    const epoch1 = new Epoch(posix1);
    const epoch2 = new Epoch(posix2);

    expect(epoch1.difference(epoch2)).toEqual(-60);
  });

  // equals
  it('should check if two epochs are equal', () => {
    const posix1 = 1614556800 as Seconds;
    const posix2 = (1614556800 + 60) as Seconds;
    const epoch1 = new Epoch(posix1);
    const epoch2 = new Epoch(posix2);

    expect(epoch1.equals(epoch2)).toEqual(false);
  });

  // toDateTime
  it('should convert to a DateTime object', () => {
    const posix = 1614556800 as Seconds;
    const epoch = new Epoch(posix);

    expect(epoch.toDateTime()).toMatchSnapshot();
  });

  // toEpochYearAndDay
  it('should convert to an epoch year and day', () => {
    const posix = 1614556800 as Seconds;
    const epoch = new Epoch(posix);

    expect(epoch.toEpochYearAndDay()).toMatchSnapshot();
  });

  // toJulianDate
  it('should convert to a Julian date', () => {
    const posix = 1614556800 as Seconds;
    const epoch = new Epoch(posix);

    expect(epoch.toJulianDate()).toMatchSnapshot();
  });

  // toJulianCenturies
  it('should convert to Julian centuries', () => {
    const posix = 1614556800 as Seconds;
    const epoch = new Epoch(posix);

    expect(epoch.toJulianCenturies()).toMatchSnapshot();
  });

  // operatorGreaterThan
  it('should check if one epoch is greater than another', () => {
    const posix1 = 1614556800 as Seconds;
    const posix2 = (1614556800 + 60) as Seconds;
    const epoch1 = new Epoch(posix1);
    const epoch2 = new Epoch(posix2);

    expect(epoch1.operatorGreaterThan(epoch2)).toEqual(false);
  });

  // operatorGreaterThanOrEqual
  it('should check if one epoch is greater than or equal to another', () => {
    const posix1 = 1614556800 as Seconds;
    const posix2 = (1614556800 + 60) as Seconds;
    const epoch1 = new Epoch(posix1);
    const epoch2 = new Epoch(posix2);

    expect(epoch1.operatorGreaterThanOrEqual(epoch2)).toEqual(false);
  });

  // operatorLessThan
  it('should check if one epoch is less than another', () => {
    const posix1 = 1614556800 as Seconds;
    const posix2 = (1614556800 + 60) as Seconds;
    const epoch1 = new Epoch(posix1);
    const epoch2 = new Epoch(posix2);

    expect(epoch1.operatorLessThan(epoch2)).toEqual(true);
  });

  // operatorLessThanOrEqual
  it('should check if one epoch is less than or equal to another', () => {
    const posix1 = 1614556800 as Seconds;
    const posix2 = (1614556800 + 60) as Seconds;
    const epoch1 = new Epoch(posix1);
    const epoch2 = new Epoch(posix2);

    expect(epoch1.operatorLessThanOrEqual(epoch2)).toEqual(true);
  });

  // Test negative posix timestamp (pre-1970 dates are valid for TLE epochs back to 1957)
  it('should allow negative POSIX timestamp for pre-1970 dates', () => {
    expect(() => new Epoch(-1 as Seconds)).not.toThrow();
  });

  // Test NaN posix timestamp
  it('should throw an error for NaN POSIX timestamp', () => {
    expect(() => new Epoch(NaN as Seconds)).toThrow('Epoch posix time must be a valid number');
  });

  // Test equals with same epoch
  it('should check if two epochs with same timestamp are equal', () => {
    const posix = 1614556800 as Seconds;
    const epoch1 = new Epoch(posix);
    const epoch2 = new Epoch(posix);

    expect(epoch1.equals(epoch2)).toEqual(true);
  });

  // Test operatorGreaterThanOrEqual with equal epochs
  it('should check if one epoch is greater than or equal to another when equal', () => {
    const posix = 1614556800 as Seconds;
    const epoch1 = new Epoch(posix);
    const epoch2 = new Epoch(posix);

    expect(epoch1.operatorGreaterThanOrEqual(epoch2)).toEqual(true);
  });

  // Test operatorLessThanOrEqual with equal epochs
  it('should check if one epoch is less than or equal to another when equal', () => {
    const posix = 1614556800 as Seconds;
    const epoch1 = new Epoch(posix);
    const epoch2 = new Epoch(posix);

    expect(epoch1.operatorLessThanOrEqual(epoch2)).toEqual(true);
  });

  // Test leap year edge cases
  it('should handle leap year in toEpochYearAndDay', () => {
    const posix = 1582934400 as Seconds; // 2020-02-29 (leap year)
    const epoch = new Epoch(posix);

    expect(epoch.toEpochYearAndDay()).toMatchSnapshot();
  });

  // Test century year that is not a leap year
  it('should handle non-leap century year', () => {
    const posix = 951782400 as Seconds; // 2000-02-29 (leap year - divisible by 400)
    const epoch = new Epoch(posix);

    expect(epoch.toEpochYearAndDay()).toMatchSnapshot();
  });

  // Test zero posix timestamp
  it('should handle zero POSIX timestamp', () => {
    const posix = 0 as Seconds;
    const epoch = new Epoch(posix);

    expect(epoch.posix).toEqual(0);
    expect(epoch.toDateTime().toISOString()).toEqual('1970-01-01T00:00:00.000Z');
  });

  // Test getDayOfYear for different months
  it('should calculate day of year correctly for different months', () => {
    // January 15th
    const posix1 = 1610668800 as Seconds; // 2021-01-15
    const epoch1 = new Epoch(posix1);

    expect(epoch1.toEpochYearAndDay().epochDay).toContain('015.');

    // June 1st
    const posix2 = 1622505600 as Seconds; // 2021-06-01
    const epoch2 = new Epoch(posix2);

    expect(epoch2.toEpochYearAndDay().epochDay).toContain('152.');
  });

  // Test isLeapYear for non-divisible by 4
  it('should identify non-leap year (not divisible by 4)', () => {
    const posix = 1641081600 as Seconds; // 2022-01-02
    const epoch = new Epoch(posix);

    expect(epoch.toEpochYearAndDay()).toMatchSnapshot();
  });

  // Test isLeapYear for century year not divisible by 400
  it('should handle century year not divisible by 400', () => {
    const posix = 4102444800 as Seconds; // 2100-01-01 (not a leap year)
    const epoch = new Epoch(posix);

    expect(epoch.toEpochYearAndDay()).toMatchSnapshot();
  });

  // Test toEpochYearAndDay with time of day calculations
  it('should include time of day in epoch day calculation', () => {
    const posix = 1614556800 as Seconds; // Contains hours and minutes
    const epoch = new Epoch(posix);
    const result = epoch.toEpochYearAndDay();

    expect(result.epochDay.length).toEqual(12);
    expect(result.epochDay).toContain('.');
  });

  // Test difference with positive result
  it('should calculate positive difference between epochs', () => {
    const posix1 = 1614556800 as Seconds;
    const posix2 = (1614556800 - 120) as Seconds;
    const epoch1 = new Epoch(posix1);
    const epoch2 = new Epoch(posix2);

    expect(epoch1.difference(epoch2)).toEqual(120);
  });

  // Test operatorGreaterThan with equal epochs
  it('should return false when comparing equal epochs with operatorGreaterThan', () => {
    const posix = 1614556800 as Seconds;
    const epoch1 = new Epoch(posix);
    const epoch2 = new Epoch(posix);

    expect(epoch1.operatorGreaterThan(epoch2)).toEqual(false);
  });

  // Test boundary values for Julian date conversion
  it('should convert to Julian date for epoch zero', () => {
    const epoch = new Epoch(0 as Seconds);

    expect(epoch.toJulianDate()).toBeCloseTo(2440587.5, 5);
  });

  // Test Julian centuries conversion
  it('should convert to Julian centuries for J2000 epoch', () => {
    const posix = 946728000 as Seconds; // 2000-01-01 12:00:00 UTC (close to J2000)
    const epoch = new Epoch(posix);

    expect(epoch.toJulianCenturies()).toBeCloseTo(0, 2);
  });
});
