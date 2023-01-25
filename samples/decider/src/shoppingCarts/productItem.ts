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

export type ProductItems = Map<string, number>;

export const addProductItem = (
  productItems: ProductItems,
  newProductItem: ProductItem
): ProductItems => {
  const { productId, quantity } = newProductItem;

  return productItems.update(
    productId,
    (currentQuantity) => (currentQuantity ?? 0) + quantity
  );
};

export const removeProductItem = (
  productItems: ProductItems,
  productItemToRemove: ProductItem
): ProductItems => {
  const { productId, quantity } = productItemToRemove;

  assertProductItemExists(productItems, productItemToRemove);

  return productItems.update(
    productId,
    (currentQuantity) => (currentQuantity ?? 0) - quantity
  );
};

export const assertProductItemExists = (
  productItems: ProductItems,
  { productId, quantity }: ProductItem
): void => {
  const currentQuantity = productItems.get(productId) ?? 0;

  if (currentQuantity < quantity) {
    throw ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND;
  }
};

export const getProductPrice = (_productId: string): Promise<number> => {
  // You should call some real service or storage in real life, aye?
  return Promise.resolve(Math.random());
};
