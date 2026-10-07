import {
  DEG2RAD, Degrees, Kilometers, PhasedArrayRadar, Radians, SensorType, ecef2enu, rae2enu,
} from '../../main';

const makeRadar = (boresightAz: number[], boresightEl: number[], beamwidth = 60): PhasedArrayRadar => new PhasedArrayRadar({
  id: 4101,
  name: 'Geometry Radar',
  sensorType: SensorType.PHASED_ARRAY_RADAR,
  boresightAz: boresightAz as Degrees[],
  boresightEl: boresightEl as Degrees[],
  beamwidth: beamwidth as Degrees,
  fieldOfView: { halfAngle: 60 as Degrees, minRange: 100 as Kilometers, maxRange: 40000 as Kilometers },
});

describe('PhasedArrayRadar geometry', () => {
  it('uv round trip returns the original az/el', () => {
    const radar = makeRadar([0], [20]);

    for (const [az, el] of [[10, 30], [-15, 5], [25, 40], [0, 20]]) {
      const { u, v } = radar.uvFromAzEl(az as Degrees, el as Degrees);
      const back = radar.azElFromUV(u, v);

      // Elevation came back mirrored about boresight (10 for an input of 30)
      expect(back.az).toBeCloseTo(az, 9);
      expect(back.el).toBeCloseTo(el, 9);
    }
  });

  it('uvFromAzEl wraps azimuth through north', () => {
    const radar = makeRadar([0], [20]);

    expect(radar.uvFromAzEl(355 as Degrees, 20 as Degrees).u).toBeCloseTo(radar.uvFromAzEl(-5 as Degrees, 20 as Degrees).u, 12);
  });

  it('face selection uses the great-circle angle and wraps azimuth', () => {
    const radar = makeRadar([0, 120, 240], [20, 20, 20]);

    // 359 deg is 1 deg from face 0 (was rejected: |359 - 0| = 359)
    expect(radar.getVisibleFaces(359 as Degrees, 20 as Degrees)).toContain(0);
    expect(radar.getBestFace(355 as Degrees, 20 as Degrees)).toBe(0);

    // At el 60, az 80 is 37.5 deg from a (0, 60) boresight, not 80
    const high = makeRadar([0], [60]);

    expect(high.getVisibleFaces(80 as Degrees, 60 as Degrees)).toEqual([0]);
  });
});

describe('ENU helpers take radians', () => {
  it('rae2enu(az 90 deg, el 0) points east', () => {
    const enu = rae2enu({ rng: 1000 as Kilometers, az: (90 * DEG2RAD) as Radians, el: 0 as Radians });

    expect(enu.x).toBeCloseTo(1000, 9);
    expect(enu.y).toBeCloseTo(0, 9);
  });

  it('ecef2enu rotates the local vertical to Up', () => {
    const lat = 40 * DEG2RAD;
    const lon = -75 * DEG2RAD;
    const up = { x: Math.cos(lat) * Math.cos(lon), y: Math.cos(lat) * Math.sin(lon), z: Math.sin(lat) };
    const enu = ecef2enu(up, { lat: lat as Radians, lon: lon as Radians, alt: 0 });

    expect(enu.z).toBeCloseTo(1, 12);
  });
});
