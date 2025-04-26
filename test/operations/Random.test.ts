import { Random } from '../../src/main';

describe('Random', () => {
  // nextFloat
  it('should return a random float', () => {
    const r = new Random();

    expect(r.nextFloat()).toMatchSnapshot();
  });

  // nextInt
  it('should return a random int', () => {
    const r = new Random();

    expect(r.nextInt()).toMatchSnapshot();
  });

  // nextBool
  it('should return a random bool', () => {
    const r = new Random();

    expect(r.nextBool()).toMatchSnapshot();
  });
});
