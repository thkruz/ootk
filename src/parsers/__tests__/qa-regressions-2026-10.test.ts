/**
 * QA 2026-10 regression tests: parsers (OEM, CDM, Horizons); also covers section 1 items 9 (CDM units) and 10 (OEM DATA_START).
 * Moved from test/qa/comm-parsers-utils.qa.test.ts (deep dive slice 2.7: comm, parsers, utils).
 *
 * Report: hq/reports/ootk-qa-deep-dive-2026-10-13.md
 *
 * Permanent regression tests for the v8 fixes of the defects cited in each
 * comment below. Do not loosen an assertion to make a test pass.
 */

import {
  CdmExporter,
  CdmParser,
  ConjunctionEvent,
  CovarianceFrame,
  EpochUTC,
  HorizonsParser,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Matrix,
  OdmExporter,
  OemParser,
  RIC,
  Satellite,
  StateCovariance,
  TleLine1,
  TleLine2,
  Vector3D,
} from '@src/main';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse an OEM and return the number of states per block, or [] if it throws. */
const oemStateCounts = (content: string): number[] => {
  try {
    return OemParser.parse(content).dataBlocks.map((b) => b.ephemeris.length);
  } catch {
    return [];
  }
};

const OEM_HEADER = [
  'CCSDS_OEM_VERS = 2.0',
  'CREATION_DATE = 2024-01-01T00:00:00',
  'ORIGINATOR = QA',
  '',
].join('\n');

const OEM_META = [
  'META_START',
  'OBJECT_NAME = QASAT',
  'OBJECT_ID = 2024-001A',
  'CENTER_NAME = EARTH',
  'REF_FRAME = EME2000',
  'TIME_SYSTEM = UTC',
  'START_TIME = 2024-01-01T00:00:00.000',
  'STOP_TIME = 2024-01-01T00:10:00.000',
  'META_STOP',
  '',
].join('\n');

const OEM_LINES = [
  '2024-01-01T00:00:00.000 6878.137 0.0 0.0 0.0 7.612 0.0',
  '2024-01-01T00:05:00.000 6000.0 3000.0 1000.0 -2.0 6.0 1.0',
  '2024-01-01T00:10:00.000 4000.0 5000.0 2000.0 -4.0 4.0 2.0',
].join('\n');

interface CdmObjectSpec {
  refFrame?: string;
  state: [number, number, number, number, number, number];
  /** Lower-triangular position covariance [CR_R, CT_R, CT_T, CN_R, CN_T, CN_N] in m**2. */
  pos?: [number, number, number, number, number, number];
  /** Velocity variances [CRDOT_RDOT, CTDOT_TDOT, CNDOT_NDOT] in m**2/s**2. */
  velVar?: [number, number, number];
}

/** Build a minimal CCSDS 508.0-B-1 CDM in KVN with SI (metre) relative data. */
const buildCdm = (opts: {
  missM?: number;
  speedMs?: number;
  obj1: CdmObjectSpec;
  obj2: CdmObjectSpec;
}): string => {
  const objBlock = (name: 'OBJECT1' | 'OBJECT2', designator: string, spec: CdmObjectSpec): string[] => {
    const [x, y, z, vx, vy, vz] = spec.state;
    const lines = [
      `OBJECT = ${name}`,
      `OBJECT_DESIGNATOR = ${designator}`,
      'CATALOG_NAME = SATCAT',
      `OBJECT_NAME = ${name}`,
      'INTERNATIONAL_DESIGNATOR = 2024-001A',
      'EPHEMERIS_NAME = NONE',
      'COVARIANCE_METHOD = CALCULATED',
      'MANEUVERABLE = NO',
      `REF_FRAME = ${spec.refFrame ?? 'EME2000'}`,
      `X = ${x} [km]`,
      `Y = ${y} [km]`,
      `Z = ${z} [km]`,
      `X_DOT = ${vx} [km/s]`,
      `Y_DOT = ${vy} [km/s]`,
      `Z_DOT = ${vz} [km/s]`,
    ];

    if (spec.pos) {
      const [crr, ctr, ctt, cnr, cnt, cnn] = spec.pos;

      lines.push(
        `CR_R = ${crr} [m**2]`,
        `CT_R = ${ctr} [m**2]`,
        `CT_T = ${ctt} [m**2]`,
        `CN_R = ${cnr} [m**2]`,
        `CN_T = ${cnt} [m**2]`,
        `CN_N = ${cnn} [m**2]`,
      );
    }
    if (spec.velVar) {
      lines.push(
        'CRDOT_R = 0 [m**2/s]',
        'CRDOT_T = 0 [m**2/s]',
        'CRDOT_N = 0 [m**2/s]',
        `CRDOT_RDOT = ${spec.velVar[0]} [m**2/s**2]`,
        'CTDOT_R = 0 [m**2/s]',
        'CTDOT_T = 0 [m**2/s]',
        'CTDOT_N = 0 [m**2/s]',
        'CTDOT_RDOT = 0 [m**2/s**2]',
        `CTDOT_TDOT = ${spec.velVar[1]} [m**2/s**2]`,
        'CNDOT_R = 0 [m**2/s]',
        'CNDOT_T = 0 [m**2/s]',
        'CNDOT_N = 0 [m**2/s]',
        'CNDOT_RDOT = 0 [m**2/s**2]',
        'CNDOT_TDOT = 0 [m**2/s**2]',
        `CNDOT_NDOT = ${spec.velVar[2]} [m**2/s**2]`,
      );
    }

    return lines;
  };

  return [
    'CCSDS_CDM_VERS = 1.0',
    'CREATION_DATE = 2025-01-19T12:00:00.000',
    'ORIGINATOR = QA',
    'MESSAGE_FOR = QASAT',
    'MESSAGE_ID = QA-001',
    '',
    'TCA = 2025-01-20T15:30:45.123',
    `MISS_DISTANCE = ${opts.missM ?? 715} [m]`,
    `RELATIVE_SPEED = ${opts.speedMs ?? 14000} [m/s]`,
    '',
    ...objBlock('OBJECT1', '11111', opts.obj1),
    '',
    ...objBlock('OBJECT2', '22222', opts.obj2),
    '',
  ].join('\n');
};

const LEO_EAST: [number, number, number, number, number, number] = [7000, 0, 0, 0, 7.5, 0];
const LEO_POLAR: [number, number, number, number, number, number] = [7000, 0, 0, 0, 0, 7.5];

// ---------------------------------------------------------------------------
// OEM parser (section 1 item 10, section 2.7)
// ---------------------------------------------------------------------------

describe('OemParser (QA 2026-10 regressions)', () => {
  /*
   * Report 1.10 (C). OemParser.ts:155-177 only reads data lines after DATA_START.
   * CCSDS 502.0-B-3 section 5.2 (KVN OEM): ephemeris data lines follow META_STOP
   * directly; DATA_START/DATA_STOP do not exist in OEM. Expected 1 block with
   * 3 states; actual: ParseError "OEM file contains no data blocks".
   */
  it('parses a spec-compliant OEM (no DATA_START) into one block of 3 states', () => {
    const oem = `${OEM_HEADER}\n${OEM_META}\n${OEM_LINES}\n`;

    expect(oemStateCounts(oem)).toEqual([3]);
  });

  /*
   * Report 1.10 (C). OdmExporter.formatOem output (OdmExporter.ts:260-300) has no
   * DATA_START, so ootk cannot read its own OEM. Expected 1 block of 7 states
   * (1 h at 600 s); actual: parse throws, 0 blocks.
   */
  it('round-trips OdmExporter.formatOem output through OemParser', () => {
    const iss = new Satellite({
      tle1: '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1,
      tle2: '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2,
    });
    const oem = OdmExporter.formatOem(iss, new Date(Date.UTC(2022, 6, 22, 11, 0, 0)), 1, 600);

    expect(oemStateCounts(oem)).toEqual([7]);
  });

  /*
   * Report 2.7 (C). OemParser.ts:158-163: a line "EPHEMERIS_DATA_BLOCK_STOP" also
   * matches the START regex /^EPHEMERIS_DATA_BLOCK/u which is tested first, so the
   * block never closes. Expected 1 block of 3 states; actual: no blocks (throws).
   */
  it('closes a block on EPHEMERIS_DATA_BLOCK_STOP', () => {
    const oem = `${OEM_HEADER}\n${OEM_META}\nEPHEMERIS_DATA_BLOCK_START\n${OEM_LINES}\nEPHEMERIS_DATA_BLOCK_STOP\n`;

    expect(oemStateCounts(oem)).toEqual([3]);
  });

  /*
   * Report 2.7 (C). OemParser.ts:~195 gates metadata parsing on line.includes('='),
   * so "COMMENT text" inside META_START/META_STOP is dropped.
   * Expected metadata.COMMENT = ['metadata note']; actual: undefined.
   */
  it('keeps COMMENT lines inside META_START/META_STOP in metadata.COMMENT', () => {
    const meta = OEM_META.replace('META_START\n', 'META_START\nCOMMENT metadata note\n');
    const oem = `${OEM_HEADER}\n${meta}\nDATA_START\n${OEM_LINES}\nDATA_STOP\n`;
    const parsed = OemParser.parse(oem);

    expect(parsed.dataBlocks[0].metadata.COMMENT).toEqual(['metadata note']);
  });

  /*
   * Report 2.7 (C). OemParser.ts:230-250 stores each covariance row as its own
   * "matrix" with epoch new Date(). CCSDS 502.0-B-3 section 5.2.5: one EPOCH plus
   * 21 lower-triangular values form one 6x6 covariance.
   * Expected 1 matrix of 21 values at 2024-01-01T00:00:00Z; actual: 6 rows.
   */
  it('assembles one 21-term covariance per EPOCH with the EPOCH as its time', () => {
    const cov = [
      'COVARIANCE_START',
      'EPOCH = 2024-01-01T00:00:00.000',
      'COV_REF_FRAME = RTN',
      '1.0',
      '0.1 2.0',
      '0.1 0.1 3.0',
      '0.0 0.0 0.0 0.01',
      '0.0 0.0 0.0 0.0 0.02',
      '0.0 0.0 0.0 0.0 0.0 0.03',
      'COVARIANCE_STOP',
    ].join('\n');
    const oem = `${OEM_HEADER}\n${OEM_META}\nDATA_START\n${OEM_LINES}\n${cov}\nDATA_STOP\n`;
    const block = OemParser.parse(oem).dataBlocks[0];

    expect(block.covariance?.length).toBe(1);
    expect(block.covariance?.[0].values.length).toBe(21);
    expect(block.covariance?.[0].epoch.getTime()).toBe(Date.UTC(2024, 0, 1));
  });

  /*
   * Report 2.7 (C). Day-of-year epochs (CCSDS 502.0-B-3 section 7.5.10,
   * "YYYY-DDDThh:mm:ss") go through new Date(), which yields NaN.
   * Expected 1 state at 2024-02-01T00:00:00Z (day 032); actual: the line is
   * silently dropped (0 states).
   */
  it('parses day-of-year epochs (YYYY-DDDThh:mm:ss)', () => {
    const oem = `${OEM_HEADER}\n${OEM_META}\nDATA_START\n2024-032T00:00:00.000 6878.137 0.0 0.0 0.0 7.612 0.0\nDATA_STOP\n`;
    const ephemeris = OemParser.parse(oem).dataBlocks[0].ephemeris;

    expect(ephemeris).toHaveLength(1);
    expect(ephemeris[0]?.epoch.toDateTime().getTime()).toBe(Date.UTC(2024, 1, 1));
  });
});

// ---------------------------------------------------------------------------
// CDM parser and exporter (section 1 item 9, section 2.7)
// ---------------------------------------------------------------------------

describe('CdmParser (QA 2026-10 regressions)', () => {
  const unitsCdm = buildCdm({
    missM: 715,
    speedMs: 14000,
    obj1: { state: LEO_EAST, pos: [1.0e6, 0, 1.0e6, 0, 0, 1.0e6] },
    obj2: { state: [7000.5, 0, 0, 0, 7.5, 0.01], pos: [0, 0, 0, 0, 0, 0] },
  });

  /*
   * Report 1.9 (C). CdmParser.ts parseRelativeData_ stores MISS_DISTANCE raw.
   * CCSDS 508.0-B-1 Table 3-2 / 4-4: MISS_DISTANCE unit is m.
   * Expected missDistance 0.715 km; actual 715 (treated as km).
   */
  it('converts MISS_DISTANCE [m] to km (715 m -> 0.715 km)', () => {
    const event = CdmParser.toConjunctionEvent(CdmParser.parse(unitsCdm));

    expect(event.missDistance).toBeCloseTo(0.715, 6);
  });

  /*
   * Report 1.9 (C). CCSDS 508.0-B-1 Table 3-2 / 4-4: RELATIVE_SPEED unit is m/s.
   * Expected relativeVelocity 14 km/s; actual 14000.
   */
  it('converts RELATIVE_SPEED [m/s] to km/s (14000 m/s -> 14 km/s)', () => {
    const event = CdmParser.toConjunctionEvent(CdmParser.parse(unitsCdm));

    expect(event.relativeVelocity).toBeCloseTo(14, 6);
  });

  /*
   * Report 1.9 (C). CCSDS 508.0-B-1 Table 3-4: CR_R unit is m**2.
   * OBJECT1 CR_R = 1e6 m**2, OBJECT2 CR_R = 0. Expected combined [0][0] = 1 km**2;
   * actual 1e6 (treated as km**2).
   */
  it('converts covariance CR_R [m**2] to km**2 (1e6 m**2 -> 1 km**2)', () => {
    const event = CdmParser.toConjunctionEvent(CdmParser.parse(unitsCdm));

    expect(event.combinedCovariance?.matrix.elements[0][0]).toBeCloseTo(1, 9);
  });

  /*
   * Report 2.7 (C). CdmParser.ts:150-163 sums OBJECT1 and OBJECT2 RTN covariances
   * element-wise, but each is in its own object's RTN frame (508.0-B-1 sec 3.5.3).
   * OBJECT1 moves +y (T1 = +y, N1 = +z); OBJECT2 moves +z (T2 = +z = N1).
   * OBJECT2 has CT_T = 100, CR_R = CN_N = 1; OBJECT1 is identity.
   * Rotated into OBJECT1 RTN: diag(2, 2, 101) so N/T = 50.5.
   * Naive sum: diag(2, 101, 2) so N/T = 0.0198. Ratio is unit-independent.
   */
  it('rotates OBJECT2 RTN covariance into OBJECT1 RTN before combining', () => {
    const cdm = buildCdm({
      obj1: { state: LEO_EAST, pos: [1, 0, 1, 0, 0, 1] },
      obj2: { state: LEO_POLAR, pos: [1, 0, 100, 0, 0, 1] },
    });
    const m = CdmParser.toConjunctionEvent(CdmParser.parse(cdm)).combinedCovariance!.matrix.elements;

    expect(m[2][2] / m[1][1]).toBeCloseTo(50.5, 6);
  });

  /*
   * Report 2.7 (C). CdmParser.ts:150-163 hard-codes the velocity block of the
   * combined 6x6 to zero, so the matrix is singular even when CRDOT_RDOT etc. are
   * supplied. Expected combined [3][3] = (1 + 1) m**2/s**2 > 0; actual 0.
   */
  it('keeps the velocity covariance block when CDM supplies it', () => {
    const cdm = buildCdm({
      obj1: { state: LEO_EAST, pos: [1, 0, 1, 0, 0, 1], velVar: [1, 1, 1] },
      obj2: { state: [7000.5, 0, 0, 0, 7.5, 0.01], pos: [1, 0, 1, 0, 0, 1], velVar: [1, 1, 1] },
    });
    const m = CdmParser.toConjunctionEvent(CdmParser.parse(cdm)).combinedCovariance!.matrix.elements;

    expect(m[3][3]).toBeGreaterThan(0);
  });

  /*
   * Report 2.7 (L). CdmParser.ts:110-130 builds J2000 states regardless of
   * REF_FRAME. 18 SDS CDMs use ITRF. The same numbers labeled ITRF must either be
   * rejected or rotated by Earth rotation (GMST at TCA), which moves a 7000 km
   * position by thousands of km. Expected |r_ITRF - r_J2000| > 1 km (or throw);
   * actual 0 km.
   */
  it('rotates REF_FRAME = ITRF states into J2000 (or rejects them)', () => {
    const base = { obj1: { state: LEO_EAST }, obj2: { state: [7000.5, 0, 0, 0, 7.5, 0.01] as typeof LEO_EAST } };
    const j2k = CdmParser.toConjunctionEvent(CdmParser.parse(buildCdm(base)));
    let diffKm = Infinity;

    try {
      const itrf = CdmParser.toConjunctionEvent(CdmParser.parse(buildCdm({
        obj1: { ...base.obj1, refFrame: 'ITRF' },
        obj2: { ...base.obj2, refFrame: 'ITRF' },
      })));

      diffKm = itrf.primaryState.position.subtract(j2k.primaryState.position).magnitude();
    } catch {
      // Rejecting a frame it cannot handle is acceptable.
    }

    expect(diffKm).toBeGreaterThan(1);
  });
});

describe('CdmExporter (QA 2026-10 regressions)', () => {
  const tca = EpochUTC.fromDateTimeString('2025-01-20T15:30:45.123');
  const primary = new J2000(
    tca,
    new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
    new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
  );
  const secondary = new J2000(
    tca,
    new Vector3D(7000.715 as Kilometers, 0 as Kilometers, 0 as Kilometers),
    new Vector3D(0 as KilometersPerSecond, -6.5 as KilometersPerSecond, 0 as KilometersPerSecond),
  );
  const diag = (a: number, b: number, c: number): StateCovariance => new StateCovariance(new Matrix([
    [a, 0, 0, 0, 0, 0],
    [0, b, 0, 0, 0, 0],
    [0, 0, c, 0, 0, 0],
    [0, 0, 0, 1e-8, 0, 0],
    [0, 0, 0, 0, 1e-8, 0],
    [0, 0, 0, 0, 0, 1e-8],
  ]), CovarianceFrame.RIC);
  const primaryCov = diag(1, 2, 3);
  const secondaryCov = diag(4, 5, 6);
  const event = new ConjunctionEvent({
    tca,
    primaryState: primary,
    secondaryState: secondary,
    relativeState: RIC.fromJ2000(secondary, primary),
    missDistance: 0.715 as Kilometers,
    radialDistance: 0.715 as Kilometers,
    intrackDistance: 0 as Kilometers,
    crosstrackDistance: 0 as Kilometers,
    relativeVelocity: 14 as KilometersPerSecond,
    combinedCovariance: diag(5, 7, 9),
    primaryCovariance: primaryCov,
    secondaryCovariance: secondaryCov,
  });
  const cdm = CdmExporter.export(event);

  /*
   * Report 1.9 (C). CdmExporter.ts:131-147 writes "[km]".
   * CCSDS 508.0-B-1 Table 3-2 / 4-4: MISS_DISTANCE is in m.
   * Expected "MISS_DISTANCE = 715... [m]"; actual "MISS_DISTANCE = 0.715000000 [km]".
   */
  it('writes MISS_DISTANCE in metres with a [m] tag', () => {
    expect(cdm).toMatch(/^MISS_DISTANCE = 715(?:\.0*)? \[m\]$/mu);
  });

  /*
   * Report 1.9 (C). CCSDS 508.0-B-1 Table 3-2: RELATIVE_SPEED is in m/s.
   * Expected "RELATIVE_SPEED = 14000... [m/s]"; actual "14.000000000 [km/s]".
   */
  it('writes RELATIVE_SPEED in m/s with a [m/s] tag', () => {
    expect(cdm).toMatch(/^RELATIVE_SPEED = 14000(?:\.0*)? \[m\/s\]$/mu);
  });

  /*
   * Report 1.9 (C). CdmExporter.ts:203-232 writes "[km**2]".
   * CCSDS 508.0-B-1 Table 3-4: covariance in m**2. Primary CR_R = 1 km**2 = 1e6 m**2.
   * Expected unit tag "m**2" and value 1e6; actual tag "km**2".
   */
  it('writes CR_R in m**2 with an [m**2] tag', () => {
    const match = (/^CR_R = (\S+) \[(\S+)\]$/mu).exec(cdm);

    expect(match?.[2]).toBe('m**2');
    expect(Number(match?.[1])).toBeCloseTo(1e6, 0);
  });

  /*
   * Report 2.7 (C). CdmExporter.ts:68-80 passes `undefined` covariance for OBJECT2.
   * CDM 1.0 (508.0-B-1 Table 3-4) requires covariance for both objects.
   * Expected OBJECT2 CR_R defined; actual undefined.
   */
  it('writes a covariance for OBJECT2', () => {
    const parsed = CdmParser.parse(cdm);

    expect(parsed.object2Data.CR_R).toBeDefined();
  });

  /*
   * Report 2.7 (C). CdmExporter.ts:68-80 writes combinedCovariance as OBJECT1's
   * own. Primary is diag(1, 2, 3) so CT_T / CR_R = 2; combined is diag(5, 7, 9)
   * so the bug gives 1.4. Ratio is unit-independent.
   */
  it('writes the primary covariance, not combinedCovariance, as OBJECT1 covariance', () => {
    const parsed = CdmParser.parse(cdm);

    expect(parsed.object1Data.CT_T! / parsed.object1Data.CR_R!).toBeCloseTo(2, 9);
  });
});

// ---------------------------------------------------------------------------
// HorizonsParser (section 2.7)
// ---------------------------------------------------------------------------

describe('HorizonsParser (QA 2026-10 regressions)', () => {
  /*
   * Report 2.7 (C). HorizonsParser.ts:520-545 parseObserverLine_ assumes
   * "JD RA Dec Delta LT"; real observer tables start with a calendar date, so
   * parseFloat("2024-Dec-01") = 2024 becomes the JD and every column shifts.
   * Expected JD ~ 2460645.5, RA 123.4567, Dec -45.6789; actual JD 2024, RA 0, Dec 123.4567.
   */
  it('parses an observer line that starts with a calendar date', () => {
    const data = [
      'Target body name: 1 Ceres',
      'Center-site name: GEOCENTRIC',
      '$$SOE',
      ' 2024-Dec-01 00:00,  123.4567,  -45.6789,  12.345,  100.123',
      '$$EOE',
    ].join('\n');
    const obs = HorizonsParser.parseObserver(data).observations;
    const jd = obs[0].epoch.toDateTime().getTime() / 86400000 + 2440587.5;

    expect(obs).toHaveLength(1);
    expect(jd).toBeCloseTo(2460645.5, 3);
    expect(obs[0].ra).toBeGreaterThanOrEqual(0);
    expect(obs[0].ra).toBeLessThan(360);
    expect(obs[0].ra).toBeCloseTo(123.4567, 4);
    expect(obs[0].dec).toBeCloseTo(-45.6789, 4);
  });

  /*
   * Report 2.7 (L). HorizonsParser.ts:395-425 splits CSV vector output (CSV_FORMAT=YES)
   * on whitespace: x = parseFloat("A.D.") = NaN, y = 2024. Expected finite position
   * (-1.234e8, 5.6e7, 1.2e3) or a thrown error; actual NaN state returned silently.
   */
  it('parses CSV vector output into finite states', () => {
    const data = [
      'Target body name: Test (1)',
      'Center body name: Sun (10)',
      'Output units    : KM-S',
      '$$SOE',
      '2460645.500000000, A.D. 2024-Dec-01 00:00:00.0000, -1.234000000000000E+08,  5.600000000000000E+07,  1.200000000000000E+03, -1.230000000000000E+01, -2.510000000000000E+01,  1.000000000000000E-03,',
      '$$EOE',
    ].join('\n');
    let x = -1.234e8;

    try {
      x = HorizonsParser.parseVectors(data).ephemeris[0].position.x;
    } catch {
      // Throwing on an unsupported layout is acceptable.
    }

    expect(Number.isNaN(x)).toBe(false);
    expect(x).toBeCloseTo(-1.234e8, -1);
  });

  /*
   * Report 2.7 (L). "Output units" is captured but never checked; AU-D output is
   * treated as km. 1 AU must become 1.495978707e8 km (or the parser must throw).
   * Actual: x = 1 (km).
   */
  it('converts AU-D vector output to km', () => {
    const data = [
      'Target body name: Test (1)',
      'Center body name: Sun (10)',
      'Output units    : AU-D',
      '$$SOE',
      '2460645.500000000 = A.D. 2024-Dec-01 00:00:00.0000 TDB',
      ' X = 1.000000000000000E+00 Y = 0.000000000000000E+00 Z = 0.000000000000000E+00',
      ' VX= 0.000000000000000E+00 VY= 1.720000000000000E-02 VZ= 0.000000000000000E+00',
      '$$EOE',
    ].join('\n');
    let x = 1.495978707e8;

    try {
      x = HorizonsParser.parseVectors(data).ephemeris[0].position.x;
    } catch {
      // Throwing on unsupported units is acceptable.
    }

    expect(x).toBeCloseTo(1.495978707e8, -3);
  });
});
