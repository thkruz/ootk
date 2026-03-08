import { vi, Mock } from 'vitest';
import { Earth, EpochUTC, J2000, MetersPerSecond, Vector3D } from '../../main';
import { AtmosphericDrag } from '../AtmosphericDrag';
import { EarthGravity } from '../EarthGravity';
import { ForceModel } from '../ForceModel';
import { Gravity } from '../Gravity';
import { SolarRadiationPressure } from '../SolarRadiationPressure';
import { ThirdBodyGravity } from '../ThirdBodyGravity';
import { Thrust } from '../Thrust';

/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */


vi.mock('../AtmosphericDrag');
vi.mock('../EarthGravity');
vi.mock('../Gravity');
vi.mock('../SolarRadiationPressure');
vi.mock('../ThirdBodyGravity');
vi.mock('../Thrust');

describe('ForceModel', () => {
  let forceModel: ForceModel;
  let mockState: J2000;

  beforeEach(() => {
    forceModel = new ForceModel();
    mockState = {
      position: new Vector3D(7000, 0, 0),
      velocity: new Vector3D(0, 7.5, 0),
      epoch: null as unknown as EpochUTC,
    } as J2000;
    vi.clearAllMocks();
  });

  describe('setGravity', () => {
    it('should set central gravity with default Earth mu', () => {
      const result = forceModel.setGravity();

      expect(Gravity).toHaveBeenCalledWith(Earth.mu);
      expect(result).toBe(forceModel);
    });

    it('should set central gravity with custom mu', () => {
      const customMu = 398600.5;

      forceModel.setGravity(customMu);
      expect(Gravity).toHaveBeenCalledWith(customMu);
    });
  });

  describe('setEarthGravity', () => {
    it('should set Earth gravity with degree and order', () => {
      forceModel.setEarthGravity(10, 10);
      expect(EarthGravity).toHaveBeenCalledWith(10, 10);
    });
  });

  describe('setThirdBodyGravity', () => {
    it('should set third body gravity with moon only', () => {
      forceModel.setThirdBodyGravity({ moon: true, sun: false });
      expect(ThirdBodyGravity).toHaveBeenCalledWith(true, false);
    });

    it('should set third body gravity with sun only', () => {
      forceModel.setThirdBodyGravity({ moon: false, sun: true });
      expect(ThirdBodyGravity).toHaveBeenCalledWith(false, true);
    });

    it('should set third body gravity with both moon and sun', () => {
      forceModel.setThirdBodyGravity({ moon: true, sun: true });
      expect(ThirdBodyGravity).toHaveBeenCalledWith(true, true);
    });

    it('should set third body gravity with defaults', () => {
      forceModel.setThirdBodyGravity({});
      expect(ThirdBodyGravity).toHaveBeenCalledWith(false, false);
    });
  });

  describe('setSolarRadiationPressure', () => {
    it('should set solar radiation pressure with default coefficient', () => {
      forceModel.setSolarRadiationPressure(1000, 10);
      expect(SolarRadiationPressure).toHaveBeenCalledWith(1000, 10, 1.2);
    });

    it('should set solar radiation pressure with custom coefficient', () => {
      forceModel.setSolarRadiationPressure(1000, 10, 1.5);
      expect(SolarRadiationPressure).toHaveBeenCalledWith(1000, 10, 1.5);
    });
  });

  describe('setAtmosphericDrag', () => {
    it('should set atmospheric drag with default coefficients', () => {
      forceModel.setAtmosphericDrag(1000, 10);
      expect(AtmosphericDrag).toHaveBeenCalledWith(1000, 10, 2.2, 4);
    });

    it('should set atmospheric drag with custom coefficients', () => {
      forceModel.setAtmosphericDrag(1000, 10, 2.5, 5);
      expect(AtmosphericDrag).toHaveBeenCalledWith(1000, 10, 2.5, 5);
    });
  });

  describe('loadManeuver and clearManeuver', () => {
    it('should load a maneuver', () => {
      const mockThrust = new Thrust(null as unknown as EpochUTC, 0 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond);

      forceModel.loadManeuver(mockThrust);
      expect(Thrust).toHaveBeenCalled();
    });

    it('should clear a maneuver', () => {
      const mockThrust = new Thrust(null as unknown as EpochUTC, 0 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond);

      forceModel.loadManeuver(mockThrust);
      forceModel.clearManeuver();
      const acceleration = forceModel.acceleration(mockState);

      expect(acceleration).toEqual(Vector3D.origin);
    });
  });

  describe('acceleration', () => {
    it('should return origin when no forces are set', () => {
      const acceleration = forceModel.acceleration(mockState);

      expect(acceleration).toEqual(Vector3D.origin);
    });

    it('should accumulate central gravity acceleration', () => {
      const mockAcceleration = new Vector3D(1, 2, 3);

      (Gravity as Mock).mockImplementation(function () {
        return {
          acceleration: vi.fn().mockReturnValue(mockAcceleration),
        };
      });

      forceModel.setGravity();
      const acceleration = forceModel.acceleration(mockState);

      expect(acceleration).toEqual(mockAcceleration);
    });

    it('should accumulate all force accelerations', () => {
      const gravityAcc = new Vector3D(1, 0, 0);
      const thirdBodyAcc = new Vector3D(0, 1, 0);
      const srpAcc = new Vector3D(0, 0, 1);

      (Gravity as Mock).mockImplementation(function () {
        return {
          acceleration: vi.fn().mockReturnValue(gravityAcc),
        };
      });
      (ThirdBodyGravity as unknown as Mock).mockImplementation(function () {
        return {
          acceleration: vi.fn().mockReturnValue(thirdBodyAcc),
        };
      });
      (SolarRadiationPressure as unknown as Mock).mockImplementation(function () {
        return {
          acceleration: vi.fn().mockReturnValue(srpAcc),
        };
      });

      forceModel.setGravity();
      forceModel.setThirdBodyGravity({ moon: true });
      forceModel.setSolarRadiationPressure(1000, 10);

      const acceleration = forceModel.acceleration(mockState);

      expect(acceleration).toEqual(new Vector3D(1, 1, 1));
    });
  });

  describe('derivative', () => {
    it('should return velocity joined with acceleration', () => {
      const mockAcceleration = new Vector3D(1, 2, 3);
      const mockJoin = vi.fn();

      mockState.velocity.join = mockJoin;

      (Gravity as Mock).mockImplementation(function () {
        return {
          acceleration: vi.fn().mockReturnValue(mockAcceleration),
        };
      });

      forceModel.setGravity();
      forceModel.derivative(mockState);

      expect(mockJoin).toHaveBeenCalledWith(mockAcceleration);
    });
  });
});
