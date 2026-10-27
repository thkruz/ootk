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

export {
  DEFAULT_BREAKUP_ALONG_LINE_WEIGHT,
  DEFAULT_BREAKUP_LOOKBACK_DAYS,
  DEFAULT_BREAKUP_MAX_MEAN_MOTION_DOT,
  DEFAULT_BREAKUP_TRIM_FRACTION,
  MAX_BREAKUP_LOOKBACK_DAYS,
  estimateBreakupEpoch,
  type BreakupDragModel,
  type BreakupEpochEstimate,
  type BreakupEpochOptions,
  type BreakupEpochQuality,
  type BreakupQualityReason,
  type BreakupSpreadMetric,
} from './BreakupEpoch';
export {
  circularMeanStd,
  fragmentDispersionStats,
  normalizeFragment,
  type BreakupFragmentElements,
  type BreakupFragmentInput,
  type BreakupTleLines,
  type FragmentDispersionStats,
  type NormalizedFragment,
} from './BreakupFragments';
export { breakupLocationAtEpoch, type BreakupLocation } from './BreakupLocation';
export { j2SecularRates, type J2SecularRates } from './J2Secular';
