import { Urns } from '@e-commerce/core';
import type { Command, Event } from '@event-driven-io/emmett';
import { PaymentId } from '../payments/payment';
import type { PricedProductItem } from '../shoppingCarts/productItems';

const orderType = 'order';

export const OrderId = {
  require: (id: string): string => Urns.requireType(id, orderType),
  of: (tail: string): string => Urns.of('ecommerce', orderType, tail),
  derivedFrom: (sourceUrn: string): string => Urns.derive(sourceUrn, orderType),
  tailOf: Urns.tailOf,
  numberOf: (id: string): string => {
    const tail = Urns.tailOf(id);
    return tail.substring(tail.lastIndexOf('-') + 1);
  },
  workflowStreamNameOf: (id: string): string => `orders_workflow-${id}`,
};

export type OrderStatus =
  'Opened' | 'Confirmed' | 'Completed' | 'ClosedUnpaid' | 'Canceled';

export type PaymentProgress =
  'Pending' | 'Authorized' | 'Captured' | 'Failed' | 'Retrying';

export type ShipmentProgress =
  'Pending' | 'Reserved' | 'Sent' | 'Rejected' | 'Failed';

export type PaymentStatus = 'NotAuthorized' | 'Authorized';

export type ShipmentStatus = 'NotReserved' | 'Reserved';

export type CancellationReason =
  'ProductWasOutOfStock' | 'CouldNotShip' | 'PaymentFailed' | 'Requested';

export type OrderProgress =
  | 'AwaitingPayment'
  | 'PaymentFailed'
  | 'OutOfStock'
  | 'Processing'
  | 'Shipped'
  | 'Completed'
  | 'Canceled'
  | 'ClosedUnpaid';

export type OrderPlaced = Event<
  'orders.OrderPlaced',
  {
    orderId: string;
    cartId: string;
    customerId: string;
    productItems: PricedProductItem[];
    totalPrice: number;
    placedAt: string;
  }
>;

export type OrderPaymentAuthorized = Event<
  'orders.OrderPaymentAuthorized',
  { orderId: string; paymentId: string; authorizedAt: string }
>;

export type OrderStockReserved = Event<
  'orders.OrderStockReserved',
  { orderId: string; shipmentId: string; reservedAt: string }
>;

export type OrderConfirmed = Event<
  'orders.OrderConfirmed',
  {
    orderId: string;
    paymentId: string;
    shipmentId: string;
    confirmedAt: string;
  }
>;

export type OrderPaymentCaptured = Event<
  'orders.OrderPaymentCaptured',
  { orderId: string; paymentId: string; amount: number; capturedAt: string }
>;

export type OrderPackageSent = Event<
  'orders.OrderPackageSent',
  { orderId: string; carrier: string; trackingNumber: string; sentAt: string }
>;

export type OrderPaymentDue = Event<
  'orders.OrderPaymentDue',
  { orderId: string; paymentId: string; dueAt: string }
>;

export type OrderPaymentFailed = Event<
  'orders.OrderPaymentFailed',
  { orderId: string; failedAt: string; dueAt: string | null }
>;

export type OrderShipmentFailed = Event<
  'orders.OrderShipmentFailed',
  { orderId: string; reason: CancellationReason; failedAt: string }
>;

export type OrderPaymentRetried = Event<
  'orders.OrderPaymentRetried',
  { orderId: string; paymentId: string; amount: number; retriedAt: string }
>;

export type OrderClosedUnpaid = Event<
  'orders.OrderClosedUnpaid',
  { orderId: string; closedAt: string }
>;

export type OrderCompleted = Event<
  'orders.OrderCompleted',
  { orderId: string; completedAt: string }
>;

export type OrderCanceled = Event<
  'orders.OrderCanceled',
  {
    orderId: string;
    paymentId: string;
    paymentStatus: PaymentStatus;
    shipmentId: string | null;
    shipmentStatus: ShipmentStatus;
    reason: CancellationReason;
    canceledAt: string;
  }
>;

export type OrderEvent =
  | OrderPlaced
  | OrderPaymentAuthorized
  | OrderStockReserved
  | OrderConfirmed
  | OrderPaymentCaptured
  | OrderPackageSent
  | OrderPaymentDue
  | OrderPaymentFailed
  | OrderShipmentFailed
  | OrderPaymentRetried
  | OrderClosedUnpaid
  | OrderCompleted
  | OrderCanceled;

export type RetryOrderPayment = Command<
  'orders.RetryOrderPayment',
  { orderId: string }
>;

export type CloseUnpaidOrder = Command<
  'orders.CloseUnpaidOrder',
  { orderId: string }
>;

export type CancelOrder = Command<
  'orders.CancelOrder',
  { orderId: string; cancellationReason: CancellationReason }
>;

export type Order = {
  id: string;
  totalPrice: number;
  status?: OrderStatus;
  payment?: PaymentProgress;
  shipment?: ShipmentProgress;
  paymentId: string;
  shipmentId?: string;
  paymentAttempts: number;
  dueAt?: string;
  shipmentFailureReason?: CancellationReason;
};

export const initialOrder = (): Order => ({
  id: '',
  paymentId: '',
  totalPrice: 0,
  paymentAttempts: 0,
});

export const isOpen = (order: Order) =>
  order.status === 'Opened' || order.status === 'Confirmed';

export const hasShipped = (order: Order) => order.shipment === 'Sent';

export const canStillBePaid = (order: Order) =>
  order.status === 'Opened' ||
  (order.status === 'Confirmed' && hasShipped(order));

export const evolve = (order: Order, event: OrderEvent): Order => {
  switch (event.type) {
    case 'orders.OrderPlaced':
      return {
        ...order,
        id: event.data.orderId,
        totalPrice: event.data.totalPrice,
        status: 'Opened',
        payment: 'Pending',
        shipment: 'Pending',
        paymentId: PaymentId.derivedFrom(event.data.orderId),
        paymentAttempts: 1,
      };
    case 'orders.OrderPaymentAuthorized':
      return {
        ...order,
        payment: 'Authorized',
        paymentId: event.data.paymentId,
      };
    case 'orders.OrderStockReserved':
      return {
        ...order,
        shipment: 'Reserved',
        shipmentId: event.data.shipmentId,
      };
    case 'orders.OrderConfirmed':
      return { ...order, status: 'Confirmed' };
    case 'orders.OrderPaymentCaptured':
      return { ...order, payment: 'Captured' };
    case 'orders.OrderPackageSent':
      return { ...order, shipment: 'Sent' };
    case 'orders.OrderPaymentDue':
      return order;
    case 'orders.OrderPaymentFailed':
      return {
        ...order,
        payment: 'Failed',
        dueAt: event.data.dueAt ?? undefined,
      };
    case 'orders.OrderShipmentFailed':
      return {
        ...order,
        shipment: event.data.reason === 'CouldNotShip' ? 'Rejected' : 'Failed',
        shipmentFailureReason: event.data.reason,
      };
    case 'orders.OrderPaymentRetried':
      return {
        ...order,
        payment: 'Retrying',
        paymentId: event.data.paymentId,
        paymentAttempts: order.paymentAttempts + 1,
      };
    case 'orders.OrderClosedUnpaid':
      return { ...order, status: 'ClosedUnpaid' };
    case 'orders.OrderCompleted':
      return { ...order, status: 'Completed' };
    case 'orders.OrderCanceled':
      return { ...order, status: 'Canceled' };
  }
};
