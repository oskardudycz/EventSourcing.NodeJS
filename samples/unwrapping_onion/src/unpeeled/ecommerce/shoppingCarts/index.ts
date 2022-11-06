import { ProductItem } from 'src/unpeeled/ecommerce/shoppingCarts/productItems/productItem';
import {
  ProductItemAddedToShoppingCart,
  ProductItemRemovedFromShoppingCart,
  ShoppingCartConfirmed,
  ShoppingCartOpened,
} from './events';

export type ShoppingCart = Readonly<{
  id: string;
  status: string;
  productItems: Map<string, number>;
  revision: number;
}>;

export const open = (id: string, customerId: string): ShoppingCartOpened => {
  return {
    type: 'shopping-cart-opened',
    data: {
      shoppingCartId: id,
      customerId,
      openedAt: new Date(),
    },
  };
};

export const addProductItem = (
  cart: ShoppingCart,
  newProductItem: ProductItem
): ProductItemAddedToShoppingCart => {
  if (cart.status !== ShoppingCartStatus.Opened) {
    throw Error('Cannot add product to not opened shopping cart');
  }

  return {
    type: 'product-item-added-to-shopping-cart',
    data: {
      shoppingCartId: cart.id,
      productItem: newProductItem,
      addedAt: new Date(),
    },
  };
};

export const removeProductItem = (
  cart: ShoppingCart,
  productItemToRemove: ProductItem
): ProductItemRemovedFromShoppingCart => {
  if (cart.status !== ShoppingCartStatus.Opened) {
    throw Error('Cannot remove product from not opened shopping cart');
  }

  const { productId, quantity } = productItemToRemove;

  const currentQuantity = cart.productItems.get(productId);

  const newQuantity = (currentQuantity ?? 0) - quantity;

  if (newQuantity < 0) throw new Error('Product Item not found');

  return {
    type: 'product-item-removed-from-shopping-cart',
    data: {
      shoppingCartId: cart.id,
      productItem: productItemToRemove,
      removedAt: new Date(),
    },
  };
};

export const confirm = (cart: ShoppingCart): ShoppingCartConfirmed => {
  if (cart.status !== ShoppingCartStatus.Opened) {
    throw Error('Cannot confirm to not opened shopping cart');
  }
  return {
    type: 'shopping-cart-confirmed',
    data: {
      shoppingCartId: cart.id,
      confirmedAt: new Date(),
    },
  };
};

export const ShoppingCartStatus = {
  Opened: 'Opened',
  Confirmed: 'Confirmed',
};
