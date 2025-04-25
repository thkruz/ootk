import { Vec3 } from '../types/types.js';

/**
 * Calculates the linear distance between two points in three-dimensional space.
 * @param pos1 The first position.
 * @param pos2 The second position.
 * @returns The linear distance between the two positions in kilometers.
 */
export function linearDistance<D extends number>(pos1: Vec3<D>, pos2: Vec3<D>): D {
  return <D>Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2 + (pos1.z - pos2.z) ** 2);
}
