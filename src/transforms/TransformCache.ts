/**
 * @author @thkruz Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
 *
 * Many of the classes are based off of the work of @david-rc-dayton and his
 * Pious Squid library (https://github.com/david-rc-dayton/pious_squid) which
 * is licensed under the MIT license.
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

export class TransformCache {
  private static readonly cache_: Map<string, unknown> = new Map();

  static get(key: string): unknown {
    const value = this.cache_.get(key);

    return value;
  }
  static add(key: string, value: unknown) {
    this.cache_.set(key, value);

    // Max of 1000 items in the cache
    if (this.cache_.size > 1000) {
      const firstKey = this.cache_.keys().next().value;

      if (!firstKey) {
        return;
      }

      this.cache_.delete(firstKey);
    }
  }
}
