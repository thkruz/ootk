import fc from 'fast-check';
import { EpochUTC, FormatTle, Seconds, Sgp4Propagator, Tle, TleLine1, TleLine2 } from '../../main';

/** Property tests (fast-check): SGP4/SDP4 propagation invariants over generated, physically plausible TLEs. */

const MU = 398600.4418; // km^3/s^2 (WGS72 is 398600.8; the bounds below leave margin for the difference)

const tleArb = fc.record({
  // Inclinations above 170 deg are excluded: SGP4 velocity disagrees with the position derivative by ~0.085 km/s at i = 179.96 deg,
  // e = 0.4, 1 rev/day. satellite.js 7.1 shows the same disagreement (0.035/-0.077 km), so it is an SGP4 property, not an ootk bug.
  inc: fc.integer({ min: 0, max: 1_700_000 }).map((n) => n / 10_000),
  rasc: fc.integer({ min: 0, max: 3_599_999 }).map((n) => n / 10_000),
  ecen: fc.integer({ min: 0, max: 4_000_000 }).map((n) => n / 10_000_000),
  argPe: fc.integer({ min: 0, max: 3_599_999 }).map((n) => n / 10_000),
  meana: fc.integer({ min: 0, max: 3_599_999 }).map((n) => n / 10_000),
  meanmo: fc.integer({ min: 100_000_000, max: 1_580_000_000 }).map((n) => n / 100_000_000),
  bstar: fc.integer({ min: 0, max: 99_999 }).map((n) => (n / 1e5) * 1e-3),
}).map((p) => {
  const { tle1, tle2 } = FormatTle.createTle({
    inc: p.inc, rasc: p.rasc, ecen: p.ecen.toFixed(7), argPe: p.argPe, meana: p.meana, meanmo: p.meanmo.toFixed(8),
    epochyr: 24, epochday: 100.5, intl: '24001A', scc: '00005', bstar: p.bstar,
  });

  return new Tle(tle1, tle2);
});

const offsetArb = fc.integer({ min: -86_400, max: 86_400 });
const mag = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);

/** Objects whose osculating perigee stays above the atmosphere; others decay or fail inside SGP4 by design. */
const plausible = (tle: Tle) => tle.perigee > 300;

describe('SGP4 propagation (properties)', () => {
  // Known counterexample (deep space, 1 rev/day, e=0.367, inc 0, dt 0): radius came out about 60 km
  // below the perigee radius at epoch. Same family as the epoch-jump finding; cause not located.
  // Kept as a deterministic it.fails below; the random property covers near-Earth orbits only.
  it.fails('deep-space counterexample: radius at epoch is not below perigee radius', () => {
    const tle = new Tle(
      '1 00005U 24001A   24100.50000000  .00000000  00000+0  00000+0 0  9992',
      '2 00005   0.0000   0.0000 3674036   0.0007   0.0009 01.00000000    03',
    );
    const r = mag(tle.propagate(tle.epoch).position);

    expect(r).toBeGreaterThan(tle.perigeeRadius - 60);
  });

  it('radius stays between perigee and apogee (with a margin for J2 and drag) within a day of epoch (near-Earth)', () => {
    fc.assert(fc.property(tleArb, offsetArb, (tle, dt) => {
      fc.pre(plausible(tle));
      fc.pre(tle.period < 225); // deep space: see the it.fails counterexample above
      const s = tle.propagate(tle.epoch.roll(dt as Seconds));
      const r = mag(s.position);

      expect(r).toBeGreaterThan(tle.perigeeRadius - 60);
      expect(r).toBeLessThan(tle.apogeeRadius + 60);
    }), { numRuns: 200 });
  });

  it('specific orbital energy matches -mu / (2a) within 1 percent', () => {
    fc.assert(fc.property(tleArb, offsetArb, (tle, dt) => {
      fc.pre(plausible(tle));
      const s = tle.propagate(tle.epoch.roll(dt as Seconds));
      const energy = mag(s.velocity) ** 2 / 2 - MU / mag(s.position);
      const expected = -MU / (2 * tle.semimajorAxis);

      expect(Math.abs((energy - expected) / expected)).toBeLessThan(0.01);
    }), { numRuns: 200 });
  });

  it('propagation is deterministic: the same epoch gives the same state after other epochs were propagated', () => {
    fc.assert(fc.property(tleArb, offsetArb, offsetArb, (tle, a, b) => {
      fc.pre(plausible(tle));
      const first = tle.propagate(tle.epoch.roll(a as Seconds));

      tle.propagate(tle.epoch.roll(b as Seconds));
      const second = tle.propagate(tle.epoch.roll(a as Seconds));

      expect(second.position.x).toBe(first.position.x);
      expect(second.position.y).toBe(first.position.y);
      expect(second.position.z).toBe(first.position.z);
    }), { numRuns: 100 });
  });

  it('position advances by velocity * dt over one second (time-shift consistency)', () => {
    fc.assert(fc.property(tleArb, offsetArb, (tle, dt) => {
      fc.pre(plausible(tle));
      // The 1 s window must not straddle the epoch: see the it.fails case below.
      fc.pre(dt > 0 || dt < -1);
      const t0 = tle.epoch.roll(dt as Seconds);
      const a = tle.propagate(t0);
      const b = tle.propagate(t0.roll(1 as Seconds));
      // acceleration is at most ~0.01 km/s^2 in these orbits, so the second-order term is under 0.005 km
      const err = Math.hypot(
        b.position.x - a.position.x - a.velocity.x,
        b.position.y - a.position.y - a.velocity.y,
        b.position.z - a.position.z - a.velocity.z,
      );

      expect(err).toBeLessThan(0.01);
    }), { numRuns: 200 });
  });

  it('Sgp4Propagator and Tle.propagate agree, and state at epoch equals Tle.state', () => {
    fc.assert(fc.property(tleArb, offsetArb, (tle, dt) => {
      fc.pre(plausible(tle));
      const when: EpochUTC = tle.epoch.roll(dt as Seconds);
      const direct = tle.propagate(when);
      const viaProp = new Sgp4Propagator(tle).propagate(when).toTEME();

      expect(Math.hypot(viaProp.position.x - direct.position.x, viaProp.position.y - direct.position.y, viaProp.position.z - direct.position.z)).toBeLessThan(1e-3);
    }), { numRuns: 100 });
  });

  it('TEME -> J2000 -> TEME round trip of a propagated state is lossless to the meter', () => {
    fc.assert(fc.property(tleArb, offsetArb, (tle, dt) => {
      fc.pre(plausible(tle));
      const s = tle.propagate(tle.epoch.roll(dt as Seconds));
      const back = s.toJ2000().toTEME();

      expect(Math.hypot(back.position.x - s.position.x, back.position.y - s.position.y, back.position.z - s.position.z)).toBeLessThan(1e-3);
    }), { numRuns: 100 });
  });

  /*
   * Counterexample found by the property above (before the epoch window was excluded):
   * a synchronous (1.0 rev/day), zero-eccentricity, zero-inclination TLE (SDP4 resonance branch). Position at tsince = 0 and at
   * tsince = 0.6 s differ by 36 m more than v * dt: every position at tsince > 0 sits on a line shifted by about -36 m
   * in y relative to tsince <= 0. satellite.js 7.1 on the same TLE is smooth (y 4.7389, 7.8108, 10.8827 at 0, 1, 2 s;
   * ootk gives 4.7389, 7.7743, 10.8462), so ootk's SDP4 resonance path differs from the reference. Cause not located.
   * Kept as it.fails so a fix flips it.
   */
  it.fails('position is continuous across the epoch for a 1 rev/day zero-inclination TLE', () => {
    const tle = new Tle(
      '1 00005U 24001A   24100.50000000  .00000000  00000+0  00000+0 0  9992' as TleLine1,
      '2 00005   0.0000   0.0000 0000000   0.0000   0.0000 01.00000000    08' as TleLine2,
    );
    const a = tle.propagate(tle.epoch);
    const b = tle.propagate(tle.epoch.roll(0.6 as Seconds));
    const err = Math.hypot(b.position.x - a.position.x - a.velocity.x * 0.6, b.position.y - a.position.y - a.velocity.y * 0.6, b.position.z - a.position.z - a.velocity.z * 0.6);

    expect(err).toBeLessThan(0.005);
  });
});
