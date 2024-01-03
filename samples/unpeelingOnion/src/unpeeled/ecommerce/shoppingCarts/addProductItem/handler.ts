import { ShoppingCart, ShoppingCartStatus } from '../shoppingCart';
import {
  ProductItemAddedToShoppingCart,
  AddProductItemToShoppingCart,
} from '../shoppingCart';

export const addProductItemToShoppingCart = (
  command: AddProductItemToShoppingCart,
  cart: ShoppingCart,
): ProductItemAddedToShoppingCart => {
  if (cart.status !== ShoppingCartStatus.Opened) {
    throw Error('Cannot add product to not opened shopping cart');
  }

  return {
    type: 'product-item-added-to-shopping-cart',
    data: {
      shoppingCartId: cart.id,
      productItem: command.data.productItem,
      addedAt: new Date(),
    },
  };
};
