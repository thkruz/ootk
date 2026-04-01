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

export { OemParser } from './OemParser';
export type {
  OemCovarianceMatrix,
  OemDataBlock,
  OemHeader,
  OemMetadata,
  ParsedOem,
} from './OemTypes';

export { HorizonsParser } from './HorizonsParser';
export type {
  HorizonsEphemerisData,
  HorizonsVectorResult,
  HorizonsObserverResult,
} from './HorizonsParser';

export { CdmParser } from './CdmParser';
export { CdmExporter } from './CdmExporter';
export type {
  CdmHeader,
  CdmRelativeData,
  CdmObjectMetadata,
  CdmObjectData,
  CdmObjectType,
  CdmManeuverableStatus,
  ParsedCdm,
  CdmExportOptions,
} from './CdmTypes';

export { OdmExporter } from './OdmExporter';
export type {
  OdmExportOptions,
  OpmExportOptions,
  OemExportOptions,
  OemFromStateVectorsOptions,
  OmmExportOptions,
} from './OdmTypes';

export { OmmParser } from './OmmParser';
export type {
  OmmHeader,
  OmmMetadata,
  OmmMeanElements,
  OmmSpacecraftParameters,
  OmmTleParameters,
  OmmCovarianceMatrix,
  OmmUserDefined,
  ParsedOmm,
} from './OmmTypes';

// TODO: Future parsers to add:
// - Sp3Parser: GPS precise ephemerides (SP3 format)
// - TdmParser: Tracking Data Messages
