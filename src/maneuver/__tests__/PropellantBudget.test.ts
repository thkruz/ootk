import { PropellantBudget } from '../PropellantBudget';

describe('PropellantBudget', () => {
  const g0 = 9.80665;

  describe('massAfterBurn', () => {
    it('applies the Tsiolkovsky equation', () => {
      // 1000 kg, 300 s Isp, dv = isp * g0 * ln(2) burns exactly half the mass
      const dv = 300 * g0 * Math.log(2);

      expect(PropellantBudget.massAfterBurn(1000, dv, 300)).toBeCloseTo(500, 9);
    });

    it('returns the full mass for a zero delta-V burn', () => {
      expect(PropellantBudget.massAfterBurn(1000, 0, 300)).toBe(1000);
    });
  });

  describe('propellantUsed', () => {
    it('is the difference between pre- and post-burn mass', () => {
      const massKg = 1500;
      const dv = 120;
      const isp = 220;
      const after = PropellantBudget.massAfterBurn(massKg, dv, isp);

      expect(PropellantBudget.propellantUsed(massKg, dv, isp)).toBeCloseTo(massKg - after, 12);
    });
  });

  describe('deltaVRemaining', () => {
    it('computes isp * g0 * ln(mass ratio)', () => {
      expect(PropellantBudget.deltaVRemaining(1000, 500, 300)).toBeCloseTo(300 * g0 * Math.log(2), 9);
    });

    it('is zero when only dry mass remains', () => {
      expect(PropellantBudget.deltaVRemaining(500, 500, 300)).toBeCloseTo(0, 12);
    });
  });

  describe('round trip', () => {
    it('burning the remaining delta-V lands exactly on the dry mass', () => {
      const massKg = 2400;
      const dryMassKg = 900;
      const isp = 315;
      const dvRemaining = PropellantBudget.deltaVRemaining(massKg, dryMassKg, isp);

      expect(PropellantBudget.massAfterBurn(massKg, dvRemaining, isp)).toBeCloseTo(dryMassKg, 9);
    });

    it('chains two burns the same as one combined burn', () => {
      const massKg = 1000;
      const isp = 250;
      const afterBoth = PropellantBudget.massAfterBurn(PropellantBudget.massAfterBurn(massKg, 75, isp), 125, isp);

      expect(afterBoth).toBeCloseTo(PropellantBudget.massAfterBurn(massKg, 200, isp), 9);
    });
  });
});
