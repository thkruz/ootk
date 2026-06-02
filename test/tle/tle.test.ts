import { TleLine1 } from '../../src/main';
import { Tle } from '../../src/main';
import { tleData } from './tleData';

describe('Valid TLEs', () => {
  tleData.forEach((testCase) => {
    describe(`TLE ${testCase.satNum}: Line 1 Parsing`, () => {
      it('should parse the line number', () => {
        expect(Tle.lineNumber(testCase.line1)).toBe(testCase.linenum1);
        expect(Tle.lineNumber(testCase.line2)).toBe(testCase.linenum2);
      });

      it('should parse satellite number', () => {
        expect(Tle.satNum(testCase.line1)).toBe(testCase.satNum);
        expect(Tle.satNum(testCase.line2)).toBe(testCase.satNum2);
      });

      it('should parse satellite number as a raw string', () => {
        expect(Tle.rawSatNum(testCase.line1)).toBe(testCase.satNumRaw);
        expect(Tle.rawSatNum(testCase.line2)).toBe(testCase.satNumRaw2);
      });

      it('should parse satellite classification', () => {
        expect(Tle.classification(testCase.line1)).toBe(testCase.classification);
      });

      it('should parse International Designator', () => {
        expect(Tle.intlDesYear(testCase.line1)).toBe(testCase.intlDesYear);
        expect(Tle.intlDesLaunchNum(testCase.line1)).toBe(testCase.intlDesLaunchNum);
        expect(Tle.intlDesLaunchPiece(testCase.line1)).toBe(testCase.intlDesLaunchPiece);
        expect(Tle.intlDes(testCase.line1)).toBe(testCase.intlDes);
      });

      it('should parse epoch', () => {
        expect(Tle.epochYear(testCase.line1)).toBe(testCase.epochYear);
        expect(Tle.epochYearFull(testCase.line1)).toBe(testCase.epochYearFull);
        expect(Tle.epochDay(testCase.line1)).toBe(testCase.epochDay);
      });

      it('should parse first derivative', () => {
        expect(Tle.meanMoDev1(testCase.line1)).toBe(testCase.meanMoDev1);
      });

      it('should parse second derivative', () => {
        expect(Tle.meanMoDev2(testCase.line1)).toBe(testCase.meanMoDev2);
      });

      it('should parse bstar', () => {
        expect(Tle.bstar(testCase.line1)).toBe(testCase.bstar);
      });

      it('should parse ephemerisType', () => {
        expect(Tle.ephemerisType(testCase.line1)).toBe(testCase.ephemerisType);
      });

      it('should parse element number', () => {
        expect(Tle.elsetNum(testCase.line1)).toBe(testCase.elsetNum);
      });

      it('should parse checksum', () => {
        expect(Tle.checksum(testCase.line1)).toBe(testCase.checksum1);
      });

      it('should parse all of line 1', () => {
        expect(Tle.parseLine1(testCase.line1)).toEqual({
          lineNumber1: testCase.linenum1,
          satNum: testCase.satNum,
          satNumRaw: testCase.satNumRaw,
          classification: testCase.classification,
          intlDes: testCase.intlDes,
          intlDesYear: testCase.intlDesYear,
          intlDesLaunchNum: testCase.intlDesLaunchNum,
          intlDesLaunchPiece: testCase.intlDesLaunchPiece,
          epochYear: testCase.epochYear,
          epochYearFull: testCase.epochYearFull,
          epochDay: testCase.epochDay,
          meanMoDev1: testCase.meanMoDev1,
          meanMoDev2: testCase.meanMoDev2,
          bstar: testCase.bstar,
          ephemerisType: testCase.ephemerisType,
          elsetNum: testCase.elsetNum,
          checksum1: testCase.checksum1,
        });
      });
    });

    describe(`TLE ${testCase.satNum}: Line 2 Parsing`, () => {
      it('should parse satellite inclination', () => {
        expect(Tle.inclination(testCase.line2)).toBe(testCase.inclination);
      });

      it('should parse right ascension of ascending node', () => {
        expect(Tle.rightAscension(testCase.line2)).toBe(testCase.rightAscension);
      });

      it('should parse eccentricity', () => {
        expect(Tle.eccentricity(testCase.line2)).toBe(testCase.eccentricity);
      });

      it('should parse argument of perigee', () => {
        expect(Tle.argOfPerigee(testCase.line2)).toBe(testCase.argOfPerigee);
      });

      it('should parse mean anomaly', () => {
        expect(Tle.meanAnomaly(testCase.line2)).toBe(testCase.meanAnomaly);
      });

      it('should parse mean motion', () => {
        expect(Tle.meanMotion(testCase.line2)).toBe(testCase.meanMotion);
      });

      it('should parse revolution number', () => {
        expect(Tle.revNum(testCase.line2)).toBe(testCase.revNum);
      });

      it('should parse checksum', () => {
        expect(Tle.checksum(testCase.line2)).toBe(testCase.checksum2);
      });

      it('should parse all of line 2', () => {
        expect(Tle.parseLine2(testCase.line2)).toEqual({
          lineNumber2: testCase.linenum2,
          satNum: testCase.satNum,
          satNumRaw: testCase.satNumRaw,
          inclination: testCase.inclination,
          rightAscension: testCase.rightAscension,
          eccentricity: testCase.eccentricity,
          argOfPerigee: testCase.argOfPerigee,
          meanAnomaly: testCase.meanAnomaly,
          meanMotion: testCase.meanMotion,
          revNum: testCase.revNum,
          checksum2: testCase.checksum2,
          period: testCase.period,
        });
      });
      describe('TLE Parsing', () => {
        it('should parse a TLE for main orbital data', () => {
          const tle = Tle.parse(testCase.line1, testCase.line2);

          expect(tle).toEqual({
            satNum: testCase.satNum,
            intlDes: testCase.intlDes,
            epochYear: testCase.epochYear,
            epochDay: testCase.epochDay,
            meanMoDev1: testCase.meanMoDev1,
            meanMoDev2: testCase.meanMoDev2,
            bstar: testCase.bstar,
            inclination: testCase.inclination,
            rightAscension: testCase.rightAscension,
            eccentricity: testCase.eccentricity,
            argOfPerigee: testCase.argOfPerigee,
            meanAnomaly: testCase.meanAnomaly,
            meanMotion: testCase.meanMotion,
            period: testCase.period,
          });
        });

        it('should parse a TLE for all data', () => {
          const tle = Tle.parseAll(testCase.line1, testCase.line2);

          expect(tle).toEqual({
            lineNumber1: testCase.linenum1,
            lineNumber2: testCase.linenum2,
            satNum: testCase.satNum,
            satNumRaw: testCase.satNumRaw,
            classification: testCase.classification,
            intlDes: testCase.intlDes,
            intlDesYear: testCase.intlDesYear,
            intlDesLaunchNum: testCase.intlDesLaunchNum,
            intlDesLaunchPiece: testCase.intlDesLaunchPiece,
            epochYear: testCase.epochYear,
            epochYearFull: testCase.epochYearFull,
            epochDay: testCase.epochDay,
            meanMoDev1: testCase.meanMoDev1,
            meanMoDev2: testCase.meanMoDev2,
            bstar: testCase.bstar,
            ephemerisType: testCase.ephemerisType,
            elsetNum: testCase.elsetNum,
            inclination: testCase.inclination,
            rightAscension: testCase.rightAscension,
            eccentricity: testCase.eccentricity,
            argOfPerigee: testCase.argOfPerigee,
            meanAnomaly: testCase.meanAnomaly,
            meanMotion: testCase.meanMotion,
            revNum: testCase.revNum,
            checksum1: testCase.checksum1,
            checksum2: testCase.checksum2,
            period: testCase.period,
          });
        });
      });
    });
  });
});

describe('meanMoDev1 leading character combinations', () => {
  // Base TLE line with meanMoDev1 field at substring(33, 43)
  // Original: '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996'
  //                                              ^^^^^^^^^^
  //                                              positions 33-42 (10 chars)
  const prefix = '1 25544U 98067A   22203.46960946 ';
  const suffix = ' 00000+0  61583-4 0  9996';

  const buildLine1 = (meanMoDev1Field: string): TleLine1 => `${prefix}${meanMoDev1Field}${suffix}` as TleLine1;

  it('should parse with leading space (standard)', () => {
    const line1 = buildLine1(' .00003068');

    expect(Tle.meanMoDev1(line1)).toBe(0.00003068);
  });

  it('should parse with leading + sign', () => {
    const line1 = buildLine1('+.00003068');

    expect(Tle.meanMoDev1(line1)).toBe(0.00003068);
  });

  it('should parse with leading 0', () => {
    const line1 = buildLine1('0.00003068');

    expect(Tle.meanMoDev1(line1)).toBe(0.00003068);
  });

  it('should parse with leading - sign', () => {
    const line1 = buildLine1('-.00003068');

    expect(Tle.meanMoDev1(line1)).toBe(-0.00003068);
  });

  it('should parse positive value with + and leading zero', () => {
    const line1 = buildLine1('+0.0003068');

    expect(Tle.meanMoDev1(line1)).toBe(0.0003068);
  });

  it('should parse negative value with leading zero', () => {
    const line1 = buildLine1('-0.0003068');

    expect(Tle.meanMoDev1(line1)).toBe(-0.0003068);
  });

  it('should parse zero value', () => {
    const line1 = buildLine1(' .00000000');

    expect(Tle.meanMoDev1(line1)).toBe(0);
  });

  it('should parse zero with + sign', () => {
    const line1 = buildLine1('+.00000000');

    expect(Tle.meanMoDev1(line1)).toBe(0);
  });

  it('should parse zero with 0 prefix', () => {
    const line1 = buildLine1('0.00000000');

    expect(Tle.meanMoDev1(line1)).toBe(0);
  });
});

describe('bstar leading character combinations', () => {
  // Base TLE line with BSTAR field at substring(53, 61) — 8 chars
  // Original: '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996'
  //                                                                  ^^^^^^^^
  //                                                                  positions 53-60 (8 chars)
  // Format: [symbol][5-digit mantissa][exponent symbol][exponent digit]
  // e.g., ' 61583-4' → 0.61583 * 10^-4 = 0.000061583
  const prefix = '1 25544U 98067A   22203.46960946  .00003068  00000+0 ';
  const suffix = ' 0  9996';

  const buildLine1 = (bstarField: string): TleLine1 => `${prefix}${bstarField}${suffix}` as TleLine1;

  it('should parse with leading space (standard)', () => {
    const line1 = buildLine1(' 61583-4');

    expect(Tle.bstar(line1)).toBe(0.000061583);
  });

  it('should parse with leading + sign', () => {
    const line1 = buildLine1('+61583-4');

    expect(Tle.bstar(line1)).toBe(0.000061583);
  });

  it('should parse with leading 0', () => {
    const line1 = buildLine1('061583-4');

    expect(Tle.bstar(line1)).toBe(0.000061583);
  });

  it('should parse with leading - sign', () => {
    const line1 = buildLine1('-61583-4');

    expect(Tle.bstar(line1)).toBe(-0.000061583);
  });

  it('should parse zero BSTAR with space', () => {
    const line1 = buildLine1(' 00000+0');

    expect(Tle.bstar(line1)).toBe(0);
  });

  it('should parse zero BSTAR with + sign', () => {
    const line1 = buildLine1('+00000+0');

    expect(Tle.bstar(line1)).toBe(0);
  });

  it('should parse zero BSTAR with 0 prefix', () => {
    const line1 = buildLine1('000000+0');

    expect(Tle.bstar(line1)).toBe(0);
  });

  it('should parse positive exponent', () => {
    const line1 = buildLine1(' 12345+2');

    expect(Tle.bstar(line1)).toBeCloseTo(12.345, 10);
  });

  it('should parse negative value with positive exponent', () => {
    const line1 = buildLine1('-12345+2');

    expect(Tle.bstar(line1)).toBeCloseTo(-12.345, 10);
  });

  it('should parse a high-drag mantissa whose integer digit fills column 54', () => {
    // Real reentering object 30819: BSTAR field "156214+0" → 1.56214 × 10^0.
    const line1 = buildLine1('156214+0');

    expect(Tle.bstar(line1)).toBeCloseTo(1.56214, 10);
  });

  it('should parse a leading mantissa digit with a negative exponent', () => {
    const line1 = buildLine1('156214-1');

    expect(Tle.bstar(line1)).toBeCloseTo(0.156214, 10);
  });

  it('should still reject a non-numeric, non-sign mantissa symbol', () => {
    const line1 = buildLine1('X56214+0');

    expect(() => Tle.bstar(line1)).toThrow(/Invalid BSTAR symbol/u);
  });
});

describe('ephemerisType leniency', () => {
  // Standard ISS line 1; the ephemeris type sits at column 63 (index 62).
  const base = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
  const withType = (t: string): TleLine1 => `${base.substring(0, 62)}${t}${base.substring(63)}` as TleLine1;

  it('accepts the standard type 0', () => {
    expect(Tle.ephemerisType(withType('0'))).toBe(0);
  });

  it('tolerates the legacy type 1', () => {
    expect(Tle.ephemerisType(withType('1'))).toBe(1);
  });

  it('rejects SGP4-XP (type 4) with a specific message', () => {
    expect(() => Tle.ephemerisType(withType('4'))).toThrow(/SGP4-XP/u);
  });

  it('rejects other values as invalid', () => {
    expect(() => Tle.ephemerisType(withType('2'))).toThrow(/Invalid ephemeris type/u);
    expect(() => Tle.ephemerisType(withType('3'))).toThrow(/Invalid ephemeris type/u);
  });
});

describe('calcElsetAge honors the supplied reference date', () => {
  // Epoch: 2022, day-of-year 203.46960946.
  const line1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;

  it('measures age in days against the reference time, not today', () => {
    // 2022-08-01 is day-of-year 213 → 213 - 203.46960946.
    const age = Tle.calcElsetAge(line1, new Date('2022-08-01T00:00:00Z'), 'days');

    expect(age).toBeCloseTo(9.53039054, 5);
  });

  it('accounts for the reference year (not just day-of-year)', () => {
    // One year later, same day-of-year → ~365 days older.
    const age = Tle.calcElsetAge(line1, new Date('2023-07-22T00:00:00Z'), 'days');

    expect(age).toBeCloseTo(364.53039054, 4);
  });

  it('honors the reference time-of-day', () => {
    const age = Tle.calcElsetAge(line1, new Date('2022-08-01T12:00:00Z'), 'days');

    expect(age).toBeCloseTo(10.03039054, 5);
  });
});
