import { afterEach, describe, expect, it, vi } from 'vitest';
import { azel2uv, calcInertAz, Degrees, eci2lla, jday, Kilometers, lla2ecef, Radians, TemeVec3 } from '../../main';

// WGS-84: a = 6378.137 km, 1/f = 298.257223563, b = a (1 - f) = 6356.7523142 km (NIMA TR8350.2).
const B_WGS84 = 6356.7523142;

describe('eci2lla on and near the polar axis', () => {
  it.each([
    [B_WGS84 + 500],
    [B_WGS84],
    [B_WGS84 + 35786],
    [B_WGS84 - 10],
  ])('z = +/-%f km on the axis gives lat +/-90 and alt = |z| - b exactly', (z) => {
    const north = eci2lla({ x: 0, y: 0, z } as TemeVec3, 1.234);
    const south = eci2lla({ x: 0, y: 0, z: -z } as TemeVec3, 1.234);

    expect(north.lat).toBe(90);
    expect(south.lat).toBe(-90);
    expect(north.alt).toBeCloseTo(z - B_WGS84, 9);
    expect(south.alt).toBeCloseTo(z - B_WGS84, 9);
  });

  it('is continuous: 1 mm off the axis matches the on-axis altitude', () => {
    const onAxis = eci2lla({ x: 0, y: 0, z: B_WGS84 + 500 } as TemeVec3, 0);
    const offAxis = eci2lla({ x: 1e-6, y: 0, z: B_WGS84 + 500 } as TemeVec3, 0);

    expect(offAxis.alt).toBeCloseTo(onAxis.alt, 9);
    expect(offAxis.lat).toBeCloseTo(90, 6);
  });

  it('inverts lla2ecef at gmst = 0 from the equator to the poles', () => {
    for (const lat of [-90, -89.9999, -60, -1, 0, 30, 45, 89.99, 90]) {
      for (const alt of [0, 400, 20200]) {
        const lon = 37;
        const ecef = lla2ecef({ lat: lat as Degrees, lon: lon as Degrees, alt: alt as Kilometers });
        const lla = eci2lla(ecef as unknown as TemeVec3, 0);

        expect(lla.lat).toBeCloseTo(lat, 8);
        expect(lla.alt).toBeCloseTo(alt, 6);
        if (Math.abs(lat) < 90) {
          expect(lla.lon).toBeCloseTo(lon, 8);
        }
      }
    }
  });
});

describe('jday', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('with no arguments equals jday(...) of the same UTC instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-02-29T18:30:15Z'));

    expect(jday()).toBeCloseTo(jday(2024, 2, 29, 18, 30, 15), 8);
  });

  it('with no arguments at 2000-01-01T12:00:00 UTC is JD 2451545.0 (Unix epoch is JD 2440587.5)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2000-01-01T12:00:00Z'));

    expect(jday()).toBeCloseTo(2451545.0, 9);
  });
});

describe('calcInertAz reachability', () => {
  it('due east launch at the latitude equal to the inclination (Vallado Eq. 6-19: sin(az) = cos i / cos lat)', () => {
    expect(calcInertAz(28.5 as Degrees, 28.5 as Degrees)).toBeCloseTo(90, 6);
  });

  it('is symmetric in the sign of latitude', () => {
    expect(calcInertAz(-30 as Degrees, 51.6 as Degrees)).toBeCloseTo(calcInertAz(30 as Degrees, 51.6 as Degrees), 12);
  });

  it('accepts the retrograde limit inc = 180 - |lat| (due west)', () => {
    expect(calcInertAz(28 as Degrees, 152 as Degrees)).toBeCloseTo(-90, 6);
  });

  it('rejects inclinations that never reach the latitude', () => {
    expect(() => calcInertAz(45 as Degrees, 30 as Degrees)).toThrow();
    expect(() => calcInertAz(-45 as Degrees, 30 as Degrees)).toThrow();
    expect(() => calcInertAz(45 as Degrees, 140 as Degrees)).toThrow();
  });
});

describe('azel2uv bounds', () => {
  const c = 0.1 as Radians;

  it('maps the cone edge to sine space (u = sin c) and accepts it', () => {
    expect(azel2uv(c, 0 as Radians, c).u).toBeCloseTo(Math.sin(c), 12);
    expect(azel2uv(-c as Radians, 0 as Radians, c).u).toBeCloseTo(-Math.sin(c), 12);
    expect(azel2uv(0 as Radians, c, c).v).toBeCloseTo(Math.sin(c), 12);
  });

  it('throws for negative angles outside the cone too', () => {
    expect(() => azel2uv(-0.5 as Radians, 0 as Radians, c)).toThrow();
    expect(() => azel2uv(0 as Radians, -0.5 as Radians, c)).toThrow();
  });

  it('bounds the total angle off boresight, not each axis separately', () => {
    // az = el = 0.08 rad is 0.113 rad off boresight, outside a 0.1 rad cone
    expect(() => azel2uv(0.08 as Radians, 0.08 as Radians, c)).toThrow();
  });
});
