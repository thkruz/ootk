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
 * Configuration options for history tracking.
 */
export interface HistoryConfig {
  /** Maximum number of entries to store. Undefined or 0 means unlimited. */
  maxLength?: number;
  /**
   * Minimum time between samples in milliseconds. A sample is skipped when its timestamp is
   * within this interval of the last stored sample, in either direction (|t - t_last| <
   * samplingInterval), so an earlier sample far from the last one is still kept.
   */
  samplingInterval?: number;
  /** If true, automatically removes oldest entries when maxLength is reached. */
  autoClean?: boolean;
}

/**
 * A single entry in the history.
 */
export interface HistoryEntry<T> {
  time: Date;
  data: T;
}

/**
 * Generic history tracking class for storing time-stamped data.
 * Used to track object state over time for visualization and analysis.
 */
export class History<T> {
  private entries_: HistoryEntry<T>[] = [];
  private config_: HistoryConfig;
  /** Timestamp (ms) of the last stored sample, or null before the first one. */
  private lastSampleTime_: number | null = null;

  constructor(config?: HistoryConfig) {
    this.config_ = {
      maxLength: config?.maxLength,
      samplingInterval: config?.samplingInterval ?? 0,
      autoClean: config?.autoClean ?? true,
    };
  }

  /**
   * Adds a new entry to the history (entries are kept in insertion order).
   * Respects sampling interval and max length constraints.
   * @param time - The timestamp for this entry
   * @param data - The data to store
   */
  add(time: Date, data: T): void {
    const timeMs = time.getTime();

    // Check sampling interval: skip only samples close in time to the last stored one. A plain
    // (t - t_last) test would drop every sample earlier than the last, so one forward sweep
    // sample (e.g. 7 days ahead) used to block all real-time samples until the clock caught up.
    if (this.config_.samplingInterval && this.config_.samplingInterval > 0 && this.lastSampleTime_ !== null) {
      if (Math.abs(timeMs - this.lastSampleTime_) < this.config_.samplingInterval) {
        return; // Skip this sample
      }
    }

    // Check max length and clean if needed
    if (this.config_.maxLength && this.entries_.length >= this.config_.maxLength) {
      if (this.config_.autoClean) {
        this.entries_.shift(); // Remove oldest entry
      } else {
        return; // Don't add if full and autoClean is disabled
      }
    }

    this.entries_.push({ time, data });
    this.lastSampleTime_ = timeMs;
  }

  /**
   * Returns all history entries.
   */
  getAll(): HistoryEntry<T>[] {
    return [...this.entries_];
  }

  /**
   * Returns entries within a time range (inclusive).
   * @param start - Start of the time range
   * @param end - End of the time range
   */
  getRange(start: Date, end: Date): HistoryEntry<T>[] {
    const startMs = start.getTime();
    const endMs = end.getTime();

    return this.entries_.filter((entry) => {
      const entryMs = entry.time.getTime();

      return entryMs >= startMs && entryMs <= endMs;
    });
  }

  /**
   * Returns the last n entries.
   * @param n - Number of entries to return
   */
  getLast(n: number): HistoryEntry<T>[] {
    if (n <= 0) {
      return [];
    }
    if (n >= this.entries_.length) {
      return [...this.entries_];
    }

    return this.entries_.slice(-n);
  }

  /**
   * Returns the first entry, or undefined if empty.
   */
  getFirst(): HistoryEntry<T> | undefined {
    return this.entries_[0];
  }

  /**
   * Returns the most recent entry, or undefined if empty.
   */
  getLatest(): HistoryEntry<T> | undefined {
    return this.entries_[this.entries_.length - 1];
  }

  /**
   * Clears all history entries.
   */
  clear(): void {
    this.entries_ = [];
    this.lastSampleTime_ = null;
  }

  /**
   * Creates a deep copy of this history. Entry data is copied recursively (plain objects,
   * arrays, Dates and class instances, whose prototype is kept), so changing nested data in
   * one history does not affect the other. Functions are shared.
   * @returns A new History instance with cloned entries
   */
  clone(): History<T> {
    const cloned = new History<T>(this.config);

    for (const entry of this.entries_) {
      cloned.entries_.push({
        time: new Date(entry.time),
        data: History.deepCopy_(entry.data),
      });
    }
    cloned.lastSampleTime_ = this.lastSampleTime_;

    return cloned;
  }

  /**
   * Recursive copy of a value (see {@link clone}). Cycles are preserved through `seen`.
   * @param value - The value to copy.
   * @param seen - Already-copied objects, for cyclic data.
   * @returns The copy.
   */
  private static deepCopy_<V>(value: V, seen = new Map<object, unknown>()): V {
    if (typeof value !== 'object' || value === null) {
      return value;
    }
    if (seen.has(value)) {
      return seen.get(value) as V;
    }
    if (value instanceof Date) {
      return new Date(value.getTime()) as V;
    }
    if (Array.isArray(value)) {
      const arr: unknown[] = [];

      seen.set(value, arr);
      for (const item of value) {
        arr.push(History.deepCopy_(item, seen));
      }

      return arr as V;
    }
    if (ArrayBuffer.isView(value)) {
      return (value as unknown as { slice: () => unknown }).slice() as V;
    }

    const copy = Object.create(Object.getPrototypeOf(value) as object | null) as Record<string, unknown>;

    seen.set(value, copy);
    for (const key of Object.keys(value)) {
      copy[key] = History.deepCopy_((value as Record<string, unknown>)[key], seen);
    }

    return copy as V;
  }

  /**
   * Returns the number of entries in the history.
   */
  get length(): number {
    return this.entries_.length;
  }

  /**
   * Returns the current configuration.
   */
  get config(): HistoryConfig {
    return { ...this.config_ };
  }

  /**
   * Returns true if the history is empty.
   */
  get isEmpty(): boolean {
    return this.entries_.length === 0;
  }

  /**
   * Returns the time span covered by the history in milliseconds.
   * Returns 0 if there are fewer than 2 entries.
   */
  get timeSpan(): number {
    if (this.entries_.length < 2) {
      return 0;
    }

    const first = this.entries_[0].time.getTime();
    const last = this.entries_[this.entries_.length - 1].time.getTime();

    return last - first;
  }

  toString(): string {
    const lines = [
      '[History]',
      `  Entries: ${this.entries_.length}`,
    ];

    if (this.entries_.length >= 2) {
      const first = this.entries_[0].time.toISOString();
      const last = this.entries_[this.entries_.length - 1].time.toISOString();

      lines.push(`  Time Span: ${first} - ${last}`);
    } else if (this.entries_.length === 1) {
      lines.push(`  Time: ${this.entries_[0].time.toISOString()}`);
    }

    if (this.config_.maxLength !== undefined) {
      lines.push(`  Max Length: ${this.config_.maxLength}`);
    }

    if (this.config_.samplingInterval && this.config_.samplingInterval > 0) {
      lines.push(`  Sampling Interval: ${this.config_.samplingInterval} ms`);
    }

    return lines.join('\n');
  }
}
