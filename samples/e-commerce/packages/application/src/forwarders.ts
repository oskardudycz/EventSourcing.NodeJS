import type { ForwardTo, HandlerRetryOptions } from '@e-commerce/core';
import type { ModuleConsumer } from './moduleConsumer';
import {
  orderRequestForwarder,
  ordersRequestForwarderId,
} from './orders/external/orderRequestForwarder';
import { orderRequestTypes, type OrderRequest } from './orders/orderWorkflow';
import {
  paymentExternalEventForwarder,
  paymentForwarderTypes,
  paymentsExternalForwarderId,
} from './payments/external/paymentExternalEventForwarder';
import type { PaymentEvent } from './payments/payment';
import {
  shipmentExternalEventForwarder,
  shipmentForwarderTypes,
  shipmentsExternalForwarderId,
} from './shipments/external/shipmentExternalEventForwarder';
import type { ShipmentEvent } from './shipments/shipment';
import {
  shoppingCartExternalEventForwarder,
  shoppingCartsExternalForwarderId,
} from './shoppingCarts/external/shoppingCartExternalEventForwarder';
import type { ShoppingCartSummaries } from './shoppingCarts/external/shoppingCartSummaries';
import type { ShoppingCartEvent } from './shoppingCarts/shoppingCart';

type Consumer = ModuleConsumer;

export const registerForwarders = ({
  consumers,
  summaries,
  forward,
  retry,
  signal,
}: HandlerRetryOptions & {
  consumers: {
    shoppingCarts?: Consumer;
    orders?: Consumer;
    payments?: Consumer;
    shipments?: Consumer;
  };
  summaries: {
    shoppingCarts: ShoppingCartSummaries;
  };
  forward: ForwardTo;
}) => {
  consumers.shoppingCarts?.reactor<ShoppingCartEvent>({
    processorId: shoppingCartsExternalForwarderId,
    canHandle: ['shopping_carts.ShoppingCartCheckedOut'],
    eachBatch: shoppingCartExternalEventForwarder({
      summaries: summaries.shoppingCarts,
      forward,
      retry,
      signal,
    }),
  });
  consumers.orders?.reactor<OrderRequest>({
    processorId: ordersRequestForwarderId,
    canHandle: [...orderRequestTypes],
    eachBatch: orderRequestForwarder({ forward, retry, signal }),
  });
  consumers.payments?.reactor<PaymentEvent>({
    processorId: paymentsExternalForwarderId,
    canHandle: [...paymentForwarderTypes],
    eachBatch: paymentExternalEventForwarder({
      forward,
      retry,
      signal,
    }),
  });
  consumers.shipments?.reactor<ShipmentEvent>({
    processorId: shipmentsExternalForwarderId,
    canHandle: [...shipmentForwarderTypes],
    eachBatch: shipmentExternalEventForwarder({
      forward,
      retry,
      signal,
    }),
  });
};
