import {
  messageRouter,
  type MessageRoutes,
  type Route,
} from '@e-commerce/core';
import type { ModuleName } from '../application';
import { ordersInternalRoutes } from '../orders/ordersConfig';
import {
  paymentsInternalRoutes,
  paymentsRequestRoutes,
  paymentsResponseRoutes,
} from '../payments/paymentsConfig';
import {
  shipmentsRequestRoutes,
  shipmentsResponseRoutes,
} from '../shipments/shipmentsConfig';
import { shoppingCartsRoutes } from '../shoppingCarts/shoppingCartsConfig';
import type { MessageContract } from './messageContract';
import { closeUnpaidOrder } from './orderContracts';
import {
  expirePaymentAuthorization,
  paymentRequestContracts,
  paymentResponseContracts,
  timeOutPayment,
} from './paymentContracts';
import {
  shipmentRequestContracts,
  shipmentResponseContracts,
} from './shipmentContracts';
import { shoppingCartCheckedOutExternal } from './shoppingCartContracts';

export type ChannelFlow = {
  sender: ModuleName;
  receivers: ModuleName[];
  routes: MessageRoutes;
  contracts: MessageContract[];
};

export const channelFlows: ChannelFlow[] = [
  {
    sender: 'shopping_carts',
    receivers: ['orders'],
    routes: shoppingCartsRoutes,
    contracts: [shoppingCartCheckedOutExternal],
  },
  {
    sender: 'orders',
    receivers: ['payments'],
    routes: paymentsRequestRoutes,
    contracts: paymentRequestContracts,
  },
  {
    sender: 'payments',
    receivers: ['orders'],
    routes: paymentsResponseRoutes,
    contracts: paymentResponseContracts,
  },
  {
    sender: 'orders',
    receivers: ['shipments'],
    routes: shipmentsRequestRoutes,
    contracts: shipmentRequestContracts,
  },
  {
    sender: 'shipments',
    receivers: ['orders'],
    routes: shipmentsResponseRoutes,
    contracts: shipmentResponseContracts,
  },
  {
    sender: 'orders',
    receivers: ['orders'],
    routes: ordersInternalRoutes,
    contracts: [closeUnpaidOrder],
  },
  {
    sender: 'payments',
    receivers: ['payments'],
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
): Route => messageRouter([routes], []).routeFor(exampleMessageOf(contract));
