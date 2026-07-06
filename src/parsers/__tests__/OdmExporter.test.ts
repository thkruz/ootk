/**
 * @file OdmExporter test suite
 * @description Tests for CCSDS ODM (OPM/OEM/OMM) KVN format export
 */

import { OdmExporter, Satellite, TleLine1, TleLine2 } from '../../main';

const issTle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
const issTle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

const geoTle1 = '1 41866U 16071A   22203.00000000  .00000000  00000+0  00000+0 0  9999' as TleLine1;
const geoTle2 = '2 41866   0.0100 267.4000 0000500 270.0000  90.0000  1.00270000    00' as TleLine2;

const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
const geo = new Satellite({ tle1: geoTle1, tle2: geoTle2 });

const epoch = new Date(Date.UTC(2022, 6, 22, 11, 0, 0));

/** Count the ephemeris data lines (those starting with an ISO datetime). */
const countEphemerisLines = (kvn: string): number =>
  kvn.split('\n').filter((line) => (/^\d{4}-\d{2}-\d{2}T/u).test(line)).length;

describe('OdmExporter.formatOpm', () => {
  it('emits a valid OPM header, TEME metadata, and a state vector', () => {
    const opm = OdmExporter.formatOpm(iss, epoch);

    expect(opm.startsWith('CCSDS_OPM_VERS = 2.0')).toBe(true);
    expect(opm).toContain('ORIGINATOR = KeepTrack');
    expect(opm).toContain('META_START');
    expect(opm).toContain('REF_FRAME = TEME');
    expect(opm).toContain('TIME_SYSTEM = UTC');
    expect(opm).toMatch(/\nX = -?\d/u);
    expect(opm).toMatch(/\nX_DOT = -?\d/u);
  });

  it('includes the Keplerian block only when requested', () => {
    expect(OdmExporter.formatOpm(iss, epoch)).not.toContain('SEMI_MAJOR_AXIS');

    const withKeplerian = OdmExporter.formatOpm(iss, epoch, { includeKeplerian: true });

    expect(withKeplerian).toContain('SEMI_MAJOR_AXIS');
    expect(withKeplerian).toContain('ECCENTRICITY');
    expect(withKeplerian).toContain('TRUE_ANOMALY');
  });

  it('honors the EME2000 reference frame option', () => {
    const opm = OdmExporter.formatOpm(iss, epoch, { refFrame: 'EME2000' });

    expect(opm).toContain('REF_FRAME = EME2000');
  });

  it('respects a custom originator and emitted comments', () => {
    const opm = OdmExporter.formatOpm(iss, epoch, { originator: 'ACME', comments: ['hello'] });

    expect(opm).toContain('ORIGINATOR = ACME');
    expect(opm).toContain('COMMENT hello');
  });
});

describe('OdmExporter.formatOem', () => {
  it('emits an OEM header, span metadata, and one line per sample', () => {
    const oem = OdmExporter.formatOem(iss, epoch, 1, 600);

    expect(oem.startsWith('CCSDS_OEM_VERS = 2.0')).toBe(true);
    expect(oem).toContain('START_TIME = ');
    expect(oem).toContain('STOP_TIME = ');
    expect(oem).toContain('INTERPOLATION = LAGRANGE');
    // 1 hour / 600s = 6 intervals + 1 sample.
    expect(countEphemerisLines(oem)).toBe(7);
  });
});

describe('OdmExporter.formatOmm', () => {
  it('emits mean elements and TLE-derived parameters', () => {
    const omm = OdmExporter.formatOmm(iss);

    expect(omm.startsWith('CCSDS_OMM_VERS = 2.0')).toBe(true);
    expect(omm).toContain('MEAN_ELEMENT_THEORY = SGP4');
    expect(omm).toContain(`NORAD_CAT_ID = ${iss.sccNum}`);
    expect(omm).toContain('MEAN_MOTION = ');
    expect(omm).toContain('BSTAR = ');
    expect(omm).toContain('REV_AT_EPOCH = ');
  });
});

describe('OdmExporter.formatOmmCatalog', () => {
  it('concatenates one OMM block per satellite', () => {
    const catalog = OdmExporter.formatOmmCatalog([iss, geo]);

    const blocks = catalog.split('CCSDS_OMM_VERS = 2.0').length - 1;

    expect(blocks).toBe(2);
    expect(catalog).toContain(`NORAD_CAT_ID = ${iss.sccNum}`);
    expect(catalog).toContain(`NORAD_CAT_ID = ${geo.sccNum}`);
  });

  it('suffixes the message id per satellite when one is provided', () => {
    const catalog = OdmExporter.formatOmmCatalog([iss, geo], { messageId: 'BATCH' });

    expect(catalog).toContain('MESSAGE_ID = BATCH-1');
    expect(catalog).toContain('MESSAGE_ID = BATCH-2');
  });
});
