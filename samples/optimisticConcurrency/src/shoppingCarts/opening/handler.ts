import { Command } from '#core/commands';
import { getCurrentTime, Result, success } from '#core/primitives';
import { ShoppingCartOpened } from '..';

export type OpenShoppingCart = Command<
  'open-shopping-cart',
  {
    shoppingCartId: string;
    clientId: string;
  }
>;

export function handleOpenShoppingCart(
  command: OpenShoppingCart
): Result<ShoppingCartOpened> {
  return success({
    type: 'shopping-cart-opened',
    data: {
      shoppingCartId: command.data.shoppingCartId,
      clientId: command.data.clientId,
      openedAt: getCurrentTime(),
    },
  });
}
