import {
  messageRouter,
  type MessageRoutes,
  type Route,
} from '@e-commerce/core';
import type { ModuleName } from '../modules';
import {
  ordersInternalQueue,
  ordersInternalRoutes,
  ordersPaymentsResponsesQueue,
  ordersShipmentsResponsesQueue,
  ordersShoppingCartsExternalQueue,
} from '../orders/ordersConfig';
import {
  paymentsInternalQueue,
  paymentsInternalRoutes,
  paymentsRequestRoutes,
  paymentsRequestsQueue,
  paymentsResponseRoutes,
} from '../payments/paymentsConfig';
import {
  shipmentsRequestRoutes,
  shipmentsRequestsQueue,
  shipmentsResponseRoutes,
} from '../shipments/shipmentsConfig';
import { shoppingCartsRoutes } from '../shoppingCarts/shoppingCartsConfig';
import type { MessageContract } from './messageContract';
import { closeUnpaidOrder } from '../orders/orderContracts';
import {
  expirePaymentAuthorization,
  paymentRequestContracts,
  paymentResponseContracts,
  timeOutPayment,
} from '../payments/paymentContracts';
import {
  shipmentRequestContracts,
  shipmentResponseContracts,
} from '../shipments/shipmentContracts';
import { shoppingCartCheckedOutExternal } from '../shoppingCarts/shoppingCartContracts';

export type ChannelFlow = {
  sender: ModuleName;
  receivers: { module: ModuleName; queue: string }[];
  routes: MessageRoutes;
  contracts: MessageContract[];
};

export const channelFlows: ChannelFlow[] = [
  {
    sender: 'shopping_carts',
    receivers: [{ module: 'orders', queue: ordersShoppingCartsExternalQueue }],
    routes: shoppingCartsRoutes,
    contracts: [shoppingCartCheckedOutExternal],
  },
  {
    sender: 'orders',
    receivers: [{ module: 'payments', queue: paymentsRequestsQueue }],
    routes: paymentsRequestRoutes,
    contracts: paymentRequestContracts,
  },
  {
    sender: 'payments',
    receivers: [{ module: 'orders', queue: ordersPaymentsResponsesQueue }],
    routes: paymentsResponseRoutes,
    contracts: paymentResponseContracts,
  },
  {
    sender: 'orders',
    receivers: [{ module: 'shipments', queue: shipmentsRequestsQueue }],
    routes: shipmentsRequestRoutes,
    contracts: shipmentRequestContracts,
  },
  {
    sender: 'shipments',
    receivers: [{ module: 'orders', queue: ordersShipmentsResponsesQueue }],
    routes: shipmentsResponseRoutes,
    contracts: shipmentResponseContracts,
  },
  {
    sender: 'orders',
    receivers: [{ module: 'orders', queue: ordersInternalQueue }],
    routes: ordersInternalRoutes,
    contracts: [closeUnpaidOrder],
  },
  {
    sender: 'payments',
    receivers: [{ module: 'payments', queue: paymentsInternalQueue }],
    routes: paymentsInternalRoutes,
    contracts: [timeOutPayment, expirePaymentAuthorization],
  },
];

export const exampleMessageOf = (contract: MessageContract) => ({
  type: contract.type,
  data: contract.allFields,
});

export const routeOf = (
  routes: MessageRoutes,
  contract: MessageContract,
): Route & { channel: string } => {
  const route = messageRouter([routes], []).routeFor(
    exampleMessageOf(contract),
  );

  if (route.channel === undefined)
    throw new Error(`No channel for '${contract.type}'`);

  return { ...route, channel: route.channel };
};
