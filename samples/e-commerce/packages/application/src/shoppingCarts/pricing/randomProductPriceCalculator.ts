import type { ProductItem } from '../productItems';
import type { ProductPriceCalculator } from './productPriceCalculator';

export const randomProductPriceCalculator = (): ProductPriceCalculator => {
  const productPrices = new Map<string, number>();

  return {
    calculate: (productItem: ProductItem) => {
      const unitPrice =
        productPrices.get(productItem.productId) ??
        (1 + Math.floor(Math.random() * 9999)) / 100;
      productPrices.set(productItem.productId, unitPrice);

      return { ...productItem, unitPrice };
    },
  };
};
