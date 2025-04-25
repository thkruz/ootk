import {
  AngularDistanceMethod,
  DEG2RAD,
  Degrees,
  EpochUTC,
  J2000,
  Kilometers,
  KilometersPerSecond,
  RAE,
  Radians,
  Vector3D,
} from '../../src/main';

describe('RAE', () => {
  let exampleDate: Date;
  let rae: RAE;

  beforeEach(() => {
    exampleDate = new Date(1705109326817);
    rae = new RAE(
      EpochUTC.fromDateTime(exampleDate),
      1000 as Kilometers,
      10 * DEG2RAD as Radians,
      20 * DEG2RAD as Radians,
    );
  });

  it('should be constructable', () => {
    expect(rae).toMatchSnapshot();
  });

  it('should be constructable from degrees', () => {
    const raeDeg = RAE.fromDegrees(
      EpochUTC.fromDateTime(exampleDate),
      1000 as Kilometers,
      10 as Degrees,
      20 as Degrees,
    );

    expect(raeDeg).toMatchSnapshot();
    expect(raeDeg).toMatchObject(rae);
  });

  // azimuthDegrees
  it('should return the azimuth in degrees', () => {
    expect(rae.az).toMatchSnapshot();
  });

  // elevationDegrees
  it('should return the elevation in degrees', () => {
    expect(rae.el).toMatchSnapshot();
  });

  // azimuthRateDegrees
  it('should return the azimuth rate in degrees', () => {
    expect(rae.azRate).toMatchSnapshot();
  });

  // elevationRateDegrees
  it('should return the elevation rate in degrees', () => {
    expect(rae.elRate).toMatchSnapshot();
  });

  // toString
  it('should return a string representation', () => {
    expect(rae.toString()).toMatchSnapshot();
  });

  // fromStateVector
  it('should return a RAE object from a state vector', () => {
    const state = new J2000(
      EpochUTC.fromDateTime(exampleDate),
      new Vector3D<Kilometers>(7000 as Kilometers, 7000 as Kilometers, 8000 as Kilometers),
      new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond),
    );
    const site = new J2000(
      EpochUTC.fromDateTime(exampleDate),
      new Vector3D<Kilometers>(6000 as Kilometers, 7000 as Kilometers, 8000 as Kilometers),
      new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond),
    );

    const rae = RAE.fromStateVector(state, site);

    expect(rae).toMatchSnapshot();
  });

  // toStateVector
  it('should return a state vector', () => {
    const site = new J2000(
      EpochUTC.fromDateTime(exampleDate),
      new Vector3D<Kilometers>(6000 as Kilometers, 7000 as Kilometers, 8000 as Kilometers),
      new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond),
    );

    expect(rae.toStateVector(site)).toMatchSnapshot();
  });

  // position
  it('should return the position vector', () => {
    const site = new J2000(
      EpochUTC.fromDateTime(exampleDate),
      new Vector3D<Kilometers>(6000 as Kilometers, 7000 as Kilometers, 8000 as Kilometers),
      new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond),
    );

    expect(rae.position(site)).toMatchSnapshot();
  });

  // angle
  it('should return the angle', () => {
    const rae2 = new RAE(
      EpochUTC.fromDateTime(exampleDate),
      1000 as Kilometers,
      15 * DEG2RAD as Radians,
      25 * DEG2RAD as Radians,
    );

    expect(rae.angle(rae2)).toMatchSnapshot();
    expect(rae.angle(rae2, AngularDistanceMethod.Haversine)).toMatchSnapshot();
    expect(rae.angle(rae2, AngularDistanceMethod.Haversine))
      .not.toEqual(rae.angle(rae2, AngularDistanceMethod.Cosine));
  });

  // angleDegrees
  it('should return the angle in degrees', () => {
    const rae2 = new RAE(
      EpochUTC.fromDateTime(exampleDate),
      1000 as Kilometers,
      15 * DEG2RAD as Radians,
      25 * DEG2RAD as Radians,
    );

    expect(rae.angleDegrees(rae2)).toMatchSnapshot();
  });
});
