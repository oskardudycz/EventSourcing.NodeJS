import { OpenShoppingCart, ShoppingCartOpened } from '../shoppingCart';

export const openShoppingCart = (
  command: OpenShoppingCart,
): ShoppingCartOpened => {
  return {
    type: 'shopping-cart-opened',
    data: {
      shoppingCartId: command.data.shoppingCartId,
      customerId: command.data.customerId,
      openedAt: new Date(),
    },
  };
};
