import { EpochUTC, Seconds } from '../../src/main';

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
});
