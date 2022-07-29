export type Kilometer = number;
export type Radians = number;
export type Degrees = number;

export type Vec3<Type> = {
  x: Type;
  y: Type;
  z: Type;
};

export type EciVec3 = Vec3<Kilometer>;
export type EcfVec3 = {
  x: Kilometer;
  y: Kilometer;
  z: Kilometer;
};
export type LlaVec3 = {
  lat: Radians;
  lon: Radians;
  alt: Kilometer;
};
export type RaeVec3 = {
  rng: Kilometer;
  az: Degrees;
  el: Degrees;
};
export type SezVec3 = {
  s: Kilometer;
  e: Kilometer;
  z: Kilometer;
};

/**
 * @interface SatelliteRecord contains all of the orbital parameters necessary for running SGP4.
 * It is generated by Sgp4.createSatrec.
 *
 */
export interface SatelliteRecord {
  a: number;
  am: number;
  alta: number;
  altp: number;
  argpdot: number;
  argpo: number;
  aycof: number;
  bstar: number;
  cc1: number;
  cc4: number;
  cc5: number;
  con41: number;
  d2: number;
  d3: number;
  d4: number;
  d5232: number;
  d5421: number;
  d5433: number;
  dedt: number;
  delmo: number;
  del1: number;
  ecco: number;
  em: number;
  epochdays: number;
  epochyr: number;
  error: number;
  eta: number;
  gsto: number;
  im: number;
  inclo: number;
  init: string;
  isimp: number;
  jdsatepoch: number;
  mdot: number;
  method: string;
  mo: number;
  mm: number;
  nddot: number;
  ndot: number;
  no: number;
  nodecf: number;
  nodedot: number;
  nodeo: number;
  om: number;
  Om: number;
  omgcof: number;
  operationmode: string;
  satnum: string;
  sinmao: number;
  t: number;
  t2cof: number;
  t3cof: number;
  t4cof: number;
  t5cof: number;
  x1mth2: number;
  x7thm1: number;
  xlcof: number;
  xmcof: number;
  xfact: number;
  xlamo: number;
  xli: number;
  xgh4: number;
  xgh3: number;
  xh2: number;
  xi2: number;
  xi3: number;
  xl2: number;
  xl3: number;
  xl4: number;
  zmol: number;
  zmos: number;
  dmdt: number;
  dnodt: number;
  domdt: number;
  e3: number;
  ee2: number;
  peo: number;
  pgho: number;
  pho: number;
  PInco: number;
  plo: number;
  se2: number;
  se3: number;
  sgh2: number;
  sgh3: number;
  sgh4: number;
  sh2: number;
  sh3: number;
  si2: number;
  si3: number;
  sl2: number;
  sl3: number;
  sl4: number;
  xgh2: number;
  xh3: number;
  tumin: number;
  radiusearthkm: number;
  irez: number;
  d3210: number;
  d3222: number;
  d4410: number;
  d4422: number;
  d5220: number;
  del2: number;
  del3: number;
  didt: number;
  atime: number;
  j2: number;
  j3: number;
  j4: number;
  mus: number;
  xke: number;
  j3oj2: number;
  xni: number;
  d2201: number;
  d2211: number;
  nm: number;
}

/** @typedef StateVector is a three dimensional position and velocity vector output from Sgp4.propagate.*/
export type StateVector = {
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

/** @typedef Vec3Flat is a flat three dimensional array used in vector math.*/
export type Vec3Flat = [number, number, number];

/** @typedef TleLine1 is the first line of a two line element set */
export type TleLine1 = string;

/** @typedef TleLine2 is the second line of a two line element set */
export type TleLine2 = string;

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

// eslint-disable-next-line no-shadow
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

export type GreenwichMeanSiderealTime = number;
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

export type AzEl = {
  az: Radians;
  el: Radians;
};

export type Meters = number;

export type SunTime = {
  solarNoon: Date;
  nadir: Date;
};