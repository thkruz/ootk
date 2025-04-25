import { Earth, EpochUTC, Kilometers, Vector3D } from '../../src/main';

describe('Earth', () => {
  let exampleDate = new Date(1705109326817);

  beforeEach(() => {
    const mockExampleDate = new Date(1705109326817);

    exampleDate = new Date(mockExampleDate.getTime());
  });

  // can calculate mean motion from semimajor axis
  it('should calculate mean motion when given a semimajor axis', () => {
    const semimajorAxis = 7000 as Kilometers;
    const meanMotion = Earth.smaToMeanMotion(semimajorAxis);

    expect(meanMotion).toMatchSnapshot();
  });

  // can calculate precession angles from epoch
  it('should calculate precession angles when given an epoch', () => {
    const epoch = EpochUTC.fromDateTime(exampleDate);
    const precessionAngles = Earth.precession(epoch);

    expect(precessionAngles.zeta).toMatchSnapshot();
    expect(precessionAngles.theta).toMatchSnapshot();
    expect(precessionAngles.zed).toMatchSnapshot();
  });

  // can calculate nutation angles from epoch
  it('should calculate nutation angles when given an epoch', () => {
    const epoch = EpochUTC.fromDateTime(exampleDate);
    const nutationAngles = Earth.nutation(epoch);

    expect(nutationAngles.dPsi).toMatchSnapshot();
    expect(nutationAngles.dEps).toMatchSnapshot();
    expect(nutationAngles.mEps).toMatchSnapshot();
    expect(nutationAngles.eps).toMatchSnapshot();
    expect(nutationAngles.eqEq).toMatchSnapshot();
    expect(nutationAngles.gast).toMatchSnapshot();
  });

  // can handle semimajor axis of 0 when calculating mean motion
  it('should return NaN when given a semimajor axis of 0', () => {
    const semimajorAxis = 0 as Kilometers;
    const meanMotion = Earth.smaToMeanMotion(semimajorAxis);

    expect(meanMotion).toBe(Infinity);
  });

  // can handle negative semimajor axis when calculating mean motion
  it('should return NaN when given a negative semimajor axis', () => {
    const semimajorAxis = -7000 as Kilometers;
    const meanMotion = Earth.smaToMeanMotion(semimajorAxis);

    expect(meanMotion).toBeNaN();
  });

  // can calculate drift rate from semimajor axis
  it('should calculate drift rate when given a semimajor axis', () => {
    const semimajorAxis = 7000; // km
    const driftRate = Earth.smaToDrift(semimajorAxis);

    expect(driftRate).toMatchSnapshot();
  });

  // can calculate semimajor axis from drift rate
  it('should calculate semimajor axis from drift rate', () => {
    const driftRate = 0.1; // degrees per day
    const semimajorAxis = Earth.driftDegreesToSma(driftRate);

    expect(semimajorAxis).toMatchSnapshot();
  });

  // can calculate Earth's diameter from satellite position
  it('should calculate Earth\'s diameter from satellite position', () => {
    const satPos = new Vector3D(1000, 1000, 1000);
    const diameter = Earth.diameter(satPos);

    expect(diameter).toMatchSnapshot();
  });

  // can handle epoch before 1900 when calculating precession angles
  it('should handle epoch before 1900 when calculating precession angles', () => {
    const epoch = EpochUTC.fromDateTime(exampleDate);
    const precessionAngles = Earth.precession(epoch);

    expect(precessionAngles.zeta).toMatchSnapshot();
  });

  // can handle epoch after 2150 when calculating precession angles
  it('should handle epoch after 2150 when calculating precession angles', () => {
    const epoch = EpochUTC.fromDateTime(exampleDate);
    const precessionAngles = Earth.precession(epoch);

    expect(precessionAngles.zeta).not.toBeNaN();
    expect(precessionAngles.zeta).toMatchSnapshot();
  });

  // can handle epoch before 1900 when calculating nutation angles
  it('should handle epoch before 1900 when calculating nutation angles', () => {
    const epoch = EpochUTC.fromDateTime(exampleDate);
    const nutationAngles = Earth.nutation(epoch);

    expect(nutationAngles.dPsi).not.toBeNaN();
    expect(nutationAngles.dPsi).toMatchSnapshot();
  });

  // can handle epoch after 2150 when calculating nutation angles
  it('should handle epoch after 2150 when calculating nutation angles', () => {
    const epoch = EpochUTC.fromDateTime(exampleDate);
    const nutationAngles = Earth.nutation(epoch);

    expect(nutationAngles.dPsi).not.toBeNaN();
    expect(nutationAngles.dPsi).toMatchSnapshot();
  });

  // can handle negative drift rate when calculating semimajor axis
  it('should handle negative drift rate when calculating semimajor axis', () => {
    const driftRate = -0.1; // degrees per day
    const semimajorAxis = Earth.driftDegreesToSma(driftRate);

    expect(semimajorAxis).not.toBeNaN();
    expect(semimajorAxis).toMatchSnapshot();
  });

  // can handle drift rate of 0 when calculating semimajor axis
  it('should handle drift rate of 0 when calculating semimajor axis', () => {
    const driftRate = 0; // degrees per day
    const semimajorAxis = Earth.driftDegreesToSma(driftRate);

    expect(semimajorAxis).not.toBeNaN();
    expect(semimajorAxis).toMatchSnapshot();
  });
});
