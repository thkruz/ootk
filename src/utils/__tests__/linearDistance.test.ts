import { Vec3 } from '../../types/types';
import { linearDistance } from '../linearDistance';

describe('linearDistance', () => {
  it('should calculate distance between two points', () => {
    const pos1: Vec3<number> = { x: 0, y: 0, z: 0 };
    const pos2: Vec3<number> = { x: 3, y: 4, z: 0 };
    const result = linearDistance(pos1, pos2);

    expect(result).toBe(5);
  });

  it('should calculate distance in 3D space', () => {
    const pos1: Vec3<number> = { x: 1, y: 2, z: 3 };
    const pos2: Vec3<number> = { x: 4, y: 6, z: 8 };
    const result = linearDistance(pos1, pos2);

    expect(result).toBeCloseTo(7.0711, 4);
  });

  it('should return 0 for identical points', () => {
    const pos1: Vec3<number> = { x: 5, y: 10, z: 15 };
    const pos2: Vec3<number> = { x: 5, y: 10, z: 15 };
    const result = linearDistance(pos1, pos2);

    expect(result).toBe(0);
  });

  it('should handle negative coordinates', () => {
    const pos1: Vec3<number> = { x: -1, y: -2, z: -3 };
    const pos2: Vec3<number> = { x: 2, y: 3, z: 4 };
    const result = linearDistance(pos1, pos2);

    expect(result).toBeCloseTo(9.1104, 4);
  });

  it('should calculate distance along single axis', () => {
    const pos1: Vec3<number> = { x: 0, y: 0, z: 0 };
    const pos2: Vec3<number> = { x: 10, y: 0, z: 0 };
    const result = linearDistance(pos1, pos2);

    expect(result).toBe(10);
  });
});
