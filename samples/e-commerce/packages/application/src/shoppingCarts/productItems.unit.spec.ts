import { describe, expect, it } from 'vitest';
import { ProductItems, type PricedProductItem } from './productItems';

const shoes = (quantity: number, unitPrice = 50): PricedProductItem => ({
  productId: 'shoes',
  quantity,
  unitPrice,
});

describe('ProductItems', () => {
  it('threeAt19_99TotalTo59_97', () => {
    const items = ProductItems.add([], shoes(3, 19.99));

    expect(ProductItems.totalPrice(items)).toBe(59.97);
  });

  it('addingTheSameProductAtTheSamePriceGrowsTheQuantity', () => {
    const items = ProductItems.add([shoes(2)], shoes(1));

    expect(items).toEqual([shoes(3)]);
  });

  it('removingAllOfTheQuantityRemovesTheLine', () => {
    expect(ProductItems.remove([shoes(2)], shoes(2))).toEqual([]);
  });

  it('removingSomeOfTheQuantityShrinksTheLine', () => {
    expect(ProductItems.remove([shoes(2)], shoes(1))).toEqual([shoes(1)]);
  });

  it('removingAProductThatIsNotThereFails', () => {
    expect(() => ProductItems.remove([], shoes(1))).toThrow(
      "Product item wasn't found",
    );
  });

  it('removingMoreThanThereIsFails', () => {
    expect(() => ProductItems.remove([shoes(1)], shoes(2))).toThrow(
      'Not enough product items',
    );
  });

  it('changingTheUnitPriceKeepsTheQuantity', () => {
    expect(ProductItems.changeUnitPrice([shoes(2)], 'shoes', 60)).toEqual([
      shoes(2, 60),
    ]);
  });
});
