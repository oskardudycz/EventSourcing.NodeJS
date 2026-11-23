import { describe, expect, it } from 'vitest';
import { matchesBindingKey } from './bindingKeys';

describe('matchesBindingKey', () => {
  it.each([
    ['#', 'ecommerce.cart.1', true],
    ['#', '', true],
    ['ecommerce.*.1', 'ecommerce.cart.1', true],
    ['ecommerce.*', 'ecommerce.cart.1', false],
    ['ecommerce.#', 'ecommerce.cart.1', true],
    ['ecommerce.#', 'ecommerce', true],
    ['#.1', 'ecommerce.cart.1', true],
    ['ecommerce.cart.2', 'ecommerce.cart.1', false],
  ])('pattern %s on key %s is %s', (pattern, key, expected) => {
    expect(matchesBindingKey(pattern, key)).toBe(expected);
  });
});
