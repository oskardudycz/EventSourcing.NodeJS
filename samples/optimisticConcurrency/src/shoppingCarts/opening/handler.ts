import type { Command } from '#core/commands';
import type { Result } from '#core/primitives';
import { getCurrentTime, success } from '#core/primitives';
import type { ShoppingCartOpened } from '..';

export type OpenShoppingCart = Command<
  'open-shopping-cart',
  {
    shoppingCartId: string;
    clientId: string;
  }
>;

export function openShoppingCart(
  command: OpenShoppingCart,
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
