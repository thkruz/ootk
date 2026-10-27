/**
 * Permanent regression tests for the ootk v8 fixes to azel2uv / uv2azel, from the QA deep dive
 * (hq/reports/ootk-qa-deep-dive-2026-10-13.md, section 2.6 (Conjunction, sensors, scheduling)
 * plus section 1 items 7, 8 and 14).
 *
 * Each test asserts the corrected behavior. Comments keep the report item and the original
 * src file:line of the defect as an audit trail.
 * Moved from test/qa/conjunction-sensor-scheduling.qa.test.ts.
 */

import { Degrees, Kilometers, PhasedArrayRadar, Radians, SensorType } from '@src/main';
import { azel2uv, rae2ruv, uv2azel } from '@src/transforms/transforms';

const DEG = Math.PI / 180;

describe('azel2uv / uv2azel (QA 2026-10 regressions)', () => {
  /*
   * Report section 2.6, transforms.ts:503-521 via PhasedArrayRadar.ts:137-172. azel2uv computes
   * u = sin((az / coneHalfAngle) * 90) instead of a direction cosine. Cone 60 deg, 10 deg offset:
   * expected u = cos(0) sin(10 deg) = 0.17365; code returned sin(15 deg) = 0.2588. The third
   * argument is a bound on the angle off boresight, so the proof uses a cone wider than the
   * offset. PhasedArrayRadar passing its beamwidth as that bound is the separate test below.
   */
  it('azel2uv returns direction cosines (u for 10 deg offset, cone 60 deg)', () => {
    const { u } = azel2uv((10 * DEG) as Radians, 0 as Radians, (60 * DEG) as Radians);

    expect(u).toBeCloseTo(Math.cos(0) * Math.sin(10 * DEG), 6);
  });

  /*
   * Same item: round trip of a 10 deg offset through a 60 deg cone must come back as 10 deg.
   */
  it('uv2azel(azel2uv(10 deg)) round-trips through a 60 deg cone', () => {
    const bw = (60 * DEG) as Radians;
    const { u, v } = azel2uv((10 * DEG) as Radians, 0 as Radians, bw);
    const { az } = uv2azel(u, v, bw);

    expect(az / DEG).toBeCloseTo(10, 6);
  });

  /*
   * Same item, transforms.ts:504-510. The bounds check `az > c && az < c` can never be true, so an
   * azimuth offset of 75 deg against a 60 deg cone half-angle is silently accepted.
   */
  it('azel2uv throws for an azimuth beyond the cone half-angle', () => {
    expect(() => azel2uv((75 * DEG) as Radians, 0 as Radians, (60 * DEG) as Radians)).toThrow();
  });

  /*
   * PhasedArrayRadar.ts:146,167 passed its beamwidth as the cone half-angle, so a 10 deg offset
   * against a 2 deg beam either threw or (with the old formula) saturated at u = 1. The bound is the
   * field-of-view half-angle; the beamwidth plays no part in sine space.
   */
  it('PhasedArrayRadar uvFromAzEl bounds by the FOV half-angle, not the beamwidth', () => {
    const radar = new PhasedArrayRadar({
      id: 1,
      name: 'qa',
      sensorType: SensorType.PHASED_ARRAY_RADAR,
      boresightAz: [0 as Degrees],
      boresightEl: [0 as Degrees],
      beamwidth: 2 as Degrees,
      fieldOfView: { halfAngle: 60 as Degrees, minRange: 0 as Kilometers, maxRange: 5000 as Kilometers },
    });

    expect(radar.uvFromAzEl(10 as Degrees, 0 as Degrees).u).toBeCloseTo(Math.sin(10 * DEG), 9);
    expect(() => radar.uvFromAzEl(75 as Degrees, 0 as Degrees)).toThrow();
  });

  /*
   * Verifier fix M.1 (2026-10-13): with a tilted face the old code treated az/el differences as
   * if the boresight were horizontal. Boresight az 0 el 20, half-angle 60, target az 55 el 50 is
   * 52.5 deg off boresight (inside) but the old bound acos(cos dAz cos dEl) gave 60.2 deg and
   * threw; az 40 el 60 gave u = 0.492 instead of 0.321.
   *
   * The reference below is an independent vector calculation: ENU line of sight d, boresight b,
   * right = (b x up) / |b x up|, up_face = right x b, u = d . right, v = d . up_face.
   */
  const enu = (azDeg: number, elDeg: number): number[] => [
    Math.cos(elDeg * DEG) * Math.sin(azDeg * DEG),
    Math.cos(elDeg * DEG) * Math.cos(azDeg * DEG),
    Math.sin(elDeg * DEG),
  ];
  const cross = (a: number[], b: number[]): number[] => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const referenceUvw = (bAz: number, bEl: number, az: number, el: number): number[] => {
    const b = enu(bAz, bEl);
    const r0 = cross(b, [0, 0, 1]);
    const n = Math.hypot(r0[0], r0[1], r0[2]);
    const right = r0.map((x) => x / n);
    const upFace = cross(right, b);
    const d = enu(az, el);

    return [dot(d, right), dot(d, upFace), dot(d, b)];
  };
  const tiltedRadar = (bAz: number, bEl: number): PhasedArrayRadar => new PhasedArrayRadar({
    id: 2,
    name: 'tilted',
    sensorType: SensorType.PHASED_ARRAY_RADAR,
    boresightAz: [bAz as Degrees],
    boresightEl: [bEl as Degrees],
    beamwidth: 2 as Degrees,
    fieldOfView: { halfAngle: 60 as Degrees, minRange: 0 as Kilometers, maxRange: 5000 as Kilometers },
  });

  it('a tilted face (el 20) accepts a target 52.5 deg off boresight and gives the true u', () => {
    const radar = tiltedRadar(0, 20);
    const [, , w] = referenceUvw(0, 20, 55, 50);

    expect(Math.acos(w) / DEG).toBeCloseTo(52.5, 1);
    expect(() => radar.uvFromAzEl(55 as Degrees, 50 as Degrees, 0)).not.toThrow();
    expect(() => rae2ruv({ rng: 1000 as Kilometers, az: 55 as Degrees, el: 50 as Degrees }, radar, 0, 360 as Degrees)).not.toThrow();
    expect(radar.uvFromAzEl(40 as Degrees, 60 as Degrees, 0).u).toBeCloseTo(Math.cos(60 * DEG) * Math.sin(40 * DEG), 12);
  });

  for (const [bAz, bEl] of [[0, 20], [30, 45], [350, 20], [200, 45]]) {
    it(`boresight az ${bAz} el ${bEl}: u/v match the vector reference, never throw inside the FOV, round trip to 1e-9 deg`, () => {
      const radar = tiltedRadar(bAz, bEl);
      let checked = 0;

      for (let dAz = -80; dAz <= 80; dAz += 5) {
        for (let el = 0; el <= 89; el += 3) {
          const az = (((bAz + dAz) % 360) + 360) % 360;
          const [uRef, vRef, wRef] = referenceUvw(bAz, bEl, az, el);
          const off = Math.acos(Math.min(1, wRef)) / DEG;

          if (off > 60.001) {
            expect(() => radar.uvFromAzEl(az as Degrees, el as Degrees, 0)).toThrow();
            continue;
          }
          if (off > 59.999) {
            // Exactly on the cone edge (for example 45 deg az offset at el 0 with a 45 deg face)
            continue;
          }

          const { u, v } = radar.uvFromAzEl(az as Degrees, el as Degrees, 0);

          expect(u).toBeCloseTo(uRef, 12);
          expect(v).toBeCloseTo(vRef, 12);

          const ruv = rae2ruv({ rng: 1000 as Kilometers, az: az as Degrees, el: el as Degrees }, radar, 0, 360 as Degrees);

          expect(ruv.u).toBeCloseTo(uRef, 12);
          expect(ruv.v).toBeCloseTo(vRef, 12);

          const back = radar.azElFromUV(u, v, 0);
          const dAzBack = ((((back.az - az) % 360) + 540) % 360) - 180;

          expect(Math.abs(dAzBack)).toBeLessThan(1e-9);
          expect(Math.abs(back.el - el)).toBeLessThan(1e-9);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(100);
    });
  }

  it('standalone azel2uv/uv2azel with a boresight elevation round-trip and default to the horizontal face', () => {
    const beta = (45 * DEG) as Radians;
    const { u, v } = azel2uv((30 * DEG) as Radians, (10 * DEG) as Radians, (60 * DEG) as Radians, beta);
    const [uRef, vRef] = referenceUvw(0, 45, 30, 55);

    expect(u).toBeCloseTo(uRef, 12);
    expect(v).toBeCloseTo(vRef, 12);

    const back = uv2azel(u, v, (60 * DEG) as Radians, beta);

    expect(Math.abs(back.az / DEG - 30)).toBeLessThan(1e-9);
    expect(Math.abs(back.el / DEG - 10)).toBeLessThan(1e-9);

    // beta = 0 keeps the horizontal-face formula u = cos(el) sin(az), v = sin(el)
    const flat = azel2uv((30 * DEG) as Radians, (10 * DEG) as Radians);

    expect(flat.u).toBeCloseTo(Math.cos(10 * DEG) * Math.sin(30 * DEG), 15);
    expect(flat.v).toBeCloseTo(Math.sin(10 * DEG), 15);
  });
});
