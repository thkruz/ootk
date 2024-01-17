import { DifferentiableFunction } from '../main';

/**
 * Calculates the derivative of a differentiable function.
 * @param f The differentiable function.
 * @param h The step size for numerical differentiation. Default value is 1e-3.
 * @returns The derivative function.
 */
export function derivative(f: DifferentiableFunction, h = 1e-3): DifferentiableFunction {
  /**
   * @param x The value at which to calculate the derivative.
   * @returns The derivative of the function at the given value.
   */
  function df(x: number): number {
    const hh = h * 0.5;

    return (f(x + hh) - f(x - hh)) / h;
  }

  return df;
}
