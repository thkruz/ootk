/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import {
  DEG2RAD,
  Kilometers,
  Radians,
  WGS84_A,
  WGS84_B,
  WGS84_E2,
  WGS84_F,
  ecef2eci,
  eci2lla,
  ellipsoidRadiusAlong,
  geodeticSurfaceNormal,
  liftToEllipsoid,
  llaRad2ecef,
  llaRad2eci,
  rayEllipsoidIntersection,
  scaleToGeodeticSurface,
  segmentIntersectsEllipsoid,
} from '../../main';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const deg = (d: number) => (d * DEG2RAD) as Radians;

describe('WGS84 constants', () => {
  it('exports exact WGS84 values', () => {
    expect(WGS84_A).toBe(6378.137);
    expect(WGS84_B).toBeCloseTo(6356.752314245, 6);
    expect(WGS84_F).toBeCloseTo(1 / 298.257223563, 15);
    expect(WGS84_E2).toBeCloseTo(0.00669437999014, 12);
  });
});

describe('geodeticSurfaceNormal', () => {
  it('equals (cos45, 0, sin45) for the surface point at geodetic latitude 45', () => {
    const p = llaRad2ecef({ lat: deg(45), lon: 0 as Radians, alt: 0 as Kilometers });
    const n = geodeticSurfaceNormal(p);

    expect(n.x).toBeCloseTo(Math.cos(45 * DEG2RAD), 12);
    expect(n.y).toBeCloseTo(0, 12);
    expect(n.z).toBeCloseTo(Math.sin(45 * DEG2RAD), 12);
  });

  it('writes into the output vector and returns it', () => {
    const out = v(9, 9, 9);

    expect(geodeticSurfaceNormal(v(WGS84_A, 0, 0), out)).toBe(out);
    expect(out).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('returns the zero vector at the center', () => {
    expect(geodeticSurfaceNormal(v(0, 0, 0))).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('scaleToGeodeticSurface', () => {
  const cases: [string, number, number, number][] = [
    ['far above the equator', 7000, 0, 0],
    ['LEO at mid latitude', 4500, 3000, 4000],
    ['geostationary distance', 42164, 0, 100],
    ['over the pole', 0, 0, 7000],
    ['inside the Earth, past the center tolerance', 3000, 3000, 3000],
  ];

  it.each(cases)('gives geodetic altitude 0 within 1 mm: %s', (_name, x, y, z) => {
    const s = scaleToGeodeticSurface(v(x, y, z));

    expect(s).not.toBeNull();
    const lla = eci2lla({ x: s!.x, y: s!.y, z: s!.z } as never, 0);

    expect(Math.abs(lla.alt)).toBeLessThan(1e-6);
  });

  it('keeps the geodetic latitude and longitude of the input', () => {
    const lla = { lat: deg(37), lon: deg(-80), alt: 700 as Kilometers };
    const s = scaleToGeodeticSurface(llaRad2ecef(lla))!;
    const back = eci2lla(s as never, 0);

    expect(back.lat).toBeCloseTo(37, 8);
    expect(back.lon).toBeCloseTo(-80, 8);
    expect(back.alt).toBeCloseTo(0, 6);
  });

  it('uses the radial projection near the center', () => {
    const s = scaleToGeodeticSurface(v(100, 0, 0))!;

    expect(s.x).toBeCloseTo(WGS84_A, 9);
  });

  it('returns null at the exact center', () => {
    expect(scaleToGeodeticSurface(v(0, 0, 0))).toBeNull();
  });

  it('writes into the output vector', () => {
    const out = v(0, 0, 0);

    expect(scaleToGeodeticSurface(v(0, 0, 8000), out)).toBe(out);
    expect(out.z).toBeCloseTo(WGS84_B, 9);
  });
});

describe('liftToEllipsoid', () => {
  it('lifts a point to the requested geodetic altitude', () => {
    const p = liftToEllipsoid(llaRad2ecef({ lat: deg(60), lon: deg(10), alt: 900 as Kilometers }), 25);
    const back = eci2lla(p as never, 0);

    expect(back.alt).toBeCloseTo(25, 6);
    expect(back.lat).toBeCloseTo(60, 8);
  });

  it('uses the output vector', () => {
    const out = v(0, 0, 0);

    expect(liftToEllipsoid(v(7000, 0, 0), 10, out)).toBe(out);
    expect(out.x).toBeCloseTo(WGS84_A + 10, 9);
  });

  it('returns a copy of the input at the center', () => {
    expect(liftToEllipsoid(v(0, 0, 0), 10)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('copies into the output vector at the center', () => {
    const out = v(5, 5, 5);

    expect(liftToEllipsoid(v(0, 0, 0), 10, out)).toBe(out);
    expect(out).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('ellipsoidRadiusAlong', () => {
  it('is a at the equator and b over the pole', () => {
    expect(ellipsoidRadiusAlong(v(1, 0, 0))).toBeCloseTo(6378.137, 9);
    expect(ellipsoidRadiusAlong(v(0, 1, 0))).toBeCloseTo(6378.137, 9);
    expect(ellipsoidRadiusAlong(v(0, 0, 1))).toBeCloseTo(6356.752, 3);
  });

  it('matches the geocentric radius of the surface point at 45 degrees geodetic', () => {
    const p = llaRad2ecef({ lat: deg(45), lon: 0 as Radians, alt: 0 as Kilometers });
    const r = Math.hypot(p.x, p.y, p.z);

    expect(ellipsoidRadiusAlong(v(p.x / r, p.y / r, p.z / r))).toBeCloseTo(r, 8);
  });
});

describe('rayEllipsoidIntersection', () => {
  it('hits at the equatorial radius', () => {
    const hit = rayEllipsoidIntersection(v(10000, 0, 0), v(-1, 0, 0))!;

    expect(10000 - hit.near).toBeCloseTo(6378.137, 9);
    expect(10000 - hit.far).toBeCloseTo(-6378.137, 9);
  });

  it('hits at the polar radius', () => {
    const hit = rayEllipsoidIntersection(v(0, 0, 10000), v(0, 0, -1))!;

    expect(10000 - hit.near).toBeCloseTo(6356.752, 3);
  });

  it('misses a ray that passes outside', () => {
    expect(rayEllipsoidIntersection(v(10000, 7000, 0), v(-1, 0, 0))).toBeNull();
  });

  it('misses a ray at a height above the polar radius', () => {
    expect(rayEllipsoidIntersection(v(0, 10000, 6400), v(0, -1, 0))).toBeNull();
  });

  it('returns null for a zero direction', () => {
    expect(rayEllipsoidIntersection(v(10000, 0, 0), v(0, 0, 0))).toBeNull();
  });
});

describe('segmentIntersectsEllipsoid', () => {
  it('detects a segment through the equatorial bulge that a mean sphere (6371.0) would miss', () => {
    expect(segmentIntersectsEllipsoid(v(6375, -2000, 0), v(6375, 2000, 0))).toBe(true);
  });

  it('clears a segment grazing just above the equator', () => {
    expect(segmentIntersectsEllipsoid(v(6379, -2000, 0), v(6379, 2000, 0))).toBe(false);
  });

  it('clears a segment 5 km above the pole that a mean sphere would block', () => {
    expect(segmentIntersectsEllipsoid(v(-3000, 0, 6361.752), v(3000, 0, 6361.752))).toBe(false);
  });

  it('blocks a segment 5 km below the pole surface', () => {
    expect(segmentIntersectsEllipsoid(v(-3000, 0, 6351.752), v(3000, 0, 6351.752))).toBe(true);
  });

  it('detects a segment fully inside the Earth', () => {
    expect(segmentIntersectsEllipsoid(v(-1000, 0, 0), v(1000, 0, 0))).toBe(true);
  });

  it('clears a segment that points at Earth but stops short', () => {
    expect(segmentIntersectsEllipsoid(v(20000, 0, 0), v(10000, 0, 0))).toBe(false);
  });

  it('clears a segment that points away and starts outside', () => {
    expect(segmentIntersectsEllipsoid(v(10000, 0, 0), v(20000, 0, 0))).toBe(false);
  });

  it('handles a degenerate zero-length segment', () => {
    expect(segmentIntersectsEllipsoid(v(0, 0, 0), v(0, 0, 0))).toBe(true);
    expect(segmentIntersectsEllipsoid(v(9000, 0, 0), v(9000, 0, 0))).toBe(false);
  });
});

describe('llaRad2eci', () => {
  it('equals ecef2eci(llaRad2ecef(lla), gmst)', () => {
    const lla = { lat: deg(28.5), lon: deg(-80.6), alt: 0.01 as Kilometers };
    const a = llaRad2eci(lla, 2.1);
    const b = ecef2eci(llaRad2ecef(lla), 2.1);

    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.z).toBe(b.z);
  });

  it('round trips through eci2lla', () => {
    const lla = { lat: deg(-33), lon: deg(151), alt: 550 as Kilometers };
    const back = eci2lla(llaRad2eci(lla, 1.3), 1.3);

    expect(back.lat).toBeCloseTo(-33, 9);
    expect(back.lon).toBeCloseTo(151, 9);
    expect(back.alt).toBeCloseTo(550, 6);
  });
});
