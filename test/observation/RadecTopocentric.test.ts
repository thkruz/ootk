import { DEG2RAD, Degrees, EpochUTC, J2000, Kilometers, KilometersPerSecond, RadecTopocentric,
  Radians, RadiansPerSecond, Vector3D } from '../../src/main';
describe('RadecTopocentric', () => {
  let radec: RadecTopocentric;
  let exampleDate: Date;

  beforeEach(() => {
    exampleDate = new Date(1705109326817);
    radec = new RadecTopocentric(
      EpochUTC.fromDateTime(exampleDate),
      25 * DEG2RAD as Radians,
      0 * DEG2RAD as Radians,
    );
  });

  it('should be constructable', () => {
    expect(radec).toMatchSnapshot();
  });

  // fromDegrees
  it('should be constructable from degrees', () => {
    const radecDeg = RadecTopocentric.fromDegrees(
      EpochUTC.fromDateTime(exampleDate),
      25 as Degrees,
      0 as Degrees,
    );

    expect(radecDeg).toMatchSnapshot();
  });

  // fromStateVector
  it('should be constructable from a state vector', () => {
    const site = new J2000(
      EpochUTC.fromDateTime(exampleDate),
      new Vector3D<Kilometers>(8000 as Kilometers, 7000 as Kilometers, 8000 as Kilometers),
      new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond),
    );
    const state = new J2000(
      EpochUTC.fromDateTime(exampleDate),
      new Vector3D<Kilometers>(7000 as Kilometers, 7000 as Kilometers, 8000 as Kilometers),
      new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond),
    );
    const radecSv = RadecTopocentric.fromStateVector(state, site);

    expect(radecSv).toMatchSnapshot();
  });

  // rightAscensionDegrees
  it('should return the right ascension in degrees', () => {
    expect(radec.rightAscensionDegrees).toMatchSnapshot();
  });

  // declinationDegrees
  it('should return the declination in degrees', () => {
    expect(radec.declinationDegrees).toMatchSnapshot();
  });

  // rightAscensionRateDegrees
  it('should return the right ascension rate in degrees', () => {
    expect(radec.rightAscensionRateDegrees).toMatchSnapshot();
  });

  // declinationRateDegrees
  it('should return the declination rate in degrees', () => {
    expect(radec.declinationRateDegrees).toMatchSnapshot();
  });

  // position
  it('should return the position', () => {
    const site = new J2000(
      EpochUTC.fromDateTime(exampleDate),
      new Vector3D<Kilometers>(8000 as Kilometers, 7000 as Kilometers, 8000 as Kilometers),
      new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond),
    );

    expect(radec.position(site)).toMatchSnapshot();
  });

  // velocity
  it('should return the velocity', () => {
    const radec2 = new RadecTopocentric(
      EpochUTC.fromDateTime(exampleDate),
      25 * DEG2RAD as Radians,
      1 * DEG2RAD as Radians,
      1000 as Kilometers,
      1.5 * DEG2RAD as RadiansPerSecond,
      2.5 * DEG2RAD as RadiansPerSecond,
    );
    const site = new J2000(
      EpochUTC.fromDateTime(exampleDate),
      new Vector3D<Kilometers>(8000 as Kilometers, 7000 as Kilometers, 8000 as Kilometers),
      new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond),
    );

    expect(radec2.velocity(site)).toMatchSnapshot();
  });

  // angle
  it('should return the angle', () => {
    const radec2 = new RadecTopocentric(
      EpochUTC.fromDateTime(exampleDate),
      25 * DEG2RAD as Radians,
      1 * DEG2RAD as Radians,
    );

    expect(radec.angle(radec2)).toMatchSnapshot();
  });

  // angleDegrees
  it('should return the angle in degrees', () => {
    const radec2 = new RadecTopocentric(
      EpochUTC.fromDateTime(exampleDate),
      25 * DEG2RAD as Radians,
      1 * DEG2RAD as Radians,
    );

    expect(radec.angleDegrees(radec2)).toMatchSnapshot();
  });
});
