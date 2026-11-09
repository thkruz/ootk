import { Degrees, ElevationMask, HorizonProfile, maskMinElevation, ValidationError } from '../../main';

const pts = (arr: [number, number][]) => arr.map(([az, el]) => ({ az, el }));

describe('HorizonProfile', () => {
  describe('fromPoints and elevationAt', () => {
    const p = HorizonProfile.fromPoints(pts([[0, 5], [90, 25], [180, 8], [270, 12]]));

    it('returns the vertex values exactly', () => {
      expect(p.elevationAt(0)).toBe(5);
      expect(p.elevationAt(90)).toBe(25);
      expect(p.elevationAt(180)).toBe(8);
      expect(p.elevationAt(270)).toBe(12);
    });

    it('interpolates linearly (analytic: midpoint of 5 and 25 is 15, quarter point is 10)', () => {
      expect(p.elevationAt(45)).toBeCloseTo(15, 12);
      expect(p.elevationAt(22.5)).toBeCloseTo(10, 12);
      expect(p.elevationAt(135)).toBeCloseTo(16.5, 12);
    });

    it('wraps across 359 -> 0 (270 deg el 12 to 360 deg el 5: slope -7/90 per deg)', () => {
      // At az 315 the value is the midpoint of 12 and 5 = 8.5
      expect(p.elevationAt(315)).toBeCloseTo(8.5, 12);
      expect(p.elevationAt(359)).toBeCloseTo(12 - (7 * 89) / 90, 12);
      expect(p.elevationAt(360)).toBeCloseTo(5, 12);
      expect(p.elevationAt(-45)).toBeCloseTo(8.5, 12);
      expect(p.elevationAt(405)).toBeCloseTo(15, 12);
    });

    it('wraps when the first vertex is not at 0', () => {
      const q = HorizonProfile.fromPoints(pts([[10, 0], [350, 20]]));

      // Between 350 and 10 (+360) is 20 deg of arc, 0 deg is the midpoint
      expect(q.elevationAt(0)).toBeCloseTo(10, 12);
    });

    it('accepts unsorted input', () => {
      const q = HorizonProfile.fromPoints(pts([[180, 8], [0, 5], [90, 25]]));

      expect(q.elevationAt(45)).toBeCloseTo(15, 12);
    });

    it('rejects bad input with ValidationError', () => {
      expect(() => HorizonProfile.fromPoints(pts([[0, 5]]))).toThrow(ValidationError);
      expect(() => HorizonProfile.fromPoints(pts([[0, 5], [0, 6]]))).toThrow(ValidationError);
      expect(() => HorizonProfile.fromPoints(pts([[0, 5], [360, 6]]))).toThrow(ValidationError);
      expect(() => HorizonProfile.fromPoints(pts([[-1, 5], [10, 6]]))).toThrow(ValidationError);
      expect(() => HorizonProfile.fromPoints(pts([[0, 91], [10, 6]]))).toThrow(ValidationError);
      expect(() => HorizonProfile.fromPoints(pts([[0, -91], [10, 6]]))).toThrow(ValidationError);
      expect(() => HorizonProfile.fromPoints(pts([[0, NaN], [10, 6]]))).toThrow(ValidationError);
    });

    it('supports a 360-point (1 degree) profile with no vertex cap', () => {
      const many = HorizonProfile.fromPoints(
        Array.from({ length: 360 }, (_, i) => ({ az: i, el: 10 + 5 * Math.sin((i * Math.PI) / 180) })),
      );

      expect(many.points).toHaveLength(360);
      expect(many.elevationAt(90)).toBeCloseTo(15, 12);
      expect(many.elevationAt(90.5)).toBeCloseTo((many.elevationAt(90) + many.elevationAt(91)) / 2, 12);
    });

    it('constant() is flat everywhere', () => {
      const c = HorizonProfile.constant(10);

      for (let az = -10; az < 400; az += 7.3) {
        expect(c.elevationAt(az)).toBeCloseTo(10, 12);
      }
    });
  });

  describe('fromElevationMasks', () => {
    it('interpolated mode equals maskMinElevation for many azimuths', () => {
      const masks = [
        { startAz: 0, stopAz: 0, minEl: 5 },
        { startAz: 100, stopAz: 0, minEl: 30 },
        { startAz: 250, stopAz: 0, minEl: 12 },
      ] as ElevationMask[];
      const p = HorizonProfile.fromElevationMasks(masks, true);

      for (let az = 0; az < 360; az += 0.37) {
        expect(p.elevationAt(az)).toBeCloseTo(maskMinElevation(masks, az, true, -90), 12);
      }
    });

    it('step mode equals maskMinElevation away from sector edges, with a wrapping sector and overlaps', () => {
      const masks = [
        { startAz: 20, stopAz: 60, minEl: 15 },
        { startAz: 340, stopAz: 10, minEl: 25 }, // wraps through north
        { startAz: 50, stopAz: 120, minEl: 8 }, // overlaps the first sector; highest wins
      ] as ElevationMask[];
      const p = HorizonProfile.fromElevationMasks(masks, false, 3);
      const edges = [10, 20, 50, 60, 120, 340];

      for (let az = 0; az < 360; az += 0.31) {
        if (edges.some((e) => Math.abs(az - e) < 1e-3)) {
          continue;
        }
        expect(p.elevationAt(az)).toBeCloseTo(maskMinElevation(masks, az, false, 3), 6);
      }
    });

    it('step mode ramps inside a 2e-6 degree band around each edge', () => {
      const masks = [{ startAz: 100, stopAz: 200, minEl: 20 }] as ElevationMask[];
      const p = HorizonProfile.fromElevationMasks(masks, false, 0);

      expect(p.elevationAt(99.9)).toBeCloseTo(0, 6);
      expect(p.elevationAt(100.001)).toBeCloseTo(20, 6);
      expect(p.elevationAt(200.001)).toBeCloseTo(0, 6);
      expect(p.elevationAt(100)).toBeCloseTo(10, 6); // midpoint of the ramp
    });

    it('empty step masks give the floor', () => {
      expect(HorizonProfile.fromElevationMasks([], false, 4).elevationAt(77)).toBeCloseTo(4, 12);
    });
  });

  describe('max / combine', () => {
    it('is exact at a crossing point (ramps cross at az 45, el 15)', () => {
      const a = HorizonProfile.fromPoints(pts([[0, 0], [90, 30]]));
      const b = HorizonProfile.fromPoints(pts([[0, 30], [90, 0]]));
      const m = a.combine(b);

      // Over 0..90 the interpolation is not what these two vertices alone imply, because the
      // profile wraps. Compare against the pointwise max of the two inputs instead.
      for (let az = 0; az < 360; az += 0.5) {
        expect(m.elevationAt(az)).toBeCloseTo(Math.max(a.elevationAt(az), b.elevationAt(az)), 9);
      }
      // Analytic crossing: a = az/3 and b = 30 - az/3 on [0, 90] meet at az 45, el 15
      expect(m.points.some((v) => Math.abs(v.az - 45) < 1e-9 && Math.abs(v.el - 15) < 1e-9)).toBe(true);
    });

    it('is exact for random pairs on a fine grid, including the wrap interval', () => {
      let seed = 12345;
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;

        return seed / 4294967296;
      };

      for (let trial = 0; trial < 20; trial++) {
        const mk = () => HorizonProfile.fromPoints(
          Array.from({ length: 6 }, (_, i) => ({ az: i * 60 + rnd() * 50, el: rnd() * 40 })),
        );
        const a = mk();
        const b = mk();
        const m = HorizonProfile.max(a, b);

        for (let az = 0; az < 360; az += 0.25) {
          expect(m.elevationAt(az)).toBeCloseTo(Math.max(a.elevationAt(az), b.elevationAt(az)), 9);
        }
      }
    });

    it('max with a constant raises only where the profile is below it', () => {
      const a = HorizonProfile.fromPoints(pts([[0, 0], [180, 40]]));
      const m = a.combine(HorizonProfile.constant(10));

      expect(m.elevationAt(0)).toBeCloseTo(10, 12);
      expect(m.elevationAt(180)).toBeCloseTo(40, 12);
      expect(m.elevationAt(45)).toBeCloseTo(10, 12); // a = 10 here: the crossing
    });
  });

  describe('serialization', () => {
    it('round-trips', () => {
      const p = HorizonProfile.fromPoints(pts([[0, 5], [90, 25], [200, -2]]));
      const q = HorizonProfile.deserialize(JSON.parse(JSON.stringify(p.serialize())));

      expect(q.points).toEqual(p.points);
      expect(q.elevationAt(123.4)).toBe(p.elevationAt(123.4));
    });

    it('toString summarises', () => {
      expect(HorizonProfile.fromPoints(pts([[0, 5], [90, 25]])).toString()).toContain('2 points');
    });

    it('elevationAt returns Degrees', () => {
      const d: Degrees = HorizonProfile.constant(1).elevationAt(0);

      expect(d).toBe(1);
    });
  });
});
