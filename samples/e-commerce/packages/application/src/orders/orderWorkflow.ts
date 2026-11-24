import { WorkflowHandler, type Workflow } from '@event-driven-io/emmett';
import {
  paymentExternalEventTypes,
  type PaymentExternalEvent,
} from '../payments/external/paymentExternalEvent';
import { PaymentId } from '../payments/payment';
import type {
  AuthorizePayment,
  CancelPayment,
  CapturePayment,
} from '../payments/paymentCommand';
import {
  shipmentExternalEventTypes,
  type ShipmentExternalEvent,
} from '../shipments/external/shipmentExternalEvent';
import { ShipmentId } from '../shipments/shipment';
import type {
  ReleaseStock,
  RequestFulfillment,
  ReserveStock,
} from '../shipments/shipmentCommand';
import {
  shoppingCartExternalEventTypes,
  type ShoppingCartCheckedOutExternal,
} from '../shoppingCarts/external/shoppingCartExternalEvent';
import { isBefore } from '../time';
import {
  canStillBePaid,
  evolve,
  hasShipped,
  initialOrder,
  isOpen,
  OrderId,
  type CancelOrder,
  type CancellationReason,
  type CloseUnpaidOrder,
  type Order,
  type OrderCanceled,
  type OrderEvent,
  type PaymentStatus,
  type RetryOrderPayment,
  type ShipmentStatus,
} from './order';

export const orderWorkflowName = 'orders';

export type OrderWorkflowExternalInput =
  ShoppingCartCheckedOutExternal | PaymentExternalEvent | ShipmentExternalEvent;

export type OrderWorkflowCommand =
  CancelOrder | RetryOrderPayment | CloseUnpaidOrder;

export type OrderWorkflowInput =
  OrderWorkflowExternalInput | OrderWorkflowCommand;

export type OrderRequest =
  | AuthorizePayment
  | CapturePayment
  | CancelPayment
  | RequestFulfillment
  | ReserveStock
  | ReleaseStock;

export type OrderWorkflowOutput = OrderEvent | OrderRequest;

export const orderWorkflowExternalInputTypes = [
  ...shoppingCartExternalEventTypes,
  ...paymentExternalEventTypes,
  ...shipmentExternalEventTypes,
] as const;

export const orderWorkflowCommandTypes = [
  'orders.CancelOrder',
  'orders.RetryOrderPayment',
  'orders.CloseUnpaidOrder',
] as const;

export const orderRequestTypes = [
  'payments.AuthorizePayment',
  'payments.CapturePayment',
  'payments.CancelPayment',
  'shipments.RequestFulfillment',
  'shipments.ReserveStock',
  'shipments.ReleaseStock',
] as const;

const orderEventTypes: OrderEvent['type'][] = [
  'orders.OrderPlaced',
  'orders.OrderPaymentAuthorized',
  'orders.OrderStockReserved',
  'orders.OrderConfirmed',
  'orders.OrderPaymentCaptured',
  'orders.OrderPackageSent',
  'orders.OrderPaymentDue',
  'orders.OrderPaymentFailed',
  'orders.OrderShipmentFailed',
  'orders.OrderPaymentRetried',
  'orders.OrderClosedUnpaid',
  'orders.OrderCompleted',
  'orders.OrderCanceled',
];

export const isOrderEvent = (message: {
  type: string;
}): message is OrderEvent =>
  orderEventTypes.some((type) => type === message.type);

const cancellationReasonOf = (
  reason: 'ProductsOutOfStock' | 'FulfillmentRejected',
): CancellationReason =>
  reason === 'ProductsOutOfStock' ? 'ProductWasOutOfStock' : 'CouldNotShip';

const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

const paymentDueAt = (failedAt: string): string =>
  new Date(Date.parse(failedAt) + sevenDaysInMs).toISOString();

export const orderIdOf = (data: OrderWorkflowInput['data']): string =>
  'orderId' in data
    ? data.orderId
    : 'referenceId' in data
      ? data.referenceId
      : OrderId.derivedFrom(data.cartId);

const paymentStatusOf = (order: Order): PaymentStatus =>
  order.payment === 'Authorized' ? 'Authorized' : 'NotAuthorized';

const shipmentStatusOf = (order: Order): ShipmentStatus =>
  order.shipment === 'Reserved' || order.shipment === 'Rejected'
    ? 'Reserved'
    : 'NotReserved';

const canceled = (
  order: Order,
  reason: CancellationReason,
  at: string,
): OrderCanceled => ({
  type: 'orders.OrderCanceled',
  data: {
    orderId: order.id,
    paymentId: order.paymentId,
    paymentStatus: paymentStatusOf(order),
    shipmentId: order.shipmentId ?? null,
    shipmentStatus: shipmentStatusOf(order),
    reason,
    canceledAt: at,
  },
});

const progress = (order: Order, at: string): OrderEvent | undefined => {
  if (order.shipment === 'Failed' || order.shipment === 'Rejected') {
    if (order.payment === 'Pending' || order.payment === 'Retrying')
      return undefined;

    const reason =
      order.payment === 'Failed'
        ? 'PaymentFailed'
        : (order.shipmentFailureReason ?? 'CouldNotShip');

    return canceled(order, reason, at);
  }

  if (order.payment === 'Failed') {
    if (order.status === 'Confirmed' && !hasShipped(order))
      return canceled(order, 'PaymentFailed', at);

    return undefined;
  }

  if (
    order.status === 'Opened' &&
    order.payment === 'Authorized' &&
    order.shipment === 'Reserved'
  )
    return {
      type: 'orders.OrderConfirmed',
      data: {
        orderId: order.id,
        paymentId: order.paymentId,
        shipmentId: order.shipmentId ?? ShipmentId.derivedFrom(order.id),
        confirmedAt: at,
      },
    };

  if (
    order.status === 'Confirmed' &&
    order.payment === 'Captured' &&
    order.shipment === 'Sent'
  )
    return {
      type: 'orders.OrderCompleted',
      data: { orderId: order.id, completedAt: at },
    };

  return undefined;
};

const withProgress = (
  order: Order,
  at: string,
  event: OrderEvent,
): OrderEvent[] => {
  const next = progress(evolve(order, event), at);

  return next ? [event, next] : [event];
};

const decideEvents = (
  input: OrderWorkflowInput,
  order: Order,
  now: string,
): OrderEvent[] => {
  switch (input.type) {
    case 'shopping_carts.external.ShoppingCartCheckedOut': {
      if (order.status !== undefined) return [];

      const { cartId, customerId, productItems, totalPrice } = input.data;

      return [
        {
          type: 'orders.OrderPlaced',
          data: {
            orderId: OrderId.derivedFrom(cartId),
            cartId,
            customerId,
            productItems,
            totalPrice,
            placedAt: now,
          },
        },
      ];
    }
    case 'payments.external.PaymentAuthorized': {
      const { referenceId: orderId, paymentId, authorizedAt } = input.data;
      const authorized: OrderEvent = {
        type: 'orders.OrderPaymentAuthorized',
        data: { orderId, paymentId, authorizedAt },
      };

      if (order.status === 'Opened' && order.payment === 'Pending')
        return withProgress(order, authorizedAt, authorized);

      if (order.payment !== 'Retrying' || paymentId !== order.paymentId)
        return [];

      if (order.status === 'Opened')
        return withProgress(order, authorizedAt, authorized);

      if (order.status === 'Confirmed')
        return [
          authorized,
          {
            type: 'orders.OrderPaymentDue',
            data: { orderId, paymentId, dueAt: authorizedAt },
          },
        ];

      return [];
    }
    case 'shipments.external.StockReserved': {
      if (order.status !== 'Opened' || order.shipment !== 'Pending') return [];

      const { referenceId: orderId, shipmentId, reservedAt } = input.data;

      return withProgress(order, reservedAt, {
        type: 'orders.OrderStockReserved',
        data: { orderId, shipmentId, reservedAt },
      });
    }
    case 'shipments.external.PackageWasSent': {
      if (
        order.status !== 'Confirmed' ||
        order.payment !== 'Authorized' ||
        order.shipment !== 'Reserved'
      )
        return [];

      const {
        referenceId: orderId,
        carrier,
        trackingNumber,
        sentAt,
      } = input.data;

      return [
        {
          type: 'orders.OrderPackageSent',
          data: { orderId, carrier, trackingNumber, sentAt },
        },
        {
          type: 'orders.OrderPaymentDue',
          data: { orderId, paymentId: order.paymentId, dueAt: sentAt },
        },
      ];
    }
    case 'payments.external.PaymentCaptured': {
      if (
        order.status !== 'Confirmed' ||
        order.payment !== 'Authorized' ||
        !hasShipped(order) ||
        input.data.paymentId !== order.paymentId
      )
        return [];

      const { referenceId: orderId, capturedAt } = input.data;

      return withProgress(order, capturedAt, {
        type: 'orders.OrderPaymentCaptured',
        data: {
          orderId,
          paymentId: order.paymentId,
          amount: order.totalPrice,
          capturedAt,
        },
      });
    }
    case 'payments.external.PaymentFailed': {
      if (
        !isOpen(order) ||
        order.payment === 'Captured' ||
        order.payment === 'Failed' ||
        input.data.paymentId !== order.paymentId
      )
        return [];

      const { referenceId: orderId, failedAt } = input.data;

      return withProgress(order, failedAt, {
        type: 'orders.OrderPaymentFailed',
        data: {
          orderId,
          failedAt,
          dueAt: order.dueAt ?? paymentDueAt(failedAt),
        },
      });
    }
    case 'shipments.external.ShipmentFailed': {
      if (
        !isOpen(order) ||
        (order.shipment !== 'Pending' && order.shipment !== 'Reserved')
      )
        return [];

      const { referenceId: orderId, reason, failedAt } = input.data;

      return withProgress(order, failedAt, {
        type: 'orders.OrderShipmentFailed',
        data: { orderId, reason: cancellationReasonOf(reason), failedAt },
      });
    }
    case 'orders.RetryOrderPayment':
      return !canStillBePaid(order) || order.payment !== 'Failed'
        ? []
        : [
            {
              type: 'orders.OrderPaymentRetried',
              data: {
                orderId: order.id,
                paymentId: PaymentId.derivedFrom(
                  order.id,
                  order.paymentAttempts + 1,
                ),
                amount: order.totalPrice,
                retriedAt: now,
              },
            },
          ];
    case 'orders.CloseUnpaidOrder': {
      if (
        (order.payment !== 'Failed' && order.payment !== 'Retrying') ||
        isBefore(now, order.dueAt)
      )
        return [];

      if (order.status === 'Opened')
        return [canceled(order, 'PaymentFailed', now)];

      if (order.status === 'Confirmed' && hasShipped(order))
        return [
          {
            type: 'orders.OrderClosedUnpaid',
            data: { orderId: order.id, closedAt: now },
          },
        ];

      return [];
    }
    case 'orders.CancelOrder':
      return order.status !== 'Opened'
        ? []
        : [canceled(order, input.data.cancellationReason, now)];
  }
};

const requestsOf = (event: OrderEvent): OrderRequest[] => {
  switch (event.type) {
    case 'orders.OrderPlaced':
      return [
        {
          type: 'payments.AuthorizePayment',
          data: {
            paymentId: PaymentId.derivedFrom(event.data.orderId),
            referenceId: event.data.orderId,
            amount: event.data.totalPrice,
          },
        },
        {
          type: 'shipments.ReserveStock',
          data: {
            referenceId: event.data.orderId,
            productItems: event.data.productItems.map(
              ({ productId, quantity }) => ({ productId, quantity }),
            ),
          },
        },
      ];
    case 'orders.OrderConfirmed':
      return [
        {
          type: 'shipments.RequestFulfillment',
          data: { shipmentId: event.data.shipmentId },
        },
      ];
    case 'orders.OrderPaymentDue':
      return [
        {
          type: 'payments.CapturePayment',
          data: { paymentId: event.data.paymentId },
        },
      ];
    case 'orders.OrderPaymentRetried':
      return [
        {
          type: 'payments.AuthorizePayment',
          data: {
            paymentId: event.data.paymentId,
            referenceId: event.data.orderId,
            amount: event.data.amount,
          },
        },
      ];
    case 'orders.OrderCanceled':
      return [
        ...(event.data.paymentStatus === 'Authorized'
          ? [
              {
                type: 'payments.CancelPayment' as const,
                data: { paymentId: event.data.paymentId },
              },
            ]
          : []),
        ...(event.data.shipmentStatus === 'Reserved' &&
        event.data.shipmentId !== null
          ? [
              {
                type: 'shipments.ReleaseStock' as const,
                data: { shipmentId: event.data.shipmentId },
              },
            ]
          : []),
      ];
    default:
      return [];
  }
};

export const orderWorkflow = ({
  now,
}: {
  now: () => Date;
}): Workflow<OrderWorkflowInput, Order, OrderWorkflowOutput> => ({
  name: orderWorkflowName,
  decide: (input, order) => {
    const events = decideEvents(input, order, now().toISOString());

    return [...events, ...events.flatMap(requestsOf)];
  },
  evolve: (order, output) =>
    isOrderEvent(output) ? evolve(order, output) : order,
  initialState: initialOrder,
});

export const orderWorkflowOptions = (now: () => Date) => ({
  workflow: orderWorkflow({ now }),
  mapWorkflowId: OrderId.workflowStreamNameOf,
  getWorkflowId: ({ data }: { data: OrderWorkflowInput['data'] }) =>
    orderIdOf(data),
  inputs: {
    commands: [...orderWorkflowCommandTypes],
    events: [...orderWorkflowExternalInputTypes],
  },
  outputs: {
    commands: [...orderRequestTypes],
    events: orderEventTypes,
  },
});

export const orderWorkflowInbox = (now: () => Date) =>
  WorkflowHandler<OrderWorkflowInput, Order, OrderWorkflowOutput>({
    ...orderWorkflowOptions(now),
    separateInputInboxFromProcessing: true,
  });

export const orderWorkflowHandler = (now: () => Date) =>
  WorkflowHandler<OrderWorkflowInput, Order, OrderWorkflowOutput>({
    ...orderWorkflowOptions(now),
    retry: { onVersionConflict: 2 },
  });
