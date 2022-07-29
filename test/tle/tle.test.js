/* eslint-disable max-lines-per-function */
/**
 * @file   Test Suite to verify tle functions work as expected
 * @author Theodore Kruczek.
 * @since  1.1.0
 */

import { Tle } from '@lib/ootk';
import tleData from './tle.json';

describe('Valid TLEs', () => {
  tleData.forEach((testCase) => {
    describe(`TLE ${testCase.satNum}: Line 1 Parsing`, () => {
      it('should parse the line number', () => {
        expect(Tle.getLineNumber(testCase.line1)).toBe(testCase.linenum1);
        expect(Tle.getLineNumber(testCase.line2)).toBe(testCase.linenum2);
      });

      it('should parse satellite number', () => {
        expect(Tle.getSatNum(testCase.line1)).toBe(testCase.satNum);
        expect(Tle.getSatNum(testCase.line2)).toBe(testCase.satNum2);
      });

      it('should parse satellite number as a raw string', () => {
        expect(Tle.getRawSatNum(testCase.line1)).toBe(testCase.satNumRaw);
        expect(Tle.getRawSatNum(testCase.line2)).toBe(testCase.satNumRaw2);
      });

      it('should parse satellite classification', () => {
        expect(Tle.getClassification(testCase.line1)).toBe(testCase.classification);
      });

      it('should parse International Designator', () => {
        expect(Tle.getIntlDesYear(testCase.line1)).toBe(testCase.intlDesYear);
        expect(Tle.getIntlDesLaunchNum(testCase.line1)).toBe(testCase.intlDesLaunchNum);
        expect(Tle.getIntlDesLaunchPiece(testCase.line1)).toBe(testCase.intlDesLaunchPiece);
        expect(Tle.getIntlDes(testCase.line1)).toBe(testCase.intlDes);
      });

      it('should parse epoch', () => {
        expect(Tle.getEpochYear(testCase.line1)).toBe(testCase.epochYear);
        expect(Tle.getEpochYearFull(testCase.line1)).toBe(testCase.epochYearFull);
        expect(Tle.getEpochDay(testCase.line1)).toBe(testCase.epochDay);
      });

      it('should parse first derivative', () => {
        expect(Tle.getMeanMoDev1(testCase.line1)).toBe(testCase.meanMoDev1);
      });

      it('should parse second derivative', () => {
        expect(Tle.getMeanMoDev2(testCase.line1)).toBe(testCase.meanMoDev2);
      });

      it('should parse bstar', () => {
        expect(Tle.getBstar(testCase.line1)).toBe(testCase.bstar);
      });

      it('should parse ephemerisType', () => {
        expect(Tle.getEphemerisType(testCase.line1)).toBe(testCase.ephemerisType);
      });

      it('should parse element number', () => {
        expect(Tle.getElsetNum(testCase.line1)).toBe(testCase.elsetNum);
      });

      it('should parse checksum', () => {
        expect(Tle.getChecksum(testCase.line1)).toBe(testCase.checksum1);
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
        expect(Tle.getInclination(testCase.line2)).toBe(testCase.inclination);
      });

      it('should parse right ascension of ascending node', () => {
        expect(Tle.getRaan(testCase.line2)).toBe(testCase.raan);
      });

      it('should parse eccentricity', () => {
        expect(Tle.getEccentricity(testCase.line2)).toBe(testCase.eccentricity);
      });

      it('should parse argument of perigee', () => {
        expect(Tle.getArgOfPerigee(testCase.line2)).toBe(testCase.argOfPerigee);
      });

      it('should parse mean anomaly', () => {
        expect(Tle.getMeanAnomaly(testCase.line2)).toBe(testCase.meanAnomaly);
      });

      it('should parse mean motion', () => {
        expect(Tle.getMeanMotion(testCase.line2)).toBe(testCase.meanMotion);
      });

      it('should parse revolution number', () => {
        expect(Tle.getRevNum(testCase.line2)).toBe(testCase.revNum);
      });

      it('should parse checksum', () => {
        expect(Tle.getChecksum(testCase.line2)).toBe(testCase.checksum2);
      });

      it('should parse all of line 2', () => {
        expect(Tle.parseLine2(testCase.line2)).toEqual({
          lineNumber2: testCase.linenum2,
          satNum: testCase.satNum,
          satNumRaw: testCase.satNumRaw,
          inclination: testCase.inclination,
          raan: testCase.raan,
          eccentricity: testCase.eccentricity,
          argOfPerigee: testCase.argOfPerigee,
          meanAnomaly: testCase.meanAnomaly,
          meanMotion: testCase.meanMotion,
          revNum: testCase.revNum,
          checksum2: testCase.checksum2,
        });
      });
      describe('TLE Parsing', () => {
        it('should parse a TLE for main orbital data', () => {
          const tle = Tle.parseTle(testCase.line1, testCase.line2);

          expect(tle).toEqual({
            satNum: testCase.satNum,
            intlDes: testCase.intlDes,
            epochYear: testCase.epochYear,
            epochDay: testCase.epochDay,
            meanMoDev1: testCase.meanMoDev1,
            meanMoDev2: testCase.meanMoDev2,
            bstar: testCase.bstar,
            inclination: testCase.inclination,
            raan: testCase.raan,
            eccentricity: testCase.eccentricity,
            argOfPerigee: testCase.argOfPerigee,
            meanAnomaly: testCase.meanAnomaly,
            meanMotion: testCase.meanMotion,
          });
        });

        it('should parse a TLE for all data', () => {
          const tle = Tle.parseTleFull(testCase.line1, testCase.line2);

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
            raan: testCase.raan,
            eccentricity: testCase.eccentricity,
            argOfPerigee: testCase.argOfPerigee,
            meanAnomaly: testCase.meanAnomaly,
            meanMotion: testCase.meanMotion,
            revNum: testCase.revNum,
            checksum1: testCase.checksum1,
            checksum2: testCase.checksum2,
          });
        });
      });
    });
  });
});
