/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
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

import { ParseError, ValidationError } from '../errors/index';

/**
 * Mapping of alpha-5 leading letters to their corresponding numeric values.
 * I and O are skipped on purpose (they resemble 1 and 0).
 */
export const ALPHA5 = {
  A: '10',
  B: '11',
  C: '12',
  D: '13',
  E: '14',
  F: '15',
  G: '16',
  H: '17',
  J: '18',
  K: '19',
  L: '20',
  M: '21',
  N: '22',
  P: '23',
  Q: '24',
  R: '25',
  S: '26',
  T: '27',
  U: '28',
  V: '29',
  W: '30',
  X: '31',
  Y: '32',
  Z: '33',
} as const;

/** Inverse of {@link ALPHA5}: two-digit prefix ('10' to '33') to its alpha-5 letter. */
const ALPHA5_LETTER_BY_PREFIX: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(ALPHA5).map(([letter, prefix]) => [prefix, letter]),
);

/**
 * Converts a 6-digit numeric SCC number to its 5-character alpha-5 form.
 *
 * Inputs shorter than 6 chars or already in alpha-5 form pass through unchanged.
 *
 * @param sccNum The SCC number to convert.
 * @returns The 5-character alpha-5 representation.
 * @throws {ValidationError} If `sccNum` exceeds the alpha-5 range (numeric value > 339 999,
 *   length > 6, or a 6-character form with a leading letter such as Z99999). For such IDs the
 *   canonical value should be kept on `Satellite.sccNum` and the TLE column populated with the
 *   last 5 digits.
 */
export function convert6DigitToA5(sccNum: string): string {
  // Pass-through for short / already-alpha5 inputs.
  if (sccNum.length < 6) {
    return sccNum;
  }

  if (typeof sccNum[0] !== 'string') {
    throw new ParseError('Invalid SCC number format', 'TLE');
  }

  if (sccNum.length > 6) {
    throw new ValidationError(
      'SCC number exceeds TLE alpha-5 capacity (max 339999); use Satellite.sccNum for the canonical ID',
      'sccNum',
      sccNum,
    );
  }

  /*
   * A leading letter at length 6 is an alpha-5 form with 5 trailing digits, which would decode
   * above Z9999 = 339 999 (for example Z99999 = 3 399 999). Alpha-5 forms are exactly 5 chars.
   */
  if ((/[A-Z]/iu).test(sccNum[0])) {
    if ((/^\d+$/u).test(sccNum.slice(1))) {
      throw new ValidationError(
        'Alpha-5 SCC number exceeds TLE alpha-5 capacity (max Z9999 = 339999)',
        'sccNum',
        sccNum,
      );
    }
    throw new ValidationError('Alpha-5 SCC number must have 4 trailing digits', 'sccNum', sccNum);
  }

  // Reject 6-digit values above alpha-5 range (340 000-999 999).
  const numericValue = parseInt(sccNum, 10);

  if (!(/^\d{6}$/u).test(sccNum)) {
    throw new ValidationError('SCC number must be numeric', 'sccNum', sccNum);
  }
  if (numericValue > 339999) {
    throw new ValidationError(
      'SCC number exceeds TLE alpha-5 capacity (max 339999); use Satellite.sccNum for the canonical ID',
      'sccNum',
      sccNum,
    );
  }

  // 6-digit form of a number below 100 000 (leading zero): the TLE column holds the plain 5 digits.
  if (numericValue < 100000) {
    return sccNum.slice(1);
  }

  // Extract the trailing 4 digits.
  const rest = sccNum.slice(2, 6);

  /*
   * Convert the first two digits into a letter with the inverse of the ALPHA5 table. I and O are
   * skipped as they look too similar to 1 and 0 (Space-Track alpha-5 definition): A=10 ... H=17,
   * J=18 ... N=22, P=23 ... Z=33. So 230000 encodes as P0000 and 339999 as Z9999.
   */
  const letter = ALPHA5_LETTER_BY_PREFIX[sccNum.slice(0, 2)];

  if (!letter) {
    throw new ValidationError('SCC number must be numeric', 'sccNum', sccNum);
  }

  return `${letter}${rest}`;
}

/**
 * Converts a 5-character alpha-5 SCC number to its 6-digit numeric form.
 *
 * Inputs shorter than 5 chars pass through unchanged. Numeric inputs without
 * an alpha-5 leading letter pass through unchanged (5-digit numeric, in-range
 * 6-digit numeric, and extended 7+ digit numeric IDs are all identity).
 *
 * @param sccNum The SCC number to convert.
 * @returns The 6-digit numeric representation, or the input itself if it
 *   is already a numeric form.
 * @throws {ValidationError} If `sccNum` is malformed or out of range: 6-digit numeric whose
 *   value exceeds 339 999, an alpha-5 form with more than 4 trailing digits (above Z9999 =
 *   339 999), or stray letters in a non-leading position.
 */
export function convertA5to6Digit(sccNum: string): string {
  if (sccNum.length < 5) {
    return sccNum;
  }

  const values = sccNum.toUpperCase().split('');

  if (!values[0]) {
    throw new ParseError('Invalid SCC number format', 'TLE');
  }

  // Alpha-5 case: leading letter from the ALPHA5 map.
  if (values[0] in ALPHA5) {
    // Exactly 4 trailing digits. More digits would decode above Z9999 = 339 999.
    if ((/^\d{5,}$/u).test(sccNum.slice(1))) {
      throw new ValidationError(
        'Alpha-5 SCC number exceeds TLE alpha-5 capacity (max Z9999 = 339999)',
        'sccNum',
        sccNum,
      );
    }
    if (!(/^\d{4}$/u).test(sccNum.slice(1))) {
      throw new ValidationError(
        'Alpha-5 SCC number must have 4 trailing digits',
        'sccNum',
        sccNum,
      );
    }

    const firstLetter = values[0] as keyof typeof ALPHA5;

    values[0] = ALPHA5[firstLetter];

    return values.join('');
  }

  // Numeric input. All characters must be digits (allow leading/trailing
  // whitespace so TLE column substrings with space-padding round-trip).
  if (!(/^\s*\d+\s*$/u).test(sccNum)) {
    throw new ValidationError(
      'SCC number must be alpha-5 or all-numeric',
      'sccNum',
      sccNum,
    );
  }

  // 6-digit numeric: enforce the alpha-5 range. 7+ digit "extended" passes
  // through (e.g. CelesTrak 9-digit supplemental IDs).
  const trimmed = sccNum.trim();

  if (trimmed.length === 6 && parseInt(trimmed, 10) > 339999) {
    throw new ValidationError(
      '6-digit SCC number exceeds TLE alpha-5 capacity (max 339999)',
      'sccNum',
      sccNum,
    );
  }

  return sccNum;
}
