/**
 * Regression tests for the v8 CDM and OEM fixes, pinned against the example messages in the CCSDS
 * standards and against the geometry those messages describe.
 */
import { CdmExporter } from '../CdmExporter';
import { CdmParser } from '../CdmParser';
import { HorizonsParser } from '../HorizonsParser';
import { OdmExporter } from '../OdmExporter';
import { OemParser } from '../OemParser';

/*
 * Example CDM of CCSDS 508.0-B-1 Annex C (KVN), SATELLITE A vs FENGYUN 1C DEB, TCA 2010-03-13.
 * Relative data are in m and m/s, states in km and km/s, covariance in m**2, m**2/s, m**2/s**2.
 */
const ANNEX_CDM = `CCSDS_CDM_VERS = 1.0
CREATION_DATE = 2010-03-12T22:31:12.000
ORIGINATOR = JSPOC
MESSAGE_FOR = SATELLITE A
MESSAGE_ID = 201113719185
TCA = 2010-03-13T22:37:52.618
MISS_DISTANCE = 715 [m]
RELATIVE_SPEED = 14762 [m/s]
RELATIVE_POSITION_R = 27.4 [m]
RELATIVE_POSITION_T = -70.2 [m]
RELATIVE_POSITION_N = 711.8 [m]
RELATIVE_VELOCITY_R = -7.2 [m/s]
RELATIVE_VELOCITY_T = -14692.0 [m/s]
RELATIVE_VELOCITY_N = -1437.2 [m/s]
START_SCREEN_PERIOD = 2010-03-12T18:29:32.212
STOP_SCREEN_PERIOD = 2010-03-15T18:29:32.212
SCREEN_VOLUME_FRAME = RTN
SCREEN_VOLUME_SHAPE = ELLIPSOID
SCREEN_VOLUME_X = 200 [m]
SCREEN_VOLUME_Y = 1000 [m]
SCREEN_VOLUME_Z = 1000 [m]
SCREEN_ENTRY_TIME = 2010-03-13T22:37:52.222
SCREEN_EXIT_TIME = 2010-03-13T22:37:52.824
COLLISION_PROBABILITY = 4.835E-05
COLLISION_PROBABILITY_METHOD = FOSTER-1992
OBJECT = OBJECT1
OBJECT_DESIGNATOR = 12345
CATALOG_NAME = SATCAT
OBJECT_NAME = SATELLITE A
INTERNATIONAL_DESIGNATOR = 1997-030E
EPHEMERIS_NAME = EPHEMERIS SATELLITE A
COVARIANCE_METHOD = CALCULATED
MANEUVERABLE = YES
REF_FRAME = EME2000
X = 2570.097065 [km]
Y = 2244.654904 [km]
Z = 6281.497978 [km]
X_DOT = 4.418769571 [km/s]
Y_DOT = 4.833547743 [km/s]
Z_DOT = -3.526774282 [km/s]
CR_R = 4.142E+01 [m**2]
CT_R = -8.579E+00 [m**2]
CT_T = 2.533E+03 [m**2]
CN_R = -2.313E+01 [m**2]
CN_T = 1.336E+01 [m**2]
CN_N = 7.098E+01 [m**2]
CRDOT_R = 2.520E-03 [m**2/s]
CRDOT_T = -5.476E+00 [m**2/s]
CRDOT_N = 8.626E-04 [m**2/s]
CRDOT_RDOT = 5.744E-03 [m**2/s**2]
CTDOT_R = -1.006E-02 [m**2/s]
CTDOT_T = 4.041E-03 [m**2/s]
CTDOT_N = -1.359E-03 [m**2/s]
CTDOT_RDOT = -1.502E-05 [m**2/s**2]
CTDOT_TDOT = 1.049E-05 [m**2/s**2]
CNDOT_R = 1.053E-03 [m**2/s]
CNDOT_T = -3.412E-03 [m**2/s]
CNDOT_N = 1.213E-02 [m**2/s]
CNDOT_RDOT = -3.004E-06 [m**2/s**2]
CNDOT_TDOT = -1.091E-06 [m**2/s**2]
CNDOT_NDOT = 5.529E-05 [m**2/s**2]
OBJECT = OBJECT2
OBJECT_DESIGNATOR = 30337
CATALOG_NAME = SATCAT
OBJECT_NAME = FENGYUN 1C DEB
INTERNATIONAL_DESIGNATOR = 1999-025AA
EPHEMERIS_NAME = NONE
COVARIANCE_METHOD = CALCULATED
MANEUVERABLE = NO
REF_FRAME = EME2000
X = 2569.540800 [km]
Y = 2245.093614 [km]
Z = 6281.599946 [km]
X_DOT = -2.888612500 [km/s]
Y_DOT = -6.007247516 [km/s]
Z_DOT = 3.328770172 [km/s]
CR_R = 1.337E+03 [m**2]
CT_R = -4.806E+04 [m**2]
CT_T = 2.492E+06 [m**2]
CN_R = -3.298E+01 [m**2]
CN_T = -7.5888E+02 [m**2]
CN_N = 7.105E+01 [m**2]
CRDOT_R = 2.591E-03 [m**2/s]
CRDOT_T = -4.152E-02 [m**2/s]
CRDOT_N = -1.784E-06 [m**2/s]
CRDOT_RDOT = 6.886E-05 [m**2/s**2]
CTDOT_R = -1.016E-02 [m**2/s]
CTDOT_T = -1.506E-04 [m**2/s]
CTDOT_N = 1.637E-03 [m**2/s]
CTDOT_RDOT = -2.987E-06 [m**2/s**2]
CTDOT_TDOT = 1.059E-05 [m**2/s**2]
CNDOT_R = 4.400E-03 [m**2/s]
CNDOT_T = 8.482E-03 [m**2/s]
CNDOT_N = 8.633E-05 [m**2/s]
CNDOT_RDOT = -1.903E-06 [m**2/s**2]
CNDOT_TDOT = -4.594E-06 [m**2/s**2]
CNDOT_NDOT = 5.178E-05 [m**2/s**2]
`;

const COV_KEYS = [
  'CR_R', 'CT_R', 'CT_T', 'CN_R', 'CN_T', 'CN_N',
  'CRDOT_R', 'CRDOT_T', 'CRDOT_N', 'CRDOT_RDOT',
  'CTDOT_R', 'CTDOT_T', 'CTDOT_N', 'CTDOT_RDOT', 'CTDOT_TDOT',
  'CNDOT_R', 'CNDOT_T', 'CNDOT_N', 'CNDOT_RDOT', 'CNDOT_TDOT', 'CNDOT_NDOT',
] as const;

/** Read a numeric KVN value and its unit tag from a CDM string. */
const kvn = (text: string, key: string, occurrence = 0): { value: number; unit: string } => {
  const re = new RegExp(`^${key} = (\\S+) \\[(\\S+)\\]$`, 'gmu');
  const matches = [...text.matchAll(re)];

  return { value: Number(matches[occurrence][1]), unit: matches[occurrence][2] };
};

describe('CCSDS 508.0-B-1 Annex C example CDM', () => {
  const parsed = CdmParser.parse(ANNEX_CDM);
  const event = CdmParser.toConjunctionEvent(parsed);

  it('reads MISS_DISTANCE and RELATIVE_SPEED in m and m/s (715 m, 14762 m/s)', () => {
    expect(event.missDistance).toBeCloseTo(0.715, 12);
    expect(event.relativeVelocity).toBeCloseTo(14.762, 12);
  });

  it('agrees with the geometry of the two km state vectors (independent of the m fields)', () => {
    // |r2 - r1| = |(-0.556265, 0.438710, 0.101968)| km = 715.8 m; |v2 - v1| = 14762 m/s
    const dr = event.secondaryState.position.subtract(event.primaryState.position).magnitude() * 1000;
    const dv = event.secondaryState.velocity.subtract(event.primaryState.velocity).magnitude() * 1000;

    expect(Math.abs(dr - 715)).toBeLessThan(1.5);
    expect(Math.abs(dv - 14762)).toBeLessThan(1);
    // The RTN relative position has the same length as the miss
    const rtn = Math.hypot(event.radialDistance, event.intrackDistance, event.crosstrackDistance) * 1000;

    expect(Math.abs(rtn - 715)).toBeLessThan(1.5);
  });

  it('converts the covariance from m**2 to km**2 (CR_R 41.42 m**2 = 4.142e-5 km**2)', () => {
    expect(parsed.object1Data.CR_R).toBeCloseTo(4.142e-5, 15);
    expect(parsed.object2Data.CT_T).toBeCloseTo(2.492, 12);
    expect(event.primaryCovariance!.matrix.elements[3][3]).toBeCloseTo(5.744e-9, 18);
  });

  it('re-exports the same numeric values in the standard units', () => {
    const out = CdmExporter.export(event);

    expect(kvn(out, 'MISS_DISTANCE')).toEqual({ value: 715, unit: 'm' });
    expect(kvn(out, 'RELATIVE_SPEED').unit).toBe('m/s');
    expect(kvn(out, 'RELATIVE_SPEED').value).toBeCloseTo(14762, 6);
    // All six signed RTN components, written from one source (the CDM's own fields)
    expect(kvn(out, 'RELATIVE_POSITION_R')).toEqual({ value: 27.4, unit: 'm' });
    expect(kvn(out, 'RELATIVE_POSITION_T')).toEqual({ value: -70.2, unit: 'm' });
    expect(kvn(out, 'RELATIVE_POSITION_N').value).toBeCloseTo(711.8, 6);
    expect(kvn(out, 'RELATIVE_VELOCITY_R')).toEqual({ value: -7.2, unit: 'm/s' });
    expect(kvn(out, 'RELATIVE_VELOCITY_T').value).toBeCloseTo(-14692.0, 6);
    expect(kvn(out, 'RELATIVE_VELOCITY_N').value).toBeCloseTo(-1437.2, 6);
    expect(out).toContain('COLLISION_PROBABILITY_METHOD = FOSTER-1992');

    for (const [occurrence, source] of [[0, parsed.object1Data], [1, parsed.object2Data]] as const) {
      expect(kvn(out, 'X', occurrence).value).toBeCloseTo(source.X, 9);
      for (const key of COV_KEYS) {
        const original = kvn(ANNEX_CDM, key, occurrence);
        const written = kvn(out, key, occurrence);

        expect(written.unit).toBe(original.unit);
        expect(written.value).toBeCloseTo(original.value, 9 - Math.ceil(Math.log10(Math.abs(original.value) + 1e-30)));
      }
    }
  });

  it('round-trips export -> parse to the same parsed values', () => {
    const again = CdmParser.parse(CdmExporter.export(event));

    expect(again.relativeData.MISS_DISTANCE).toBeCloseTo(parsed.relativeData.MISS_DISTANCE, 12);
    // Signed RTN components survive (v7 wrote |R|, |T|, |N|, so T = -70.2 m came back positive)
    for (const key of [
      'RELATIVE_POSITION_R', 'RELATIVE_POSITION_T', 'RELATIVE_POSITION_N',
      'RELATIVE_VELOCITY_R', 'RELATIVE_VELOCITY_T', 'RELATIVE_VELOCITY_N',
    ] as const) {
      expect(again.relativeData[key]).toBeCloseTo(parsed.relativeData[key]!, 12);
    }
    expect(again.relativeData.RELATIVE_POSITION_T).toBeCloseTo(-0.0702, 12);
    expect(again.relativeData.RELATIVE_VELOCITY_N).toBeCloseTo(-1.4372, 12);
    for (const key of COV_KEYS) {
      expect(again.object1Data[key]! / parsed.object1Data[key]!).toBeCloseTo(1, 9);
      expect(again.object2Data[key]! / parsed.object2Data[key]!).toBeCloseTo(1, 9);
    }
  });

  it('honours an explicit [km] tag from pre-v8 ootk exports', () => {
    const legacy = ANNEX_CDM.replace('MISS_DISTANCE = 715 [m]', 'MISS_DISTANCE = 0.715 [km]');

    expect(CdmParser.parse(legacy).relativeData.MISS_DISTANCE).toBeCloseTo(0.715, 12);
  });

  it('rejects a unit tag from the wrong family', () => {
    const bad = ANNEX_CDM.replace('MISS_DISTANCE = 715 [m]', 'MISS_DISTANCE = 715 [m/s]');

    expect(() => CdmParser.parse(bad)).toThrow(/MISS_DISTANCE/u);
  });

  it('rotates an ITRF state into J2000 by Earth rotation (radius preserved, direction changed)', () => {
    const itrf = ANNEX_CDM.replaceAll('REF_FRAME = EME2000', 'REF_FRAME = ITRF');
    const rotated = CdmParser.toConjunctionEvent(CdmParser.parse(itrf)).primaryState.position;

    expect(rotated.magnitude()).toBeCloseTo(event.primaryState.position.magnitude(), 3);
    expect(rotated.subtract(event.primaryState.position).magnitude()).toBeGreaterThan(100);
  });
});

/*
 * Example OEM of CCSDS 502.0-B-3 (Mars Global Surveyor, two data blocks separated by a
 * trajectory correction maneuver). The "< intervening data records omitted here >" placeholder
 * lines of the standard's figure are removed, leaving 4 states per block. Note there is no
 * DATA_START / DATA_STOP: data lines follow META_STOP directly.
 */
const ANNEX_OEM = `CCSDS_OEM_VERS = 2.0
CREATION_DATE = 1996-11-04T17:22:31
ORIGINATOR = NASA/JPL

META_START
OBJECT_NAME = MARS GLOBAL SURVEYOR
OBJECT_ID = 1996-062A
CENTER_NAME = MARS BARYCENTER
REF_FRAME = EME2000
TIME_SYSTEM = UTC
START_TIME = 1996-12-18T12:00:00.331
USEABLE_START_TIME = 1996-12-18T12:10:00.331
USEABLE_STOP_TIME = 1996-12-28T21:23:00.331
STOP_TIME = 1996-12-28T21:28:00.331
INTERPOLATION = HERMITE
INTERPOLATION_DEGREE = 7
META_STOP

COMMENT This file was produced by M.R. Somebody, MSOO NAV/JPL, 1996NOV 04. It is
COMMENT to be used for DSN scheduling purposes only.
1996-12-18T12:00:00.331 2789.619 -280.045 -1746.755 4.73372 -2.49586 -1.04195
1996-12-18T12:01:00.331 2783.419 -308.143 -1877.071 5.18604 -2.42124 -1.99608
1996-12-18T12:02:00.331 2776.033 -336.859 -2008.682 5.63678 -2.33951 -1.94687
1996-12-28T21:28:00.331 -3881.024 563.959 -682.773 -3.28827 -3.66735 1.63861

META_START
OBJECT_NAME = MARS GLOBAL SURVEYOR
OBJECT_ID = 1996-062A
CENTER_NAME = MARS BARYCENTER
REF_FRAME = EME2000
TIME_SYSTEM = UTC
START_TIME = 1996-12-28T21:29:07.267
USEABLE_START_TIME = 1996-12-28T22:08:02.5
USEABLE_STOP_TIME = 1996-12-30T01:18:02.5
STOP_TIME = 1996-12-30T01:28:02.267
INTERPOLATION = HERMITE
INTERPOLATION_DEGREE = 7
META_STOP

COMMENT This block begins after trajectory correction maneuver TCM-3.
1996-12-28T21:29:07.267 -2432.166 -063.042 1742.754 7.33702 -3.495867 -1.041945
1996-12-28T21:59:02.267 -2445.234 -878.141 1873.073 1.86043 -3.421256 -0.996366
1996-12-28T22:00:02.267 -2458.079 -683.858 2007.684 6.36786 -3.339563 -0.946654
1996-12-30T01:28:02.267 2164.375 1115.811 -688.131 -3.53328 -2.88452 0.88535
`;

describe('CCSDS 502.0-B-3 example OEM', () => {
  it('parses both data blocks with 4 states each and no DATA_START markers', () => {
    const parsed = OemParser.parse(ANNEX_OEM);

    expect(parsed.dataBlocks.map((b) => b.ephemeris.length)).toEqual([4, 4]);
    expect(parsed.dataBlocks[1].metadata.START_TIME).toBe('1996-12-28T21:29:07.267');
    expect(parsed.dataBlocks[0].ephemeris[0].epoch.toDateTime().toISOString()).toBe('1996-12-18T12:00:00.331Z');
    // Leading-zero field "-063.042" is a plain decimal
    expect(parsed.dataBlocks[1].ephemeris[0].position.y).toBeCloseTo(-63.042, 9);
  });

  it('gives the same epochs when they are written as day-of-year (1996-353 is Dec 18, leap year)', () => {
    const doy = ANNEX_OEM.replace('1996-12-18T12:00:00.331 2789.619', '1996-353T12:00:00.331 2789.619');
    const a = OemParser.parse(ANNEX_OEM).dataBlocks[0].ephemeris[0].epoch.posix;
    const b = OemParser.parse(doy).dataBlocks[0].ephemeris[0].epoch.posix;

    expect(b).toBe(a);
  });

  it('shifts TAI epochs by TAI - UTC = 30 s in December 1996 (IERS Bulletin C)', () => {
    const tai = ANNEX_OEM.replace('TIME_SYSTEM = UTC', 'TIME_SYSTEM = TAI');
    const utcEpoch = OemParser.parse(ANNEX_OEM).dataBlocks[0].ephemeris[0].epoch.posix;
    const taiEpoch = OemParser.parse(tai).dataBlocks[0].ephemeris[0].epoch.posix;

    expect(utcEpoch - taiEpoch).toBeCloseTo(30, 6);
  });

  it('rejects an unsupported TIME_SYSTEM instead of misreading it as UTC', () => {
    expect(() => OemParser.parse(ANNEX_OEM.replace('TIME_SYSTEM = UTC', 'TIME_SYSTEM = MET'))).toThrow(/TIME_SYSTEM/u);
  });

  it('round-trips through OdmExporter.formatOemFromStateVectors', () => {
    const states = OemParser.parse(ANNEX_OEM).dataBlocks[0].ephemeris;
    const again = OemParser.parse(OdmExporter.formatOemFromStateVectors(states, {
      objectName: 'MARS GLOBAL SURVEYOR',
      objectId: '1996-062A',
    })).dataBlocks[0].ephemeris;

    expect(again).toHaveLength(states.length);
    again.forEach((s, i) => {
      expect(s.epoch.posix).toBeCloseTo(states[i].epoch.posix, 6);
      expect(s.position.subtract(states[i].position).magnitude()).toBeLessThan(1e-6);
    });
  });

  it('assembles a covariance that spans several lines and keeps COV_REF_FRAME', () => {
    const withCov = `${ANNEX_OEM}COVARIANCE_START
EPOCH = 1996-12-28T21:29:07.267
COV_REF_FRAME = EME2000
3.3313494e-04
4.6189273e-04 6.7824216e-04
-3.0700078e-04 -4.2212341e-04 3.2319319e-04
-3.3493650e-07 -4.6860842e-07 2.4849495e-07 4.2960228e-10
-2.2118325e-07 -2.8641868e-07 1.7980986e-07 2.6088992e-10 1.7675147e-10
-3.0413460e-07 -4.9894969e-07 3.5403109e-07 1.8692631e-10 1.0088625e-10 6.2244443e-10
COVARIANCE_STOP
`;
    const cov = OemParser.parse(withCov).dataBlocks[1].covariance!;

    expect(cov).toHaveLength(1);
    expect(cov[0].refFrame).toBe('EME2000');
    expect(cov[0].values[0]).toBe(3.3313494e-4);
    expect(cov[0].values[20]).toBe(6.2244443e-10);
    expect(cov[0].epoch.toISOString()).toBe('1996-12-28T21:29:07.267Z');
  });
});

describe('HorizonsParser units and layouts', () => {
  const vectors = (units: string, x: string, vy: string): string => [
    'Target body name: Test (1)',
    'Center body name: Sun (10)',
    `Output units    : ${units}`,
    '$$SOE',
    '2460645.500000000 = A.D. 2024-Dec-01 00:00:00.0000 TDB',
    ` X = ${x} Y = 0.0E+00 Z = 0.0E+00`,
    ` VX= 0.0E+00 VY= ${vy} VZ= 0.0E+00`,
    '$$EOE',
  ].join('\n');

  it('converts AU-D velocity to km/s with 1 au / 86400 s (1 au/day = 1731.4568 km/s)', () => {
    const ep = HorizonsParser.parseVectors(vectors('AU-D', '1.0E+00', '1.0E+00')).ephemeris[0];

    expect(ep.velocity!.y).toBeCloseTo(149597870 / 86400, 6);
  });

  it('converts KM-D velocity to km/s and leaves KM-D position in km', () => {
    const ep = HorizonsParser.parseVectors(vectors('KM-D', '7.0E+03', '8.64E+04')).ephemeris[0];

    expect(ep.position.x).toBeCloseTo(7000, 9);
    expect(ep.velocity!.y).toBeCloseTo(1, 12);
  });

  it('rejects unknown output units', () => {
    expect(() => HorizonsParser.parseVectors(vectors('M-S', '1.0E+00', '1.0E+00'))).toThrow(/units/u);
  });

  it('reads a sexagesimal (ANG_FORMAT=HMS) observer line: 08 13 49.61 -45 40 44.0 is 123.4567 deg, -45.6789 deg', () => {
    const data = [
      'Target body name: 1 Ceres',
      '$$SOE',
      ' 2024-Dec-01 00:00 *m  08 13 49.608 -45 40 44.04  12.345  100.123',
      '$$EOE',
    ].join('\n');
    const obs = HorizonsParser.parseObserver(data).observations[0];

    // RA = (8 + 13/60 + 49.608/3600) * 15 = 123.4567 deg; Dec = -(45 + 40/60 + 44.04/3600) = -45.6789 deg
    expect(obs.ra).toBeCloseTo(123.4567, 4);
    expect(obs.dec).toBeCloseTo(-45.6789, 4);
    expect(obs.distance).toBeCloseTo(12.345, 9);
    expect(obs.lightTime).toBeCloseTo(100.123 * 60, 9);
    expect(obs.epoch.toDateTime().toISOString()).toBe('2024-12-01T00:00:00.000Z');
  });
});
