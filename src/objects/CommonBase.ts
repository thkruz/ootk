import { getSpaceObjectTypeStringValue, SpaceObjectType } from '../main.js';

export interface CommonBaseParams {
  id?: number;
  shortDescription?: string;
  longDescription?: string;
  type?: SpaceObjectType;
  isEnabled?: boolean;
}

export abstract class CommonBase {
  id: number;
  shortDescription: string;
  longDescription: string;
  type: SpaceObjectType;
  isEnabled;
  private static idCounter_ = 1;

  constructor(params: CommonBaseParams = {}) {
    this.id = params.id ?? CommonBase.generateUniqueId_();
    this.shortDescription = params.shortDescription ?? '';
    this.longDescription = params.longDescription ?? '';
    this.type = params.type ?? SpaceObjectType.UNKNOWN;
    this.isEnabled = params.isEnabled ?? true;
  }

  private static generateUniqueId_(): number {
    return CommonBase.idCounter_++;
  }

  toJSON(): string {
    return JSON.stringify({
      id: this.id,
      shortDescription: this.shortDescription,
      longDescription: this.longDescription,
    });
  }

  /**
   * Validates a parameter value against a minimum and maximum value.
   * @param value - The value to be validated.
   * @param minValue - The minimum allowed value.
   * @param maxValue - The maximum allowed value.
   * @param errorMessage - The error message to be thrown if the value is invalid.
   */
  validateParameter<T>(value: T, minValue: T, maxValue: T, errorMessage: string): void {
    if (typeof minValue !== 'undefined' && minValue !== null && (value as number) < (minValue as number)) {
      throw new Error(errorMessage);
    }
    if (typeof maxValue !== 'undefined' && maxValue !== null && (value as number) > (maxValue as number)) {
      throw new Error(errorMessage);
    }
  }

  /**
   * Returns a string representation of the object's type.
   *
   * This method maps the `SpaceObjectType` enum value of the object to a corresponding string.
   * If the type is not recognized, it returns 'Unknown'.
   * @returns The string representation of the object's type.
   */
  getTypeString(): string {
    return getSpaceObjectTypeStringValue(this.type);
  }
}

