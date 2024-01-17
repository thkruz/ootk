import { derivative, jacobian } from '../../src/main';

// jacobian
it('should be calculate jacobian', () => {
  expect(jacobian((xs: Float64Array) => xs, 1, new Float64Array([1, 2, 3]))).toMatchSnapshot();
});

// derivative
it('should be calculate derivative', () => {
  expect(derivative((x: number) => x * x, 1)).toMatchSnapshot();
});
