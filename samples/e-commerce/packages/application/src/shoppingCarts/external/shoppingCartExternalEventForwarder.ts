import {
  externalMessageId,
  getForwarderId,
  type ForwardedMessage,
  type ForwardingHandler,
  type ForwardTo,
  type HandlerRetryOptions,
} from '@e-commerce/core';
import type { RecordedMessage } from '@event-driven-io/emmett';
import type { ShoppingCartEvent } from '../shoppingCart';
import {
  shoppingCartsChannels,
  shoppingCartsRoutes,
} from '../shoppingCartsConfig';
import type { ShoppingCartCheckedOutExternal } from './shoppingCartExternalEvent';
import type { ShoppingCartSummaries } from './shoppingCartSummaries';

export const shoppingCartsExternalForwarderId = getForwarderId({
  name: 'shopping_carts-external',
});

const toExternalEvents =
  (summaries: ShoppingCartSummaries) =>
  async (
    event: RecordedMessage<ShoppingCartEvent>,
  ): Promise<ForwardedMessage<ShoppingCartCheckedOutExternal>[]> => {
    if (event.type !== 'shopping_carts.ShoppingCartCheckedOut') return [];

    const summary = await summaries.get(event.data.shoppingCartId);

    if (!summary)
      throw new Error(
        `Shopping cart '${event.data.shoppingCartId}' has no summary`,
      );

    return [
      {
        type: 'shopping_carts.external.ShoppingCartCheckedOut',
        data: {
          cartId: event.data.shoppingCartId,
          customerId: summary.customerId,
          productItems: summary.productItems,
          totalPrice: summary.totalPrice,
          checkedOutAt: event.data.checkedOutAt,
        },
        metadata: {
          messageId: externalMessageId(
            event.metadata.messageId,
            'shopping_carts.external.ShoppingCartCheckedOut',
          ),
          correlationId: event.metadata.correlationId,
          causationId: event.metadata.messageId,
        },
      },
    ];
  };

export const shoppingCartExternalEventForwarder = ({
  summaries,
  forward,
  ...retry
}: HandlerRetryOptions & {
  summaries: ShoppingCartSummaries;
  forward: ForwardTo;
}): ForwardingHandler<ShoppingCartEvent> =>
  forward<ShoppingCartEvent, ShoppingCartCheckedOutExternal>({
    channels: shoppingCartsChannels,
    routes: [shoppingCartsRoutes],
    map: toExternalEvents(summaries),
    ...retry,
  });
