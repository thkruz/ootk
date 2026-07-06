/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Custom error classes for ootk.
 *
 * Error Handling Convention:
 * - ValidationError: Invalid constructor arguments, out-of-range values
 * - ParseError: Malformed external data formats (TLE, OEM, Horizons)
 * - PropagationError: Unrecoverable propagation failures (use null for expected failures)
 * - OrbitDeterminationError: IOD algorithm convergence failures
 *
 * Methods that may fail for expected reasons (e.g., satellite decay, time outside
 * ephemeris window) should return null rather than throwing.
 */

/**
 * Base class for all ootk errors.
 *
 * All custom error classes in ootk extend this base class, allowing
 * callers to catch all ootk-specific errors with a single catch block.
 *
 * @example
 * ```typescript
 * try {
 *   const sat = new Satellite({ tle1, tle2 });
 * } catch (e) {
 *   if (e instanceof OotkError) {
 *     console.log('ootk error:', e.message);
 *   }
 * }
 * ```
 */
/* eslint-disable max-classes-per-file */
export class OotkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OotkError';
    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when input validation fails (invalid ranges, types, formats).
 *
 * Use this error for:
 * - Constructor parameter validation
 * - Method argument validation
 * - Out-of-range numeric values
 * - Invalid enum values
 *
 * @example
 * ```typescript
 * if (latitude < -90 || latitude > 90) {
 *   throw new ValidationError(
 *     'Latitude must be between -90 and 90 degrees',
 *     'latitude',
 *     latitude,
 *   );
 * }
 * ```
 */
export class ValidationError extends OotkError {
  /**
   * Creates a new ValidationError.
   * @param message - Human-readable error message
   * @param field - Optional name of the field that failed validation
   * @param value - Optional value that failed validation
   */
  constructor(
    message: string,
    readonly field?: string,
    readonly value?: unknown,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when parsing external data formats fails.
 *
 * Use this error for:
 * - TLE parsing failures
 * - OEM file parsing failures
 * - Horizons data parsing failures
 * - Any external data format that cannot be parsed
 *
 * @example
 * ```typescript
 * if (line1.length !== 69) {
 *   throw new ParseError(
 *     'TLE line 1 must be exactly 69 characters',
 *     'TLE',
 *     1,
 *   );
 * }
 * ```
 */
export class ParseError extends OotkError {
  /**
   * Creates a new ParseError.
   * @param message - Human-readable error message
   * @param format - Optional format identifier (e.g., 'TLE', 'OEM', 'HORIZONS')
   * @param line - Optional line number where the error occurred
   */
  constructor(
    message: string,
    readonly format?: string,
    readonly line?: number,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Thrown when orbital propagation encounters an unrecoverable error.
 *
 * Note: Expected failures (e.g., satellite decay, epoch before TLE epoch)
 * should return null rather than throwing this error. Use PropagationError
 * only for truly unexpected, unrecoverable failures.
 *
 * @example
 * ```typescript
 * if (!isFinite(position.x)) {
 *   throw new PropagationError(
 *     'Propagation produced non-finite position',
 *     epoch,
 *   );
 * }
 * ```
 */
export class PropagationError extends OotkError {
  /**
   * Creates a new PropagationError.
   * @param message - Human-readable error message
   * @param epoch - Optional epoch at which the propagation failed
   */
  constructor(
    message: string,
    readonly epoch?: Date,
  ) {
    super(message);
    this.name = 'PropagationError';
  }
}

/**
 * Thrown when orbit determination algorithms fail to converge.
 *
 * Use this error for:
 * - Gauss IOD failures
 * - Gooding IOD failures
 * - Gibbs IOD failures
 * - Lambert solver failures
 * - Any iterative algorithm that fails to converge
 *
 * @example
 * ```typescript
 * if (iterations > maxIterations) {
 *   throw new OrbitDeterminationError(
 *     'Algorithm failed to converge after maximum iterations',
 *     'Gooding',
 *   );
 * }
 * ```
 */
export class OrbitDeterminationError extends OotkError {
  /**
   * Creates a new OrbitDeterminationError.
   * @param message - Human-readable error message
   * @param algorithm - Optional algorithm name (e.g., 'Gauss', 'Gooding', 'Lambert')
   */
  constructor(
    message: string,
    readonly algorithm?: string,
  ) {
    super(message);
    this.name = 'OrbitDeterminationError';
  }
}
