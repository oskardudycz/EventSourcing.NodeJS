import { isInAChannelStream, toWorkflowInbox } from '@e-commerce/core';
import type { ChannelReading } from '../messagingBus';
import type { ModuleConsumer } from '../moduleConsumer';
import {
  paymentExternalEventTypes,
  type PaymentExternalEvent,
} from '../payments/external/paymentExternalEvent';
import {
  shipmentExternalEventTypes,
  type ShipmentExternalEvent,
} from '../shipments/external/shipmentExternalEvent';
import {
  shoppingCartExternalEventTypes,
  type ShoppingCartCheckedOutExternal,
} from '../shoppingCarts/external/shoppingCartExternalEvent';
import {
  orderIdOf,
  orderWorkflowInbox,
  orderWorkflowOptions,
  type OrderWorkflowExternalInput,
  type OrderWorkflowInput,
  type OrderWorkflowOutput,
} from './orderWorkflow';
import { ordersSubscriptions } from './ordersConfig';
import type { CloseUnpaidOrder, Order } from './order';

type OrdersConsumer = ModuleConsumer;

export const registerOrdersProcessors = (
  orders: OrdersConsumer,
  { now }: { now: () => Date },
) => {
  orders.workflowProcessor<OrderWorkflowInput, Order, OrderWorkflowOutput>({
    ...orderWorkflowOptions(now),
    separateInputInboxFromProcessing: true,
    processorId: 'orders-workflow',
    getWorkflowId: (message) =>
      isInAChannelStream(message) ? null : orderIdOf(message.data),
  });
};

export const registerOrdersChannelReaders = (
  read: ChannelReading,
  { now }: { now: () => Date },
) => {
  const storeInInbox = orderWorkflowInbox(now);
  const intoOrdersInbox = toWorkflowInbox<OrderWorkflowExternalInput>(
    (store, message) => storeInInbox(store, message),
  );

  read<ShoppingCartCheckedOutExternal>({
    subscription: ordersSubscriptions.shoppingCartsExternal,
    canHandle: [...shoppingCartExternalEventTypes],
    handle: intoOrdersInbox,
  });
  read<PaymentExternalEvent>({
    subscription: ordersSubscriptions.paymentsResponses,
    canHandle: [...paymentExternalEventTypes],
    handle: intoOrdersInbox,
  });
  read<ShipmentExternalEvent>({
    subscription: ordersSubscriptions.shipmentsResponses,
    canHandle: [...shipmentExternalEventTypes],
    handle: intoOrdersInbox,
  });
};

export const registerOrdersInternalReader = (
  read: ChannelReading,
  { now }: { now: () => Date },
) => {
  read<CloseUnpaidOrder>({
    subscription: ordersSubscriptions.internal,
    canHandle: ['orders.CloseUnpaidOrder'],
    handle: toWorkflowInbox(orderWorkflowInbox(now)),
  });
};
