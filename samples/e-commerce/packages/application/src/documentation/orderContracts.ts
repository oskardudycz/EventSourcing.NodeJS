import { z } from 'zod';
import type {
  CancelOrder,
  CloseUnpaidOrder,
  OrderCanceled,
  OrderClosedUnpaid,
  OrderCompleted,
  OrderConfirmed,
  OrderPackageSent,
  OrderPaymentAuthorized,
  OrderPaymentCaptured,
  OrderPaymentDue,
  OrderPaymentFailed,
  OrderPaymentRetried,
  OrderPlaced,
  OrderShipmentFailed,
  OrderStockReserved,
  RetryOrderPayment,
} from '../orders/order';
import {
  at,
  customerId,
  cartId,
  later,
  orderId,
  paymentId,
  pricedProductItem,
  shipmentId,
} from './fixtures';
import { messageContract } from './messageContract';
import { pricedProductItemSchema } from './shoppingCartContracts';

const cancellationReason = z.enum([
  'ProductWasOutOfStock',
  'CouldNotShip',
  'PaymentFailed',
  'Requested',
]);

type OrderCanceledData = Omit<OrderCanceled['data'], 'shipmentId'> & {
  shipmentId?: string | null;
};

const event = <Data extends Record<string, unknown>>(
  name: string,
  description: string,
  schema: z.ZodType<Data>,
  allFields: Data,
) =>
  messageContract<Data>({
    type: `orders.${name}`,
    kind: 'event',
    description,
    schema,
    allFields,
  });

export const orderPlaced = event<OrderPlaced['data']>(
  'OrderPlaced',
  'An order was placed from a checked out shopping cart.',
  z.object({
    orderId: z.string(),
    cartId: z.string(),
    customerId: z.string(),
    productItems: z.array(pricedProductItemSchema),
    totalPrice: z.number(),
    placedAt: z.string(),
  }),
  {
    orderId,
    cartId,
    customerId,
    productItems: [pricedProductItem],
    totalPrice: 39.98,
    placedAt: at,
  },
);

export const orderPaymentAuthorized = event<OrderPaymentAuthorized['data']>(
  'OrderPaymentAuthorized',
  'The payment of the order was authorized.',
  z.object({
    orderId: z.string(),
    paymentId: z.string(),
    authorizedAt: z.string(),
  }),
  { orderId, paymentId, authorizedAt: at },
);

export const orderStockReserved = event<OrderStockReserved['data']>(
  'OrderStockReserved',
  'The stock for the order was reserved.',
  z.object({
    orderId: z.string(),
    shipmentId: z.string(),
    reservedAt: z.string(),
  }),
  { orderId, shipmentId, reservedAt: at },
);

export const orderConfirmed = event<OrderConfirmed['data']>(
  'OrderConfirmed',
  'The order has an authorized payment and reserved stock.',
  z.object({
    orderId: z.string(),
    paymentId: z.string(),
    shipmentId: z.string(),
    confirmedAt: z.string(),
  }),
  { orderId, paymentId, shipmentId, confirmedAt: at },
);

export const orderPaymentCaptured = event<OrderPaymentCaptured['data']>(
  'OrderPaymentCaptured',
  'The payment of the order was captured.',
  z.object({
    orderId: z.string(),
    paymentId: z.string(),
    amount: z.number(),
    capturedAt: z.string(),
  }),
  { orderId, paymentId, amount: 39.98, capturedAt: at },
);

export const orderPackageSent = event<OrderPackageSent['data']>(
  'OrderPackageSent',
  'The package of the order was sent.',
  z.object({
    orderId: z.string(),
    carrier: z.string(),
    trackingNumber: z.string(),
    sentAt: z.string(),
  }),
  { orderId, carrier: 'Sandbox Express', trackingNumber: 'SB-1', sentAt: at },
);

export const orderPaymentDue = event<OrderPaymentDue['data']>(
  'OrderPaymentDue',
  'The payment of the order is due.',
  z.object({
    orderId: z.string(),
    paymentId: z.string(),
    dueAt: z.string(),
  }),
  { orderId, paymentId, dueAt: later },
);

export const orderPaymentFailedContract = messageContract<
  OrderPaymentFailed['data']
>({
  type: 'orders.OrderPaymentFailed',
  kind: 'event',
  description:
    'The payment of the order failed. The customer can retry until it is due.',
  schema: z.object({
    orderId: z.string(),
    failedAt: z.string(),
    dueAt: z.string().nullable(),
  }),
  allFields: { orderId, failedAt: at, dueAt: later },
  requiredOnly: { orderId, failedAt: at, dueAt: null },
});

export const orderShipmentFailed = event<OrderShipmentFailed['data']>(
  'OrderShipmentFailed',
  'The shipment of the order failed.',
  z.object({
    orderId: z.string(),
    reason: cancellationReason,
    failedAt: z.string(),
  }),
  { orderId, reason: 'ProductWasOutOfStock', failedAt: at },
);

export const orderPaymentRetried = event<OrderPaymentRetried['data']>(
  'OrderPaymentRetried',
  'The customer retried the payment of the order.',
  z.object({
    orderId: z.string(),
    paymentId: z.string(),
    amount: z.number(),
    retriedAt: z.string(),
  }),
  { orderId, paymentId, amount: 39.98, retriedAt: at },
);

export const orderClosedUnpaid = event<OrderClosedUnpaid['data']>(
  'OrderClosedUnpaid',
  'The order was closed because it stayed unpaid.',
  z.object({ orderId: z.string(), closedAt: z.string() }),
  { orderId, closedAt: at },
);

export const orderCompleted = event<OrderCompleted['data']>(
  'OrderCompleted',
  'The order is paid and sent.',
  z.object({ orderId: z.string(), completedAt: z.string() }),
  { orderId, completedAt: at },
);

export const orderCanceledContract = messageContract<OrderCanceledData>({
  type: 'orders.OrderCanceled',
  kind: 'event',
  description:
    'The order was canceled. The shipment id is missing when no stock was reserved.',
  schema: z.object({
    orderId: z.string(),
    paymentId: z.string(),
    paymentStatus: z.enum(['NotAuthorized', 'Authorized']),
    shipmentId: z.string().nullish(),
    shipmentStatus: z.enum(['NotReserved', 'Reserved']),
    reason: cancellationReason,
    canceledAt: z.string(),
  }),
  allFields: {
    orderId,
    paymentId,
    paymentStatus: 'Authorized',
    shipmentId,
    shipmentStatus: 'Reserved',
    reason: 'Requested',
    canceledAt: at,
  },
  requiredOnly: {
    orderId,
    paymentId,
    paymentStatus: 'NotAuthorized',
    shipmentStatus: 'NotReserved',
    reason: 'PaymentFailed',
    canceledAt: at,
  },
});

const command = <Data extends Record<string, unknown>>(
  name: string,
  description: string,
  schema: z.ZodType<Data>,
  allFields: Data,
) =>
  messageContract<Data>({
    type: `orders.${name}`,
    kind: 'command',
    description,
    schema,
    allFields,
  });

export const retryOrderPayment = command<RetryOrderPayment['data']>(
  'RetryOrderPayment',
  'Retry the payment of an order.',
  z.object({ orderId: z.string() }),
  { orderId },
);

export const closeUnpaidOrder = command<CloseUnpaidOrder['data']>(
  'CloseUnpaidOrder',
  'Close an order that stayed unpaid.',
  z.object({ orderId: z.string() }),
  { orderId },
);

export const cancelOrder = command<CancelOrder['data']>(
  'CancelOrder',
  'Cancel an order.',
  z.object({ orderId: z.string(), cancellationReason }),
  { orderId, cancellationReason: 'Requested' },
);

export const orderStoredContracts = [
  orderPlaced,
  orderPaymentAuthorized,
  orderStockReserved,
  orderConfirmed,
  orderPaymentCaptured,
  orderPackageSent,
  orderPaymentDue,
  orderPaymentFailedContract,
  orderShipmentFailed,
  orderPaymentRetried,
  orderClosedUnpaid,
  orderCompleted,
  orderCanceledContract,
  retryOrderPayment,
  closeUnpaidOrder,
  cancelOrder,
];
