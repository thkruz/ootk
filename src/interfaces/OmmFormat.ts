/**
 * Represents the data format for orbital elements as provided by the Omm system.
 * Each property is expressed as a string to accommodate various formatting or precision
 * requirements from the data source.
 */
export interface OmmDataFormat {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  /** Date in YYYY-MM-DDTHH:MM:SS.SSSSSS UTC format */
  EPOCH: string;
  MEAN_MOTION: string;
  ECCENTRICITY: string;
  INCLINATION: string;
  RA_OF_ASC_NODE: string;
  ARG_OF_PERICENTER: string;
  MEAN_ANOMALY: string;
  EPHEMERIS_TYPE: string;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: string;
  ELEMENT_SET_NO: string;
  REV_AT_EPOCH: string;
  BSTAR: string;
  MEAN_MOTION_DOT: string;
  MEAN_MOTION_DDOT: string;
}

/**
 * Represents the parsed data format for orbital elements as provided by the Omm system.
 * Each property is expressed as a string to accommodate various formatting or precision
 * requirements from the data source.
 * The `epoch` property is an object that contains the parsed date and time values.
 * The `doy` property is the day of the year.
 * The `epoch` property is an object that contains the parsed date and time values.
 */
export interface OmmParsedDataFormat {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  /** Date in YYYY-MM-DDTHH:MM:SS.SSSSSS UTC format */
  EPOCH: string;
  MEAN_MOTION: string;
  ECCENTRICITY: string;
  INCLINATION: string;
  RA_OF_ASC_NODE: string;
  ARG_OF_PERICENTER: string;
  MEAN_ANOMALY: string;
  EPHEMERIS_TYPE: string;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: string;
  ELEMENT_SET_NO: string;
  REV_AT_EPOCH: string;
  BSTAR: string;
  MEAN_MOTION_DOT: string;
  MEAN_MOTION_DDOT: string;
  epoch: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    doy: number;
  };
}
