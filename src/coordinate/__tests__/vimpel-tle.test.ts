import { Satellite } from '../../objects/Satellite';
import { Tle } from '../Tle';
import { TleLine1, TleLine2 } from '../../main';

// JSC Vimpel TLEs carry a 'V' in the classification column (index 7) and leave
// the catalog-number field (cols 3-7) blank. They must parse and construct
// successfully. Leniency is scoped to classification === 'V'; ordinary TLEs
// with mismatched or blank catalog numbers must still throw.
describe('Vimpel TLE (classification "V") handling', () => {
  const tle1 = '1      V 12104    25007.20347222 +.00000000 +00000+0 +00000-0 0 29990' as TleLine1;
  const tle2 = '2       064.8350 009.7330 1627170 165.9900 359.1946 12.12185514 00010' as TleLine2;

  it('classification column resolves to "V"', () => {
    expect(Tle.classification(tle1)).toBe('V');
  });

  it('satNum returns NaN for the blank catalog field', () => {
    expect(Tle.satNum(tle1)).toBeNaN();
    expect(Tle.satNum(tle2)).toBeNaN();
  });

  it('Tle.parse does not throw', () => {
    expect(() => Tle.parse(tle1, tle2)).not.toThrow();
  });

  it('Tle.parseAll does not throw', () => {
    expect(() => Tle.parseAll(tle1, tle2)).not.toThrow();
  });

  it('new Satellite constructs without throwing', () => {
    let sat: Satellite | null = null;

    expect(() => {
      sat = new Satellite({ tle1, tle2 });
    }).not.toThrow();
    expect(sat).not.toBeNull();
  });

  it('still throws when a non-Vimpel TLE has mismatched satellite numbers', () => {
    const a = '1 25544U 98067A   25007.20347222 +.00000000 +00000+0 +00000-0 0 29990' as TleLine1;
    const b = '2 25545  051.6400 009.7330 0006703 165.9900 359.1946 15.50000000 00010' as TleLine2;

    expect(() => Tle.parse(a, b)).toThrow();
  });
});
