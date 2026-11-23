import { describe, expect, it } from 'vitest';
import { Urns } from './urns';

describe('Urns', () => {
  it('buildsAUrnFromNamespaceTypeAndTail', () => {
    expect(Urns.of('ecommerce', 'cart', 'abc')).toBe('urn:ecommerce:cart:abc');
  });

  it('derivesAUrnOfAnotherTypeWithTheSameTail', () => {
    expect(Urns.derive('urn:ecommerce:cart:abc-1', 'order')).toBe(
      'urn:ecommerce:order:abc-1',
    );
  });

  it('givesTheTailOfAUrn', () => {
    expect(Urns.tailOf('urn:ecommerce:cart:abc-1')).toBe('abc-1');
  });

  it('turnsAUrnIntoADotSeparatedRoutingKey', () => {
    expect(Urns.routingKeyOf('urn:ecommerce:cart:abc-1')).toBe(
      'ecommerce.cart.abc-1',
    );
  });

  it('rejectsAUrnOfAnotherType', () => {
    expect(() => Urns.requireType('urn:ecommerce:order:1', 'cart')).toThrow(
      "Urn has to be of type 'cart', but was 'order'",
    );
  });

  it('rejectsAValueThatIsNotAUrn', () => {
    expect(() => Urns.tailOf('abc')).toThrow('Urn has to be');
  });
});
