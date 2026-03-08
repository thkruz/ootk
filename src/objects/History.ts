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
  /** Maximum number of entries to store. Undefined means unlimited. */
  maxLength?: number;
  /** Minimum time between samples in milliseconds. */
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
  private lastSampleTime_ = 0;

  constructor(config?: HistoryConfig) {
    this.config_ = {
      maxLength: config?.maxLength,
      samplingInterval: config?.samplingInterval ?? 0,
      autoClean: config?.autoClean ?? true,
    };
  }

  /**
   * Adds a new entry to the history.
   * Respects sampling interval and max length constraints.
   * @param time - The timestamp for this entry
   * @param data - The data to store
   */
  add(time: Date, data: T): void {
    const timeMs = time.getTime();

    // Check sampling interval
    if (this.config_.samplingInterval && this.config_.samplingInterval > 0) {
      if (timeMs - this.lastSampleTime_ < this.config_.samplingInterval) {
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
    this.lastSampleTime_ = 0;
  }

  /**
   * Creates a deep copy of this history.
   * @returns A new History instance with cloned entries
   */
  clone(): History<T> {
    const cloned = new History<T>(this.config);

    for (const entry of this.entries_) {
      // Deep copy the entry data (for objects like HistoricalState: {position, velocity})
      const clonedData = typeof entry.data === 'object' && entry.data !== null
        ? { ...entry.data } as T
        : entry.data;

      cloned.entries_.push({
        time: new Date(entry.time),
        data: clonedData,
      });
    }
    cloned.lastSampleTime_ = this.lastSampleTime_;

    return cloned;
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
