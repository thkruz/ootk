import {
  Degrees,
  DegreesPerSecond,
  EpochUTC,
  J2000,
  Kilometers,
  KilometersPerSecond,
  RadecGeocentric,
  RadecTopocentric,
  RAE,
  Vector3D,
} from '../../main';

describe('observation rates and angles', () => {
  const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00Z'));

  it('a rate of exactly zero is kept, not dropped as "missing"', () => {
    const rae = RAE.fromDegrees(epoch, 1000 as Kilometers, 10 as Degrees, 20 as Degrees, 0, 0, 0);

    expect(rae.azRate).toBe(0);
    expect(rae.elRate).toBe(0);

    const topo = RadecTopocentric.fromDegrees(epoch, 10 as Degrees, 20 as Degrees, 1000 as Kilometers,
      0 as DegreesPerSecond, 0 as DegreesPerSecond, 0 as KilometersPerSecond);

    expect(topo.rightAscensionRateDegrees).toBe(0);
    const site = new J2000(epoch, new Vector3D(6378 as Kilometers, 0 as Kilometers, 0 as Kilometers),
      new Vector3D(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond));

    // velocity() threw "missing ra/dec rates" for zero rates
    expect(() => topo.velocity(site)).not.toThrow();

    const geo = RadecGeocentric.fromDegrees(epoch, 10 as Degrees, 20 as Degrees, 7000 as Kilometers,
      0 as DegreesPerSecond, 0 as DegreesPerSecond, 0 as KilometersPerSecond);

    expect(() => geo.velocity()).not.toThrow();
  });

  it('RadecGeocentric right ascension is in [0, 360)', () => {
    const state = new J2000(epoch, new Vector3D(7000 as Kilometers, -7000 as Kilometers, 0 as Kilometers),
      new Vector3D(0 as KilometersPerSecond, 7 as KilometersPerSecond, 0 as KilometersPerSecond));

    // Was -45
    expect(RadecGeocentric.fromStateVector(state).rightAscensionDegrees).toBeCloseTo(315, 10);
  });
});
