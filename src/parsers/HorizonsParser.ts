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
import { Kilometers, KilometersPerSecond, Seconds } from '../types/types';
import { KM_PER_AU } from '../utils/constants';

const MONTHS_: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

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
 * Converts a time read on the TDB scale (Horizons vector tables are JDTDB) to UTC.
 * TT is used for TDB: they differ by under 2 ms.
 * @param tdb - The TDB time, stored as if it were a UTC Date
 * @returns The UTC epoch
 */
function tdbDateToEpochUtc(tdb: Date): EpochUTC {
  const j2000Posix = 946728000; // 2000-01-01T12:00:00, the J2000 reference instant

  return EpochUTC.fromJ2000TTSeconds((tdb.getTime() / 1000 - j2000Posix) as Seconds);
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
   * - VECTORS (type 2 or 3), plain or CSV (CSV_FORMAT=YES)
   * - OUT_UNITS KM-S, KM-D or AU-D (read from the "Output units" header line; values are
   *   converted to km and km/s, with 1 au = KM_PER_AU km and 1 day = 86400 s). A table with no
   *   "Output units" line is read as KM-S.
   *
   * @param data - Raw Horizons output text
   * @returns Parsed ephemeris data (km, km/s)
   * @throws ParseError when the output units are not one of the above
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

      // Parse metadata. Horizons pads labels before the colon for column
      // alignment (e.g. "Output units    : KM-S"), so match label-then-colon
      // rather than an exact "Label:" prefix.
      const meta = this.matchMetadataLine_(line);

      if (meta) {
        switch (meta.label) {
          case 'Target body name':
            targetName = this.stripNameSuffixes_(meta.value);
            metadata.targetName = targetName;
            break;
          case 'Center body name':
            centerBody = meta.value;
            metadata.centerBody = centerBody;
            break;
          case 'Center-site name':
            if (!centerBody) {
              centerBody = meta.value;
              metadata.centerBody = centerBody;
            }
            break;
          case 'Output type':
            metadata.outputType = meta.value;
            break;
          case 'Reference frame':
            referenceFrame = meta.value;
            metadata.referenceFrame = referenceFrame;
            break;
          case 'Output units':
            metadata.outputUnits = meta.value;
            break;
          default:
            break;
        }
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

    // Convert to km and km/s from the table's OUT_UNITS
    const units = (metadata.outputUnits ?? 'KM-S').trim().toUpperCase();
    const unitScales: Record<string, [number, number]> = {
      'KM-S': [1, 1],
      'KM-D': [1, 1 / 86400],
      'AU-D': [KM_PER_AU, KM_PER_AU / 86400],
    };
    const scale = unitScales[units];

    if (!scale) {
      throw new ParseError(`Unsupported Horizons output units "${metadata.outputUnits}"; use KM-S, KM-D or AU-D`, 'HORIZONS');
    }
    if (scale[0] !== 1 || scale[1] !== 1) {
      for (const ep of ephemeris) {
        ep.position = ep.position.scale(scale[0]) as Vector3D<Kilometers>;
        if (ep.velocity) {
          ep.velocity = ep.velocity.scale(scale[1]) as Vector3D<KilometersPerSecond>;
        }
      }
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

      // Parse metadata (tolerating Horizons' padded-colon alignment)
      const targetRaw = this.extractLabeledValue_(line, 'Target body name');
      const siteRaw = this.extractLabeledValue_(line, 'Center-site name');

      if (targetRaw !== null) {
        targetName = this.stripNameSuffixes_(targetRaw);
      } else if (siteRaw !== null) {
        observerLocation = siteRaw;
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

  /** Metadata labels recognized in Horizons output headers. */
  private static readonly metadataLabels_ = [
    'Target body name',
    'Center body name',
    'Center-site name',
    'Output type',
    'Reference frame',
    'Output units',
  ] as const;

  /**
   * Extracts a metadata value from a `Label : value` line, tolerating the
   * column-aligned padding Horizons inserts before the colon (e.g.
   * "Output units    : KM-S"). Returns null if the line does not carry the
   * given label.
   */
  private static extractLabeledValue_(line: string, label: string): string | null {
    if (!line.startsWith(label)) {
      return null;
    }

    const rest = line.substring(label.length);
    const colonIdx = rest.indexOf(':');

    if (colonIdx === -1 || rest.substring(0, colonIdx).trim().length > 0) {
      return null;
    }

    // Remove trailing metadata separated by 2+ spaces (e.g., "{source: astDys}")
    return rest.substring(colonIdx + 1).trim().split(/\s{2,}/u)[0].trim();
  }

  /** Returns the first recognized metadata label/value on the line, if any. */
  private static matchMetadataLine_(line: string): { label: string; value: string } | null {
    for (const label of this.metadataLabels_) {
      const value = this.extractLabeledValue_(line, label);

      if (value !== null) {
        return { label, value };
      }
    }

    return null;
  }

  /**
   * Strips parenthetical descriptors and IDs from a target body name.
   *
   * Horizons format examples:
   * - "1 Ceres"                       → "1 Ceres"
   * - "Artemis II (spacecraft) (-1024)" → "Artemis II"
   * - "Mars (499)"                    → "Mars"
   */
  private static stripNameSuffixes_(raw: string): string {
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

    // CSV_FORMAT=YES: "JDTDB, Calendar Date (TDB), X, Y, Z, VX, VY, VZ, [LT, RG, RR,]"
    if (line.includes(',')) {
      return HorizonsParser.parseCsvVectorLine_(line, currentIndex);
    }

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

          // Horizons vector tables give JDTDB, which runs ~69 s ahead of UTC
          const epoch = tdbDateToEpochUtc(julianDateToDate(jd));
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

    const month = MONTHS_[monthStr] ?? 0;

    const date = new Date(Date.UTC(year, month, day, hour, minute, Math.floor(second), (second % 1) * 1000));
    // Vector tables are on TDB (the line ends "TDB"); only a line marked UT is already UTC
    const isUt = (/\bUTC?\b/u).test(line.slice(dateMatch[0].length));
    const epoch = isUt ? EpochUTC.fromDateTime(date) : tdbDateToEpochUtc(date);

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
   * Parses one CSV vector line (CSV_FORMAT=YES). Columns: JDTDB, calendar date (TDB), X, Y, Z,
   * then VX, VY, VZ when present; any further columns (LT, RG, RR) are ignored.
   * @param line The trimmed data line.
   * @param currentIndex Index of the line.
   * @returns The state, or null when the line is not a CSV vector record.
   * @throws ParseError when a record has a JD but non-numeric position fields.
   */
  private static parseCsvVectorLine_(
    line: string,
    currentIndex: number,
  ): { data: HorizonsEphemerisData; nextIndex: number } | null {
    const fields = line.split(',').map((f) => f.trim());

    while (fields.length > 0 && fields[fields.length - 1] === '') {
      fields.pop();
    }

    const jd = Number(fields[0]);

    if (fields.length < 5 || !Number.isFinite(jd)) {
      return null;
    }

    const nums = fields.slice(2).map((f) => Number(f));

    if (nums.slice(0, 3).some((n) => !Number.isFinite(n))) {
      throw new ParseError(`Malformed Horizons CSV vector line: "${line}"`, 'HORIZONS');
    }

    const position = new Vector3D(nums[0] as Kilometers, nums[1] as Kilometers, nums[2] as Kilometers);
    let velocity: Vector3D<KilometersPerSecond> | undefined;

    if (nums.length >= 6 && nums.slice(3, 6).every((n) => Number.isFinite(n))) {
      velocity = new Vector3D(nums[3] as KilometersPerSecond, nums[4] as KilometersPerSecond, nums[5] as KilometersPerSecond);
    }

    return {
      // Vector tables are on TDB
      data: { epoch: tdbDateToEpochUtc(julianDateToDate(jd)), position, velocity },
      nextIndex: currentIndex + 1,
    };
  }

  /**
   * Parses an observer table data line.
   *
   * Observer tables start with the UT calendar date ("2024-Dec-01 00:00[:ss[.fff]]"), followed
   * by optional solar/lunar presence flags, then the requested quantities. This parser reads the
   * first four quantities as RA (deg), Dec (deg), Delta (au) and one-way light time (min), the
   * layout of QUANTITIES='1,20,21' with ANG_FORMAT=DEG; sexagesimal RA/Dec (ANG_FORMAT=HMS) is
   * converted to degrees. Both CSV and whitespace-separated tables are accepted. A line that
   * starts with a Julian date (UT) instead of a calendar date is also accepted.
   * @param line The trimmed data line.
   * @returns The observation (RA/Dec in deg, distance in au, light time in s), or null.
   */
  private static parseObserverLine_(line: string): HorizonsObserverResult['observations'][0] | null {
    const dateMatch = (/^b?(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?/u).exec(line);
    let epoch: EpochUTC;
    let rest: string;

    if (dateMatch) {
      const month = MONTHS_[dateMatch[2]];

      if (month === undefined) {
        return null;
      }
      const sec = dateMatch[6] ? Number(dateMatch[6]) : 0;
      const ms = Date.UTC(Number(dateMatch[1]), month, Number(dateMatch[3]), Number(dateMatch[4]), Number(dateMatch[5])) +
        sec * 1000;

      epoch = EpochUTC.fromDateTime(new Date(ms));
      rest = line.substring(dateMatch[0].length);
    } else {
      const first = (/^\s*(\d+\.\d+)[,\s]/u).exec(line);

      if (!first) {
        return null;
      }
      epoch = EpochUTC.fromDateTime(julianDateToDate(Number(first[1])));
      rest = line.substring(first[0].length);
    }

    const isCsv = rest.includes(',');
    let tokens = isCsv
      ? rest.split(',').map((t) => t.trim())
      : rest.trim().split(/\s+/u);

    // Drop empty CSV cells and the solar/lunar presence flags ("*", "C", "N", "A", "m", ...)
    tokens = tokens.filter((t) => t.length > 0 && !(/^[*A-Za-z]{1,2}$/u).test(t));

    let ra: number;
    let dec: number;
    let next: number;
    const sexagesimal = (t: string[], i: number): boolean => (/^\d{1,2}$/u).test(t[i] ?? '') &&
      (/^\d{1,2}$/u).test(t[i + 1] ?? '') && (/^\d{1,2}(?:\.\d*)?$/u).test(t[i + 2] ?? '') &&
      (/^[+-]?\d{1,2}$/u).test(t[i + 3] ?? '') && (/^\d{1,2}$/u).test(t[i + 4] ?? '') &&
      (/^\d{1,2}(?:\.\d*)?$/u).test(t[i + 5] ?? '');

    if (isCsv && tokens[0]?.includes(' ')) {
      // CSV with sexagesimal cells: "hh mm ss.ff", "+dd mm ss.f"
      const [h, m, sRa] = tokens[0].split(/\s+/u).map(Number);
      const decParts = tokens[1].split(/\s+/u);
      const sign = decParts[0].startsWith('-') ? -1 : 1;

      ra = (h + m / 60 + sRa / 3600) * 15;
      dec = sign * (Math.abs(Number(decParts[0])) + Number(decParts[1]) / 60 + Number(decParts[2]) / 3600);
      next = 2;
    } else if (!isCsv && sexagesimal(tokens, 0)) {
      const sign = tokens[3].startsWith('-') ? -1 : 1;

      ra = (Number(tokens[0]) + Number(tokens[1]) / 60 + Number(tokens[2]) / 3600) * 15;
      dec = sign * (Math.abs(Number(tokens[3])) + Number(tokens[4]) / 60 + Number(tokens[5]) / 3600);
      next = 6;
    } else {
      ra = Number(tokens[0]);
      dec = Number(tokens[1]);
      next = 2;
    }

    const distance = Number(tokens[next]);
    const lightTimeMin = Number(tokens[next + 1]);

    if (![ra, dec, distance, lightTimeMin].every((v) => Number.isFinite(v))) {
      return null;
    }

    // One-way light time is given in minutes
    return { epoch, ra, dec, distance, lightTime: lightTimeMin * 60 };
  }
}
