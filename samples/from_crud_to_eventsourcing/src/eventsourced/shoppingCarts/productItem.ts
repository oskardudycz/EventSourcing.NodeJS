//////////////////////////////////////
/// Product Items
//////////////////////////////////////

import { ShoppingCartErrors } from './shoppingCart';

export interface ProductItem {
  productId: number;
  quantity: number;
}

export interface PricedProductItem {
  productId: number;
  quantity: number;
  sku: string;
  price: number;
  discount: number;
}

export const addProductItem = (
  productItems: PricedProductItem[],
  newProductItem: PricedProductItem
): PricedProductItem[] => {
  const { productId, quantity } = newProductItem;

  const currentProductItem = findProductItem(productItems, productId);

  if (!currentProductItem) return [...productItems, newProductItem];

  const newQuantity = currentProductItem.quantity + quantity;
  const mergedProductItem = { ...currentProductItem, quantity: newQuantity };

  return productItems.map((pi) =>
    pi.productId === productId ? mergedProductItem : pi
  );
};

export const removeProductItem = (
  productItems: PricedProductItem[],
  newProductItem: PricedProductItem
): PricedProductItem[] => {
  const { productId, quantity } = newProductItem;

  const currentProductItem = assertProductItemExists(
    productItems,
    newProductItem
  );

  const newQuantity = currentProductItem.quantity - quantity;

  if (newQuantity === 0)
    return productItems.filter((pi) => pi.productId !== productId);

  const mergedProductItem = { ...currentProductItem, quantity: newQuantity };

  return productItems.map((pi) =>
    pi.productId === productId ? mergedProductItem : pi
  );
};

export const findProductItem = (
  productItems: PricedProductItem[],
  productId: number
): PricedProductItem | undefined => {
  return productItems.find((pi) => pi.productId === productId);
};

export const assertProductItemExists = (
  productItems: PricedProductItem[],
  { productId, quantity }: ProductItem
): PricedProductItem => {
  const current = findProductItem(productItems, productId);

  if (!current || current.quantity < quantity) {
    throw ShoppingCartErrors.PRODUCT_ITEM_NOT_FOUND;
  }

  return current;
};

export const getPricedProductItem = (productItem: ProductItem) => {
  const pricedItem: PricedProductItem = {
    ...productItem,
    discount: 0,
    price: 100,
    sku: 'SKU',
  };

  return Promise.resolve(pricedItem);
};
