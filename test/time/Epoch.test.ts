import { Epoch, Seconds } from '../../src/main';

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
});
