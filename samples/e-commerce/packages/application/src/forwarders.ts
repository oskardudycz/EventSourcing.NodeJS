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
import type { PaymentSummaries } from './payments/external/paymentSummaries';
import type { PaymentEvent } from './payments/payment';
import {
  shipmentExternalEventForwarder,
  shipmentForwarderTypes,
  shipmentsExternalForwarderId,
} from './shipments/external/shipmentExternalEventForwarder';
import type { ShipmentSummaries } from './shipments/external/shipmentSummaries';
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
    payments: PaymentSummaries;
    shipments: ShipmentSummaries;
  };
  forward: ForwardTo;
}) => {
  consumers.shoppingCarts?.reactor<ShoppingCartEvent>({
    processorId: shoppingCartsExternalForwarderId,
    canHandle: ['shopping_carts.ShoppingCartCheckedOut'],
    eachMessage: shoppingCartExternalEventForwarder({
      summaries: summaries.shoppingCarts,
      forward,
      retry,
      signal,
    }),
  });
  consumers.orders?.reactor<OrderRequest>({
    processorId: ordersRequestForwarderId,
    canHandle: [...orderRequestTypes],
    eachMessage: orderRequestForwarder({ forward, retry, signal }),
  });
  consumers.payments?.reactor<PaymentEvent>({
    processorId: paymentsExternalForwarderId,
    canHandle: [...paymentForwarderTypes],
    eachMessage: paymentExternalEventForwarder({
      summaries: summaries.payments,
      forward,
      retry,
      signal,
    }),
  });
  consumers.shipments?.reactor<ShipmentEvent>({
    processorId: shipmentsExternalForwarderId,
    canHandle: [...shipmentForwarderTypes],
    eachMessage: shipmentExternalEventForwarder({
      summaries: summaries.shipments,
      forward,
      retry,
      signal,
    }),
  });
};
