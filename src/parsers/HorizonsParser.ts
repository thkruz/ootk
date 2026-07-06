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

import { ParseError } from '../errors';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { Kilometers, KilometersPerSecond } from '../types/types';

/**
 * Converts a Julian Date to a JavaScript Date.
 * @param jd - Julian Date
 * @returns JavaScript Date object
 */
function julianDateToDate(jd: number): Date {
  // Julian Date to Unix timestamp (milliseconds)
  // JD 2440587.5 = Unix epoch (Jan 1, 1970 00:00:00 UTC)
  const unixMs = (jd - 2440587.5) * 86400000;

  return new Date(unixMs);
}

/**
 * Parsed ephemeris data from NASA Horizons.
 */
export interface HorizonsEphemerisData {
  /** Epoch for this state */
  epoch: EpochUTC;
  /** Position vector in km */
  position: Vector3D<Kilometers>;
  /** Velocity vector in km/s (if available) */
  velocity?: Vector3D<KilometersPerSecond>;
  /** Light-time from observer to target (seconds) */
  lightTime?: number;
}

/**
 * Parsed result from NASA Horizons vector table.
 */
export interface HorizonsVectorResult {
  /** Target body name */
  targetName: string;
  /** Center body name */
  centerBody: string;
  /** Reference frame */
  referenceFrame: string;
  /** Whether coordinates are heliocentric */
  isHeliocentric: boolean;
  /** Ephemeris data points */
  ephemeris: HorizonsEphemerisData[];
  /** Raw metadata */
  metadata: Record<string, string>;
}

/**
 * Parsed result from NASA Horizons observer table.
 */
export interface HorizonsObserverResult {
  /** Target body name */
  targetName: string;
  /** Observer location */
  observerLocation: string;
  /** Observations */
  observations: Array<{
    epoch: EpochUTC;
    ra: number; // Right ascension in degrees
    dec: number; // Declination in degrees
    distance: number; // AU
    lightTime: number; // seconds
  }>;
}

/**
 * Parser for NASA JPL Horizons ephemeris data.
 *
 * Horizons is a NASA/JPL system that provides precise ephemerides for solar
 * system objects. This parser handles the vector table format (positions and
 * velocities in Cartesian coordinates).
 *
 * @see https://ssd.jpl.nasa.gov/horizons/
 *
 * @example
 * ```typescript
 * // Parse vector table output from Horizons
 * const result = HorizonsParser.parseVectors(horizonsOutput);
 *
 * // Create an EphemerisBody from the data
 * const ceres = EphemerisBody.fromData(
 *   'ceres',
 *   result.targetName,
 *   CelestialBodyType.DWARF_PLANET,
 *   result.ephemeris.map(ep => ({
 *     date: ep.epoch.toDateTime(),
 *     position: { x: ep.position.x, y: ep.position.y, z: ep.position.z },
 *     velocity: ep.velocity ? { x: ep.velocity.x, y: ep.velocity.y, z: ep.velocity.z } : undefined,
 *   })),
 *   { isHeliocentric: result.isHeliocentric }
 * );
 * ```
 */
export class HorizonsParser {
  private constructor() {
    // Static class - prevent instantiation
  }

  /**
   * Parses NASA Horizons vector table format.
   *
   * Expects output from Horizons with settings:
   * - VECTORS (type 2 or 3)
   * - Output in km and km/s
   *
   * @param data - Raw Horizons output text
   * @returns Parsed ephemeris data
   */
  static parseVectors(data: string): HorizonsVectorResult {
    if (!data || data.trim().length === 0) {
      throw new ParseError('Horizons data is empty', 'HORIZONS');
    }

    const lines = data.split('\n');

    // Validate required markers exist
    const hasSOE = lines.some((l) => l.trim() === '$$SOE');
    const hasEOE = lines.some((l) => l.trim() === '$$EOE');

    if (!hasSOE || !hasEOE) {
      throw new ParseError('Missing $$SOE or $$EOE markers in Horizons data', 'HORIZONS');
    }

    const metadata: Record<string, string> = {};
    const ephemeris: HorizonsEphemerisData[] = [];
    let inData = false;
    let targetName = '';
    let centerBody = '';
    let referenceFrame = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Parse metadata
      if (line.startsWith('Target body name:')) {
        targetName = this.extractTargetName_(line, 'Target body name:');
        metadata.targetName = targetName;
      } else if (line.startsWith('Center body name:')) {
        centerBody = this.extractValue_(line, 'Center body name:');
        metadata.centerBody = centerBody;
      } else if (line.startsWith('Center-site name:') && !centerBody) {
        centerBody = this.extractValue_(line, 'Center-site name:');
        metadata.centerBody = centerBody;
      } else if (line.startsWith('Output type:')) {
        metadata.outputType = this.extractValue_(line, 'Output type:');
      } else if (line.startsWith('Reference frame:')) {
        referenceFrame = this.extractValue_(line, 'Reference frame:');
        metadata.referenceFrame = referenceFrame;
      } else if (line.startsWith('Output units:')) {
        metadata.outputUnits = this.extractValue_(line, 'Output units:');
      }

      // Check for data section start/end
      if (line === '$$SOE') {
        inData = true;
        continue;
      }
      if (line === '$$EOE') {
        inData = false;
        continue;
      }

      // Parse data lines
      if (inData && line.length > 0) {
        const parsed = this.parseVectorLine_(line, lines, i);

        if (parsed) {
          ephemeris.push(parsed.data);
          i = parsed.nextIndex - 1; // -1 because loop will increment
        }
      }
    }

    // Validate we found some data
    if (ephemeris.length === 0) {
      throw new ParseError('No valid ephemeris data found between $$SOE and $$EOE markers', 'HORIZONS');
    }

    // Determine if heliocentric
    const isHeliocentric =
      centerBody.toLowerCase().includes('sun') ||
      centerBody.toLowerCase().includes('solar') ||
      centerBody === 'Sun';

    return {
      targetName,
      centerBody,
      referenceFrame: referenceFrame || 'ICRF',
      isHeliocentric,
      ephemeris,
      metadata,
    };
  }

  /**
   * Parses NASA Horizons observer table format.
   *
   * @param data - Raw Horizons output text
   * @returns Parsed observer data
   */
  static parseObserver(data: string): HorizonsObserverResult {
    const lines = data.split('\n');
    const observations: HorizonsObserverResult['observations'] = [];
    let inData = false;
    let targetName = '';
    let observerLocation = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Parse metadata
      if (line.startsWith('Target body name:')) {
        targetName = this.extractTargetName_(line, 'Target body name:');
      } else if (line.startsWith('Center-site name:')) {
        observerLocation = this.extractValue_(line, 'Center-site name:');
      }

      // Check for data section
      if (line === '$$SOE') {
        inData = true;
        continue;
      }
      if (line === '$$EOE') {
        inData = false;
        continue;
      }

      // Parse observation lines
      if (inData && line.length > 0) {
        const parsed = this.parseObserverLine_(line);

        if (parsed) {
          observations.push(parsed);
        }
      }
    }

    return {
      targetName,
      observerLocation,
      observations,
    };
  }

  // ==================== Private Helper Methods ====================

  /**
   * Extracts a value from a key: value line.
   */
  private static extractValue_(line: string, key: string): string {
    const value = line.substring(key.length).trim();

    // Remove trailing metadata separated by 2+ spaces (e.g., "{source: astDys}")
    return value.split(/\s{2,}/u)[0].trim();
  }

  /**
   * Extracts the target body name, stripping parenthetical descriptors and IDs.
   *
   * Horizons format examples:
   * - "1 Ceres                       {source: astDys}" → "1 Ceres"
   * - "Artemis II (spacecraft) (-1024) {source: ...}"  → "Artemis II"
   * - "Mars (499)"                                     → "Mars"
   */
  private static extractTargetName_(line: string, key: string): string {
    const raw = this.extractValue_(line, key);

    // Strip parenthetical suffixes: "(spacecraft)", "(-1024)", "(499)", etc.
    // Stop at the first '(' that is preceded by a space (part of a suffix, not the name itself)
    const parenIdx = raw.search(/\s\(/u);

    if (parenIdx > 0) {
      return raw.substring(0, parenIdx).trim();
    }

    return raw;
  }

  /**
   * Parses a vector data line from Horizons output.
   * Horizons vector output can span multiple lines.
   */
  private static parseVectorLine_(
    line: string,
    allLines: string[],
    currentIndex: number,
  ): { data: HorizonsEphemerisData; nextIndex: number } | null {
    // Horizons vector format varies, but typically:
    // Line 1: JD, Calendar date
    // Line 2: X, Y, Z (position)
    // Line 3: VX, VY, VZ (velocity) - optional

    // Try to parse the Julian Date / Calendar date line
    const dateMatch = line.match(/^(\d+\.\d+)\s*=\s*A\.D\.\s*(\d{4})-(\w{3})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2}\.?\d*)/u);

    if (!dateMatch) {
      // Try alternate format with just numbers
      const parts = line.split(/\s+/u);

      if (parts.length >= 7) {
        // Assume: JD X Y Z VX VY VZ format
        try {
          const jd = parseFloat(parts[0]);

          if (isNaN(jd)) {
            return null;
          }

          const epoch = EpochUTC.fromDateTime(julianDateToDate(jd));
          const x = parseFloat(parts[1]) as Kilometers;
          const y = parseFloat(parts[2]) as Kilometers;
          const z = parseFloat(parts[3]) as Kilometers;

          let velocity: Vector3D<KilometersPerSecond> | undefined;

          if (parts.length >= 7 && !isNaN(parseFloat(parts[4]))) {
            velocity = new Vector3D(
              parseFloat(parts[4]) as KilometersPerSecond,
              parseFloat(parts[5]) as KilometersPerSecond,
              parseFloat(parts[6]) as KilometersPerSecond,
            );
          }

          return {
            data: {
              epoch,
              position: new Vector3D(x, y, z),
              velocity,
            },
            nextIndex: currentIndex + 1,
          };
        } catch {
          return null;
        }
      }

      return null;
    }

    // Parse the date
    const year = parseInt(dateMatch[2], 10);
    const monthStr = dateMatch[3];
    const day = parseInt(dateMatch[4], 10);
    const hour = parseInt(dateMatch[5], 10);
    const minute = parseInt(dateMatch[6], 10);
    const second = parseFloat(dateMatch[7]);

    const monthMap: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const month = monthMap[monthStr] ?? 0;

    const date = new Date(Date.UTC(year, month, day, hour, minute, Math.floor(second), (second % 1) * 1000));
    const epoch = EpochUTC.fromDateTime(date);

    // Parse position line (next line)
    let nextIndex = currentIndex + 1;

    if (nextIndex >= allLines.length) {
      return null;
    }

    const posLine = allLines[nextIndex].trim();

    // Try labeled format first: X = ... Y = ... Z = ...
    const posMatchLabeled = posLine.match(/X\s*=\s*([-\d.E+]+)\s+Y\s*=\s*([-\d.E+]+)\s+Z\s*=\s*([-\d.E+]+)/iu);
    // Then try unlabeled format: three bare numbers (scientific notation)
    const posMatchBare = !posMatchLabeled ? posLine.match(/^\s*([-\d.E+]+)\s+([-\d.E+]+)\s+([-\d.E+]+)\s*$/iu) : null;
    const posMatch = posMatchLabeled ?? posMatchBare;

    if (!posMatch) {
      return null;
    }

    const x = parseFloat(posMatch[1]) as Kilometers;
    const y = parseFloat(posMatch[2]) as Kilometers;
    const z = parseFloat(posMatch[3]) as Kilometers;
    const position = new Vector3D(x, y, z);

    nextIndex++;

    // Try to parse velocity line (optional)
    let velocity: Vector3D<KilometersPerSecond> | undefined;

    if (nextIndex < allLines.length) {
      const velLine = allLines[nextIndex].trim();

      // Try labeled format first: VX = ... VY = ... VZ = ...
      const velMatchLabeled = velLine.match(/VX\s*=\s*([-\d.E+]+)\s+VY\s*=\s*([-\d.E+]+)\s+VZ\s*=\s*([-\d.E+]+)/iu);
      // Then try unlabeled format: three bare numbers (scientific notation)
      const velMatchBare = !velMatchLabeled ? velLine.match(/^\s*([-\d.E+]+)\s+([-\d.E+]+)\s+([-\d.E+]+)\s*$/iu) : null;
      const velMatch = velMatchLabeled ?? velMatchBare;

      if (velMatch) {
        velocity = new Vector3D(
          parseFloat(velMatch[1]) as KilometersPerSecond,
          parseFloat(velMatch[2]) as KilometersPerSecond,
          parseFloat(velMatch[3]) as KilometersPerSecond,
        );
        nextIndex++;
      }
    }

    // Skip any remaining data lines for this entry (e.g., LT, RG, RR line in format 3)
    while (nextIndex < allLines.length) {
      const extraLine = allLines[nextIndex].trim();

      // Stop if we hit the next date line, $$EOE, or an empty line
      if (extraLine === '$$EOE' || extraLine.length === 0 ||
          (/^\d+\.\d+\s*=\s*A\.D\./u).test(extraLine)) {
        break;
      }

      // If it's just numbers (like LT RG RR), skip it
      if ((/^\s*[-\d.E+]+(\s+[-\d.E+]+)*\s*$/u).test(extraLine)) {
        nextIndex++;
      } else {
        break;
      }
    }

    return {
      data: { epoch, position, velocity },
      nextIndex,
    };
  }

  /**
   * Parses an observer table data line.
   */
  private static parseObserverLine_(line: string): HorizonsObserverResult['observations'][0] | null {
    // Observer format typically includes:
    // Date, RA (HMS), Dec (DMS), Delta (AU), Delta-dot, S-O-T, etc.
    // This is a simplified parser

    const parts = line.split(/\s+/u);

    if (parts.length < 5) {
      return null;
    }

    try {
      // Try to parse as JD RA Dec Delta LT format
      const jd = parseFloat(parts[0]);

      if (isNaN(jd)) {
        return null;
      }

      const epoch = EpochUTC.fromDateTime(julianDateToDate(jd));
      const ra = parseFloat(parts[1]); // Assuming already in degrees
      const dec = parseFloat(parts[2]);
      const distance = parseFloat(parts[3]);
      const lightTime = parseFloat(parts[4]) * 60; // Convert minutes to seconds if needed

      return { epoch, ra, dec, distance, lightTime };
    } catch {
      return null;
    }
  }
}
