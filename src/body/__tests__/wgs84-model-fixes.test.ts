/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import { vi } from 'vitest';
import {
  Antenna,
  Decibels,
  DEG2RAD,
  EpochUTC,
  Hertz,
  Kilometers,
  RepeatGroundTrack,
  secondsPerDay,
  Sun,
  SunBody,
  Transmitter,
  Vector3D,
  Watts,
  WGS84_A,
  WGS84_B,
} from '../../main';

const km = (x: number, y: number, z: number) => new Vector3D(x as Kilometers, y as Kilometers, z as Kilometers);

describe('SunBody shadow against the WGS84 ellipsoid', () => {
  const epoch = EpochUTC.fromDateTime(new Date('2026-03-20T12:00:00Z'));
  const zScale = WGS84_A / WGS84_B;

  beforeEach(() => {
    // Sun along +x so the shadow axis is -x and the polar (z) offset is the cylinder offset.
    vi.spyOn(Sun, 'eciApparent').mockReturnValue(km(1.496e8, 0, 0));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Penumbra edge at x = -3000 in scaled space.
  const penVert = WGS84_A + Math.tan(SunBody.PENUMBRA_ANGLE) * -3000;

  it('reports a polar-orbit satellite outside the shadow when the spherical model (radius a) would put it inside', () => {
    const z = penVert / zScale + 5;

    expect(z).toBeLessThan(penVert);
    expect(Sun.shadow(epoch, km(-3000, 0, z))).toBe(false);
  });

  it('reports a polar-orbit satellite just inside the ellipsoidal shadow as in shadow', () => {
    const z = penVert / zScale - 5;

    expect(Sun.shadow(epoch, km(-3000, 0, z))).toBe(true);
  });

  it('is unchanged on the equator where the scale does not apply', () => {
    expect(Sun.shadow(epoch, km(-3000, penVert - 5, 0))).toBe(true);
    expect(Sun.shadow(epoch, km(-3000, penVert + 5, 0))).toBe(false);
  });

  it('is false on the day side', () => {
    expect(Sun.shadow(epoch, km(7000, 0, 0))).toBe(false);
  });

  it('eclipseAngles uses the polar radius for a satellite over the pole', () => {
    const [, aCent] = Sun.eclipseAngles(km(0, 0, 7000), km(1.496e8, 0, 0));

    expect(aCent).toBeCloseTo(Math.asin(WGS84_B / 7000), 6);
  });

  it('eclipseAngles uses the equatorial radius for a satellite on the equator', () => {
    const [, aCent] = Sun.eclipseAngles(km(7000, 0, 0), km(1.496e8, 0, 0));

    expect(aCent).toBeCloseTo(Math.asin(WGS84_A / 7000), 6);
  });

  it('eclipseAngles uses WGS84_A, not Earth.radiusEquator, in the apparent radius (hand value)', () => {
    // sin(aCent) = 6378.137 / 7000 = 0.91116242857, aCent = 1.14609642480 rad. Earth.radiusEquator (6378.1363)
    // would give 1.14609618211 rad, 2.4e-7 rad lower, so 9 digits tell the two apart.
    const [, aCent] = Sun.eclipseAngles(km(7000, 0, 0), km(1.496e8, 0, 0));

    expect(aCent).toBeCloseTo(1.1460964248, 9);
  });
});

describe('Transmitter space-to-space visibility against the WGS84 ellipsoid', () => {
  const tx = new Transmitter({
    id: 1,
    name: 'tx',
    frequency: 14e9 as Hertz,
    power: 10 as Watts,
    bandwidth: 36e6 as Hertz,
    antenna: new Antenna({ gain: 10 as Decibels }),
  });
  const blocked = (a: [number, number, number], b: [number, number, number]) =>
    (tx as unknown as { lineIntersectsEarth_: (p: object, q: object) => boolean }).lineIntersectsEarth_(
      { x: a[0], y: a[1], z: a[2] },
      { x: b[0], y: b[1], z: b[2] },
    );

  it('blocks a link through the equatorial bulge that the mean sphere reported clear', () => {
    expect(blocked([6375, -2000, 0], [6375, 2000, 0])).toBe(true);
  });

  it('clears a link 5 km above the pole that the mean sphere reported blocked', () => {
    expect(blocked([-3000, 0, 6361.752], [3000, 0, 6361.752])).toBe(false);
  });
});

describe('Reference-radius conventions', () => {
  it('sunSynchronousInclination uses the WGS84 equatorial radius for altitude', () => {
    const sma = 500 + WGS84_A;
    const e = 0.0001;
    const p = sma * (1 - e * e);
    const n = Math.sqrt(398600.4415 / sma ** 3);
    const rate = (0.9856 * DEG2RAD) / secondsPerDay;
    const factor = -1.5 * 1.08262668355315e-3 * (6378.1363 / p) ** 2 * n;
    const expected = Math.acos(rate / factor) / DEG2RAD;

    expect(RepeatGroundTrack.sunSynchronousInclination(500 as Kilometers, e)).toBeCloseTo(expected, 6);
  });
});
