import { Geodetic, AngularDistanceMethod, Degrees, EpochUTC, Kilometers, Radians } from '../../src/main';

describe('Geodetic', () => {
  /*
   * Creating a Geodetic object with valid latitude, longitude, and altitude
   * values should succeed.
   */
  it('should create a Geodetic object with valid latitude, longitude, and altitude values', () => {
    const geodetic = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 100 as Kilometers);

    expect(geodetic).toMatchSnapshot();
  });

  // Converting a Geodetic object from degrees to radians should succeed.
  it('should convert a Geodetic object from degrees to radians', () => {
    const geodetic = Geodetic.fromDegrees(45 as Degrees, 90 as Degrees, 0 as Kilometers);

    expect(geodetic).toMatchSnapshot();
  });

  // Converting a Geodetic object to a string should succeed.
  it('should convert a Geodetic object to a string', () => {
    const geodetic = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 100 as Kilometers);
    const result = geodetic.toString();

    expect(result).toMatchSnapshot();
  });

  // Converting a Geodetic object to ITRF coordinates should succeed.
  it('should convert a Geodetic object to ITRF coordinates', () => {
    const geodetic = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 100 as Kilometers);
    const epoch = EpochUTC.fromDateTime(new Date('2024-01-14T14:39:39.914Z'));
    const result = geodetic.toITRF(epoch);

    expect(result).toMatchSnapshot();
  });

  /*
   * Calculating the angle between two Geodetic objects using Haversine method
   * should succeed.
   */
  it('should calculate the angle between two Geodetic objects using Haversine method', () => {
    const geodetic1 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 0 as Kilometers);
    const geodetic2 = new Geodetic(0.7854 as Radians, 3.1015 as Radians, 0 as Kilometers);
    const result = geodetic1.angle(geodetic2);

    expect(result).toMatchSnapshot();
  });

  /*
   * Calculating the angle between two Geodetic objects using Spherical Law of
   * Cosines method should succeed.
   */
  it('should calculate the angle between two Geodetic objects using Spherical Law of Cosines method', () => {
    const geodetic1 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 0 as Kilometers);
    const geodetic2 = new Geodetic(0.7854 as Radians, 3.1015 as Radians, 0 as Kilometers);
    const result = geodetic1.angle(geodetic2, AngularDistanceMethod.Cosine);

    expect(result).toMatchSnapshot();
  });

  /*
   * Creating a Geodetic object with invalid latitude value should raise an
   * exception.
   */
  it('should raise an exception when creating a Geodetic object with invalid latitude value', () => {
    expect(() => new Geodetic(100 as Radians, 1.5708 as Radians, 0 as Kilometers)).toThrow();
  });

  /*
   * Calculating the angle in degrees between two Geodetic objects using
   * Haversine method should succeed.
   */
  it('should calculate the angle in degrees between two Geodetic objects using Haversine method', () => {
    const geodetic1 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 100 as Kilometers);
    const geodetic2 = new Geodetic(0.7854 as Radians, 3.1015 as Radians, 200 as Kilometers);
    const angleDegrees = geodetic1.angleDeg(geodetic2, AngularDistanceMethod.Haversine);

    expect(angleDegrees).toMatchSnapshot();
  });

  /*
   * Calculating the angle in degrees between two Geodetic objects using
   * Spherical Law of Cosines method should succeed.
   */
  it('should calculate the angle in degrees between two Geodetic objects using Spherical Law of Cosines method', () => {
    const geodetic1 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 100 as Kilometers);
    const geodetic2 = new Geodetic(0.7854 as Radians, 3.1015 as Radians, 200 as Kilometers);
    const angleDegrees = geodetic1.angleDeg(geodetic2, AngularDistanceMethod.Cosine);

    expect(angleDegrees).toMatchSnapshot();
  });

  /*
   * Calculating the distance between two Geodetic objects using Haversine
   * method should succeed.
   */
  it('should calculate the distance between two Geodetic objects using Haversine method', () => {
    const geodetic1 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 0 as Kilometers);
    const geodetic2 = new Geodetic(0 as Radians, 0 as Radians, 0 as Kilometers);
    const distance = geodetic1.distance(geodetic2, AngularDistanceMethod.Haversine);

    expect(distance).toMatchSnapshot();
  });

  /*
   * Calculating the distance between two Geodetic objects using Spherical Law
   * of Cosines method should succeed.
   */
  it('should calculate the distance between two Geodetic objects using Spherical Law of Cosines method', () => {
    const geodetic1 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 0 as Kilometers);
    const geodetic2 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 100 as Kilometers);
    const distance = geodetic1.distance(geodetic2, AngularDistanceMethod.Cosine);

    expect(distance).toMatchSnapshot();
  });

  /*
   * Calculating the angle between two Geodetic objects with identical
   * coordinates should return 0 radians.
   */
  it('should return 0 radians when angle between two Geodetic objects with identical coordinates', () => {
    const geodetic1 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 100 as Kilometers);
    const geodetic2 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 200 as Kilometers);
    const angle = geodetic1.angle(geodetic2);

    expect(angle).toBe(0);
  });

  /*
   * Calculating the angle in degrees between two Geodetic objects with
   * identical coordinates should return 0 degrees.
   */
  it('should return 0 degrees when angle in degrees between two Geodetic objects with identical coordinates', () => {
    const geodetic1 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 100 as Kilometers);
    const geodetic2 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 200 as Kilometers);
    const angleDegrees = geodetic1.angleDeg(geodetic2);

    expect(angleDegrees).toBe(0);
  });

  /*
   * Calculating the distance between two Geodetic objects with identical
   * coordinates should return 0 kilometers.
   */
  it('should return 0 when calculating the distance between two Geodetic objects with identical coordinates', () => {
    const geodetic1 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 100 as Kilometers);
    const geodetic2 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 100 as Kilometers);
    const distance = geodetic1.distance(geodetic2);

    expect(distance).toBe(0);
  });

  /*
   * Checking if a Geodetic object is in view of another Geodetic object with
   * identical coordinates should return True.
   */
  it('should return true if a Geodetic object is in view of another Geodetic object with identical coordinates', () => {
    const geodetic1 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 100 as Kilometers);
    const geodetic2 = new Geodetic(0.7854 as Radians, 1.5708 as Radians, 100 as Kilometers);
    const result = geodetic1.isInView(geodetic2);

    expect(result).toBe(true);
  });
});
