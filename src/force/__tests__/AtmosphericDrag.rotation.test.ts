import { Earth, EpochUTC, ITRF, J2000, Kilometers, KilometersPerSecond, Radians, Vector3D } from '../../main';
import { AtmosphericDrag } from '../AtmosphericDrag';

/**
 * Reference copy of the pre-issue-#26 implementation: Earth.rotation stored in a fake ITRF position,
 * rotated with toJ2000(), then cross product with double casts. Kept verbatim as a regression oracle.
 */
function oldAcceleration(drag: AtmosphericDrag, state: J2000): Vector3D {
  const itrfState = state.toITRF();

  const density = (AtmosphericDrag as any)._getHPDensity(itrfState, drag.cosine, drag.f107) as number;

  if (density === 0) {
    return Vector3D.origin;
  }
  const rotation = new ITRF(
    state.epoch,
    Earth.rotation as unknown as Vector3D<Kilometers>,
    Vector3D.origin as Vector3D<KilometersPerSecond>,
  ).toJ2000().position;
  const vRel = state.velocity.subtract(rotation.cross(state.position) as unknown as Vector3D<KilometersPerSecond>)
    .scale(1000.0 as KilometersPerSecond);
  const vm = vRel.magnitude();
  const fScale = -0.5 * density * ((drag.dragCoeff * drag.area) / drag.mass) * vm;

  return vRel.scale(fScale / 1000.0);
}

const mk = (iso: string, alt: number, vx: number, vy: number, vz: number, y = 0, z = 0): J2000 => new J2000(
  EpochUTC.fromDateTimeString(iso),
  new Vector3D<Kilometers>((6378.137 + alt) as Kilometers, y as Kilometers, z as Kilometers),
  new Vector3D<KilometersPerSecond>(vx as KilometersPerSecond, vy as KilometersPerSecond, vz as KilometersPerSecond),
);

describe('AtmosphericDrag Earth-rotation handling (ootk issue #26)', () => {
  const drag = new AtmosphericDrag(1000, 10, 2.2, 4);
  const states = [
    mk('2024-01-01T12:00:00.000Z', 400, 0, 7.67, 0),
    mk('2012-06-21T03:30:00.000Z', 250, 0, 5.4, 5.4, 1000, 2000),
    mk('2026-09-15T22:10:00.000Z', 700, 1.0, 7.3, 0.5, -500, 300),
    mk('2005-03-20T00:00:00.000Z', 180, 0, 7.8, 0),
  ];

  it.each(states.map((s, i) => [i, s] as const))('matches the old implementation, state %i (rel 1e-12)', (_i, state) => {
    const a = drag.acceleration(state);
    const ref = oldAcceleration(drag, state);

    expect(ref.magnitude()).toBeGreaterThan(0);
    for (const k of ['x', 'y', 'z'] as const) {
      const tol = 1e-12 * ref.magnitude();

      expect(Math.abs(a[k] - ref[k])).toBeLessThanOrEqual(tol);
    }
  });

  describe('Earth rotation vector in J2000', () => {
    // IERS Conventions (2010) nominal Earth rotation rate: 7.292115e-5 rad/s.
    const omegaNominal = 7.292115e-5;
    // Precession of the pole since J2000 is about 50.3 arcsec/yr (IERS Conventions 2010 / IAU 2006),
    // so at most ~0.36 deg by 2026 and ~0.4 deg by 2030. The 0.5 deg bound covers 2000 to 2030 with nutation (<20 arcsec).

    it.each(['2000-01-01T12:00:00.000Z', '2010-07-01T00:00:00.000Z', '2026-11-08T00:00:00.000Z', '2030-12-31T23:59:59.000Z'])(
      'is within 0.5 deg of +Z with nominal magnitude at %s',
      (iso) => {
        const w = ITRF.rotateToJ2000(Earth.rotation, EpochUTC.fromDateTimeString(iso));
        const angleDeg = Math.acos(w.z / w.magnitude()) * 180 / Math.PI;

        expect(angleDeg).toBeLessThan(0.5);
        // Magnitude is preserved by a rotation; Earth.rotation z is the IERS value to 1e-9 relative.
        expect(w.magnitude()).toBeCloseTo(omegaNominal, 10);
        expect(Math.abs(w.magnitude() - omegaNominal) / omegaNominal).toBeLessThan(1e-6);
      },
    );
  });

  describe('ITRF.rotateToJ2000', () => {
    const epoch = EpochUTC.fromDateTimeString('2024-03-15T06:00:00.000Z');

    it('maps ITRF +Z close to J2000 +Z with unit length (analytic: rotations about Z leave Z fixed up to precession and nutation)', () => {
      const z = ITRF.rotateToJ2000(new Vector3D(0, 0, 1), epoch);

      expect(z.magnitude()).toBeCloseTo(1, 14);
      expect(Math.acos(z.z)).toBeLessThan(0.5 * Math.PI / 180);
    });

    it('matches ITRF.toJ2000 on a real position vector (zero velocity, 1e-12)', () => {
      const pos = new Vector3D<Kilometers>(4000 as Kilometers, -3000 as Kilometers, 4500 as Kilometers);
      const full = new ITRF(epoch, pos, new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond)).toJ2000().position;
      const r = ITRF.rotateToJ2000(pos, epoch);

      expect(r.x).toBeCloseTo(full.x, 9);
      expect(r.y).toBeCloseTo(full.y, 9);
      expect(r.z).toBeCloseTo(full.z, 9);
    });

    it('preserves vector magnitude for any epoch', () => {
      const v = new Vector3D<Radians>(0.3 as Radians, -0.2 as Radians, 0.9 as Radians);

      expect(ITRF.rotateToJ2000(v, epoch).magnitude()).toBeCloseTo(v.magnitude(), 12);
    });
  });
});
