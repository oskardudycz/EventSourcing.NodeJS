import type { ReadEvent } from '@event-driven-io/emmett';
import { singleStreamReadModel } from '../../readModelProjection';
import type { PongoClient } from '@event-driven-io/pongo';
import { PaymentId } from '../../payments/payment';
import type { PricedProductItem } from '../../shoppingCarts/productItems';
import type { OrderEvent, OrderProgress } from '../order';

export const orderStatusesCollection = 'order_statuses';

export type OrderStage = 'Opened' | 'Confirmed' | 'Ended';
export type OrderPaymentStage =
  'Pending' | 'Authorized' | 'Captured' | 'Failed';
export type OrderShipmentStage = 'Pending' | 'Reserved' | 'Sent' | 'Failed';
export type OrderAction = 'PayNow' | 'RetryPayment' | 'CancelOrder';

export type OrderStatus = {
  customerId: string;
  productItems: PricedProductItem[];
  totalPrice: number;
  placedAt: string;
  paymentId: string;
  carrier?: string;
  trackingNumber?: string;
  progress: OrderProgress;
  stage: OrderStage;
  payment: OrderPaymentStage;
  shipment: OrderShipmentStage;
  version: number;
};

type OrderStatusDocument = Omit<OrderStatus, 'version'>;

type InternalStages = 'stage' | 'payment' | 'shipment';

export const publicOrderStatusOf = <
  Status extends Pick<OrderStatus, InternalStages>,
>({
  stage: _stage,
  payment: _payment,
  shipment: _shipment,
  ...status
}: Status): Omit<Status, InternalStages> => status;

const refreshed = (status: OrderStatusDocument): OrderStatusDocument => {
  if (status.stage === 'Ended') return status;

  const progress: OrderProgress =
    status.payment === 'Failed'
      ? 'PaymentFailed'
      : status.shipment === 'Failed'
        ? 'OutOfStock'
        : status.shipment === 'Sent'
          ? 'Shipped'
          : status.stage === 'Confirmed' ||
              status.payment === 'Authorized' ||
              status.payment === 'Captured'
            ? 'Processing'
            : 'AwaitingPayment';

  return { ...status, progress };
};

const ended = (
  status: OrderStatusDocument,
  progress: OrderProgress,
): OrderStatusDocument => ({ ...status, stage: 'Ended', progress });

export const actionsOf = (
  status: Pick<OrderStatus, 'stage' | 'payment' | 'shipment'>,
): OrderAction[] => {
  const canStillBePaid =
    (status.stage === 'Opened' ||
      (status.stage === 'Confirmed' && status.shipment === 'Sent')) &&
    status.shipment !== 'Failed';

  return [
    ...(canStillBePaid && status.payment === 'Pending'
      ? ['PayNow' as const]
      : []),
    ...(canStillBePaid && status.payment === 'Failed'
      ? ['RetryPayment' as const]
      : []),
    ...(status.stage === 'Opened' ? ['CancelOrder' as const] : []),
  ];
};

const evolveStatus = (
  current: OrderStatusDocument | null,
  event: ReadEvent<OrderEvent>,
): OrderStatusDocument | null => {
  if (event.type === 'orders.OrderPlaced')
    return refreshed({
      customerId: event.data.customerId,
      productItems: event.data.productItems,
      totalPrice: event.data.totalPrice,
      placedAt: event.data.placedAt,
      paymentId: PaymentId.derivedFrom(event.data.orderId),
      progress: 'AwaitingPayment',
      stage: 'Opened',
      payment: 'Pending',
      shipment: 'Pending',
    });

  if (!current) return current;

  switch (event.type) {
    case 'orders.OrderPaymentAuthorized':
      return refreshed({
        ...current,
        payment: 'Authorized',
        paymentId: event.data.paymentId,
      });
    case 'orders.OrderStockReserved':
      return refreshed({ ...current, shipment: 'Reserved' });
    case 'orders.OrderConfirmed':
      return refreshed({ ...current, stage: 'Confirmed' });
    case 'orders.OrderPackageSent':
      return refreshed({
        ...current,
        carrier: event.data.carrier,
        trackingNumber: event.data.trackingNumber,
        shipment: 'Sent',
      });
    case 'orders.OrderPaymentCaptured':
      return refreshed({ ...current, payment: 'Captured' });
    case 'orders.OrderPaymentFailed':
      return refreshed({ ...current, payment: 'Failed' });
    case 'orders.OrderShipmentFailed':
      return refreshed({ ...current, shipment: 'Failed' });
    case 'orders.OrderPaymentRetried':
      return refreshed({
        ...current,
        payment: 'Pending',
        paymentId: event.data.paymentId,
      });
    case 'orders.OrderCompleted':
      return ended(current, 'Completed');
    case 'orders.OrderCanceled':
      return ended(current, 'Canceled');
    case 'orders.OrderClosedUnpaid':
      return ended(current, 'ClosedUnpaid');
    case 'orders.OrderPaymentDue':
      return current;
  }
};

export const orderStatusesReadModel = singleStreamReadModel<
  OrderStatus,
  OrderEvent
>({
  collectionName: orderStatusesCollection,
  canHandle: [
    'orders.OrderPlaced',
    'orders.OrderPaymentAuthorized',
    'orders.OrderStockReserved',
    'orders.OrderConfirmed',
    'orders.OrderPackageSent',
    'orders.OrderPaymentCaptured',
    'orders.OrderPaymentFailed',
    'orders.OrderShipmentFailed',
    'orders.OrderPaymentRetried',
    'orders.OrderCompleted',
    'orders.OrderCanceled',
    'orders.OrderClosedUnpaid',
  ],
  getDocumentId: (event) => event.data.orderId,
  evolve: (
    current: OrderStatus | null,
    event: ReadEvent<OrderEvent>,
  ): OrderStatus | null => {
    const next = evolveStatus(current, event);
    return next && { ...next, version: (current?.version ?? 0) + 1 };
  },
});

export const orderStatuses = (pongo: PongoClient) => {
  const collection = pongo
    .db()
    .collection<OrderStatus>(orderStatusesCollection);

  return {
    get: async (orderId: string) => {
      const found = await collection.findOne({ _id: orderId });

      if (!found) return null;

      const { _id, _version: _ignored, ...status } = found;
      return { orderId: _id, ...status, actions: actionsOf(status) };
    },
  };
};

export type OrderStatuses = ReturnType<typeof orderStatuses>;
