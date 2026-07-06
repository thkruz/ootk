/**
 * @file CdmParser test suite
 * @description Tests for CDM KVN format parsing
 */

import {
  CdmParser,
  ParseError,
} from '../../main';

describe('CdmParser', () => {
  // Sample CDM content conforming to CCSDS 508.0-B-1
  const validCdmContent = `
CCSDS_CDM_VERS = 1.0
CREATION_DATE = 2025-01-19T12:00:00.000
ORIGINATOR = OOTK
MESSAGE_FOR = SATELLITE_A
MESSAGE_ID = CDM-2025-001

TCA = 2025-01-20T15:30:45.123
MISS_DISTANCE = 0.5 [km]
RELATIVE_SPEED = 14.2 [km/s]
RELATIVE_POSITION_R = 0.1 [km]
RELATIVE_POSITION_T = 0.3 [km]
RELATIVE_POSITION_N = 0.35 [km]
RELATIVE_VELOCITY_R = 1.5 [km/s]
RELATIVE_VELOCITY_T = 12.0 [km/s]
RELATIVE_VELOCITY_N = 7.0 [km/s]
COLLISION_PROBABILITY = 1.5E-05
COLLISION_PROBABILITY_METHOD = CHAN-2D

OBJECT = OBJECT1
OBJECT_DESIGNATOR = 25544
CATALOG_NAME = SATCAT
OBJECT_NAME = ISS
INTERNATIONAL_DESIGNATOR = 1998-067A
OBJECT_TYPE = PAYLOAD
MANEUVERABLE = YES
REF_FRAME = EME2000

OBJECT = OBJECT1
X = 6878.137 [km]
Y = 0.0 [km]
Z = 0.0 [km]
X_DOT = 0.0 [km/s]
Y_DOT = 7.612 [km/s]
Z_DOT = 0.0 [km/s]
CR_R = 1.0E-06 [km**2]
CT_R = 0.0 [km**2]
CT_T = 1.0E-06 [km**2]
CN_R = 0.0 [km**2]
CN_T = 0.0 [km**2]
CN_N = 1.0E-06 [km**2]

OBJECT = OBJECT2
OBJECT_DESIGNATOR = 12345
CATALOG_NAME = SATCAT
OBJECT_NAME = DEBRIS
OBJECT_TYPE = DEBRIS
MANEUVERABLE = NO
REF_FRAME = EME2000

OBJECT = OBJECT2
X = 6878.637 [km]
Y = 0.1 [km]
Z = 0.35 [km]
X_DOT = 0.001 [km/s]
Y_DOT = 7.612 [km/s]
Z_DOT = 0.001 [km/s]
CR_R = 2.0E-06 [km**2]
CT_T = 2.0E-06 [km**2]
CN_N = 2.0E-06 [km**2]
`;

  const minimalCdmContent = `
CCSDS_CDM_VERS = 1.0
CREATION_DATE = 2025-01-19T12:00:00.000
ORIGINATOR = TEST

TCA = 2025-01-20T15:30:45.123
MISS_DISTANCE = 1.0

OBJECT = OBJECT1
OBJECT_DESIGNATOR = 25544

OBJECT = OBJECT1
X = 6878.137
Y = 0.0
Z = 0.0
X_DOT = 0.0
Y_DOT = 7.612
Z_DOT = 0.0

OBJECT = OBJECT2
OBJECT_DESIGNATOR = 12345

OBJECT = OBJECT2
X = 6879.137
Y = 0.1
Z = 0.1
X_DOT = 0.001
Y_DOT = 7.612
Z_DOT = 0.001
`;

  describe('parse', () => {
    it('should parse valid CDM content', () => {
      const parsed = CdmParser.parse(validCdmContent);

      expect(parsed).toBeDefined();
      expect(parsed.header).toBeDefined();
      expect(parsed.relativeData).toBeDefined();
      expect(parsed.object1Metadata).toBeDefined();
      expect(parsed.object1Data).toBeDefined();
      expect(parsed.object2Metadata).toBeDefined();
      expect(parsed.object2Data).toBeDefined();
    });

    it('should parse header fields correctly', () => {
      const parsed = CdmParser.parse(validCdmContent);

      expect(parsed.header.CCSDS_CDM_VERS).toBe('1.0');
      expect(parsed.header.CREATION_DATE).toBe('2025-01-19T12:00:00.000');
      expect(parsed.header.ORIGINATOR).toBe('OOTK');
      expect(parsed.header.MESSAGE_FOR).toBe('SATELLITE_A');
      expect(parsed.header.MESSAGE_ID).toBe('CDM-2025-001');
    });

    it('should parse relative data fields correctly', () => {
      const parsed = CdmParser.parse(validCdmContent);

      expect(parsed.relativeData.TCA).toBe('2025-01-20T15:30:45.123');
      expect(parsed.relativeData.MISS_DISTANCE).toBe(0.5);
      expect(parsed.relativeData.RELATIVE_SPEED).toBe(14.2);
      expect(parsed.relativeData.RELATIVE_POSITION_R).toBe(0.1);
      expect(parsed.relativeData.RELATIVE_POSITION_T).toBe(0.3);
      expect(parsed.relativeData.RELATIVE_POSITION_N).toBe(0.35);
      expect(parsed.relativeData.COLLISION_PROBABILITY).toBe(1.5e-5);
      expect(parsed.relativeData.COLLISION_PROBABILITY_METHOD).toBe('CHAN-2D');
    });

    it('should parse object metadata correctly', () => {
      const parsed = CdmParser.parse(validCdmContent);

      expect(parsed.object1Metadata.OBJECT).toBe('OBJECT1');
      expect(parsed.object1Metadata.OBJECT_DESIGNATOR).toBe('25544');
      expect(parsed.object1Metadata.OBJECT_NAME).toBe('ISS');
      expect(parsed.object1Metadata.OBJECT_TYPE).toBe('PAYLOAD');
      expect(parsed.object1Metadata.MANEUVERABLE).toBe('YES');

      expect(parsed.object2Metadata.OBJECT).toBe('OBJECT2');
      expect(parsed.object2Metadata.OBJECT_DESIGNATOR).toBe('12345');
      expect(parsed.object2Metadata.OBJECT_NAME).toBe('DEBRIS');
      expect(parsed.object2Metadata.OBJECT_TYPE).toBe('DEBRIS');
      expect(parsed.object2Metadata.MANEUVERABLE).toBe('NO');
    });

    it('should parse object state data correctly', () => {
      const parsed = CdmParser.parse(validCdmContent);

      expect(parsed.object1Data.X).toBe(6878.137);
      expect(parsed.object1Data.Y).toBe(0.0);
      expect(parsed.object1Data.Z).toBe(0.0);
      expect(parsed.object1Data.X_DOT).toBe(0.0);
      expect(parsed.object1Data.Y_DOT).toBe(7.612);
      expect(parsed.object1Data.Z_DOT).toBe(0.0);

      expect(parsed.object2Data.X).toBe(6878.637);
      expect(parsed.object2Data.Y).toBe(0.1);
      expect(parsed.object2Data.Z).toBe(0.35);
    });

    it('should parse covariance data correctly', () => {
      const parsed = CdmParser.parse(validCdmContent);

      expect(parsed.object1Data.CR_R).toBe(1.0e-6);
      expect(parsed.object1Data.CT_T).toBe(1.0e-6);
      expect(parsed.object1Data.CN_N).toBe(1.0e-6);
    });

    it('should strip units from values', () => {
      const parsed = CdmParser.parse(validCdmContent);

      // Values should be numbers without unit suffixes
      expect(typeof parsed.relativeData.MISS_DISTANCE).toBe('number');
      expect(typeof parsed.object1Data.X).toBe('number');
    });

    it('should parse minimal CDM content', () => {
      const parsed = CdmParser.parse(minimalCdmContent);

      expect(parsed.header.CCSDS_CDM_VERS).toBe('1.0');
      expect(parsed.relativeData.TCA).toBeDefined();
      expect(parsed.relativeData.MISS_DISTANCE).toBe(1.0);
      expect(parsed.object1Metadata.OBJECT_DESIGNATOR).toBe('25544');
      expect(parsed.object2Metadata.OBJECT_DESIGNATOR).toBe('12345');
    });

    it('should handle Windows line endings', () => {
      const windowsContent = validCdmContent.replace(/\n/gu, '\r\n');
      const parsed = CdmParser.parse(windowsContent);

      expect(parsed.header.CCSDS_CDM_VERS).toBe('1.0');
    });

    it('should throw ParseError for missing TCA', () => {
      const invalidContent = `
CCSDS_CDM_VERS = 1.0
CREATION_DATE = 2025-01-19T12:00:00.000
ORIGINATOR = TEST
MISS_DISTANCE = 1.0
`;

      expect(() => CdmParser.parse(invalidContent)).toThrow(ParseError);
    });

    it('should throw ParseError for missing MISS_DISTANCE', () => {
      const invalidContent = `
CCSDS_CDM_VERS = 1.0
CREATION_DATE = 2025-01-19T12:00:00.000
ORIGINATOR = TEST
TCA = 2025-01-20T15:30:45.123
`;

      expect(() => CdmParser.parse(invalidContent)).toThrow(ParseError);
    });

    it('should throw ParseError for missing object state data', () => {
      const invalidContent = `
CCSDS_CDM_VERS = 1.0
CREATION_DATE = 2025-01-19T12:00:00.000
ORIGINATOR = TEST
TCA = 2025-01-20T15:30:45.123
MISS_DISTANCE = 1.0
OBJECT = OBJECT1
OBJECT_DESIGNATOR = 25544
`;

      expect(() => CdmParser.parse(invalidContent)).toThrow(ParseError);
    });
  });

  describe('validate', () => {
    it('should validate correct CDM structure', () => {
      const parsed = CdmParser.parse(validCdmContent);

      expect(() => CdmParser.validate(parsed)).not.toThrow();
    });
  });

  describe('toConjunctionEvent', () => {
    it('should convert parsed CDM to ConjunctionEvent', () => {
      const parsed = CdmParser.parse(validCdmContent);
      const event = CdmParser.toConjunctionEvent(parsed);

      expect(event).toBeDefined();
      expect(event.tca).toBeDefined();
      expect(event.missDistance).toBe(0.5);
      expect(event.primaryState).toBeDefined();
      expect(event.secondaryState).toBeDefined();
      expect(event.relativeState).toBeDefined();
    });

    it('should preserve TCA from CDM', () => {
      const parsed = CdmParser.parse(validCdmContent);
      const event = CdmParser.toConjunctionEvent(parsed);

      expect(event.tca.toString()).toContain('2025-01-20');
    });

    it('should preserve Pc from CDM', () => {
      const parsed = CdmParser.parse(validCdmContent);
      const event = CdmParser.toConjunctionEvent(parsed);

      expect(event.probabilityOfCollision).toBe(1.5e-5);
    });

    it('should preserve relative position components from CDM', () => {
      const parsed = CdmParser.parse(validCdmContent);
      const event = CdmParser.toConjunctionEvent(parsed);

      expect(event.radialDistance).toBe(0.1);
      expect(event.intrackDistance).toBe(0.3);
      expect(event.crosstrackDistance).toBe(0.35);
    });

    it('should create combined covariance when both objects have covariance', () => {
      const parsed = CdmParser.parse(validCdmContent);
      const event = CdmParser.toConjunctionEvent(parsed);

      expect(event.combinedCovariance).toBeDefined();
    });

    it('should handle minimal CDM without optional fields', () => {
      const parsed = CdmParser.parse(minimalCdmContent);
      const event = CdmParser.toConjunctionEvent(parsed);

      expect(event).toBeDefined();
      expect(event.missDistance).toBe(1.0);
      expect(event.probabilityOfCollision).toBeUndefined();
    });
  });
});
