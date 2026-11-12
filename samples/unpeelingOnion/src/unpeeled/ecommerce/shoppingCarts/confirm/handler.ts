import type { ShoppingCart } from '../shoppingCart';
import { ShoppingCartStatus } from '../shoppingCart';
import type {
  ShoppingCartConfirmed,
  ConfirmShoppingCart,
} from '../shoppingCart';

export const confirmShoppingCart = (
  _command: ConfirmShoppingCart,
  cart: ShoppingCart,
): ShoppingCartConfirmed => {
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
