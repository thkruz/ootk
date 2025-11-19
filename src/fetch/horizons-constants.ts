/**
 * Common celestial object identifiers for the Horizons system
 */

export enum CELESTIAL_OBJECTS {
  // Planets
  Mercury = '199',
  Venus = '299',
  Earth = '399',
  Mars = '499',
  Jupiter = '599',
  Saturn = '699',
  Uranus = '799',
  Neptune = '899',

  // Dwarf Planets
  Pluto = '999',
  Ceres = '1',
  Eris = '136199',
  Makemake = '136472',
  Haumea = '136108',

  // Moons
  Moon = '301',
  Phobos = '401',
  Deimos = '402',
  Io = '501',
  Europa = '502',
  Ganymede = '503',
  Callisto = '504',
  Titan = '606',
  Enceladus = '602',

  // Sun and barycenters
  Sun = '10',
  SolarSystemBarycenter = '0',
  EarthMoonBarycenter = '3',
}

/**
 * Observer center codes
 */

export enum OBSERVER_CENTERS {
  /** Geocentric (Earth center) */
  Geocentric = '500@399',
  /** Solar System Barycenter */
  SolarSystemBarycenter = '500@0',
  /** Heliocentric (Sun center) */
  Heliocentric = '500@10',
  /** Topocentric (requires custom coordinates) */
  Topocentric = '500@399a',
}
