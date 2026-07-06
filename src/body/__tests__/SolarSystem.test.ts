/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import {
  SolarSystem,
  CelestialBodyType,
  CelestialBody,
  Sun,
  Moon,
  Mercury,
  Venus,
  Mars,
  Jupiter,
  Saturn,
  Uranus,
  Neptune,
  Pluto,
  Vector3D,
  Kilometers,
} from '../../main';

describe('SolarSystem', () => {
  describe('static class', () => {
    it('should be a static utility class', () => {
      // SolarSystem is a static class - verify key static methods exist
      expect(typeof SolarSystem.get).toBe('function');
      expect(typeof SolarSystem.getByType).toBe('function');
      expect(typeof SolarSystem.getAll).toBe('function');
      expect(typeof SolarSystem.register).toBe('function');
    });
  });

  describe('direct accessors', () => {
    it('should provide Sun via static accessor', () => {
      expect(SolarSystem.sun).toBe(Sun);
    });

    it('should provide Moon via static accessor', () => {
      expect(SolarSystem.moon).toBe(Moon);
    });

    it('should provide Mercury via static accessor', () => {
      expect(SolarSystem.mercury).toBe(Mercury);
    });

    it('should provide Venus via static accessor', () => {
      expect(SolarSystem.venus).toBe(Venus);
    });

    it('should provide Mars via static accessor', () => {
      expect(SolarSystem.mars).toBe(Mars);
    });

    it('should provide Jupiter via static accessor', () => {
      expect(SolarSystem.jupiter).toBe(Jupiter);
    });

    it('should provide Saturn via static accessor', () => {
      expect(SolarSystem.saturn).toBe(Saturn);
    });

    it('should provide Uranus via static accessor', () => {
      expect(SolarSystem.uranus).toBe(Uranus);
    });

    it('should provide Neptune via static accessor', () => {
      expect(SolarSystem.neptune).toBe(Neptune);
    });

    it('should provide Pluto via static accessor', () => {
      expect(SolarSystem.pluto).toBe(Pluto);
    });
  });

  describe('get by id', () => {
    it('should get Sun by id', () => {
      const sun = SolarSystem.get('sun');

      expect(sun).toBe(Sun);
    });

    it('should get Moon by id', () => {
      const moon = SolarSystem.get('moon');

      expect(moon).toBe(Moon);
    });

    it('should get Mars by id', () => {
      const mars = SolarSystem.get('mars');

      expect(mars).toBe(Mars);
    });

    it('should return undefined for unknown id', () => {
      const unknown = SolarSystem.get('unknown-body');

      expect(unknown).toBeUndefined();
    });
  });

  describe('getByType', () => {
    it('should return star type bodies', () => {
      const stars = SolarSystem.getByType(CelestialBodyType.STAR);

      expect(stars).toContain(Sun);
      expect(stars.length).toBe(1);
    });

    it('should return moon type bodies', () => {
      const moons = SolarSystem.getByType(CelestialBodyType.MOON);

      expect(moons).toContain(Moon);
    });

    it('should return terrestrial planets', () => {
      const terrestrial = SolarSystem.getByType(CelestialBodyType.TERRESTRIAL_PLANET);

      expect(terrestrial).toContain(Mercury);
      expect(terrestrial).toContain(Venus);
      expect(terrestrial).toContain(Mars);
    });

    it('should return gas giants', () => {
      const gasGiants = SolarSystem.getByType(CelestialBodyType.GAS_GIANT);

      expect(gasGiants).toContain(Jupiter);
      expect(gasGiants).toContain(Saturn);
    });

    it('should return ice giants', () => {
      const iceGiants = SolarSystem.getByType(CelestialBodyType.ICE_GIANT);

      expect(iceGiants).toContain(Uranus);
      expect(iceGiants).toContain(Neptune);
    });

    it('should return dwarf planets', () => {
      const dwarfPlanets = SolarSystem.getByType(CelestialBodyType.DWARF_PLANET);

      expect(dwarfPlanets).toContain(Pluto);
    });
  });

  describe('getAll', () => {
    it('should return all registered bodies', () => {
      const all = SolarSystem.getAll();

      expect(all.length).toBeGreaterThanOrEqual(10);
      expect(all).toContain(Sun);
      expect(all).toContain(Moon);
      expect(all).toContain(Mars);
    });
  });

  describe('register and unregister', () => {
    // Create a mock CelestialBody for testing
    class MockBody extends CelestialBody {
      eci(): Vector3D<Kilometers> {
        return new Vector3D(0 as Kilometers, 0 as Kilometers, 0 as Kilometers);
      }

      heliocentric(): Vector3D<Kilometers> {
        return new Vector3D(0 as Kilometers, 0 as Kilometers, 0 as Kilometers);
      }

      velocity(): Vector3D | null {
        return null;
      }
    }

    it('should register a new body', () => {
      const mockBody = new MockBody({
        id: 9901,
        name: 'Test Body',
        bodyType: CelestialBodyType.ASTEROID,
      });

      SolarSystem.register(mockBody);

      expect(SolarSystem.get('Test Body')).toBe(mockBody);

      // Clean up
      SolarSystem.unregister(9901);
    });

    it('should unregister a body', () => {
      const mockBody = new MockBody({
        id: 9902,
        name: 'Test Body 2',
        bodyType: CelestialBodyType.COMET,
      });

      SolarSystem.register(mockBody);
      SolarSystem.unregister(9902);

      expect(SolarSystem.get('Test Body 2')).toBeUndefined();
    });

    it('should allow registering custom bodies', () => {
      const mockBody = new MockBody({
        id: 9903,
        name: 'Custom Asteroid',
        bodyType: CelestialBodyType.ASTEROID,
      });

      SolarSystem.register(mockBody);
      expect(SolarSystem.get('Custom Asteroid')).toBe(mockBody);

      // Clean up
      SolarSystem.unregister(9903);
    });
  });

  describe('planet iteration', () => {
    it('should iterate through all planets', () => {
      const planets = [
        SolarSystem.mercury,
        SolarSystem.venus,
        SolarSystem.mars,
        SolarSystem.jupiter,
        SolarSystem.saturn,
        SolarSystem.uranus,
        SolarSystem.neptune,
        SolarSystem.pluto,
      ];

      for (const planet of planets) {
        expect(planet).toBeDefined();
        expect(planet.mu).toBeGreaterThan(0);
        expect(planet.radius).toBeGreaterThan(0);
      }
    });
  });
});
