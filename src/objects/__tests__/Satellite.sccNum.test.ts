import { Satellite } from '../Satellite';
import { Tle } from '../../coordinate/Tle';
import { TleLine1, TleLine2 } from '../../types/types';

describe('Satellite sccNum derivation from TLE construction', () => {
  // Pre-fix sccNum behavior was inconsistent between Satellite.fromOmm
  // (preserves input as-is) and `new Satellite({tle1, tle2})` (runs through
  // Tle.parse which calls Tle.convertA5to6Digit, so alpha-5 inputs become
  // 6-digit numeric on .sccNum). These tests pin both behaviors so callers
  // know which form they're getting.

  describe('legacy 5-digit numeric TLEs', () => {
    const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
    const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

    it('round-trips sccNum/sccNum5/sccNum6 to the same 5-digit numeric', () => {
      const sat = new Satellite({ tle1, tle2 });

      expect(sat.sccNum).toBe('25544');
      expect(sat.sccNum5).toBe('25544');
      expect(sat.sccNum6).toBe('25544');
    });
  });

  describe('alpha-5 TLEs', () => {
    const tle1 = '1 T0001U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
    const tle2 = '2 T0001  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

    // Tle.parse converts the alpha-5 satnum to its 6-digit numeric form via
    // Tle.convertA5to6Digit and parseInt. That's then stored on sat.sccNum.
    // The alpha-5 form is only recoverable via sat.sccNum5.
    it('stores the 6-digit numeric form on sccNum (NOT the alpha-5 input)', () => {
      const sat = new Satellite({ tle1, tle2 });
      const expectedSixDigit = Tle.convertA5to6Digit('T0001');

      expect(sat.sccNum).toBe(expectedSixDigit);
      expect(sat.sccNum5).toBe('T0001');
      expect(sat.sccNum6).toBe(expectedSixDigit);
    });

    it('normalizes an explicit alpha-5 constructor override to the numeric form', () => {
      const sat = new Satellite({ sccNum: 'T0001', tle1, tle2 });
      const expectedSixDigit = Tle.convertA5to6Digit('T0001');

      // Class invariant: sat.sccNum is always the display-canonical numeric
      // form, regardless of which form the caller supplied. The alpha-5
      // string is preserved on sccNum5.
      expect(sat.sccNum).toBe(expectedSixDigit);
      expect(sat.sccNum5).toBe('T0001');
      expect(sat.sccNum6).toBe(expectedSixDigit);
    });
  });

  describe('extended (9-digit) sccNum via explicit constructor override', () => {
    // Extended IDs can't fit in TLE cols 3-7, so the convention is: TLE
    // carries the trailing 5 digits, Satellite.sccNum carries the canonical
    // 9-digit string via an explicit override.
    const tle1 = '1 99999U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
    const tle2 = '2 99999  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

    it('preserves the full canonical id on sccNum and emits null for alpha-5 forms', () => {
      const sat = new Satellite({ sccNum: '799500766', tle1, tle2 });

      expect(sat.sccNum).toBe('799500766');
      // sccNum5/sccNum6 are unrepresentable for IDs > 339999.
      expect(sat.sccNum5).toBeNull();
      expect(sat.sccNum6).toBeNull();
    });

    it('keeps the TLE satnum independent of the canonical sccNum', () => {
      const sat = new Satellite({ sccNum: '799500766', tle1, tle2 });

      // TLE cols 3-7 carry whatever was in the input — separate from sccNum.
      expect(sat.tle1.substring(2, 7)).toBe('99999');
      expect(sat.tle2.substring(2, 7)).toBe('99999');
    });
  });

  describe('editTle preserves explicit sccNum across re-parse', () => {
    const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
    const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;
    const newTle1 = '1 25544U 98067A   24001.00000000  .00003068  00000+0  61583-4 0  9999' as TleLine1;
    const newTle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

    it('editTle without sccNum re-derives from the new TLE satnum', () => {
      const sat = new Satellite({ sccNum: '799500766', tle1, tle2 });

      sat.editTle(newTle1, newTle2);
      // No override on editTle → sccNum reverts to whatever the new TLE encodes.
      expect(sat.sccNum).toBe('25544');
    });

    it('editTle with explicit sccNum preserves the canonical id across re-parse', () => {
      const sat = new Satellite({ sccNum: '799500766', tle1, tle2 });

      sat.editTle(newTle1, newTle2, '799500766');
      expect(sat.sccNum).toBe('799500766');
      expect(sat.sccNum5).toBeNull();
    });
  });

  // Class-wide invariant: Satellite.sccNum is ALWAYS the display-canonical
  // numeric form, never an alpha-5 string. This block parametrizes over every
  // construction path to catch any future regression that re-introduces
  // alpha-5 preservation on .sccNum.
  describe('sccNum invariant: always display-canonical numeric', () => {
    const tle1Numeric = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
    const tle2Numeric = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;
    const tle1Alpha5 = '1 T0001U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
    const tle2Alpha5 = '2 T0001  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

    const isNeverAlpha5 = (sat: { sccNum: string }) => {
      expect(Tle.classifySatNum(sat.sccNum)).not.toBe('alpha5');
    };

    it('numeric5 input via TLE construction stays numeric', () => {
      const sat = new Satellite({ tle1: tle1Numeric, tle2: tle2Numeric });

      isNeverAlpha5(sat);
      expect(sat.sccNum).toBe('25544');
    });

    it('alpha-5 TLE construction normalizes to the 6-digit numeric form', () => {
      const sat = new Satellite({ tle1: tle1Alpha5, tle2: tle2Alpha5 });

      isNeverAlpha5(sat);
      expect(sat.sccNum).toBe(Tle.convertA5to6Digit('T0001'));
    });

    it('explicit alpha-5 constructor override normalizes too', () => {
      const sat = new Satellite({ sccNum: 'T0001', tle1: tle1Numeric, tle2: tle2Numeric });

      isNeverAlpha5(sat);
      expect(sat.sccNum).toBe(Tle.convertA5to6Digit('T0001'));
    });

    it('fromOmm with numeric NORAD_CAT_ID stays numeric', () => {
      const sat = Satellite.fromOmm({
        OBJECT_NAME: 'TEST', OBJECT_ID: '2024-001A',
        EPOCH: '2024-01-01T00:00:00.000000',
        MEAN_MOTION: 15.5, ECCENTRICITY: 0.0001, INCLINATION: 51.6,
        RA_OF_ASC_NODE: 0, ARG_OF_PERICENTER: 0, MEAN_ANOMALY: 0,
        EPHEMERIS_TYPE: 0, CLASSIFICATION_TYPE: 'U', NORAD_CAT_ID: '25544',
        ELEMENT_SET_NO: 999, REV_AT_EPOCH: 1, BSTAR: 0,
        MEAN_MOTION_DOT: 0, MEAN_MOTION_DDOT: 0,
      });

      isNeverAlpha5(sat);
      expect(sat.sccNum).toBe('25544');
    });

    it('fromOmm with alpha-5 NORAD_CAT_ID normalizes to the 6-digit numeric form', () => {
      const sat = Satellite.fromOmm({
        OBJECT_NAME: 'TEST', OBJECT_ID: '2024-001A',
        EPOCH: '2024-01-01T00:00:00.000000',
        MEAN_MOTION: 15.5, ECCENTRICITY: 0.0001, INCLINATION: 51.6,
        RA_OF_ASC_NODE: 0, ARG_OF_PERICENTER: 0, MEAN_ANOMALY: 0,
        EPHEMERIS_TYPE: 0, CLASSIFICATION_TYPE: 'U', NORAD_CAT_ID: 'T0001',
        ELEMENT_SET_NO: 999, REV_AT_EPOCH: 1, BSTAR: 0,
        MEAN_MOTION_DOT: 0, MEAN_MOTION_DDOT: 0,
      });

      isNeverAlpha5(sat);
      expect(sat.sccNum).toBe(Tle.convertA5to6Digit('T0001'));
      expect(sat.sccNum5).toBe('T0001');
    });

    it('extended (9-digit) sccNum passes through (no conversion applies)', () => {
      const sat = new Satellite({ sccNum: '799500766', tle1: tle1Numeric, tle2: tle2Numeric });

      isNeverAlpha5(sat);
      expect(sat.sccNum).toBe('799500766');
    });

    it('editTle re-derives sccNum to the numeric form even when the new TLE is alpha-5', () => {
      const sat = new Satellite({ tle1: tle1Numeric, tle2: tle2Numeric });

      sat.editTle(tle1Alpha5, tle2Alpha5);
      isNeverAlpha5(sat);
      expect(sat.sccNum).toBe(Tle.convertA5to6Digit('T0001'));
    });

    it('editTle with explicit alpha-5 sccNum override still normalizes', () => {
      const sat = new Satellite({ tle1: tle1Numeric, tle2: tle2Numeric });

      sat.editTle(tle1Alpha5, tle2Alpha5, 'T0001');
      isNeverAlpha5(sat);
      expect(sat.sccNum).toBe(Tle.convertA5to6Digit('T0001'));
    });
  });

  describe('toTle preserves the TLE satnum independent of canonical sccNum', () => {
    // Satellite.toTle returns the raw stored tle1/tle2 strings (no rewriting).
    // The TLE satnum and Satellite.sccNum can diverge — extended IDs use that
    // gap to keep the full 9-digit canonical id while still emitting 69-char
    // TLE lines for SGP4.
    it('returns a Tle with line1/line2 carrying the input TLE satnum even when sccNum is extended', () => {
      const tle1 = '1 99999U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
      const tle2 = '2 99999  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;
      const sat = new Satellite({ sccNum: '799500766', tle1, tle2 });
      const tle = sat.toTle();

      expect(tle.line1.substring(2, 7)).toBe('99999');
      expect(tle.line2.substring(2, 7)).toBe('99999');
      expect(tle.line1.length).toBe(69);
      expect(tle.line2.length).toBe(69);
    });

    it('returns a Tle with alpha-5 satnum when input TLE used alpha-5', () => {
      const tle1 = '1 T0001U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
      const tle2 = '2 T0001  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;
      const sat = new Satellite({ sccNum: 'T0001', tle1, tle2 });
      const tle = sat.toTle();

      expect(tle.line1.substring(2, 7)).toBe('T0001');
      expect(tle.line2.substring(2, 7)).toBe('T0001');
    });
  });
});
