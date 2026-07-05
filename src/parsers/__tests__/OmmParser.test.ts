import { OmmParser } from '../OmmParser';

describe('OmmParser', () => {
  // Sample OMM content following CCSDS 502.0-B-3 Section 4
  const sampleSgp4Omm = `CCSDS_OMM_VERS = 3.0
COMMENT This is a test OMM
CREATION_DATE = 2024-01-15T12:00:00
ORIGINATOR = TEST
OBJECT_NAME = ISS (ZARYA)
OBJECT_ID = 1998-067A
CENTER_NAME = EARTH
REF_FRAME = TEME
TIME_SYSTEM = UTC
MEAN_ELEMENT_THEORY = SGP4
COMMENT Mean elements epoch
EPOCH = 2024-01-15T12:00:00.000
MEAN_MOTION = 15.49560532
ECCENTRICITY = 0.0006703
INCLINATION = 51.6461
RA_OF_ASC_NODE = 304.2523
ARG_OF_PERICENTER = 126.1490
MEAN_ANOMALY = 328.9436
EPHEMERIS_TYPE = 0
CLASSIFICATION_TYPE = U
NORAD_CAT_ID = 25544
ELEMENT_SET_NO = 999
REV_AT_EPOCH = 43150
BSTAR = 0.000036771
MEAN_MOTION_DOT = 0.00001506
MEAN_MOTION_DDOT = 0
`;

  const sampleDsstOmm = `CCSDS_OMM_VERS = 3.0
CREATION_DATE = 2024-02-01T00:00:00
ORIGINATOR = CNES
OBJECT_NAME = SPOT 5
OBJECT_ID = 2002-021A
CENTER_NAME = EARTH
REF_FRAME = EME2000
TIME_SYSTEM = UTC
MEAN_ELEMENT_THEORY = DSST
EPOCH = 2024-02-01T00:00:00.000
SEMI_MAJOR_AXIS = 7200.0
ECCENTRICITY = 0.001
INCLINATION = 98.7
RA_OF_ASC_NODE = 45.0
ARG_OF_PERICENTER = 90.0
MEAN_ANOMALY = 270.0
GM = 398600.4418
`;

  const fullOmmWithCovariance = `CCSDS_OMM_VERS = 3.0
CREATION_DATE = 2024-03-01T00:00:00
ORIGINATOR = GSFC
MESSAGE_ID = OMM-2024-001
CLASSIFICATION = SBU
OBJECT_NAME = GPS BIIR-2
OBJECT_ID = 1997-035A
CENTER_NAME = EARTH
REF_FRAME = TEME
TIME_SYSTEM = UTC
MEAN_ELEMENT_THEORY = SGP4
EPOCH = 2024-03-01T12:00:00.000
MEAN_MOTION = 2.00563985
ECCENTRICITY = 0.0045231
INCLINATION = 55.5
RA_OF_ASC_NODE = 120.0
ARG_OF_PERICENTER = 45.0
MEAN_ANOMALY = 315.0
MASS = 1860.0
SOLAR_RAD_AREA = 15.0
SOLAR_RAD_COEFF = 1.2
DRAG_AREA = 10.0
DRAG_COEFF = 2.2
EPHEMERIS_TYPE = 0
CLASSIFICATION_TYPE = U
NORAD_CAT_ID = 24876
ELEMENT_SET_NO = 500
REV_AT_EPOCH = 5000
BSTAR = 0.00001
MEAN_MOTION_DOT = 0.0
MEAN_MOTION_DDOT = 0.0
COV_REF_FRAME = TEME
CX_X = 3.331349476038534e-04
CY_X = 4.618927349220216e-04
CY_Y = 6.782421679971363e-04
CZ_X = -3.070007847730449e-04
CZ_Y = -4.221234189514228e-04
CZ_Z = 3.231931992380369e-04
CX_DOT_X = -3.349365033922630e-07
CX_DOT_Y = -4.686084221046758e-07
CX_DOT_Z = 2.484949578400095e-07
CX_DOT_X_DOT = 4.296022805587290e-10
CY_DOT_X = -2.211832501084875e-07
CY_DOT_Y = -2.864186892102733e-07
CY_DOT_Z = 1.798098699846038e-07
CY_DOT_X_DOT = 2.608899201686016e-10
CY_DOT_Y_DOT = 1.767514756338532e-10
CZ_DOT_X = -3.041346050686871e-07
CZ_DOT_Y = -4.989496988610662e-07
CZ_DOT_Z = 3.540310904497689e-07
CZ_DOT_X_DOT = 1.869263192954590e-10
CZ_DOT_Y_DOT = 1.008862586240695e-10
CZ_DOT_Z_DOT = 6.224444338635500e-10
USER_DEFINED_EARTH_MODEL = WGS-84
USER_DEFINED_ATMOSPHERIC_MODEL = NRLMSISE-00
`;

  describe('parse', () => {
    it('should parse a valid SGP4 OMM', () => {
      const result = OmmParser.parse(sampleSgp4Omm);

      expect(result.header.CCSDS_OMM_VERS).toBe('3.0');
      expect(result.header.CREATION_DATE).toBe('2024-01-15T12:00:00');
      expect(result.header.ORIGINATOR).toBe('TEST');
      expect(result.header.COMMENT).toEqual(['This is a test OMM']);

      expect(result.metadata.OBJECT_NAME).toBe('ISS (ZARYA)');
      expect(result.metadata.OBJECT_ID).toBe('1998-067A');
      expect(result.metadata.CENTER_NAME).toBe('EARTH');
      expect(result.metadata.REF_FRAME).toBe('TEME');
      expect(result.metadata.TIME_SYSTEM).toBe('UTC');
      expect(result.metadata.MEAN_ELEMENT_THEORY).toBe('SGP4');

      expect(result.meanElements.EPOCH).toBe('2024-01-15T12:00:00.000');
      expect(result.meanElements.MEAN_MOTION).toBe(15.49560532);
      expect(result.meanElements.ECCENTRICITY).toBe(0.0006703);
      expect(result.meanElements.INCLINATION).toBe(51.6461);
      expect(result.meanElements.RA_OF_ASC_NODE).toBe(304.2523);
      expect(result.meanElements.ARG_OF_PERICENTER).toBe(126.1490);
      expect(result.meanElements.MEAN_ANOMALY).toBe(328.9436);
      expect(result.meanElements.SEMI_MAJOR_AXIS).toBeUndefined();
    });

    it('should parse TLE parameters for SGP4 OMM', () => {
      const result = OmmParser.parse(sampleSgp4Omm);

      expect(result.tleParameters).toBeDefined();
      expect(result.tleParameters!.EPHEMERIS_TYPE).toBe(0);
      expect(result.tleParameters!.CLASSIFICATION_TYPE).toBe('U');
      expect(result.tleParameters!.NORAD_CAT_ID).toBe(25544);
      expect(result.tleParameters!.ELEMENT_SET_NO).toBe(999);
      expect(result.tleParameters!.REV_AT_EPOCH).toBe(43150);
      expect(result.tleParameters!.BSTAR).toBe(0.000036771);
      expect(result.tleParameters!.MEAN_MOTION_DOT).toBe(0.00001506);
      expect(result.tleParameters!.MEAN_MOTION_DDOT).toBe(0);
    });

    it('should parse a DSST OMM with SEMI_MAJOR_AXIS', () => {
      const result = OmmParser.parse(sampleDsstOmm);

      expect(result.metadata.MEAN_ELEMENT_THEORY).toBe('DSST');
      expect(result.metadata.REF_FRAME).toBe('EME2000');
      expect(result.meanElements.SEMI_MAJOR_AXIS).toBe(7200.0);
      expect(result.meanElements.MEAN_MOTION).toBeUndefined();
      expect(result.meanElements.GM).toBe(398600.4418);
      expect(result.tleParameters).toBeUndefined();
    });

    it('should parse full OMM with covariance matrix', () => {
      const result = OmmParser.parse(fullOmmWithCovariance);

      expect(result.header.MESSAGE_ID).toBe('OMM-2024-001');
      expect(result.header.CLASSIFICATION).toBe('SBU');

      expect(result.spacecraftParameters).toBeDefined();
      expect(result.spacecraftParameters!.MASS).toBe(1860.0);
      expect(result.spacecraftParameters!.SOLAR_RAD_AREA).toBe(15.0);
      expect(result.spacecraftParameters!.SOLAR_RAD_COEFF).toBe(1.2);
      expect(result.spacecraftParameters!.DRAG_AREA).toBe(10.0);
      expect(result.spacecraftParameters!.DRAG_COEFF).toBe(2.2);

      expect(result.covarianceMatrix).toBeDefined();
      expect(result.covarianceMatrix!.COV_REF_FRAME).toBe('TEME');
      expect(result.covarianceMatrix!.CX_X).toBeCloseTo(3.331349476038534e-04);
      expect(result.covarianceMatrix!.CZ_DOT_Z_DOT).toBeCloseTo(6.224444338635500e-10);
    });

    it('should parse user-defined parameters', () => {
      const result = OmmParser.parse(fullOmmWithCovariance);

      expect(result.userDefined).toBeDefined();
      expect(result.userDefined!.USER_DEFINED_EARTH_MODEL).toBe('WGS-84');
      expect(result.userDefined!.USER_DEFINED_ATMOSPHERIC_MODEL).toBe('NRLMSISE-00');
    });

    it('should handle CRLF line endings', () => {
      const crlfContent = sampleSgp4Omm.replace(/\n/gu, '\r\n');
      const result = OmmParser.parse(crlfContent);

      expect(result.header.CCSDS_OMM_VERS).toBe('3.0');
      expect(result.meanElements.MEAN_MOTION).toBe(15.49560532);
    });
  });

  describe('isTleCompatible', () => {
    it('should return true for SGP4 theory', () => {
      const result = OmmParser.parse(sampleSgp4Omm);

      expect(OmmParser.isTleCompatible(result)).toBe(true);
    });

    it('should return false for DSST theory', () => {
      const result = OmmParser.parse(sampleDsstOmm);

      expect(OmmParser.isTleCompatible(result)).toBe(false);
    });
  });

  describe('validation errors', () => {
    it('should throw on missing CCSDS_OMM_VERS', () => {
      const content = `CREATION_DATE = 2024-01-01
ORIGINATOR = TEST
OBJECT_NAME = SAT
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = EME2000
TIME_SYSTEM = UTC
MEAN_ELEMENT_THEORY = DSST
EPOCH = 2024-01-01T00:00:00
SEMI_MAJOR_AXIS = 7000.0
ECCENTRICITY = 0.001
INCLINATION = 98.0
RA_OF_ASC_NODE = 0.0
ARG_OF_PERICENTER = 0.0
MEAN_ANOMALY = 0.0
`;

      expect(() => OmmParser.parse(content)).toThrow('CCSDS_OMM_VERS');
    });

    it('should throw on missing OBJECT_NAME', () => {
      const content = `CCSDS_OMM_VERS = 3.0
CREATION_DATE = 2024-01-01
ORIGINATOR = TEST
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = EME2000
TIME_SYSTEM = UTC
MEAN_ELEMENT_THEORY = DSST
EPOCH = 2024-01-01T00:00:00
SEMI_MAJOR_AXIS = 7000.0
ECCENTRICITY = 0.001
INCLINATION = 98.0
RA_OF_ASC_NODE = 0.0
ARG_OF_PERICENTER = 0.0
MEAN_ANOMALY = 0.0
`;

      expect(() => OmmParser.parse(content)).toThrow('OBJECT_NAME');
    });

    it('should throw on missing both SEMI_MAJOR_AXIS and MEAN_MOTION', () => {
      const content = `CCSDS_OMM_VERS = 3.0
CREATION_DATE = 2024-01-01
ORIGINATOR = TEST
OBJECT_NAME = SAT
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = EME2000
TIME_SYSTEM = UTC
MEAN_ELEMENT_THEORY = DSST
EPOCH = 2024-01-01T00:00:00
ECCENTRICITY = 0.001
INCLINATION = 98.0
RA_OF_ASC_NODE = 0.0
ARG_OF_PERICENTER = 0.0
MEAN_ANOMALY = 0.0
`;

      expect(() => OmmParser.parse(content)).toThrow('SEMI_MAJOR_AXIS or MEAN_MOTION');
    });

    it('should throw when SGP4 OMM uses wrong CENTER_NAME', () => {
      const content = `CCSDS_OMM_VERS = 3.0
CREATION_DATE = 2024-01-01
ORIGINATOR = TEST
OBJECT_NAME = SAT
OBJECT_ID = 2024-001A
CENTER_NAME = MARS
REF_FRAME = TEME
TIME_SYSTEM = UTC
MEAN_ELEMENT_THEORY = SGP4
EPOCH = 2024-01-01T00:00:00
MEAN_MOTION = 15.0
ECCENTRICITY = 0.001
INCLINATION = 51.0
RA_OF_ASC_NODE = 0.0
ARG_OF_PERICENTER = 0.0
MEAN_ANOMALY = 0.0
`;

      expect(() => OmmParser.parse(content)).toThrow('CENTER_NAME must be EARTH');
    });

    it('should throw when SGP4 OMM uses wrong REF_FRAME', () => {
      const content = `CCSDS_OMM_VERS = 3.0
CREATION_DATE = 2024-01-01
ORIGINATOR = TEST
OBJECT_NAME = SAT
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = EME2000
TIME_SYSTEM = UTC
MEAN_ELEMENT_THEORY = SGP4
EPOCH = 2024-01-01T00:00:00
MEAN_MOTION = 15.0
ECCENTRICITY = 0.001
INCLINATION = 51.0
RA_OF_ASC_NODE = 0.0
ARG_OF_PERICENTER = 0.0
MEAN_ANOMALY = 0.0
`;

      expect(() => OmmParser.parse(content)).toThrow('REF_FRAME must be TEME');
    });

    it('should throw on invalid numeric value', () => {
      const content = `CCSDS_OMM_VERS = 3.0
CREATION_DATE = 2024-01-01
ORIGINATOR = TEST
OBJECT_NAME = SAT
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = EME2000
TIME_SYSTEM = UTC
MEAN_ELEMENT_THEORY = DSST
EPOCH = 2024-01-01T00:00:00
SEMI_MAJOR_AXIS = 7000.0
ECCENTRICITY = not_a_number
INCLINATION = 98.0
RA_OF_ASC_NODE = 0.0
ARG_OF_PERICENTER = 0.0
MEAN_ANOMALY = 0.0
`;

      expect(() => OmmParser.parse(content)).toThrow('Invalid numeric value for ECCENTRICITY');
    });

    it('should throw on incomplete covariance matrix', () => {
      const content = `CCSDS_OMM_VERS = 3.0
CREATION_DATE = 2024-01-01
ORIGINATOR = TEST
OBJECT_NAME = SAT
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = EME2000
TIME_SYSTEM = UTC
MEAN_ELEMENT_THEORY = DSST
EPOCH = 2024-01-01T00:00:00
SEMI_MAJOR_AXIS = 7000.0
ECCENTRICITY = 0.001
INCLINATION = 98.0
RA_OF_ASC_NODE = 0.0
ARG_OF_PERICENTER = 0.0
MEAN_ANOMALY = 0.0
CX_X = 1.0e-04
CY_X = 2.0e-04
CY_Y = 3.0e-04
`;

      expect(() => OmmParser.parse(content)).toThrow('Incomplete covariance matrix');
    });
  });

  describe('comment handling', () => {
    it('should parse comments in header', () => {
      const result = OmmParser.parse(sampleSgp4Omm);

      expect(result.header.COMMENT).toContain('This is a test OMM');
    });

    it('should parse comments before mean elements', () => {
      const result = OmmParser.parse(sampleSgp4Omm);

      expect(result.meanElements.COMMENT).toContain('Mean elements epoch');
    });
  });
});
