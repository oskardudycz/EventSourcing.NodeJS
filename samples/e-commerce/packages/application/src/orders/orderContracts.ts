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
} from './order';
import {
  at,
  customerId,
  cartId,
  later,
  orderId,
  paymentId,
  pricedProductItem,
  shipmentId,
} from '../documentation/fixtures';
import { bodyContract, contractsOf } from '../documentation/messageContract';
import type { CustomerOrder } from './getCustomerOrders/customerOrders';
import type { OrderStatuses } from './getOrderStatus/orderStatuses';
import { pricedProductItemSchema } from '../shoppingCarts/shoppingCartContracts';

const cancellationReason = z.enum([
  'ProductWasOutOfStock',
  'CouldNotShip',
  'PaymentFailed',
  'Requested',
]);

const { event, command } = contractsOf('orders');

export const orderPlaced = event<OrderPlaced['data']>(
  'OrderPlaced',
  'An order was placed from a checked out shopping cart.',
  z.object({
    orderId: z.string(),
    cartId: z.string(),
    customerId: z.uuid(),
    productItems: z.array(pricedProductItemSchema),
    totalPrice: z.number(),
    placedAt: z.iso.datetime(),
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
    authorizedAt: z.iso.datetime(),
  }),
  { orderId, paymentId, authorizedAt: at },
);

export const orderStockReserved = event<OrderStockReserved['data']>(
  'OrderStockReserved',
  'The stock for the order was reserved.',
  z.object({
    orderId: z.string(),
    shipmentId: z.string(),
    reservedAt: z.iso.datetime(),
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
    confirmedAt: z.iso.datetime(),
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
    capturedAt: z.iso.datetime(),
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
    sentAt: z.iso.datetime(),
  }),
  { orderId, carrier: 'Sandbox Express', trackingNumber: 'SB-1', sentAt: at },
);

export const orderPaymentDue = event<OrderPaymentDue['data']>(
  'OrderPaymentDue',
  'The payment of the order is due.',
  z.object({
    orderId: z.string(),
    paymentId: z.string(),
    dueAt: z.iso.datetime(),
  }),
  { orderId, paymentId, dueAt: later },
);

export const orderPaymentFailedContract = event<OrderPaymentFailed['data']>(
  'OrderPaymentFailed',
  'The payment of the order failed. The customer can retry until it is due.',
  z.object({
    orderId: z.string(),
    failedAt: z.iso.datetime(),
    dueAt: z.iso.datetime().nullable(),
  }),
  { orderId, failedAt: at, dueAt: later },
  { requiredOnly: { orderId, failedAt: at, dueAt: null } },
);

export const orderShipmentFailed = event<OrderShipmentFailed['data']>(
  'OrderShipmentFailed',
  'The shipment of the order failed.',
  z.object({
    orderId: z.string(),
    reason: cancellationReason,
    failedAt: z.iso.datetime(),
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
    retriedAt: z.iso.datetime(),
  }),
  { orderId, paymentId, amount: 39.98, retriedAt: at },
);

export const orderClosedUnpaid = event<OrderClosedUnpaid['data']>(
  'OrderClosedUnpaid',
  'The order was closed because it stayed unpaid.',
  z.object({ orderId: z.string(), closedAt: z.iso.datetime() }),
  { orderId, closedAt: at },
);

export const orderCompleted = event<OrderCompleted['data']>(
  'OrderCompleted',
  'The order is paid and sent.',
  z.object({ orderId: z.string(), completedAt: z.iso.datetime() }),
  { orderId, completedAt: at },
);

export const orderCanceledContract = event<OrderCanceled['data']>(
  'OrderCanceled',
  'The order was canceled. The shipment id is null when no stock was reserved.',
  z.object({
    orderId: z.string(),
    paymentId: z.string(),
    paymentStatus: z.enum(['NotAuthorized', 'Authorized']),
    shipmentId: z.string().nullable(),
    shipmentStatus: z.enum(['NotReserved', 'Reserved']),
    reason: cancellationReason,
    canceledAt: z.iso.datetime(),
  }),
  {
    orderId,
    paymentId,
    paymentStatus: 'Authorized',
    shipmentId,
    shipmentStatus: 'Reserved',
    reason: 'Requested',
    canceledAt: at,
  },
  {
    requiredOnly: {
      orderId,
      paymentId,
      paymentStatus: 'NotAuthorized',
      shipmentId: null,
      shipmentStatus: 'NotReserved',
      reason: 'PaymentFailed',
      canceledAt: at,
    },
    earlierForms: [
      {
        name: 'before-shipment-id',
        data: {
          orderId,
          paymentId,
          paymentStatus: 'Authorized',
          shipmentStatus: 'Reserved',
          reason: 'Requested',
          canceledAt: at,
        },
      },
    ],
  },
);

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

const orderProgress = z.enum([
  'AwaitingPayment',
  'PaymentFailed',
  'OutOfStock',
  'Processing',
  'Shipped',
  'Completed',
  'Canceled',
  'ClosedUnpaid',
]);

type OrderStatusBody = Omit<
  NonNullable<Awaited<ReturnType<OrderStatuses['get']>>>,
  'stage' | 'payment' | 'shipment'
>;

export const orderStatusSchema = z
  .object({
    orderId: z.string(),
    customerId: z.uuid(),
    productItems: z.array(pricedProductItemSchema),
    totalPrice: z.number(),
    placedAt: z.iso.datetime(),
    paymentId: z.string(),
    carrier: z.string().optional(),
    trackingNumber: z.string().optional(),
    progress: orderProgress,
    actions: z.array(z.enum(['PayNow', 'RetryPayment', 'CancelOrder'])),
    version: z.number(),
  })
  .meta({ id: 'OrderStatus' });

export const customerOrderSchema = z
  .object({
    orderId: z.string(),
    customerId: z.uuid(),
    placedAt: z.iso.datetime(),
    totalPrice: z.number(),
    progress: orderProgress,
    version: z.number(),
  })
  .meta({ id: 'CustomerOrder' });

const openOrderStatus: OrderStatusBody = {
  orderId,
  customerId,
  productItems: [pricedProductItem],
  totalPrice: 39.98,
  placedAt: at,
  paymentId,
  progress: 'AwaitingPayment',
  actions: ['PayNow', 'CancelOrder'],
  version: 1,
};

export const orderBodyContracts = [
  bodyContract<OrderStatusBody>({
    name: 'OrderStatus',
    schema: orderStatusSchema,
    allFields: {
      ...openOrderStatus,
      carrier: 'Sandbox Express',
      trackingNumber: 'SB-1',
      progress: 'Shipped',
      actions: [],
      version: 5,
    },
    requiredOnly: openOrderStatus,
  }),
  bodyContract<CustomerOrder>({
    name: 'CustomerOrder',
    schema: customerOrderSchema,
    allFields: {
      orderId,
      customerId,
      placedAt: at,
      totalPrice: 39.98,
      progress: 'Shipped',
      version: 4,
    },
  }),
];
