import { EpochUTC, Seconds } from '../../main';

describe('EpochGPS', () => {
  it('now', () => {
    const epoch = EpochUTC.now();
    const now = new Date();

    expect(epoch.posix).toBeCloseTo(now.getTime() / 1000, 2);
  });

  it('fromDate', () => {
    const epoch = EpochUTC.fromDate({ year: 2021, month: 3, day: 1 });

    expect(epoch).toMatchSnapshot();
  });

  it('fromDateTime', () => {
    const epoch = EpochUTC.fromDateTime(new Date(2021, 2, 1));

    expect(epoch).toMatchSnapshot();
  });

  it('fromDateTimeString', () => {
    const epoch = EpochUTC.fromDateTimeString('2021-03-01');

    expect(epoch).toMatchSnapshot();
  });

  it('fromJ2000TTSeconds', () => {
    const epoch = EpochUTC.fromJ2000TTSeconds(0 as Seconds);

    expect(epoch).toMatchSnapshot();
  });

  it('fromDefinitiveString', () => {
    const epoch = EpochUTC.fromDefinitiveString('1/2021 00:00:00');

    expect(epoch).toMatchSnapshot();
  });

  // roll
  it('should roll the epoch forward', () => {
    const epoch = EpochUTC.fromDateTime(new Date(2021, 2, 1));

    expect(epoch.roll(60 as Seconds)).toMatchSnapshot();
  });

  // toMjd
  it('should convert to an MJD', () => {
    const epoch = EpochUTC.fromDateTime(new Date(2021, 2, 1));

    expect(epoch.toMjd()).toMatchSnapshot();
  });

  // toMjdGsfc
  it('should convert to an MJD GSFC', () => {
    const epoch = EpochUTC.fromDateTime(new Date(2021, 2, 1));

    expect(epoch.toMjdGsfc()).toMatchSnapshot();
  });

  // toTAI
  it('should convert to a TAI epoch', () => {
    const epoch = EpochUTC.fromDateTime(new Date(2021, 2, 1));

    expect(epoch.toTAI()).toMatchSnapshot();
  });

  // toTT
  it('should convert to a TT epoch', () => {
    const epoch = EpochUTC.fromDateTime(new Date(2021, 2, 1));

    expect(epoch.toTT()).toMatchSnapshot();
  });

  // toTDB
  it('should convert to a TDB epoch', () => {
    const epoch = EpochUTC.fromDateTime(new Date(2021, 2, 1));

    expect(epoch.toTDB()).toMatchSnapshot();
  });

  // toGPS
  it('should convert to a GPS epoch', () => {
    const epoch = EpochUTC.fromDateTime(new Date(2021, 2, 1));

    expect(epoch.toGPS()).toMatchSnapshot();
  });

  // gmstAngle
  it('should calculate the GMST angle', () => {
    const epoch = EpochUTC.fromDateTime(new Date(2021, 2, 1));

    expect(epoch.gmstAngle()).toMatchSnapshot();
  });

  // gmstAngleDegrees
  it('should calculate the GMST angle in degrees', () => {
    const epoch = EpochUTC.fromDateTime(new Date(2021, 2, 1));

    expect(epoch.gmstAngleDegrees()).toMatchSnapshot();
  });

  // Test private methods through public interface
  it('should handle leap year correctly in fromDate', () => {
    const leapYear = EpochUTC.fromDate({ year: 2020, month: 2, day: 29 });
    const nonLeapYear = EpochUTC.fromDate({ year: 2021, month: 3, day: 1 });

    expect(leapYear).toMatchSnapshot();
    expect(nonLeapYear).toMatchSnapshot();
  });

  it('should handle century leap year edge cases', () => {
    const century2000 = EpochUTC.fromDate({ year: 2000, month: 2, day: 29 });

    expect(century2000).toMatchSnapshot();
  });

  it('should handle full datetime in fromDate', () => {
    const epoch = EpochUTC.fromDate({
      year: 2021,
      month: 6,
      day: 15,
      hour: 14,
      minute: 30,
      second: 45,
    });

    expect(epoch).toMatchSnapshot();
  });

  it('should handle fromDateTimeString without Z suffix', () => {
    const epoch = EpochUTC.fromDateTimeString('2021-03-01T12:00:00');

    expect(epoch).toMatchSnapshot();
  });

  it('should roll the epoch backward', () => {
    const epoch = EpochUTC.fromDateTime(new Date(2021, 2, 1));

    expect(epoch.roll(-60 as Seconds)).toMatchSnapshot();
  });

  it('should handle definitive string with different days', () => {
    const epoch = EpochUTC.fromDefinitiveString('365/2021 23:59:59');

    expect(epoch).toMatchSnapshot();
  });

  // Regression: rendering pipeline (Earth.update / getJ2000 / getTeme) constructs
  // EpochUTC from simulationTimeObj for missions like Apollo 8 (1968), which
  // produces a negative POSIX value. Pre-1970 dates must flow through without throwing.
  it('should accept pre-1970 dates via fromDateTime', () => {
    const apollo8Tli = new Date('1968-12-21T12:51:00Z');

    expect(() => EpochUTC.fromDateTime(apollo8Tli)).not.toThrow();
    expect(EpochUTC.fromDateTime(apollo8Tli).posix).toBeLessThan(0);
  });

  it('should accept negative POSIX seconds via constructor', () => {
    expect(() => new EpochUTC(-1 as Seconds)).not.toThrow();
  });
});
