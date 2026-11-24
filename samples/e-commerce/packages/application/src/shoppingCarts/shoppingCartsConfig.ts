import {
  messageRoutes,
  routeChannel,
  routeKey,
  Urns,
  type ForwardedMessage,
} from '@e-commerce/core';
import type { ShoppingCartCheckedOutExternal } from './external/shoppingCartExternalEvent';

export const shoppingCartsExternalChannel = 'shopping_carts-external';

export const shoppingCartsChannels = [shoppingCartsExternalChannel];

export const shoppingCartsRoutes = messageRoutes<
  ForwardedMessage<ShoppingCartCheckedOutExternal>
>(
  routeChannel(
    'shopping_carts.external.ShoppingCartCheckedOut',
    shoppingCartsExternalChannel,
  ),
  routeKey('shopping_carts.external.ShoppingCartCheckedOut', (message) =>
    Urns.routingKeyOf(message.data.cartId),
  ),
);
