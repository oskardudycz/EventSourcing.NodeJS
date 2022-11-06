import { ShoppingCart, ShoppingCartStatus } from '../shoppingCart';
import {
  ProductItemRemovedFromShoppingCart,
  RemoveProductItemFromShoppingCart,
} from '../shoppingCart';

export const removeProductItemFromShoppingCart = (
  command: RemoveProductItemFromShoppingCart,
  cart: ShoppingCart
): ProductItemRemovedFromShoppingCart => {
  if (cart.status !== ShoppingCartStatus.Opened) {
    throw Error('Cannot remove product from not opened shopping cart');
  }

  const productItemToRemove = command.data.productItem;

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
