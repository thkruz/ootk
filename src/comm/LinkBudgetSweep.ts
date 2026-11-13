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

/**
 * Range-scaling helpers for a link budget. With every other term held fixed, only free-space
 * path loss changes with slant range (20*log10(d)), so a margin computed at one reference range
 * can be scaled to any other range, and the range where margin reaches zero has a closed form.
 */

/**
 * Eb/N0 achieved by a link: C/N0 (dB-Hz) minus 10*log10(data rate).
 * @param cnoDbHz Carrier-to-noise-density ratio in dB-Hz
 * @param dataRateBps Data rate in bits per second (must be greater than zero)
 * @returns Eb/N0 in dB
 */
export function ebN0FromCno(cnoDbHz: number, dataRateBps: number): number {
  if (!(dataRateBps > 0)) {
    throw new RangeError('dataRateBps must be greater than zero');
  }

  return cnoDbHz - 10 * Math.log10(dataRateBps);
}

/**
 * Scale a link margin from a reference range to another range (only FSPL changes).
 * @param refMarginDb Margin at the reference range, dB
 * @param refRangeKm Reference slant range, km (greater than zero)
 * @param rangeKm Target slant range, km (greater than zero)
 * @returns Margin at the target range, dB
 */
export function marginAtRange(refMarginDb: number, refRangeKm: number, rangeKm: number): number {
  if (!(refRangeKm > 0) || !(rangeKm > 0)) {
    throw new RangeError('ranges must be greater than zero');
  }

  return refMarginDb + 20 * Math.log10(refRangeKm / rangeKm);
}

/**
 * Slant range at which the link margin reaches zero.
 * @param refMarginDb Margin at the reference range, dB
 * @param refRangeKm Reference slant range, km (greater than zero)
 * @returns Threshold range in km
 */
export function thresholdRangeKm(refMarginDb: number, refRangeKm: number): number {
  if (!(refRangeKm > 0)) {
    throw new RangeError('refRangeKm must be greater than zero');
  }

  return refRangeKm * 10 ** (refMarginDb / 20);
}
