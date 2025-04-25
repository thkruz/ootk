/**
 * Improved error handling for SGP4
 */

// Define specific error types
export enum Sgp4ErrorCode {
  NO_ERROR = 0,
  MEAN_ELEMENTS_INVALID = 1, // ecc >= 1.0 or ecc < -0.001 or a < 0.95 er
  MEAN_MOTION_NEGATIVE = 2, // mean motion less than 0.0
  PERT_ELEMENTS_INVALID = 3, // pert elements, ecc < 0.0 or ecc > 1.0
  SEMI_LATUS_RECTUM_NEGATIVE = 4, // semi-latus rectum < 0.0
  EPOCH_ELEMENTS_SUBORBITAL = 5, // epoch elements are sub-orbital
  SATELLITE_DECAYED = 6 // satellite has decayed
}

// Error class for SGP4 errors
export class Sgp4Error extends Error {
  code: Sgp4ErrorCode;

  constructor(code: Sgp4ErrorCode, message?: string) {
    super(message ?? Sgp4Error.getDefaultMessage(code));
    this.name = 'Sgp4Error';
    this.code = code;
  }

  static getDefaultMessage(code: Sgp4ErrorCode): string {
    switch (code) {
      case Sgp4ErrorCode.NO_ERROR:
        return 'No error';
      case Sgp4ErrorCode.MEAN_ELEMENTS_INVALID:
        return 'Mean elements invalid: eccentricity out of range or semi-major axis too small';
      case Sgp4ErrorCode.MEAN_MOTION_NEGATIVE:
        return 'Mean motion is negative';
      case Sgp4ErrorCode.PERT_ELEMENTS_INVALID:
        return 'Perturbed elements invalid: eccentricity out of range';
      case Sgp4ErrorCode.SEMI_LATUS_RECTUM_NEGATIVE:
        return 'Semi-latus rectum is negative';
      case Sgp4ErrorCode.EPOCH_ELEMENTS_SUBORBITAL:
        return 'Epoch elements are sub-orbital';
      case Sgp4ErrorCode.SATELLITE_DECAYED:
        return 'Satellite has decayed';
      default:
        return `Unknown error code: ${code}`;
    }
  }
}

// Result type that includes error information
export interface Sgp4Result<T> {
  success: boolean;
  value?: T;
  error?: Sgp4Error;
}
