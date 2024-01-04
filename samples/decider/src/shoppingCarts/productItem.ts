//////////////////////////////////////
/// Product Items
//////////////////////////////////////

import { Map } from 'immutable';
import { ShoppingCartErrors } from './shoppingCart';

export interface ProductItem {
  productId: string;
  quantity: number;
}

export type PricedProductItem = ProductItem & {
  price: number;
};

export type ProductItems = Map<string, Map<number, number>>;

export const addProductItem = (
  productItems: ProductItems,
  { productId, quantity, price }: PricedProductItem,
): ProductItems => {
  return productItems.update(productId, (productWithPrice) =>
    (productWithPrice ?? Map<number, number>()).update(
      price,
      (currentQuantity) => (currentQuantity ?? 0) + quantity,
    ),
  );
};

export const removeProductItem = (
  productItems: ProductItems,
  { productId, quantity, price }: PricedProductItem,
): ProductItems => {
  return productItems.update(productId, (productWithPrice) =>
    (productWithPrice ?? Map<number, number>()).update(
      price,
      (currentQuantity) => {
        if (!currentQuantity || currentQuantity < quantity) {
          throw ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND;
        }
        return currentQuantity - quantity;
      },
    ),
  );
};

export const assertProductItemExists = (
  productItems: ProductItems,
  { productId, quantity, price }: PricedProductItem,
): void => {
  const currentQuantity = productItems.get(productId)?.get(price) ?? 0;

  if (currentQuantity < quantity) {
    throw ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND;
  }
};

export const getProductPrice = (_productId: string): Promise<number> => {
  // You should call some real service or storage in real life, aye?
  return Promise.resolve(Math.random());
};
