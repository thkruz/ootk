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

import { Body, BaryState, Illumination, MakeTime } from 'astronomy-engine';
import { Vector3D } from '../operations/Vector3D';
import { Degrees, Kilometers, KilometersPerSecond, SpaceObjectType } from '../types/types';
import { KM_PER_AU } from '../utils/constants';
import { CelestialBody, CelestialBodyParams } from './CelestialBody';
import { CelestialBodyType } from './CelestialBodyType';

/**
 * Planet physical data.
 */
interface PlanetData {
  body: Body;
  name: string;
  id: number;
  mu: number;
  radius: Kilometers;
  type: CelestialBodyType;
  spaceObjectType: SpaceObjectType;
}

/**
 * Planet data catalog.
 * Gravitational parameters in km³/s², radii in km.
 */
const PLANET_DATA: Record<string, PlanetData> = {
  Mercury: {
    body: Body.Mercury,
    name: 'Mercury',
    id: 1,
    mu: 22032.09,
    radius: 2439.7 as Kilometers,
    type: CelestialBodyType.TERRESTRIAL_PLANET,
    spaceObjectType: SpaceObjectType.TERRESTRIAL_PLANET,
  },
  Venus: {
    body: Body.Venus,
    name: 'Venus',
    id: 2,
    mu: 324858.63,
    radius: 6051.8 as Kilometers,
    type: CelestialBodyType.TERRESTRIAL_PLANET,
    spaceObjectType: SpaceObjectType.TERRESTRIAL_PLANET,
  },
  Earth: {
    body: Body.Earth,
    name: 'Earth',
    id: 3,
    mu: 398600.4418,
    radius: 6371.0 as Kilometers,
    type: CelestialBodyType.TERRESTRIAL_PLANET,
    spaceObjectType: SpaceObjectType.TERRESTRIAL_PLANET,
  },
  Mars: {
    body: Body.Mars,
    name: 'Mars',
    id: 4,
    mu: 42828.37,
    radius: 3389.5 as Kilometers,
    type: CelestialBodyType.TERRESTRIAL_PLANET,
    spaceObjectType: SpaceObjectType.TERRESTRIAL_PLANET,
  },
  Jupiter: {
    body: Body.Jupiter,
    name: 'Jupiter',
    id: 5,
    mu: 126686534.0,
    radius: 69911 as Kilometers,
    type: CelestialBodyType.GAS_GIANT,
    spaceObjectType: SpaceObjectType.GAS_GIANT,
  },
  Saturn: {
    body: Body.Saturn,
    name: 'Saturn',
    id: 6,
    mu: 37931187.0,
    radius: 58232 as Kilometers,
    type: CelestialBodyType.GAS_GIANT,
    spaceObjectType: SpaceObjectType.GAS_GIANT,
  },
  Uranus: {
    body: Body.Uranus,
    name: 'Uranus',
    id: 7,
    mu: 5793939.0,
    radius: 25362 as Kilometers,
    type: CelestialBodyType.ICE_GIANT,
    spaceObjectType: SpaceObjectType.ICE_GIANT,
  },
  Neptune: {
    body: Body.Neptune,
    name: 'Neptune',
    id: 8,
    mu: 6836529.0,
    radius: 24622 as Kilometers,
    type: CelestialBodyType.ICE_GIANT,
    spaceObjectType: SpaceObjectType.ICE_GIANT,
  },
  Pluto: {
    body: Body.Pluto,
    name: 'Pluto',
    id: 9,
    mu: 871.0,
    radius: 1188.3 as Kilometers,
    type: CelestialBodyType.DWARF_PLANET,
    spaceObjectType: SpaceObjectType.DWARF_PLANET,
  },
};

/**
 * AU/day to km/s conversion factor.
 */
const AU_PER_DAY_TO_KM_PER_S = KM_PER_AU / 86400;

/**
 * Planet body for Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, and Pluto.
 *
 * PlanetBody provides:
 * - High-precision position and velocity calculations via astronomy-engine
 * - Visual magnitude and illumination data
 * - Phase angle calculations
 *
 * @example
 * ```typescript
 * // Get Mars position
 * const marsPos = Mars.eci(new Date());
 *
 * // Get Jupiter's visual magnitude
 * const mag = Jupiter.getVisualMagnitude(new Date());
 *
 * // Get rise/set times for Saturn
 * const times = Saturn.getRiseSetTimes(groundStation, new Date());
 * ```
 */
export class PlanetBody extends CelestialBody {
  private planetData_: PlanetData;

  private constructor(planetName: string) {
    const data = PLANET_DATA[planetName];

    if (!data) {
      throw new Error(`Unknown planet: ${planetName}`);
    }

    super({
      id: data.id,
      name: data.name,
      type: data.spaceObjectType,
      bodyType: data.type,
      mu: data.mu,
      radius: data.radius,
      astronomyBody: data.body,
    } as CelestialBodyParams);

    this.planetData_ = data;
  }

  // ==================== Factory Methods ====================

  /**
   * Creates a PlanetBody instance for the specified planet.
   * @param name - Planet name (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto)
   */
  static create(name: string): PlanetBody {
    return new PlanetBody(name);
  }

  /** Mercury */
  static Mercury(): PlanetBody {
    return new PlanetBody('Mercury');
  }

  /** Venus */
  static Venus(): PlanetBody {
    return new PlanetBody('Venus');
  }

  /** Earth (for heliocentric reference) */
  static Earth(): PlanetBody {
    return new PlanetBody('Earth');
  }

  /** Mars */
  static Mars(): PlanetBody {
    return new PlanetBody('Mars');
  }

  /** Jupiter */
  static Jupiter(): PlanetBody {
    return new PlanetBody('Jupiter');
  }

  /** Saturn */
  static Saturn(): PlanetBody {
    return new PlanetBody('Saturn');
  }

  /** Uranus */
  static Uranus(): PlanetBody {
    return new PlanetBody('Uranus');
  }

  /** Neptune */
  static Neptune(): PlanetBody {
    return new PlanetBody('Neptune');
  }

  /** Pluto */
  static Pluto(): PlanetBody {
    return new PlanetBody('Pluto');
  }

  // ==================== Position Methods ====================

  /**
   * Gets the planet's position in Earth-Centered Inertial (J2000) coordinates.
   * @param date - The date/time for the position calculation
   * @returns Position vector in kilometers
   */
  eci(date: Date = new Date()): Vector3D<Kilometers> {
    return this.geoVectorToKm(this.planetData_.body, date);
  }

  /**
   * Gets the planet's position in heliocentric coordinates.
   * @param date - The date/time for the position calculation
   * @returns Position vector in kilometers (Sun-centered)
   */
  heliocentric(date: Date = new Date()): Vector3D<Kilometers> {
    return this.helioVectorToKm(this.planetData_.body, date);
  }

  /**
   * Gets the planet's velocity in heliocentric coordinates.
   * @param date - The date/time for the velocity calculation
   * @returns Velocity vector in km/s
   */
  velocity(date: Date = new Date()): Vector3D<KilometersPerSecond> {
    const time = MakeTime(date);
    const state = BaryState(this.planetData_.body, time);

    return new Vector3D(
      (state.vx * AU_PER_DAY_TO_KM_PER_S) as KilometersPerSecond,
      (state.vy * AU_PER_DAY_TO_KM_PER_S) as KilometersPerSecond,
      (state.vz * AU_PER_DAY_TO_KM_PER_S) as KilometersPerSecond,
    );
  }

  // ==================== Visual/Illumination Methods ====================

  /**
   * Gets the planet's visual magnitude as seen from Earth.
   * @param date - The date/time for the calculation
   * @returns Visual magnitude (lower = brighter)
   */
  getVisualMagnitude(date: Date = new Date()): number {
    const time = MakeTime(date);
    const illum = Illumination(this.planetData_.body, time);

    return illum.mag;
  }

  /**
   * Gets the planet's phase angle as seen from Earth.
   * @param date - The date/time for the calculation
   * @returns Phase angle in degrees (0 = full illumination, 180 = backlit)
   */
  getPhaseAngle(date: Date = new Date()): Degrees {
    const time = MakeTime(date);
    const illum = Illumination(this.planetData_.body, time);

    return illum.phase_angle as Degrees;
  }

  /**
   * Gets the planet's illuminated fraction as seen from Earth.
   * @param date - The date/time for the calculation
   * @returns Illuminated fraction (0-1)
   */
  getIlluminatedFraction(date: Date = new Date()): number {
    const time = MakeTime(date);
    const illum = Illumination(this.planetData_.body, time);

    // Calculate illuminated fraction from phase angle
    return (1 + Math.cos(illum.phase_angle * Math.PI / 180)) / 2;
  }

  /**
   * Gets the planet's heliocentric distance.
   * @param date - The date/time for the calculation
   * @returns Distance in AU
   */
  getHeliocentricDistanceAU(date: Date = new Date()): number {
    const time = MakeTime(date);
    const illum = Illumination(this.planetData_.body, time);

    return illum.helio_dist;
  }

  /**
   * Gets the planet's geocentric distance.
   * @param date - The date/time for the calculation
   * @returns Distance in AU
   */
  getGeocentricDistanceAU(date: Date = new Date()): number {
    const time = MakeTime(date);
    const illum = Illumination(this.planetData_.body, time);

    return illum.geo_dist;
  }
}

// ==================== Pre-instantiated Planet Singletons ====================

/** Mercury singleton */
export const Mercury = PlanetBody.Mercury();

/** Venus singleton */
export const Venus = PlanetBody.Venus();

/** Mars singleton */
export const Mars = PlanetBody.Mars();

/** Jupiter singleton */
export const Jupiter = PlanetBody.Jupiter();

/** Saturn singleton */
export const Saturn = PlanetBody.Saturn();

/** Uranus singleton */
export const Uranus = PlanetBody.Uranus();

/** Neptune singleton */
export const Neptune = PlanetBody.Neptune();

/** Pluto singleton */
export const Pluto = PlanetBody.Pluto();
