/**
 * Represents the data format for orbital elements as provided by the OMM system.
 * Numeric fields accept both string and number to support CelesTrak's JSON format
 * (which sends numbers as numbers) and other sources that send them as strings.
 */
export interface OmmDataFormat {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  /** Date in YYYY-MM-DDTHH:MM:SS.SSSSSS UTC format */
  EPOCH: string;
  MEAN_MOTION: string | number;
  ECCENTRICITY: string | number;
  INCLINATION: string | number;
  RA_OF_ASC_NODE: string | number;
  ARG_OF_PERICENTER: string | number;
  MEAN_ANOMALY: string | number;
  EPHEMERIS_TYPE: string | number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: string | number;
  ELEMENT_SET_NO: string | number;
  REV_AT_EPOCH: string | number;
  BSTAR: string | number;
  MEAN_MOTION_DOT: string | number;
  MEAN_MOTION_DDOT: string | number;
}

/**
 * Represents the parsed data format for orbital elements as provided by the OMM system.
 * String fields are preserved from the original data; the `epoch` property contains
 * the parsed date/time values used for SGP4 initialization.
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
