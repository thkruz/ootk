import { RicSigmas, scaleAndClampRicSigmas } from '../displayRadii';

const CAPS: RicSigmas = { radial: 1200, inTrack: 5000, crossTrack: 1000 };

describe('scaleAndClampRicSigmas', () => {
  it('scales each axis by the confidence multiplier', () => {
    const result = scaleAndClampRicSigmas({ radial: 2, inTrack: 3, crossTrack: 4 }, 2, CAPS);

    expect(result).toEqual({ radial: 4, inTrack: 6, crossTrack: 8 });
  });

  it('clamps each axis independently to its cap', () => {
    const result = scaleAndClampRicSigmas({ radial: 10000, inTrack: 10000, crossTrack: 10000 }, 1, CAPS);

    expect(result).toEqual({ radial: 1200, inTrack: 5000, crossTrack: 1000 });
  });

  it('applies confidence before clamping', () => {
    // 700 * 2 = 1400, clamped to the 1200 radial cap.
    const result = scaleAndClampRicSigmas({ radial: 700, inTrack: 1, crossTrack: 1 }, 2, CAPS);

    expect(result?.radial).toBe(1200);
  });

  it('treats a zero on a single axis as valid (yields a zero radius there)', () => {
    const result = scaleAndClampRicSigmas({ radial: 0, inTrack: 3, crossTrack: 4 }, 1, CAPS);

    expect(result).toEqual({ radial: 0, inTrack: 3, crossTrack: 4 });
  });

  it.each([
    ['NaN', { radial: Number.NaN, inTrack: 1, crossTrack: 1 }],
    ['Infinity', { radial: 1, inTrack: Infinity, crossTrack: 1 }],
    ['negative', { radial: 1, inTrack: 1, crossTrack: -1 }],
  ])('returns null when an input sigma is %s', (_label, sigmas) => {
    expect(scaleAndClampRicSigmas(sigmas as RicSigmas, 1, CAPS)).toBeNull();
  });
});
