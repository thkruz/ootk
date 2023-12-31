import { Sensor } from '@src/objects';

/**
 * Represents a distinct type.
 *
 * This type is used to create new types based on existing ones, but with a unique identifier.
 * This can be useful for creating types that are semantically different but structurally the same.
 *
 * @template T The base type from which the distinct type is created.
 * @template DistinctName A unique identifier for the distinct type.
 *
 * @property __TYPE__ A property that holds the unique identifier for the distinct type.
 */
type Distinct<T, DistinctName> = T & { __TYPE__: DistinctName };

// Possible usages
/**
 * Represents a quantity of hours.
 *
 * This type is based on the number type, but is distinct and cannot be used interchangeably
 * with other number-based types.
 */
export type Hours = Distinct<number, 'Hours'>;

/**
 * Represents a quantity of minutes.
 *
 * This type is based on the number type, but is distinct and cannot be used interchangeably
 * with other number-based types.
 */
export type Minutes = Distinct<number, 'Minutes'>;

/**
 * Represents a quantity of seconds.
 *
 * This type is based on the number type, but is distinct and cannot be used interchangeably
 * with other number-based types.
 */
export type Seconds = Distinct<number, 'Seconds'>;

/**
 * Represents a quantity of milliseconds.
 *
 * This type is based on the number type, but is distinct and cannot be used interchangeably
 * with other number-based types.
 */
export type Milliseconds = Distinct<number, 'Milliseconds'>;

/**
 * Represents a quantity of degrees.
 *
 * This type is based on the number type, but is distinct and cannot be used interchangeably
 * with other number-based types.
 */
export type Degrees = Distinct<number, 'Degrees'>;

/**
 * Represents a quantity of radians.
 *
 * This type is based on the number type, but is distinct and cannot be used interchangeably
 * with other number-based types.
 */
export type Radians = Distinct<number, 'Radians'>;

/**
 * Represents a quantity of kilometers.
 *
 * This type is based on the number type, but is distinct and cannot be used interchangeably
 * with other number-based types.
 */
export type Kilometers = Distinct<number, 'Kilometers'>;

/**
 * Represents a quantity of meters.
 *
 * This type is based on the number type, but is distinct and cannot be used interchangeably
 * with other number-based types.
 */
export type Meters = Distinct<number, 'Meters'>;

/**
 * Represents a three-dimensional vector.
 *
 * This type is used to represent a point in space in terms of x, y, and z coordinates.
 * It is a generic type that allows for flexibility in the units of measure used for each dimension.
 * The default unit of measure is Kilometers.
 *
 * @template Units The unit of measure used for the dimensions.
 * This is typically a type representing a distance, such as kilometers or meters. The default is Kilometers.
 *
 * @property x The x dimension of the vector, representing the distance from the origin to
 * the point in the x direction.
 * @property y The y dimension of the vector, representing the distance from the origin to
 * the point in the y direction.
 * @property z The z dimension of the vector, representing the distance from the origin to
 * the point in the z direction.
 */
export type Vec3<Units = Kilometers> = {
  x: Units;
  y: Units;
  z: Units;
};

/**
 * Represents a three-dimensional vector in Earth-Centered Inertial (ECI) coordinates.
 *
 * This type is used to represent a point in space in terms of x, y, and z coordinates.
 * It is a generic type that allows for flexibility in the units of measure used for each dimension.
 * The default unit of measure is Kilometers.
 *
 * @property x The x dimension of the vector, representing the distance from the origin to
 * the point in the x direction.
 * @property y The y dimension of the vector, representing the distance from the origin to
 * the point in the y direction.
 * @property z The z dimension of the vector, representing the distance from the origin to
 * the point in the z direction.
 */
export type EciVec3<Units = Kilometers> = Vec3<Units>;

/**
 * Represents a three-dimensional vector in Earth-Centered Fixed (ECF) coordinates.
 *
 * NOTE: ECF (Earth-Centered Fixed) and ECEF (Earth-Centered, Earth-Fixed) are essentially
 * the same thing. Both refer to a coordinate system that is fixed with respect to the Earth,
 * meaning that the coordinates of a point in this system do not change even as the Earth rotates.
 *
 * The difference between the two is that ECF is a Cartesian coordinate system, while ECEF is a
 * spherical coordinate system. The ECF system is used in this library because it is easier to
 * work with in the context of the SGP4 algorithm.
 *
 * This type is used to represent a point in space in terms of x, y, and z coordinates.
 * It is a generic type that allows for flexibility in the units of measure used for each dimension.
 * The default unit of measure is Kilometers.
 *
 * @property x The x dimension of the vector, representing the distance from the origin to
 * the point in the x direction.
 * @property y The y dimension of the vector, representing the distance from the origin to
 * the point in the y direction.
 * @property z The z dimension of the vector, representing the distance from the origin to
 * the point in the z direction.
 */
export type EcfVec3<Units = Kilometers> = Vec3<Units>;

/**
 * Represents a three-dimensional vector in Earth-Centered Earth-Fixed (ECEF) coordinates.
 */
export type EcefVec3<Units = Kilometers> = EcfVec3<Units>;

/**
 * Represents a three-dimensional vector in East, North, Up (ENU) coordinates.
 *
 * East–west tangent to parallels, North–south tangent to meridians, and
 * Up–down in the direction normal to the oblate spheroid used as Earth's ellipsoid,
 * which does not generally pass through the center of Earth.
 *
 * In many targeting and tracking applications the local East, North, Up (ENU)
 * Cartesian coordinate system is far more intuitive and practical than ECEF or
 * Geodetic coordinates. The local ENU coordinates are formed from a plane tangent
 * to the Earth's surface fixed to a specific location and hence it is sometimes
 * known as a "Local Tangent" or "local geodetic" plane. By convention the east axis
 * is labeled x, the north y, and the up z.
 *
 * @see https://en.wikipedia.org/wiki/Local_tangent_plane_coordinates
 *
 * @template Units The unit of measure used for the dimensions.
 * This is typically a type representing a distance, such as kilometers or meters. The default is Kilometers.
 *
 * @property e The east dimension of the vector, representing the distance from the origin to
 * the point in the east direction.
 * @property n The north dimension of the vector, representing the distance from the origin to
 * the point in the north direction.
 * @property u The up dimension of the vector, representing the distance from the origin to
 * the point in the upward direction.
 */
export type EnuVec3<Units = Kilometers> = Vec3<Units>;

/**
 * Represents a three-dimensional vector in geographical coordinates.
 *
 * This type is used to represent a point in space in terms of latitude, longitude, and altitude.
 * It is a generic type that allows for flexibility in the units of measure used for each dimension.
 *
 * @template A The unit of measure used for the latitude and longitude dimensions.
 * This is typically a type representing an angle, such as degrees or radians. The default is Radians.
 *
 * @template D The unit of measure used for the altitude dimension.
 * This is typically a type representing a distance, such as kilometers or meters. The default is Kilometers.
 */
export type LlaVec3<A = Radians, D = Kilometers> = {
  lat: A;
  lon: A;
  alt: D;
};

/**
 * Represents a three-dimensional vector in Range, Azimuth, and Elevation (RAE) coordinates.
 *
 * This type is used to represent a point in space in terms of range, azimuth, and elevation.
 * It is a generic type that allows for flexibility in the units of measure used for each dimension.
 *
 * @template DistanceUnit The unit of measure used for the altitude dimension.
 * This is typically a type representing a distance, such as kilometers or meters. The default is Kilometers.
 *
 * @template AngleUnit The unit of measure used for the latitude and longitude dimensions.
 * This is typically a type representing an angle, such as degrees or radians. The default is Radians.
 *
 * @property rng The range dimension of the vector, representing the distance from the origin to the point.
 * @property az The azimuth dimension of the vector, representing the angle in the horizontal plane from a
 * reference direction.
 * @property el The elevation dimension of the vector, representing the angle from the horizontal plane to the point.
 */
export type RaeVec3<DistanceUnit = Kilometers, AngleUnit = Radians> = {
  rng: DistanceUnit;
  az: AngleUnit;
  el: AngleUnit;
};

/**
 * Represents a three-dimensional vector in South, East, and Zenith (SEZ) coordinates.
 *
 * This type is used to represent a point in space in terms of south, east, and zenith.
 * It is a generic type that allows for flexibility in the units of measure used for each dimension.
 *
 * @property s The south dimension of the vector
 * @property e The east dimension of the vector
 * @property z The zenith dimension of the vector
 */
export type SezVec3<D = Kilometers> = {
  s: D;
  e: D;
  z: D;
};

/**
 * @interface SatelliteRecord contains all of the orbital parameters necessary for running SGP4.
 * It is generated by Sgp4.createSatrec.
 *
 */
export interface SatelliteRecord {
  Om: number;
  PInco: number;
  a: number;
  alta: number;
  altp: number;
  am: number;
  argpdot: number;
  argpo: number;
  atime: number;
  aycof: number;
  bstar: number;
  cc1: number;
  cc4: number;
  cc5: number;
  con41: number;
  d2: number;
  d2201: number;
  d2211: number;
  d3: number;
  d3210: number;
  d3222: number;
  d4: number;
  d4410: number;
  d4422: number;
  d5220: number;
  d5232: number;
  d5421: number;
  d5433: number;
  dedt: number;
  del1: number;
  del2: number;
  del3: number;
  delmo: number;
  didt: number;
  dmdt: number;
  dnodt: number;
  domdt: number;
  e3: number;
  ecco: number;
  ee2: number;
  em: number;
  epochdays: number;
  epochyr: number;
  error: number;
  eta: number;
  gsto: number;
  im: number;
  inclo: number;
  init: string;
  irez: number;
  isimp: number;
  j2: number;
  j3: number;
  j3oj2: number;
  j4: number;
  jdsatepoch: number;
  mdot: number;
  method: string;
  mm: number;
  mo: number;
  mus: number;
  nddot: number;
  ndot: number;
  nm: number;
  no: number;
  nodecf: number;
  nodedot: number;
  nodeo: number;
  om: number;
  omgcof: number;
  operationmode: string;
  peo: number;
  pgho: number;
  pho: number;
  plo: number;
  radiusearthkm: number;
  satnum: string;
  se2: number;
  se3: number;
  sgh2: number;
  sgh3: number;
  sgh4: number;
  sh2: number;
  sh3: number;
  si2: number;
  si3: number;
  sinmao: number;
  sl2: number;
  sl3: number;
  sl4: number;
  t: number;
  t2cof: number;
  t3cof: number;
  t4cof: number;
  t5cof: number;
  tumin: number;
  x1mth2: number;
  x7thm1: number;
  xfact: number;
  xgh2: number;
  xgh3: number;
  xgh4: number;
  xh2: number;
  xh3: number;
  xi2: number;
  xi3: number;
  xke: number;
  xl2: number;
  xl3: number;
  xl4: number;
  xlamo: number;
  xlcof: number;
  xli: number;
  xmcof: number;
  xni: number;
  zmol: number;
  zmos: number;
}

/**
 * The StateVector is a type that represents the output from the Sgp4.propagate function.
 * It consists of two main properties: position and velocity, each of which is a three-dimensional vector.
 *
 * The position and velocity vectors are represented as objects with x, y, and z properties,
 * each of which is a number. Alternatively, they can be a boolean value.
 *
 * This type is primarily used in the context of satellite tracking and prediction,
 * where it is crucial to know both the current position and velocity of a satellite.
 */
export type StateVectorSgp4 = {
  position:
    | {
        x: number;
        y: number;
        z: number;
      }
    | boolean;
  velocity:
    | {
        x: number;
        y: number;
        z: number;
      }
    | boolean;
};

/**
 * The RUV coordinate system is a spherical coordinate system with the origin
 * at the radar. The RUV coordinate system is defined with respect to the
 * radar boresight. The R-axis points outward along the boresight with
 * the origin at the radar. The U-axis is in the horizontal plane and
 * points to the right of the boresight. The V-axis is in the vertical
 * plane and points down from the boresight.
 *
 * @template DistanceUnit The unit of measure used for the altitude dimension.
 * This is typically a type representing a distance, such as kilometers or meters. The default is Kilometers.
 *
 * * @template AngleUnit The unit of measure used for the latitude and longitude dimensions.
 * This is typically a type representing an angle, such as degrees or radians. The default is Radians.
 */
export type RuvVec3<DistanceUnit = Kilometers, AngleUnit = Radians> = {
  rng: DistanceUnit;
  u: AngleUnit;
  v: AngleUnit;
};

/**
 * Phased Array Radar Face Cartesian Coordinates
 * The cartesian coordinates (XRF, YRF ZRF) are defined with respect to the
 * phased array radar face. The radar face lies in the XRF-YRF plane, with
 * the XRF-axis horizontal and the YRF-axis pointing upward.
 * The ZRF-axis points outward along the normal to the array face.
 *
 * The orientation of the phased array face is defined by the azimuth and
 * the elevation of the phased array boresight (i.e., the phased array Z-axis).
 */
export type RfVec3<Units = Kilometers> = Vec3<Units>;

/**
 * A type that represents a three-dimensional vector in a flat array format.
 * This type is used in vector mathematics and physics calculations.
 *
 * It is an array of three numbers, where each number represents a coordinate in 3D space:
 * - The first number represents the x-coordinate.
 * - The second number represents the y-coordinate.
 * - The third number represents the z-coordinate.
 *
 * This format is particularly useful in scenarios where you need to perform operations on vectors,
 * such as addition, subtraction, scalar multiplication, dot product, and cross product.
 */
export type Vec3Flat<T = number> = [T, T, T];

/**
 * A type that represents a two-line element set (TLE).
 * A TLE is a data format used to convey sets of orbital elements that describe the orbits of Earth-orbiting objects.
 * It consists of two lines of text, each of which is 69 characters long.
 * @see https://en.wikipedia.org/wiki/Two-line_element_set
 */
export type TleLine1 = Distinct<string, 'TLE Line 1'>;

/**
 * A type that represents a two-line element set (TLE).
 * A TLE is a data format used to convey sets of orbital elements that describe the orbits of Earth-orbiting objects.
 * It consists of two lines of text, each of which is 69 characters long.
 * @see https://en.wikipedia.org/wiki/Two-line_element_set
 */
export type TleLine2 = Distinct<string, 'TLE Line 2'>;

/**
 * The Line1Data type represents the first line of a two-line element set (TLE).
 * A TLE is a data format used to convey sets of orbital elements that describe the orbits of Earth-orbiting objects.
 *
 * The properties of this type include:
 * - lineNumber1: The line number of the TLE (should be 1 for this line).
 * - satNum: The satellite number.
 * - satNumRaw: The raw string representation of the satellite number.
 * - classification: The classification of the satellite (e.g., "U" for unclassified).
 * - intlDes: The international designator for the satellite.
 * - intlDesYear: The year of the international designator.
 * - intlDesLaunchNum: The launch number of the international designator.
 * - intlDesLaunchPiece: The piece of the launch of the international designator.
 * - epochYear: The last two digits of the year of the epoch.
 * - epochYearFull: The full four-digit year of the epoch.
 * - epochDay: The day of the year of the epoch.
 * - meanMoDev1: The first derivative of the Mean Motion.
 * - meanMoDev2: The second derivative of the Mean Motion.
 * - bstar: The BSTAR drag term.
 * - ephemerisType: The type of ephemeris used.
 * - elsetNum: The element set number.
 * - checksum1: The checksum of the first line of the TLE.
 *
 * @see https://en.wikipedia.org/wiki/Two-line_element_set
 */
export type Line1Data = {
  lineNumber1: number;
  satNum: number;
  satNumRaw: string;
  classification: string;
  intlDes: string;
  intlDesYear: number;
  intlDesLaunchNum: number;
  intlDesLaunchPiece: string;
  epochYear: number;
  epochYearFull: number;
  epochDay: number;
  meanMoDev1: number;
  meanMoDev2: number;
  bstar: number;
  ephemerisType: number;
  elsetNum: number;
  checksum1: number;
};

/**
 * The Line2Data type represents the second line of a two-line element set (TLE).
 * A TLE is a data format used to convey sets of orbital elements that describe the orbits of Earth-orbiting objects.
 *
 * The properties of this type include:
 * - lineNumber2: The line number of the TLE (should be 2 for this line).
 * - satNum: The satellite number.
 * - satNumRaw: The raw string representation of the satellite number.
 * - inclination: The inclination of the satellite's orbit.
 * - raan: The Right Ascension of the Ascending Node.
 * - eccentricity: The eccentricity of the satellite's orbit.
 * - argOfPerigee: The argument of perigee.
 * - meanAnomaly: The mean anomaly of the satellite.
 * - meanMotion: The mean motion of the satellite.
 * - revNum: The revolution number at epoch.
 * - checksum2: The checksum of the second line of the TLE.
 *
 * @see https://en.wikipedia.org/wiki/Two-line_element_set
 */
export type Line2Data = {
  lineNumber2: number;
  satNum: number;
  satNumRaw: string;
  inclination: number;
  raan: number;
  eccentricity: number;
  argOfPerigee: number;
  meanAnomaly: number;
  meanMotion: number;
  revNum: number;
  checksum2: number;
};

/**
 * Enum representing different types of objects.
 */
export enum SpaceObjectType {
  UNKNOWN = 0,
  PAYLOAD = 1,
  ROCKET_BODY = 2,
  DEBRIS = 3,
  SPECIAL = 4,
  RADAR_MEASUREMENT = 5,
  RADAR_TRACK = 6,
  RADAR_OBJECT = 7,
  BALLISTIC_MISSILE = 8,
  STAR = 9,
  INTERGOVERNMENTAL_ORGANIZATION = 10,
  SUBORBITAL_PAYLOAD_OPERATOR = 11,
  PAYLOAD_OWNER = 12,
  METEOROLOGICAL_ROCKET_LAUNCH_AGENCY_OR_MANUFACTURER = 13,
  PAYLOAD_MANUFACTURER = 14,
  LAUNCH_AGENCY = 15,
  LAUNCH_SITE = 16,
  LAUNCH_POSITION = 17,
  LAUNCH_FACILITY = 18,
  CONTROL_FACILITY = 19,
  GROUND_SENSOR_STATION = 20,
  OPTICAL = 21,
  MECHANICAL = 22,
  PHASED_ARRAY_RADAR = 23,
  OBSERVER = 24,
  BISTATIC_RADIO_TELESCOPE = 25,
  COUNTRY = 26,
  LAUNCH_VEHICLE_MANUFACTURER = 27,
  ENGINE_MANUFACTURER = 28,
}

/**
 * Represents the Greenwich Mean Sidereal Time (GMST).
 *
 * GMST is a time system that is a measure of the angle, on the celestial equator, from the
 * Greenwich meridian to the meridian that passes through the vernal equinox.
 */
export type GreenwichMeanSiderealTime = Distinct<number, 'Greenwich Mean Sidereal Time'>;

/**
 * Represents the azimuth and elevation of an object in the sky.
 * Azimuth and elevation are the two coordinates that define the position of a
 * celestial body (sun, moon, planet, star, etc.) in the sky as observed from a specific location
 * on the Earth's surface.
 *
 * @template Units The units in which the azimuth and elevation are expressed. By default, this is radians.
 *
 * @property az The azimuth of the object. This is the angle between the observer's north vector and
 * the perpendicular projection of the object onto the observer's local horizon.
 * @property el The elevation of the object. This is the angle between the object and the observer's local horizon.
 */
export type AzEl<Units = Radians> = {
  az: Units;
  el: Units;
};

/**
 * Represents the coordinates of a celestial object in Right Ascension (RA) and Declination (Dec).
 */
export type RaDec = {
  dec: Radians;
  ra: Radians;
  dist?: Kilometers;
};

export interface RadarSensor extends Sensor {
  coneHalfAngle: Radians;
  boresight: {
    az: Radians;
    el: Radians;
  };
}

/**
 * Represents the solar noon and nadir times.
 *
 * @property solarNoon The time at which the sun is at its highest point in the
 * sky (directly above the observer's head). This is the midpoint of the day.
 * @property nadir The time at which the sun is at its lowest point, directly below the observer.
 * This is the midpoint of the night.
 */
export type SunTime = {
  solarNoon: Date;
  nadir: Date;
};

export type LaunchDetails = {
  launchDate?: string;
  launchMass?: string;
  launchSite?: string;
  launchVehicle?: string;
};

export type SpaceCraftDetails = {
  lifetime?: string | number;
  maneuver?: string;
  manufacturer?: string;
  motor?: string;
  power?: string;
  payload?: string;
  purpose?: string;
  shape?: string;
  span?: string;
  bus?: string;
  configuration?: string;
  equipment?: string;
  dryMass?: string;
};

export type OperationsDetails = {
  user?: string;
  mission?: string;
  owner?: string;
  country?: string;
};
