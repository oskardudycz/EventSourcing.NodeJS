import {
  messageRoutes,
  routeChannel,
  routeKey,
  Urns,
  type ForwardedMessage,
} from '@e-commerce/core';
import {
  paymentsChannels,
  paymentsRequestRoutes,
  paymentsResponsesChannel,
} from '../payments/paymentsConfig';
import {
  shipmentsChannels,
  shipmentsRequestRoutes,
  shipmentsResponsesChannel,
} from '../shipments/shipmentsConfig';
import { shoppingCartsExternalChannel } from '../shoppingCarts/shoppingCartsConfig';
import type { CloseUnpaidOrder } from './order';

export const ordersInternalChannel = 'orders-internal';
export const ordersInternalQueue = 'orders-internal';

export const ordersInternalRoutes = messageRoutes<
  ForwardedMessage<CloseUnpaidOrder>
>(
  routeChannel('orders.CloseUnpaidOrder', ordersInternalChannel),
  routeKey('orders.CloseUnpaidOrder', (message) =>
    Urns.routingKeyOf(message.data.orderId),
  ),
);

export const ordersShoppingCartsExternalQueue =
  'orders-shopping_carts-external';
export const ordersPaymentsResponsesQueue = 'orders-payments-responses';
export const ordersShipmentsResponsesQueue = 'orders-shipments-responses';
export const responsesForOrders = 'ecommerce.order.*';

export const ordersChannels = [...paymentsChannels, ...shipmentsChannels];

export const orderRequestRoutes = [
  paymentsRequestRoutes,
  shipmentsRequestRoutes,
];

export const ordersSubscriptions = {
  internal: {
    channel: ordersInternalChannel,
    queue: ordersInternalQueue,
  },
  shoppingCartsExternal: {
    channel: shoppingCartsExternalChannel,
    queue: ordersShoppingCartsExternalQueue,
  },
  paymentsResponses: {
    channel: paymentsResponsesChannel,
    queue: ordersPaymentsResponsesQueue,
    bindingKey: responsesForOrders,
  },
  shipmentsResponses: {
    channel: shipmentsResponsesChannel,
    queue: ordersShipmentsResponsesQueue,
    bindingKey: responsesForOrders,
  },
};
