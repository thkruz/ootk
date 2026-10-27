/**
 * Assertion helpers shared by the integration tests.
 */

/**
 * Fails the test when `value` is null or undefined, and narrows its type for the code after it.
 * Use this instead of `toBeDefined()` on APIs that return `T | null`: `toBeDefined()` passes on null.
 * @param value The value under test.
 */
export function expectNotNull<T>(value: T | null | undefined): asserts value is T {
  expect(value).not.toBeNull();
  expect(value).toBeDefined();
}
