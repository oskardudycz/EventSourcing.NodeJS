import {
  messageRoutes,
  routeChannel,
  routeKey,
  Urns,
  type ForwardedMessage,
} from '@e-commerce/core';
import type { ShoppingCartCheckedOutExternal } from './external/shoppingCartExternalEvent';
import { ShoppingCartId } from './shoppingCart';

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

export const shoppingCartsExternalStreamName = (cartId: string) =>
  `shopping_carts:external:${ShoppingCartId.tailOf(cartId)}`;
