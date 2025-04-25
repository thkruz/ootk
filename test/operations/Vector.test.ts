import { DEG2RAD, Radians, Vector } from './../../src/main';

describe('Vector', () => {
  // create a Vector with elements and get its length
  it('should create a Vector with elements and get its length', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.length).toBe(3);
  });

  // create a Vector with all elements set to zero and get its length
  it('should create a Vector with all elements set to zero and get its length', () => {
    const v = Vector.zero(3);

    expect(v.length).toBe(3);
  });

  // create a Vector with all elements set to a value and get its length
  it('should create a Vector with all elements set to a value and get its length', () => {
    const v = Vector.filled(3, 5);

    expect(v.length).toBe(3);
  });

  // create a Vector from a list of elements and get its length
  it('should create a Vector from a list of elements and get its length', () => {
    const v = Vector.fromList([1, 2, 3]);

    expect(v.length).toBe(3);
  });

  // get the x, y, and z components of a Vector
  it('should get the x, y, and z components of a Vector', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.x).toBe(1);
    expect(v.y).toBe(2);
    expect(v.z).toBe(3);
  });

  // get the magnitude of a Vector
  it('should get the magnitude of a Vector', () => {
    const v = new Vector([3, 4]);

    expect(v.magnitude()).toBe(5);
  });

  // create a Vector with an empty array of elements
  it('should create a Vector with an empty array of elements', () => {
    const v = new Vector([]);

    expect(v.length).toBe(0);
  });

  // create a Vector with a negative length
  it('should create a Vector with a negative length', () => {
    expect(() => new Vector([-1, -2, -3])).toMatchSnapshot();
  });

  // add two Vectors and return a new Vector
  it('should add two Vectors and return a new Vector', () => {
    const v1 = new Vector([1, 2, 3]);
    const v2 = new Vector([4, 5, 6]);
    const result = v1.add(v2);

    expect(result).toMatchSnapshot();
  });

  // subtract two Vectors and return a new Vector
  it('should subtract two Vectors and return a new Vector when called', () => {
    const v1 = new Vector([1, 2, 3]);
    const v2 = new Vector([4, 5, 6]);
    const result = v1.subtract(v2);

    expect(result).toMatchInlineSnapshot(`
      Vector {
        "elements": Array [
          -3,
          -3,
          -3,
        ],
        "length": 3,
      }
    `);
  });

  // scale a Vector by a scalar and return a new Vector
  it('should scale a Vector by a scalar and return a new Vector when called with a scalar value', () => {
    const v = new Vector([1, 2, 3]);
    const scaledVector = v.scale(2);

    expect(scaledVector).toMatchInlineSnapshot(`
      Vector {
        "elements": Array [
          2,
          4,
          6,
        ],
        "length": 3,
      }
    `);
  });

  // negate a Vector and return a new Vector
  it('should negate a Vector and return a new Vector when calling the negate() method', () => {
    const v = new Vector([1, 2, 3]);
    const negated = v.negate();

    expect(negated).toEqual(new Vector([-1, -2, -3]));
  });

  // normalize a Vector and return a new Vector
  it('should normalize a Vector and return a new Vector', () => {
    const v = new Vector([3, 4]);
    const normalized = v.normalize();

    expect(normalized).toMatchSnapshot();
  });

  // calculate the dot product of two Vectors
  it('should calculate the dot product of two Vectors', () => {
    const v1 = new Vector([1, 2, 3]);
    const v2 = new Vector([4, 5, 6]);
    const dotProduct = v1.dot(v2);

    expect(dotProduct).toMatchSnapshot();
  });

  // toString
  it('should return a string representation of a Vector', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.toString()).toMatchSnapshot();
  });

  // toList
  it('should return a list representation of a Vector', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.toList()).toMatchSnapshot();
  });

  // toArray
  it('should return an array representation of a Vector', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.toArray()).toMatchSnapshot();
  });

  // distance
  it('should calculate the distance between two Vectors', () => {
    const v1 = new Vector([1, 2, 3]);
    const v2 = new Vector([4, 5, 6]);

    expect(v1.distance(v2)).toMatchSnapshot();
  });

  // outer
  it('should calculate the outer product of two Vectors', () => {
    const v1 = new Vector([1, 2, 3]);
    const v2 = new Vector([4, 5, 6]);

    expect(v1.outer(v2)).toMatchSnapshot();
  });

  // cross
  it('should calculate the cross product of two Vectors', () => {
    const v1 = new Vector([1, 2, 3]);
    const v2 = new Vector([4, 5, 6]);

    expect(v1.cross(v2)).toMatchSnapshot();
  });

  // skewSymmetric
  it('should calculate the skew symmetric matrix of a Vector', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.skewSymmetric()).toMatchSnapshot();
  });

  // rotX
  it('should rotate a Vector around the x-axis', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.rotX((90 * DEG2RAD) as Radians)).toMatchSnapshot();
  });

  // rotY
  it('should rotate a Vector around the y-axis', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.rotY((90 * DEG2RAD) as Radians)).toMatchSnapshot();
  });

  // rotZ
  it('should rotate a Vector around the z-axis', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.rotZ((90 * DEG2RAD) as Radians)).toMatchSnapshot();
  });

  // angle
  it('should calculate the angle between two Vectors', () => {
    const v1 = new Vector([1, 2, 3]);
    const v2 = new Vector([4, 5, 6]);

    expect(v1.angle(v2)).toMatchSnapshot();
  });

  // angleDegrees
  it('should calculate the angle between two Vectors in degrees', () => {
    const v1 = new Vector([1, 2, 3]);
    const v2 = new Vector([4, 5, 6]);

    expect(v1.angleDegrees(v2)).toMatchSnapshot();
  });

  // sight
  it('should calculate the sight of a Vector', () => {
    const v = new Vector([1, 2, 3]);
    const v2 = new Vector([4, 5, 6]);

    expect(v.sight(v2, (90 * DEG2RAD) as Radians)).toMatchSnapshot();
  });

  // bisect
  it('should calculate the bisect of two Vectors', () => {
    const v1 = new Vector([1, 2, 3]);
    const v2 = new Vector([4, 5, 6]);

    expect(v1.bisect(v2)).toMatchSnapshot();
  });

  // slice
  it('should slice a Vector', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.slice(1, 2)).toMatchSnapshot();
  });

  // join
  it('should join two Vectors', () => {
    const v1 = new Vector([1, 2, 3]);
    const v2 = new Vector([4, 5, 6]);

    expect(v1.join(v2)).toMatchSnapshot();
  });

  // row
  it('should get a row from a Vector', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.row()).toMatchSnapshot();
  });

  // column
  it('should get a column from a Vector', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.column()).toMatchSnapshot();
  });

  // toVector3D
  it('should convert a Vector to a Vector3D', () => {
    const v = new Vector([1, 2, 3]);

    expect(v.toVector3D(1)).toMatchSnapshot();
  });
});
