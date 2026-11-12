import type { StreamEvent } from '#core/events';
import type { Command } from '#core/commands';
import type { Result } from '#core/primitives';
import { failure, getCurrentTime, success } from '#core/primitives';
import type {
  ShoppingCart,
  ShoppingCartConfirmed,
  ShoppingCartEvent,
  SHOPPING_CARD_CLOSED,
} from '..';
import { ShoppingCartStatus, when } from '..';
import { aggregateStream } from '#core/streams';

export type ConfirmShoppingCart = Command<
  'confirm-shopping-cart',
  {
    shoppingCartId: string;
  }
>;

export function confirmShoppingCart(
  events: StreamEvent<ShoppingCartEvent>[],
  command: ConfirmShoppingCart,
): Result<ShoppingCartConfirmed, SHOPPING_CARD_CLOSED> {
  const shoppingCart = aggregateStream<
    ShoppingCart,
    StreamEvent<ShoppingCartEvent>
  >(events, when);

  if (shoppingCart.status & ShoppingCartStatus.Closed) {
    return failure('SHOPPING_CARD_CLOSED');
  }

  return success({
    type: 'shopping-cart-confirmed',
    data: {
      shoppingCartId: command.data.shoppingCartId,
      confirmedAt: getCurrentTime(),
    },
  });
}
