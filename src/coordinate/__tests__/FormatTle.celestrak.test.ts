import { readFileSync } from 'fs';
import { resolve } from 'path';
import { FormatTle, TleParams } from '../../main';
import type { OmmDataFormat } from '../../interfaces/OmmFormat';

/**
 * Convert CelesTrak OBJECT_ID (COSPAR) to TLE international designator.
 * "1998-067A" → "98067A", "2011-037PF" → "11037PF"
 */
function objectIdToIntl(objectId: string): string {
  const dashIdx = objectId.indexOf('-');
  const year2 = objectId.substring(dashIdx - 2, dashIdx);
  const rest = objectId.substring(dashIdx + 1);

  return year2 + rest;
}

/**
 * Convert ISO epoch string to TLE epochyr and epochday with sub-millisecond precision.
 * Parses manually to avoid JavaScript Date's millisecond truncation.
 */
function epochFromIso(epoch: string): { epochyr: number; epochday: number } {
  const [datePart, timePart] = epoch.split('T');
  const [yearStr, monthStr, dayStr] = datePart.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const [hourStr, minStr, secStr] = timePart.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  const second = parseFloat(secStr);

  const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
    daysInMonth[2] = 29;
  }

  let doy = day;

  for (let i = 1; i < month; i++) {
    doy += daysInMonth[i];
  }

  const dayFraction = (hour * 3600 + minute * 60 + second) / 86400;

  return {
    epochyr: year % 100,
    epochday: doy + dayFraction,
  };
}

/**
 * Convert a CelesTrak JSON GP entry to TleParams for FormatTle.createTle().
 */
function ommJsonToTleParams(omm: OmmDataFormat): TleParams {
  const { epochyr, epochday } = epochFromIso(omm.EPOCH);

  return {
    scc: String(omm.NORAD_CAT_ID),
    intl: objectIdToIntl(omm.OBJECT_ID),
    epochyr,
    epochday,
    inc: Number(omm.INCLINATION),
    rasc: Number(omm.RA_OF_ASC_NODE),
    ecen: Number(omm.ECCENTRICITY),
    argPe: Number(omm.ARG_OF_PERICENTER),
    meana: Number(omm.MEAN_ANOMALY),
    meanmo: Number(omm.MEAN_MOTION),
    bstar: Number(omm.BSTAR),
    meanMotionDot: Number(omm.MEAN_MOTION_DOT),
    meanMotionDdot: Number(omm.MEAN_MOTION_DDOT),
    classification: String(omm.CLASSIFICATION_TYPE),
    elementSetNo: Number(omm.ELEMENT_SET_NO),
    ephemerisType: Number(omm.EPHEMERIS_TYPE),
    revAtEpoch: Number(omm.REV_AT_EPOCH),
  };
}

/**
 * Parse a 2LE file into a map keyed by NORAD catalog ID.
 */
function parse2le(content: string): Map<number, { tle1: string; tle2: string }> {
  const lines = content
    .replace(/\r\n/gu, '\n')
    .trim()
    .split('\n')
    .map((l) => l.trimEnd());
  const result = new Map<number, { tle1: string; tle2: string }>();

  for (let i = 0; i < lines.length; i += 2) {
    const tle1 = lines[i];
    const tle2 = lines[i + 1];
    const noradId = parseInt(tle2.substring(2, 7).trim(), 10);

    result.set(noradId, { tle1, tle2 });
  }

  return result;
}

describe('FormatTle.createTle against CelesTrak stations data', () => {
  const fixtureDir = resolve(__dirname, 'fixtures');
  const jsonData: OmmDataFormat[] = JSON.parse(readFileSync(resolve(fixtureDir, 'stations.json'), 'utf-8'));
  const tleMap = parse2le(readFileSync(resolve(fixtureDir, 'stations.2le'), 'utf-8'));

  const testCases = jsonData.map((omm) => ({
    name: String(omm.OBJECT_NAME),
    noradId: Number(omm.NORAD_CAT_ID),
    omm,
  }));

  describe('TLE line 1 matches CelesTrak', () => {
    it.each(testCases)('$name (NORAD $noradId)', ({ noradId, omm }) => {
      const expected = tleMap.get(noradId);

      expect(expected).toBeDefined();

      const tleParams = ommJsonToTleParams(omm);
      const result = FormatTle.createTle(tleParams);

      expect(result.tle1).toBe(expected!.tle1);
    });
  });

  describe('TLE line 2 matches CelesTrak', () => {
    it.each(testCases)('$name (NORAD $noradId)', ({ noradId, omm }) => {
      const expected = tleMap.get(noradId);

      expect(expected).toBeDefined();

      const tleParams = ommJsonToTleParams(omm);
      const result = FormatTle.createTle(tleParams);

      expect(result.tle2).toBe(expected!.tle2);
    });
  });

  describe('checksums are valid', () => {
    it.each(testCases)('$name (NORAD $noradId)', ({ omm }) => {
      const tleParams = ommJsonToTleParams(omm);
      const result = FormatTle.createTle(tleParams);

      const tle1Checksum = FormatTle.tleChecksum(result.tle1);
      const tle2Checksum = FormatTle.tleChecksum(result.tle2);

      expect(parseInt(result.tle1[68], 10)).toBe(tle1Checksum);
      expect(parseInt(result.tle2[68], 10)).toBe(tle2Checksum);
    });
  });

  describe('line lengths are 69 characters', () => {
    it.each(testCases)('$name (NORAD $noradId)', ({ omm }) => {
      const tleParams = ommJsonToTleParams(omm);
      const result = FormatTle.createTle(tleParams);

      expect(result.tle1.length).toBe(69);
      expect(result.tle2.length).toBe(69);
    });
  });
});

describe('ommJsonToTleParams helper', () => {
  it('should convert ISS epoch correctly', () => {
    const { epochyr, epochday } = epochFromIso('2026-03-12T19:18:27.745920');

    expect(epochyr).toBe(26);
    expect(Number(epochday.toFixed(8))).toBeCloseTo(71.80448780, 7);
  });

  it('should convert OBJECT_ID to TLE intl designator', () => {
    expect(objectIdToIntl('1998-067A')).toBe('98067A');
    expect(objectIdToIntl('2011-037PF')).toBe('11037PF');
    expect(objectIdToIntl('1998-067XN')).toBe('98067XN');
    expect(objectIdToIntl('2026-031A')).toBe('26031A');
  });
});
