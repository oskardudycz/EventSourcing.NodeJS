import type { ProductItem } from '../productItems';
import type { ProductPriceCalculator } from './productPriceCalculator';

export const defaultUnitPrice = 100;

export type ChangeablePrices = ProductPriceCalculator & {
  setPriceOf: (productId: string, unitPrice: number) => void;
};

export const changeablePrices = (): ChangeablePrices => {
  const prices = new Map<string, number>();

  return {
    setPriceOf: (productId, unitPrice) => void prices.set(productId, unitPrice),
    calculate: (productItem: ProductItem) => ({
      ...productItem,
      unitPrice: prices.get(productItem.productId) ?? defaultUnitPrice,
    }),
  };
};
