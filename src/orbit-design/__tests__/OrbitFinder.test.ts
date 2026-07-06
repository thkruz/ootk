import { Satellite } from '../../objects/Satellite';
import { Degrees, TleLine1, TleLine2 } from '../../types/types';
import { OrbitFinder } from '../OrbitFinder';

describe('OrbitFinder TLE generation with extended sccNums', () => {
  // Standard ISS TLE — satnum in cols 3-7 is "25544" (5 chars).
  const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
  const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;
  const now = new Date('2022-07-22T12:00:00Z');

  // Pre-fix code interpolated `sat.sccNum` directly into the TLE strings.
  // For 9-digit canonical sccNums (Satellite.sccNum kept full precision while
  // TLE cols 3-7 only fit 5 chars), the synthesized TLE would be >69 chars
  // and break Sgp4.createSatrec. The fix uses the 5-char satnum from the
  // input tle1 — what SGP4 actually wants.
  it('uses 5-char satnum from tle1 (not the canonical sccNum) for extended IDs', () => {
    const sat = new Satellite({
      sccNum: '999500766', // 9-digit canonical id — overrides what's derived from tle1
      tle1,
      tle2,
    });

    expect(sat.sccNum).toBe('999500766');
    // The TLE itself carries the 5-char satnum '25544', not the 9-digit id.
    expect(sat.tle1.substring(2, 7)).toBe('25544');

    const finder = new OrbitFinder(sat, 0 as Degrees, 0 as Degrees, 'N', now);
    // generateTle1_ / generateTle2_ are private; cast to invoke directly so
    // we test the TLE substitution in isolation from the iterative search.
    const f = finder as unknown as {
      generateTle1_(): TleLine1;
      generateTle2_(params: object): TleLine2;
      currentParams_: object;
    };
    const outTle1 = f.generateTle1_();
    const outTle2 = f.generateTle2_(f.currentParams_);

    // Both lines must use the 5-char satnum from the input TLE, not the 9-digit sccNum.
    expect(outTle1.substring(2, 7)).toBe('25544');
    expect(outTle2.substring(2, 7)).toBe('25544');

    // And the resulting TLE lines must be exactly 69 chars (SGP4 contract).
    expect(outTle1.length).toBe(69);
    expect(outTle2.length).toBe(69);
  });

  it('keeps producing 5-char satnums for legacy numeric sccNums (regression guard)', () => {
    const sat = new Satellite({ tle1, tle2 });

    expect(sat.sccNum).toBe('25544');

    const finder = new OrbitFinder(sat, 0 as Degrees, 0 as Degrees, 'N', now);
    const f = finder as unknown as {
      generateTle1_(): TleLine1;
      generateTle2_(params: object): TleLine2;
      currentParams_: object;
    };

    expect(f.generateTle1_().substring(2, 7)).toBe('25544');
    expect(f.generateTle2_(f.currentParams_).substring(2, 7)).toBe('25544');
  });

  it('keeps producing 5-char alpha-5 satnums when the TLE carries them', () => {
    // Build a TLE whose satnum columns hold a real alpha-5 id "T0001".
    const alpha5Tle1 = '1 T0001U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
    const alpha5Tle2 = '2 T0001  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;
    const sat = new Satellite({ tle1: alpha5Tle1, tle2: alpha5Tle2 });

    const finder = new OrbitFinder(sat, 0 as Degrees, 0 as Degrees, 'N', now);
    const f = finder as unknown as {
      generateTle1_(): TleLine1;
      generateTle2_(params: object): TleLine2;
      currentParams_: object;
    };

    expect(f.generateTle1_().substring(2, 7)).toBe('T0001');
    expect(f.generateTle2_(f.currentParams_).substring(2, 7)).toBe('T0001');
  });
});
