/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import {
  PlanetBody,
  Mercury,
  Venus,
  Mars,
  Jupiter,
  Saturn,
  Uranus,
  Neptune,
  Pluto,
  CelestialBodyType,
  Vector3D,
} from '../../main';

describe('PlanetBody', () => {
  const testDate = new Date('2024-06-21T12:00:00Z');

  describe('Mercury', () => {
    it('should be creatable via factory method', () => {
      const mercury = PlanetBody.Mercury();

      expect(mercury).toBeInstanceOf(PlanetBody);
      expect(mercury.name).toBe('Mercury');
    });

    it('should have correct body type', () => {
      expect(Mercury.bodyType).toBe(CelestialBodyType.TERRESTRIAL_PLANET);
    });

    it('should have correct name', () => {
      expect(Mercury.name).toBe('Mercury');
    });

    it('should return ECI position', () => {
      const position = Mercury.eci(testDate);

      expect(position).toBeInstanceOf(Vector3D);
    });

    it('should return heliocentric position', () => {
      const position = Mercury.heliocentric(testDate);

      expect(position).toBeInstanceOf(Vector3D);

      // Mercury orbital distance: 46-70 million km
      const distance = position.magnitude();

      expect(distance).toBeGreaterThan(40_000_000);
      expect(distance).toBeLessThan(80_000_000);
    });
  });

  describe('Venus', () => {
    it('should be creatable via factory method', () => {
      const venus = PlanetBody.Venus();

      expect(venus).toBeInstanceOf(PlanetBody);
      expect(venus.name).toBe('Venus');
    });

    it('should have correct body type', () => {
      expect(Venus.bodyType).toBe(CelestialBodyType.TERRESTRIAL_PLANET);
    });

    it('should return heliocentric position', () => {
      const position = Venus.heliocentric(testDate);

      // Venus orbital distance: 107-109 million km
      const distance = position.magnitude();

      expect(distance).toBeGreaterThan(100_000_000);
      expect(distance).toBeLessThan(120_000_000);
    });
  });

  describe('Mars', () => {
    it('should be creatable via factory method', () => {
      const mars = PlanetBody.Mars();

      expect(mars).toBeInstanceOf(PlanetBody);
      expect(mars.name).toBe('Mars');
    });

    it('should have correct body type', () => {
      expect(Mars.bodyType).toBe(CelestialBodyType.TERRESTRIAL_PLANET);
    });

    it('should have gravitational parameter', () => {
      expect(Mars.mu).toBeGreaterThan(0);
    });

    it('should return heliocentric position', () => {
      const position = Mars.heliocentric(testDate);

      // Mars orbital distance: 207-249 million km
      const distance = position.magnitude();

      expect(distance).toBeGreaterThan(200_000_000);
      expect(distance).toBeLessThan(260_000_000);
    });
  });

  describe('Jupiter', () => {
    it('should be creatable via factory method', () => {
      const jupiter = PlanetBody.Jupiter();

      expect(jupiter).toBeInstanceOf(PlanetBody);
      expect(jupiter.name).toBe('Jupiter');
    });

    it('should have correct body type', () => {
      expect(Jupiter.bodyType).toBe(CelestialBodyType.GAS_GIANT);
    });

    it('should have large gravitational parameter', () => {
      expect(Jupiter.mu).toBeGreaterThan(100_000_000);
    });

    it('should return heliocentric position', () => {
      const position = Jupiter.heliocentric(testDate);

      // Jupiter orbital distance: 741-817 million km
      const distance = position.magnitude();

      expect(distance).toBeGreaterThan(700_000_000);
      expect(distance).toBeLessThan(850_000_000);
    });
  });

  describe('Saturn', () => {
    it('should be creatable via factory method', () => {
      const saturn = PlanetBody.Saturn();

      expect(saturn).toBeInstanceOf(PlanetBody);
      expect(saturn.name).toBe('Saturn');
    });

    it('should have correct body type', () => {
      expect(Saturn.bodyType).toBe(CelestialBodyType.GAS_GIANT);
    });

    it('should return heliocentric position', () => {
      const position = Saturn.heliocentric(testDate);

      // Saturn orbital distance: 1.35-1.51 billion km
      const distance = position.magnitude();

      expect(distance).toBeGreaterThan(1_300_000_000);
      expect(distance).toBeLessThan(1_600_000_000);
    });
  });

  describe('Uranus', () => {
    it('should be creatable via factory method', () => {
      const uranus = PlanetBody.Uranus();

      expect(uranus).toBeInstanceOf(PlanetBody);
      expect(uranus.name).toBe('Uranus');
    });

    it('should have correct body type', () => {
      expect(Uranus.bodyType).toBe(CelestialBodyType.ICE_GIANT);
    });

    it('should return heliocentric position', () => {
      const position = Uranus.heliocentric(testDate);

      // Uranus orbital distance: 2.74-3.01 billion km
      const distance = position.magnitude();

      expect(distance).toBeGreaterThan(2_700_000_000);
      expect(distance).toBeLessThan(3_100_000_000);
    });
  });

  describe('Neptune', () => {
    it('should be creatable via factory method', () => {
      const neptune = PlanetBody.Neptune();

      expect(neptune).toBeInstanceOf(PlanetBody);
      expect(neptune.name).toBe('Neptune');
    });

    it('should have correct body type', () => {
      expect(Neptune.bodyType).toBe(CelestialBodyType.ICE_GIANT);
    });

    it('should return heliocentric position', () => {
      const position = Neptune.heliocentric(testDate);

      // Neptune orbital distance: 4.46-4.54 billion km
      const distance = position.magnitude();

      expect(distance).toBeGreaterThan(4_400_000_000);
      expect(distance).toBeLessThan(4_600_000_000);
    });
  });

  describe('Pluto', () => {
    it('should be creatable via factory method', () => {
      const pluto = PlanetBody.Pluto();

      expect(pluto).toBeInstanceOf(PlanetBody);
      expect(pluto.name).toBe('Pluto');
    });

    it('should have correct body type', () => {
      expect(Pluto.bodyType).toBe(CelestialBodyType.DWARF_PLANET);
    });

    it('should return heliocentric position', () => {
      const position = Pluto.heliocentric(testDate);

      // Pluto orbital distance varies widely: 4.44-7.38 billion km
      const distance = position.magnitude();

      expect(distance).toBeGreaterThan(4_000_000_000);
      expect(distance).toBeLessThan(8_000_000_000);
    });
  });

  describe('common functionality', () => {
    it('all planets should have radius', () => {
      expect(Mercury.radius).toBeGreaterThan(0);
      expect(Venus.radius).toBeGreaterThan(0);
      expect(Mars.radius).toBeGreaterThan(0);
      expect(Jupiter.radius).toBeGreaterThan(0);
      expect(Saturn.radius).toBeGreaterThan(0);
      expect(Uranus.radius).toBeGreaterThan(0);
      expect(Neptune.radius).toBeGreaterThan(0);
      expect(Pluto.radius).toBeGreaterThan(0);
    });

    it('all planets should serialize', () => {
      const serialized = Mars.serialize();

      expect(serialized).toHaveProperty('id');
      expect(serialized).toHaveProperty('name', 'Mars');
      expect(serialized).toHaveProperty('bodyType');
    });

    it('planets should return different positions over time', () => {
      const pos1 = Mars.heliocentric(new Date('2024-01-01T12:00:00Z'));
      const pos2 = Mars.heliocentric(new Date('2024-07-01T12:00:00Z'));

      const diff = pos1.subtract(pos2).magnitude();

      expect(diff).toBeGreaterThan(1_000_000);
    });
  });
});
