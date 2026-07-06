import { InterpolatorType } from '../../objects/InterpolatorType';
import { OemParser } from '../OemParser';
import type { OemMetadata } from '../OemTypes';

describe('OemParser', () => {
  // Sample OEM content following CCSDS 502.0-B-3 format
  const sampleOemContent = `CCSDS_OEM_VERS = 2.0
CREATION_DATE = 2024-01-01T00:00:00
ORIGINATOR = TEST
COMMENT This is a test OEM file

META_START
OBJECT_NAME = ISS
OBJECT_ID = 1998-067A
CENTER_NAME = EARTH
REF_FRAME = J2000
TIME_SYSTEM = UTC
START_TIME = 2024-01-01T00:00:00.000
USEABLE_START_TIME = 2024-01-01T00:00:00.000
USEABLE_STOP_TIME = 2024-01-01T00:10:00.000
STOP_TIME = 2024-01-01T00:10:00.000
INTERPOLATION = LAGRANGE
INTERPOLATION_DEGREE = 8
META_STOP

DATA_START
2024-01-01T00:00:00.000 6878.137 0.0 0.0 0.0 7.612 0.0
2024-01-01T00:05:00.000 6000.0 3000.0 1000.0 -2.0 6.0 1.0
2024-01-01T00:10:00.000 4000.0 5000.0 2000.0 -4.0 4.0 2.0
DATA_STOP
`;

  const minimalOemContent = `CCSDS_OEM_VERS = 2.0
CREATION_DATE = 2024-01-01

META_START
OBJECT_NAME = SAT
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = J2000
TIME_SYSTEM = UTC
META_STOP

DATA_START
2024-01-01T00:00:00.000 6878.137 0.0 0.0 0.0 7.612 0.0
DATA_STOP
`;

  const multiBlockOemContent = `CCSDS_OEM_VERS = 2.0
CREATION_DATE = 2024-01-01

META_START
OBJECT_NAME = SAT1
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = J2000
TIME_SYSTEM = UTC
META_STOP

DATA_START
2024-01-01T00:00:00.000 6878.137 0.0 0.0 0.0 7.612 0.0
DATA_STOP

META_START
OBJECT_NAME = SAT2
OBJECT_ID = 2024-002A
CENTER_NAME = MOON
REF_FRAME = TEME
TIME_SYSTEM = UTC
META_STOP

DATA_START
2024-01-02T00:00:00.000 1737.4 0.0 0.0 0.0 1.68 0.0
DATA_STOP
`;

  describe('parse', () => {
    it('should parse valid OEM content', () => {
      const parsed = OemParser.parse(sampleOemContent);

      expect(parsed).toBeDefined();
      expect(parsed.header).toBeDefined();
      expect(parsed.dataBlocks).toBeDefined();
      expect(parsed.dataBlocks.length).toBe(1);
    });

    it('should parse header fields', () => {
      const parsed = OemParser.parse(sampleOemContent);

      expect(parsed.header.CCSDS_OEM_VERS).toBe('2.0');
      expect(parsed.header.CREATION_DATE).toBe('2024-01-01T00:00:00');
      expect(parsed.header.ORIGINATOR).toBe('TEST');
      expect(parsed.header.COMMENT).toContain('This is a test OEM file');
    });

    it('should parse metadata', () => {
      const parsed = OemParser.parse(sampleOemContent);
      const metadata = parsed.dataBlocks[0].metadata;

      expect(metadata.OBJECT_NAME).toBe('ISS');
      expect(metadata.OBJECT_ID).toBe('1998-067A');
      expect(metadata.CENTER_NAME).toBe('EARTH');
      expect(metadata.REF_FRAME).toBe('J2000');
      expect(metadata.INTERPOLATION).toBe('LAGRANGE');
      expect(metadata.INTERPOLATION_DEGREE).toBe(8);
    });

    it('should parse ephemeris data', () => {
      const parsed = OemParser.parse(sampleOemContent);
      const ephemeris = parsed.dataBlocks[0].ephemeris;

      expect(ephemeris.length).toBe(3);
      expect(ephemeris[0].position.x).toBeCloseTo(6878.137, 3);
      expect(ephemeris[0].velocity.y).toBeCloseTo(7.612, 3);
    });

    it('should parse multiple data blocks', () => {
      const parsed = OemParser.parse(multiBlockOemContent);

      expect(parsed.dataBlocks.length).toBe(2);
      expect(parsed.dataBlocks[0].metadata.OBJECT_NAME).toBe('SAT1');
      expect(parsed.dataBlocks[1].metadata.OBJECT_NAME).toBe('SAT2');
      expect(parsed.dataBlocks[1].metadata.CENTER_NAME).toBe('MOON');
    });

    it('should throw error for empty file', () => {
      expect(() => OemParser.parse('')).toThrow('OEM file contains no data blocks');
    });

    it('should throw error for file with no data blocks', () => {
      const noDataContent = `CCSDS_OEM_VERS = 2.0
CREATION_DATE = 2024-01-01
`;

      expect(() => OemParser.parse(noDataContent)).toThrow('OEM file contains no data blocks');
    });

    it('should handle minimal OEM content', () => {
      const parsed = OemParser.parse(minimalOemContent);

      expect(parsed.dataBlocks.length).toBe(1);
      expect(parsed.dataBlocks[0].ephemeris.length).toBe(1);
    });

    it('should handle Windows line endings', () => {
      const windowsContent = sampleOemContent.replace(/\n/gu, '\r\n');
      const parsed = OemParser.parse(windowsContent);

      expect(parsed.dataBlocks.length).toBe(1);
      expect(parsed.dataBlocks[0].ephemeris.length).toBe(3);
    });

    it('should skip malformed ephemeris lines', () => {
      const contentWithBadLine = `CCSDS_OEM_VERS = 2.0
META_START
OBJECT_NAME = SAT
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = J2000
TIME_SYSTEM = UTC
META_STOP
DATA_START
2024-01-01T00:00:00.000 6878.137 0.0 0.0 0.0 7.612 0.0
malformed line that should be skipped
2024-01-01T00:05:00.000 6000.0 3000.0 1000.0 -2.0 6.0 1.0
DATA_STOP
`;
      const parsed = OemParser.parse(contentWithBadLine);

      expect(parsed.dataBlocks[0].ephemeris.length).toBe(2);
    });
  });

  describe('getRecommendedInterpolator', () => {
    const baseMetadata = {
      OBJECT_NAME: 'test',
      OBJECT_ID: 'test',
      CENTER_NAME: 'EARTH',
      REF_FRAME: 'J2000',
      TIME_SYSTEM: 'UTC',
      START_TIME: '2024-01-01T00:00:00',
      STOP_TIME: '2024-01-01T01:00:00',
    };

    it('should return LAGRANGE for Lagrange interpolation', () => {
      const metadata: OemMetadata = {
        ...baseMetadata,
        INTERPOLATION: 'LAGRANGE',
      };

      expect(OemParser.getRecommendedInterpolator(metadata)).toBe(InterpolatorType.LAGRANGE);
    });

    it('should return LAGRANGE for lowercase lagrange', () => {
      const metadata: OemMetadata = {
        ...baseMetadata,
        INTERPOLATION: 'lagrange',
      };

      expect(OemParser.getRecommendedInterpolator(metadata)).toBe(InterpolatorType.LAGRANGE);
    });

    it('should return CUBIC_SPLINE for Hermite interpolation', () => {
      const metadata: OemMetadata = {
        ...baseMetadata,
        INTERPOLATION: 'HERMITE',
      };

      expect(OemParser.getRecommendedInterpolator(metadata)).toBe(InterpolatorType.CUBIC_SPLINE);
    });

    it('should return CHEBYSHEV for Chebyshev interpolation', () => {
      const metadata: OemMetadata = {
        ...baseMetadata,
        INTERPOLATION: 'CHEBYSHEV',
      };

      expect(OemParser.getRecommendedInterpolator(metadata)).toBe(InterpolatorType.CHEBYSHEV);
    });

    it('should return LAGRANGE for undefined interpolation', () => {
      const metadata: OemMetadata = {
        ...baseMetadata,
      };

      expect(OemParser.getRecommendedInterpolator(metadata)).toBe(InterpolatorType.LAGRANGE);
    });

    it('should return LAGRANGE for unknown interpolation type', () => {
      const metadata: OemMetadata = {
        ...baseMetadata,
        INTERPOLATION: 'UNKNOWN_TYPE',
      };

      expect(OemParser.getRecommendedInterpolator(metadata)).toBe(InterpolatorType.LAGRANGE);
    });
  });

  describe('getInterpolationOrder', () => {
    const baseMetadata = {
      OBJECT_NAME: 'test',
      OBJECT_ID: 'test',
      CENTER_NAME: 'EARTH',
      REF_FRAME: 'J2000',
      TIME_SYSTEM: 'UTC',
      START_TIME: '2024-01-01T00:00:00',
      STOP_TIME: '2024-01-01T01:00:00',
    };

    it('should return specified degree', () => {
      const metadata: OemMetadata = {
        ...baseMetadata,
        INTERPOLATION_DEGREE: 8,
      };

      expect(OemParser.getInterpolationOrder(metadata)).toBe(8);
    });

    it('should return default of 10 when not specified', () => {
      const metadata: OemMetadata = {
        ...baseMetadata,
      };

      expect(OemParser.getInterpolationOrder(metadata)).toBe(10);
    });
  });

  describe('TEME reference frame', () => {
    it('should parse TEME reference frame', () => {
      const temeContent = `CCSDS_OEM_VERS = 2.0

META_START
OBJECT_NAME = SAT
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = TEME
TIME_SYSTEM = UTC
META_STOP

DATA_START
2024-01-01T00:00:00.000 6878.137 0.0 0.0 0.0 7.612 0.0
DATA_STOP
`;
      const parsed = OemParser.parse(temeContent);

      expect(parsed.dataBlocks[0].metadata.REF_FRAME).toBe('TEME');
    });
  });

  describe('covariance data', () => {
    it('should handle covariance blocks without crashing', () => {
      const contentWithCovariance = `CCSDS_OEM_VERS = 2.0

META_START
OBJECT_NAME = SAT
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = J2000
TIME_SYSTEM = UTC
META_STOP

DATA_START
2024-01-01T00:00:00.000 6878.137 0.0 0.0 0.0 7.612 0.0

COVARIANCE_START
EPOCH = 2024-01-01T00:00:00.000
1.0e-6
2.0e-6 3.0e-6
COVARIANCE_STOP

DATA_STOP
`;
      const parsed = OemParser.parse(contentWithCovariance);

      expect(parsed.dataBlocks.length).toBe(1);
      expect(parsed.dataBlocks[0].ephemeris.length).toBe(1);
      // Covariance is stored but processing is deferred
      expect(parsed.dataBlocks[0].covariance).toBeDefined();
    });
  });

  describe('comments', () => {
    it('should parse header comments', () => {
      const parsed = OemParser.parse(sampleOemContent);

      expect(parsed.header.COMMENT).toBeDefined();
      expect(parsed.header.COMMENT).toContain('This is a test OEM file');
    });

    it('should handle metadata comments with equals sign', () => {
      // Note: The current parser requires COMMENT = format for metadata comments
      // The parser captures everything after 'COMMENT' (7 chars) when using = format
      const contentWithMetaComment = `CCSDS_OEM_VERS = 2.0

META_START
COMMENT = This is a metadata comment
OBJECT_NAME = SAT
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = J2000
TIME_SYSTEM = UTC
META_STOP

DATA_START
2024-01-01T00:00:00.000 6878.137 0.0 0.0 0.0 7.612 0.0
DATA_STOP
`;
      const parsed = OemParser.parse(contentWithMetaComment);

      expect(parsed.dataBlocks[0].metadata.COMMENT).toBeDefined();
      // Parser includes the '=' in the comment due to substring(7)
      expect(parsed.dataBlocks[0].metadata.COMMENT![0]).toContain('metadata comment');
    });
  });

  describe('edge cases', () => {
    it('should handle extra whitespace', () => {
      const contentWithWhitespace = `CCSDS_OEM_VERS = 2.0

META_START
OBJECT_NAME   =   SAT WITH SPACES
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = J2000
TIME_SYSTEM = UTC
META_STOP

DATA_START
2024-01-01T00:00:00.000    6878.137    0.0    0.0    0.0    7.612    0.0
DATA_STOP
`;
      const parsed = OemParser.parse(contentWithWhitespace);

      expect(parsed.dataBlocks[0].metadata.OBJECT_NAME).toBe('SAT WITH SPACES');
      expect(parsed.dataBlocks[0].ephemeris.length).toBe(1);
    });

    it('should handle different center bodies', () => {
      const marsContent = `CCSDS_OEM_VERS = 2.0

META_START
OBJECT_NAME = MAVEN
OBJECT_ID = 2013-063A
CENTER_NAME = MARS
REF_FRAME = J2000
TIME_SYSTEM = UTC
META_STOP

DATA_START
2024-01-01T00:00:00.000 3396.2 0.0 0.0 0.0 3.55 0.0
DATA_STOP
`;
      const parsed = OemParser.parse(marsContent);

      expect(parsed.dataBlocks[0].metadata.CENTER_NAME).toBe('MARS');
    });
  });
});
