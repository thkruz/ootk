import { OmmDataFormat } from '../../interfaces/OmmFormat';
import { Satellite } from '../Satellite';

const baseOmm = {
  OBJECT_NAME: 'TEST SAT',
  OBJECT_ID: '2024-001A',
  EPOCH: '2024-01-12T10:48:42.611488',
  MEAN_MOTION: 15.5,
  ECCENTRICITY: 0.0001137,
  INCLINATION: 51.6415,
  RA_OF_ASC_NODE: 161.8339,
  ARG_OF_PERICENTER: 35.9781,
  MEAN_ANOMALY: 54.7009,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 1,
  BSTAR: 0.00003879,
  MEAN_MOTION_DOT: 0,
  MEAN_MOTION_DDOT: 0,
} satisfies Omit<OmmDataFormat, 'NORAD_CAT_ID'>;

describe('Satellite.fromOmm', () => {
  it('populates sccNum/sccNum5/sccNum6 for a standard 5-digit ID', () => {
    const sat = Satellite.fromOmm({ ...baseOmm, NORAD_CAT_ID: '25544' });

    expect(sat.sccNum).toBe('25544');
    expect(sat.sccNum5).toBe('25544');
    expect(sat.sccNum6).toBe('25544');
  });

  it('populates sccNum5/sccNum6 for an alpha-5-range 6-digit ID', () => {
    const sat = Satellite.fromOmm({ ...baseOmm, NORAD_CAT_ID: '123456' });

    expect(sat.sccNum).toBe('123456');
    expect(sat.sccNum5).toBe('C3456');
    expect(sat.sccNum6).toBe('123456');
  });

  it('preserves the canonical 9-digit ID and emits null for alpha-5 forms', () => {
    const sat = Satellite.fromOmm({ ...baseOmm, NORAD_CAT_ID: '799500766' });

    expect(sat.sccNum).toBe('799500766');
    expect(sat.sccNum5).toBeNull();
    expect(sat.sccNum6).toBeNull();
  });

  it('writes the truncated last-5 digits into TLE cols 3-7 for extended IDs', () => {
    const sat = Satellite.fromOmm({ ...baseOmm, NORAD_CAT_ID: '799500766' });

    expect(sat.tle1.substring(2, 7)).toBe('00766');
    expect(sat.tle2.substring(2, 7)).toBe('00766');
  });

  it('accepts NORAD_CAT_ID as a number', () => {
    const sat = Satellite.fromOmm({ ...baseOmm, NORAD_CAT_ID: 799500766 });

    expect(sat.sccNum).toBe('799500766');
    expect(sat.sccNum5).toBeNull();
  });
});
