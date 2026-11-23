import type { PricedProductItem, ProductItem } from '../productItems';

export type ProductPriceCalculator = {
  calculate: (productItem: ProductItem) => PricedProductItem;
};
