import { isInternalChannel } from '@e-commerce/core';
import type { EventStore } from '@event-driven-io/emmett';
import type { ModuleStores } from './eventStore';
import { ordersInternalChannel } from './orders/ordersConfig';
import {
  paymentsInternalChannel,
  paymentsRequestsChannel,
  paymentsResponsesChannel,
} from './payments/paymentsConfig';
import {
  shipmentsRequestsChannel,
  shipmentsResponsesChannel,
} from './shipments/shipmentsConfig';
import { shoppingCartsExternalChannel } from './shoppingCarts/shoppingCartsConfig';

type ChannelOwner = 'orders' | 'payments' | 'shipments';

const ownerOfChannel: Record<string, ChannelOwner> = {
  [shoppingCartsExternalChannel]: 'orders',
  [ordersInternalChannel]: 'orders',
  [paymentsInternalChannel]: 'payments',
  [paymentsRequestsChannel]: 'payments',
  [paymentsResponsesChannel]: 'orders',
  [shipmentsRequestsChannel]: 'shipments',
  [shipmentsResponsesChannel]: 'orders',
};

export const channelStoreOf =
  (stores: ModuleStores) =>
  (channel: string): EventStore => {
    const owner = ownerOfChannel[channel];

    if (owner === undefined) throw new Error(`Unknown channel '${channel}'`);

    return stores.messagingBus === 'in-memory' && !isInternalChannel(channel)
      ? stores.broker.store
      : stores[owner].store;
  };
