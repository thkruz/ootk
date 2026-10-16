import {
  encounterPlaneBasis,
  encounterPlaneNormalOffset,
  encounterPlaneSigmaEllipse,
  projectToEncounterPlane,
  sampleEncounterPlaneEllipse,
  type EncounterPlaneVec3,
} from '../EncounterPlane';

const dot = (a: EncounterPlaneVec3, b: EncounterPlaneVec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: EncounterPlaneVec3, b: EncounterPlaneVec3): EncounterPlaneVec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const expectVec = (actual: EncounterPlaneVec3, expected: EncounterPlaneVec3): void => {
  expect(actual.x).toBeCloseTo(expected.x, 12);
  expect(actual.y).toBeCloseTo(expected.y, 12);
  expect(actual.z).toBeCloseTo(expected.z, 12);
};

describe('encounterPlaneBasis', () => {
  it('uses radial as +x and cross-track as +y for a head-on pass along in-track', () => {
    // Primary moves +I, secondary moves -I: relative velocity (secondary minus primary) is -I.
    const basis = encounterPlaneBasis({ x: 0, y: -15, z: 0 })!;

    expectVec(basis.normal, { x: 0, y: -1, z: 0 });
    expectVec(basis.xAxis, { x: 1, y: 0, z: 0 });
    expectVec(basis.yAxis, { x: 0, y: 0, z: 1 });
  });

  it('falls back to cross-track as the reference when the relative velocity is radial', () => {
    const basis = encounterPlaneBasis({ x: 3, y: 0, z: 0 })!;

    expectVec(basis.xAxis, { x: 0, y: 0, z: 1 });
    expectVec(basis.yAxis, { x: 0, y: -1, z: 0 });
  });

  it('returns null for zero or non-finite relative velocity', () => {
    expect(encounterPlaneBasis({ x: 0, y: 0, z: 0 })).toBeNull();
    expect(encounterPlaneBasis({ x: Number.NaN, y: 1, z: 0 })).toBeNull();
  });

  it('is a right-handed orthonormal basis for an oblique relative velocity', () => {
    const basis = encounterPlaneBasis({ x: 0.4, y: -3.1, z: 2.7 })!;

    expect(dot(basis.xAxis, basis.xAxis)).toBeCloseTo(1, 12);
    expect(dot(basis.yAxis, basis.yAxis)).toBeCloseTo(1, 12);
    expect(dot(basis.normal, basis.normal)).toBeCloseTo(1, 12);
    expect(dot(basis.xAxis, basis.yAxis)).toBeCloseTo(0, 12);
    expect(dot(basis.xAxis, basis.normal)).toBeCloseTo(0, 12);
    expect(dot(basis.yAxis, basis.normal)).toBeCloseTo(0, 12);
    expectVec(cross(basis.xAxis, basis.yAxis), basis.normal);
    // +x keeps a positive radial component (it is radial projected into the plane).
    expect(basis.xAxis.x).toBeGreaterThan(0);
  });
});

describe('projectToEncounterPlane', () => {
  it('puts a purely radial miss on the +x axis at the miss distance (head-on along in-track)', () => {
    const basis = encounterPlaneBasis({ x: 0, y: -15, z: 0 })!;
    const p = projectToEncounterPlane({ x: 2.5, y: 0, z: 0 }, basis);

    expect(p.x).toBeCloseTo(2.5, 12);
    expect(p.y).toBeCloseTo(0, 12);
  });

  it('drops the along-velocity component, so a straight-line pass projects to one point', () => {
    const relVel = { x: 0, y: -7, z: 3 };
    const basis = encounterPlaneBasis(relVel)!;
    const miss = { x: 1.2, y: 0.3, z: 0.7 };
    const missP = projectToEncounterPlane(miss, basis);

    for (const t of [-60, -1, 0, 5, 120]) {
      const pos = { x: miss.x + relVel.x * t, y: miss.y + relVel.y * t, z: miss.z + relVel.z * t };
      const p = projectToEncounterPlane(pos, basis);

      expect(p.x).toBeCloseTo(missP.x, 9);
      expect(p.y).toBeCloseTo(missP.y, 9);
    }
  });

  it('reports the along-normal offset separately', () => {
    const basis = encounterPlaneBasis({ x: 0, y: -15, z: 0 })!;

    expect(encounterPlaneNormalOffset({ x: 2, y: 10, z: 0 }, basis)).toBeCloseTo(-10, 12);
  });
});

describe('encounterPlaneSigmaEllipse', () => {
  const zero = { radial: 0, inTrack: 0, crossTrack: 0 };

  it('keeps radial and cross-track sigmas and drops in-track for a head-on pass', () => {
    const basis = encounterPlaneBasis({ x: 0, y: -15, z: 0 })!;
    const ellipse = encounterPlaneSigmaEllipse(basis, { radial: 0.3, inTrack: 50, crossTrack: 0.1 }, zero)!;

    expect(ellipse.semiMajor).toBeCloseTo(0.3, 12);
    expect(ellipse.semiMinor).toBeCloseTo(0.1, 12);
    expect(ellipse.angleRad).toBeCloseTo(0, 12);
  });

  it('adds the two objects as independent Gaussians', () => {
    const basis = encounterPlaneBasis({ x: 0, y: -15, z: 0 })!;
    const ellipse = encounterPlaneSigmaEllipse(basis, { radial: 0.3, inTrack: 1, crossTrack: 0 }, { radial: 0.4, inTrack: 1, crossTrack: 0 })!;

    expect(ellipse.semiMajor).toBeCloseTo(0.5, 12);
    expect(ellipse.semiMinor).toBeCloseTo(0, 12);
  });

  it('rotates an in-track sigma into the plane for an oblique pass', () => {
    // n = (0, -1, -1)/sqrt2, x = radial, y = n x x = (0, -1, 1)/sqrt2: in-track variance lands half on y.
    const basis = encounterPlaneBasis({ x: 0, y: -1, z: -1 })!;
    const ellipse = encounterPlaneSigmaEllipse(basis, { radial: 0, inTrack: 1, crossTrack: 0 }, zero)!;

    expect(ellipse.semiMajor).toBeCloseTo(Math.SQRT1_2, 12);
    expect(ellipse.semiMinor).toBeCloseTo(0, 12);
    expect(Math.abs(ellipse.angleRad)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('rejects negative or non-finite sigmas', () => {
    const basis = encounterPlaneBasis({ x: 0, y: -15, z: 0 })!;

    expect(encounterPlaneSigmaEllipse(basis, { radial: -1, inTrack: 0, crossTrack: 0 }, zero)).toBeNull();
    expect(encounterPlaneSigmaEllipse(basis, zero, { radial: 0, inTrack: Number.NaN, crossTrack: 0 })).toBeNull();
  });
});

describe('sampleEncounterPlaneEllipse', () => {
  it('traces a closed outline around the centre at the scaled semi-axes', () => {
    const pts = sampleEncounterPlaneEllipse({ x: 1, y: 2 }, { semiMajor: 2, semiMinor: 1, angleRad: Math.PI / 2, covariance: [[0, 0], [0, 0]] }, 3, 4);

    expect(pts).toHaveLength(5);
    // t = 0 lies on the major axis, rotated 90 degrees onto +y, scaled 3x.
    expect(pts[0].x).toBeCloseTo(1, 12);
    expect(pts[0].y).toBeCloseTo(8, 12);
    expect(pts[4].x).toBeCloseTo(pts[0].x, 12);
    expect(pts[4].y).toBeCloseTo(pts[0].y, 12);
  });
});
