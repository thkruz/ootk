import { Kilometers, KilometersPerSecond, Vector, Vector3D } from '../../src/main';

describe('Vector3D', () => {
  // fromVector
  it('should create a Vector3D from a Vector3D', () => {
    const v = Vector3D.fromVector(new Vector([1, 2, 3]));

    expect(v).toMatchSnapshot();
  });

  // toArray
  it('should return an array of elements', () => {
    const v = new Vector3D(1, 2, 3);

    expect(v.toArray()).toMatchSnapshot();
  });

  // getElement
  it('should get an element from a Vector3D', () => {
    const v = new Vector3D(1, 2, 3);

    expect(v.getElement(0)).toBe(1);
    expect(v.getElement(1)).toBe(2);
    expect(v.getElement(2)).toBe(3);
  });

  // toVector
  it('should return a Vector3D as a Vector', () => {
    const v = new Vector3D(1, 2, 3);

    expect(v.toVector()).toMatchSnapshot();
  });

  // toString
  it('should return a Vector3D as a string', () => {
    const v = new Vector3D(1, 2, 3);

    expect(v.toString()).toMatchSnapshot();
  });

  // distance
  it('should return the distance between two Vector3Ds', () => {
    const v1 = new Vector3D(1, 2, 3);
    const v2 = new Vector3D(4, 5, 6);

    expect((v1 as Vector3D).distance(v2)).toMatchSnapshot();
  });

  // outer
  it('should return the outer product of two Vector3Ds', () => {
    const v1 = new Vector3D(1, 2, 3);
    const v2 = new Vector3D(4, 5, 6);

    expect(v1.outer(v2)).toMatchSnapshot();
  });

  // skewSymmetric
  it('should return the skew symmetric of a Vector3D', () => {
    const v = new Vector3D(1, 2, 3);

    expect(v.skewSymmetric()).toMatchSnapshot();
  });

  // angleDegrees
  it('should return the angle between two Vector3Ds in degrees', () => {
    const v1 = new Vector3D<number>(1, 2, 3);
    const v2 = new Vector3D(4, 5, 6);

    expect(v1.angleDegrees(v2)).toMatchSnapshot();
  });

  // sight
  it('should return the sight of a Vector3D', () => {
    const v = new Vector3D(1, 2, 3);
    const v2 = new Vector3D(4 as KilometersPerSecond, 5 as KilometersPerSecond, 6 as KilometersPerSecond);

    expect(v.sight(v2, 20 as Kilometers)).toMatchSnapshot();
  });

  // bisect
  it('should return the bisect of two Vector3Ds', () => {
    const v1 = new Vector3D(1, 2, 3);
    const v2 = new Vector3D(4, 5, 6);

    expect((v1 as Vector3D).bisect(v2)).toMatchSnapshot();
  });

  // row
  it('should return the row of a Vector3D', () => {
    const v = new Vector3D(1, 2, 3);

    expect(v.row()).toMatchSnapshot();
  });

  // column
  it('should return the column of a Vector3D', () => {
    const v = new Vector3D(1, 2, 3);

    expect(v.column()).toMatchSnapshot();
  });

  // join
  it('should return the join of two Vector3Ds', () => {
    const v1 = new Vector3D(1, 2, 3);
    const v2 = new Vector3D(4, 5, 6);

    expect(v1.join(v2)).toMatchSnapshot();
  });
});
