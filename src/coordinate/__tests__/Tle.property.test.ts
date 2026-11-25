import fc from 'fast-check';
import { FormatTle, Tle, TleLine1, TleLine2 } from '../../main';

/** Property tests (fast-check): TLE format -> parse round trips and format invariants. */

const tleParamsArb = fc.record({
  inc: fc.integer({ min: 0, max: 1_800_000 }).map((n) => n / 10_000),
  rasc: fc.integer({ min: 0, max: 3_599_999 }).map((n) => n / 10_000),
  ecen: fc.integer({ min: 0, max: 9_999_999 }).map((n) => n / 10_000_000),
  argPe: fc.integer({ min: 0, max: 3_599_999 }).map((n) => n / 10_000),
  meana: fc.integer({ min: 0, max: 3_599_999 }).map((n) => n / 10_000),
  meanmo: fc.integer({ min: 10_000_000, max: 1_700_000_000 }).map((n) => n / 100_000_000),
  epochyr: fc.integer({ min: 0, max: 99 }),
  epochday: fc.integer({ min: 100_000_000, max: 36_599_999_999 }).map((n) => n / 100_000_000),
  scc: fc.integer({ min: 1, max: 99_999 }).map((n) => String(n).padStart(5, '0')),
  revAtEpoch: fc.integer({ min: 0, max: 99_999 }),
  elementSetNo: fc.integer({ min: 0, max: 9_999 }),
  bstarMantissa: fc.integer({ min: 10_000, max: 99_999 }),
  bstarExp: fc.integer({ min: -9, max: -1 }),
});

type TleGen = typeof tleParamsArb extends fc.Arbitrary<infer T> ? T : never;

const build = (p: TleGen) => {
  const bstar = (p.bstarMantissa / 1e5) * 10 ** p.bstarExp;
  const { tle1, tle2 } = FormatTle.createTle({
    inc: p.inc, rasc: p.rasc, ecen: p.ecen.toFixed(7), argPe: p.argPe, meana: p.meana, meanmo: p.meanmo.toFixed(8),
    epochyr: p.epochyr, epochday: p.epochday, intl: '98067A', scc: p.scc, bstar,
    revAtEpoch: p.revAtEpoch, elementSetNo: p.elementSetNo,
  });

  return { tle1, tle2, bstar };
};

const checksumOk = (line: string) => FormatTle.tleChecksum(line.substring(0, 68)) === Number(line[68]);

describe('TLE format and parse (properties)', () => {
  it('createTle always yields two 69-character lines with valid checksums', () => {
    fc.assert(fc.property(tleParamsArb, (p) => {
      const { tle1, tle2 } = build(p);

      expect(tle1).toHaveLength(69);
      expect(tle2).toHaveLength(69);
      expect(tle1.startsWith('1 ')).toBe(true);
      expect(tle2.startsWith('2 ')).toBe(true);
      expect(checksumOk(tle1)).toBe(true);
      expect(checksumOk(tle2)).toBe(true);
    }));
  });

  it('parse(createTle(x)) returns x (line 2 fields exactly, epoch and bstar within precision)', () => {
    fc.assert(fc.property(tleParamsArb, (p) => {
      const { tle1, tle2, bstar } = build(p);
      const d = Tle.parse(tle1 as TleLine1, tle2 as TleLine2);

      expect(d.satNum).toBe(Number(p.scc));
      expect(d.inclination).toBeCloseTo(p.inc, 4);
      expect(d.rightAscension).toBeCloseTo(p.rasc, 4);
      expect(d.eccentricity).toBeCloseTo(p.ecen, 7);
      expect(d.argOfPerigee).toBeCloseTo(p.argPe, 4);
      expect(d.meanAnomaly).toBeCloseTo(p.meana, 4);
      expect(d.meanMotion).toBeCloseTo(p.meanmo, 8);
      expect(d.epochYear).toBe(p.epochyr);
      expect(d.epochDay).toBeCloseTo(p.epochday, 8);
      // bstar is 0.MMMMM x 10^e, normalized (below 1e-10 formats as zero by design)
      expect(Math.abs(d.bstar - bstar)).toBeLessThanOrEqual(Math.abs(bstar) * 1e-3 + 1e-12);
    }));
  });

  it('format(parse(format(x))) is a fixed point', () => {
    fc.assert(fc.property(tleParamsArb, (p) => {
      const { tle1, tle2 } = build(p);
      const d = Tle.parse(tle1 as TleLine1, tle2 as TleLine2);
      const again = FormatTle.createTle({
        inc: d.inclination, rasc: d.rightAscension, ecen: d.eccentricity.toFixed(7), argPe: d.argOfPerigee, meana: d.meanAnomaly,
        meanmo: d.meanMotion.toFixed(8), epochyr: d.epochYear, epochday: d.epochDay, intl: '98067A', scc: p.scc, bstar: d.bstar,
        revAtEpoch: p.revAtEpoch, elementSetNo: p.elementSetNo,
      });

      expect(again.tle2).toBe(tle2);
      expect(again.tle1).toBe(tle1);
    }));
  });

  it('the checksum of a line ignores its own last character', () => {
    fc.assert(fc.property(tleParamsArb, fc.integer({ min: 0, max: 9 }), (p, digit) => {
      const { tle1 } = build(p);
      const changed = `${tle1.substring(0, 68)}${digit}`;

      expect(FormatTle.tleChecksum(changed.substring(0, 68))).toBe(FormatTle.tleChecksum(tle1.substring(0, 68)));
    }));
  });
});
