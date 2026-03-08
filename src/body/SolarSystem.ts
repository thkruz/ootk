/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Orbital Object ToolKit is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Orbital Object ToolKit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * Orbital Object ToolKit. If not, see <http://www.gnu.org/licenses/>.
 */

import { CelestialBody } from './CelestialBody';
import { CelestialBodyType } from './CelestialBodyType';
import { MoonBody, Moon } from './MoonBody';
import { Jupiter, Mars, Mercury, Neptune, Pluto, Saturn, Uranus, Venus, PlanetBody } from './PlanetBody';
import { Sun, SunBody } from './SunBody';

/**
 * Registry and convenience access for all solar system bodies.
 *
 * SolarSystem provides:
 * - Pre-initialized access to Sun, Moon, and planets
 * - Registration of custom ephemeris bodies (asteroids, comets)
 * - Lookup by name or ID
 * - Filtering by body type
 *
 * @example
 * ```typescript
 * // Get a body by name
 * const mars = SolarSystem.get('Mars');
 * const marsPos = mars?.eci(new Date());
 *
 * // Register a custom body
 * SolarSystem.register(ceres);
 *
 * // Get all planets
 * const planets = SolarSystem.getByType(CelestialBodyType.TERRESTRIAL_PLANET);
 * ```
 */
export class SolarSystem {
  /** Registry of all bodies by ID (lowercase) */
  private static bodies_: Map<string, CelestialBody> = new Map();

  /** Registry of all bodies by name (lowercase) */
  private static bodiesByName_: Map<string, CelestialBody> = new Map();

  /** Whether the registry has been initialized */
  private static initialized_ = false;

  private constructor() {
    // Static class - prevent instantiation
  }

  // ==================== Initialization ====================

  /**
   * Initializes the solar system with all standard bodies.
   * Called automatically on first access, but can be called explicitly.
   */
  static initialize(): void {
    if (SolarSystem.initialized_) {
      return;
    }

    // Register the Sun
    SolarSystem.register(Sun);

    // Register the Moon
    SolarSystem.register(Moon);

    // Register planets
    SolarSystem.register(Mercury);
    SolarSystem.register(Venus);
    SolarSystem.register(Mars);
    SolarSystem.register(Jupiter);
    SolarSystem.register(Saturn);
    SolarSystem.register(Uranus);
    SolarSystem.register(Neptune);
    SolarSystem.register(Pluto);

    SolarSystem.initialized_ = true;
  }

  // ==================== Registration ====================

  /**
   * Registers a celestial body in the solar system registry.
   * @param body - The body to register
   */
  static register(body: CelestialBody): void {
    const idKey = String(body.id);
    const nameKey = body.name.toLowerCase();

    SolarSystem.bodies_.set(idKey, body);
    SolarSystem.bodiesByName_.set(nameKey, body);
  }

  /**
   * Unregisters a celestial body from the registry.
   * @param idOrName - ID or name of the body to remove
   * @returns True if the body was found and removed
   */
  static unregister(idOrName: string | number): boolean {
    const key = typeof idOrName === 'number' ? String(idOrName) : idOrName.toLowerCase();
    const body = SolarSystem.bodies_.get(key) ?? SolarSystem.bodiesByName_.get(key);

    if (body) {
      SolarSystem.bodies_.delete(String(body.id));
      SolarSystem.bodiesByName_.delete(body.name.toLowerCase());

      return true;
    }

    return false;
  }

  // ==================== Lookup Methods ====================

  /**
   * Gets a celestial body by ID or name.
   * @param idOrName - ID or name of the body (case-insensitive)
   * @returns The body, or undefined if not found
   */
  static get(idOrName: string | number): CelestialBody | undefined {
    SolarSystem.ensureInitialized_();

    const key = typeof idOrName === 'number' ? String(idOrName) : idOrName.toLowerCase();

    return SolarSystem.bodies_.get(key) ?? SolarSystem.bodiesByName_.get(key);
  }

  /**
   * Gets all registered celestial bodies.
   * @returns Array of all bodies (deduplicated)
   */
  static getAll(): CelestialBody[] {
    SolarSystem.ensureInitialized_();

    return [...new Set(SolarSystem.bodies_.values())];
  }

  /**
   * Gets all bodies of a specific type.
   * @param type - The body type to filter by
   * @returns Array of bodies matching the type
   */
  static getByType(type: CelestialBodyType): CelestialBody[] {
    SolarSystem.ensureInitialized_();

    return SolarSystem.getAll().filter((b) => b.bodyType === type);
  }

  /**
   * Checks if a body is registered.
   * @param idOrName - ID or name to check
   * @returns True if the body is registered
   */
  static has(idOrName: string | number): boolean {
    SolarSystem.ensureInitialized_();

    const key = typeof idOrName === 'number' ? String(idOrName) : idOrName.toLowerCase();

    return SolarSystem.bodies_.has(key) || SolarSystem.bodiesByName_.has(key);
  }

  // ==================== Direct Accessors ====================

  /** The Sun */
  static get sun(): SunBody {
    SolarSystem.ensureInitialized_();

    return Sun;
  }

  /** The Moon */
  static get moon(): MoonBody {
    SolarSystem.ensureInitialized_();

    return Moon;
  }

  /** Mercury */
  static get mercury(): PlanetBody {
    SolarSystem.ensureInitialized_();

    return Mercury;
  }

  /** Venus */
  static get venus(): PlanetBody {
    SolarSystem.ensureInitialized_();

    return Venus;
  }

  /** Mars */
  static get mars(): PlanetBody {
    SolarSystem.ensureInitialized_();

    return Mars;
  }

  /** Jupiter */
  static get jupiter(): PlanetBody {
    SolarSystem.ensureInitialized_();

    return Jupiter;
  }

  /** Saturn */
  static get saturn(): PlanetBody {
    SolarSystem.ensureInitialized_();

    return Saturn;
  }

  /** Uranus */
  static get uranus(): PlanetBody {
    SolarSystem.ensureInitialized_();

    return Uranus;
  }

  /** Neptune */
  static get neptune(): PlanetBody {
    SolarSystem.ensureInitialized_();

    return Neptune;
  }

  /** Pluto */
  static get pluto(): PlanetBody {
    SolarSystem.ensureInitialized_();

    return Pluto;
  }

  // ==================== Utility Methods ====================

  /**
   * Gets the count of registered bodies.
   */
  static get count(): number {
    SolarSystem.ensureInitialized_();

    return new Set(SolarSystem.bodies_.values()).size;
  }

  /**
   * Clears all registered bodies and resets to uninitialized state.
   * Primarily for testing purposes.
   */
  static reset(): void {
    SolarSystem.bodies_.clear();
    SolarSystem.bodiesByName_.clear();
    SolarSystem.initialized_ = false;
  }

  // ==================== Private Methods ====================

  /**
   * Ensures the registry is initialized before access.
   */
  private static ensureInitialized_(): void {
    if (!SolarSystem.initialized_) {
      SolarSystem.initialize();
    }
  }
}
