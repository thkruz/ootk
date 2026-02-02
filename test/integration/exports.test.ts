/**
 * Integration test: Verify all major exports are accessible
 * from the built package.
 */
import * as ootk from '../../dist/main.js';

describe('Package Exports', () => {
  describe('Core Objects', () => {
    it('should export Satellite class', () => {
      expect(ootk.Satellite).toBeDefined();
      expect(typeof ootk.Satellite).toBe('function');
    });

    it('should export GroundObject class', () => {
      expect(ootk.GroundObject).toBeDefined();
    });

    it('should export Sensor class', () => {
      expect(ootk.Sensor).toBeDefined();
    });

    it('should export BaseObject class', () => {
      expect(ootk.BaseObject).toBeDefined();
    });

    it('should export Star class', () => {
      expect(ootk.Star).toBeDefined();
    });
  });

  describe('Coordinate Classes', () => {
    it('should export Tle class', () => {
      expect(ootk.Tle).toBeDefined();
    });

    it('should export ClassicalElements class', () => {
      expect(ootk.ClassicalElements).toBeDefined();
    });

    it('should export EquinoctialElements class', () => {
      expect(ootk.EquinoctialElements).toBeDefined();
    });

    it('should export J2000 class', () => {
      expect(ootk.J2000).toBeDefined();
    });

    it('should export ITRF class', () => {
      expect(ootk.ITRF).toBeDefined();
    });

    it('should export Geodetic class', () => {
      expect(ootk.Geodetic).toBeDefined();
    });

    it('should export TEME class', () => {
      expect(ootk.TEME).toBeDefined();
    });

    it('should export RIC class', () => {
      expect(ootk.RIC).toBeDefined();
    });
  });

  describe('Time Classes', () => {
    it('should export EpochUTC class', () => {
      expect(ootk.EpochUTC).toBeDefined();
    });

    it('should export Epoch class', () => {
      expect(ootk.Epoch).toBeDefined();
    });

    it('should export EpochGPS class', () => {
      expect(ootk.EpochGPS).toBeDefined();
    });

    it('should export EpochWindow class', () => {
      expect(ootk.EpochWindow).toBeDefined();
    });
  });

  describe('Celestial Bodies', () => {
    it('should export Earth', () => {
      expect(ootk.Earth).toBeDefined();
    });

    it('should export Sun', () => {
      expect(ootk.Sun).toBeDefined();
    });

    it('should export Moon', () => {
      expect(ootk.Moon).toBeDefined();
    });

    it('should export CelestialBody class', () => {
      expect(ootk.CelestialBody).toBeDefined();
    });

    it('should export SolarSystem', () => {
      expect(ootk.SolarSystem).toBeDefined();
    });
  });

  describe('Propagators', () => {
    it('should export Sgp4 class', () => {
      expect(ootk.Sgp4).toBeDefined();
    });

    it('should export Sgp4Propagator class', () => {
      expect(ootk.Sgp4Propagator).toBeDefined();
    });

    it('should export KeplerPropagator class', () => {
      expect(ootk.KeplerPropagator).toBeDefined();
    });

    it('should export RungeKuttaAdaptive class', () => {
      expect(ootk.RungeKuttaAdaptive).toBeDefined();
    });
  });

  describe('Operations', () => {
    it('should export Vector3D class', () => {
      expect(ootk.Vector3D).toBeDefined();
    });

    it('should export Matrix class', () => {
      expect(ootk.Matrix).toBeDefined();
    });

    it('should export Quaternion class', () => {
      expect(ootk.Quaternion).toBeDefined();
    });
  });

  describe('Force Models', () => {
    it('should export ForceModel class', () => {
      expect(ootk.ForceModel).toBeDefined();
    });

    it('should export EarthGravity class', () => {
      expect(ootk.EarthGravity).toBeDefined();
    });

    it('should export AtmosphericDrag class', () => {
      expect(ootk.AtmosphericDrag).toBeDefined();
    });

    it('should export SolarRadiationPressure class', () => {
      expect(ootk.SolarRadiationPressure).toBeDefined();
    });
  });

  describe('Sensors', () => {
    it('should export RadarSensor class', () => {
      expect(ootk.RadarSensor).toBeDefined();
    });

    it('should export OpticalSensor class', () => {
      expect(ootk.OpticalSensor).toBeDefined();
    });

    it('should export FieldOfView class', () => {
      expect(ootk.FieldOfView).toBeDefined();
    });
  });

  describe('Parsers', () => {
    it('should export OemParser', () => {
      expect(ootk.OemParser).toBeDefined();
    });

    it('should export CdmParser', () => {
      expect(ootk.CdmParser).toBeDefined();
    });
  });

  describe('Constants', () => {
    it('should export DEG2RAD', () => {
      expect(ootk.DEG2RAD).toBeDefined();
      expect(typeof ootk.DEG2RAD).toBe('number');
    });

    it('should export RAD2DEG', () => {
      expect(ootk.RAD2DEG).toBeDefined();
      expect(typeof ootk.RAD2DEG).toBe('number');
    });

    it('should export TAU', () => {
      expect(ootk.TAU).toBeDefined();
    });
  });

  describe('Error Classes', () => {
    it('should export OotkError', () => {
      expect(ootk.OotkError).toBeDefined();
    });

    it('should export PropagationError', () => {
      expect(ootk.PropagationError).toBeDefined();
    });

    it('should export ParseError', () => {
      expect(ootk.ParseError).toBeDefined();
    });
  });
});
