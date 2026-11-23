import { describe, expect, it } from 'vitest';
import { randomProductPriceCalculator } from './randomProductPriceCalculator';

describe('randomProductPriceCalculator', () => {
  it('givesTheSamePriceForTheSameProduct', () => {
    const prices = randomProductPriceCalculator();
    const item = { productId: 'shoes', quantity: 1 };

    expect(prices.calculate(item).unitPrice).toBe(
      prices.calculate(item).unitPrice,
    );
  });

  it('givesAPositivePriceInWholeCents', () => {
    const { unitPrice } = randomProductPriceCalculator().calculate({
      productId: 'shoes',
      quantity: 1,
    });

    expect(unitPrice).toBeGreaterThan(0);
    expect(Math.round(unitPrice * 100)).toBeCloseTo(unitPrice * 100, 6);
  });
});
