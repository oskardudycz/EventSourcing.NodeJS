import type { ReadEvent } from '@event-driven-io/emmett';
import { singleStreamReadModel } from '../../readModelProjection';
import type { PongoClient } from '@event-driven-io/pongo';
import type { OrderEvent, OrderProgress } from '../order';

export const customerOrdersCollection = 'customer_orders';

export type CustomerOrder = {
  orderId: string;
  customerId: string;
  placedAt: string;
  totalPrice: number;
  progress: OrderProgress;
  shipped: boolean;
};

type CustomerOrderDocument = Omit<CustomerOrder, 'orderId'>;

const evolveOrder = (
  current: CustomerOrderDocument | null,
  event: ReadEvent<OrderEvent>,
): CustomerOrderDocument | null => {
  if (event.type === 'orders.OrderPlaced')
    return {
      customerId: event.data.customerId,
      placedAt: event.data.placedAt,
      totalPrice: event.data.totalPrice,
      progress: 'AwaitingPayment',
      shipped: false,
    };

  if (!current) return current;

  switch (event.type) {
    case 'orders.OrderPaymentAuthorized':
      return {
        ...current,
        progress: current.shipped ? 'Shipped' : 'Processing',
      };
    case 'orders.OrderConfirmed':
      return { ...current, progress: 'Processing', shipped: false };
    case 'orders.OrderPackageSent':
      return { ...current, progress: 'Shipped', shipped: true };
    case 'orders.OrderPaymentFailed':
      return { ...current, progress: 'PaymentFailed' };
    case 'orders.OrderPaymentRetried':
      return { ...current, progress: 'AwaitingPayment' };
    case 'orders.OrderCompleted':
      return { ...current, progress: 'Completed', shipped: true };
    case 'orders.OrderCanceled':
      return { ...current, progress: 'Canceled' };
    case 'orders.OrderClosedUnpaid':
      return { ...current, progress: 'ClosedUnpaid', shipped: true };
    default:
      return current;
  }
};

export const customerOrdersReadModel = singleStreamReadModel<
  CustomerOrderDocument,
  OrderEvent
>({
  collectionName: customerOrdersCollection,
  canHandle: [
    'orders.OrderPlaced',
    'orders.OrderPaymentAuthorized',
    'orders.OrderConfirmed',
    'orders.OrderPackageSent',
    'orders.OrderPaymentFailed',
    'orders.OrderPaymentRetried',
    'orders.OrderCompleted',
    'orders.OrderCanceled',
    'orders.OrderClosedUnpaid',
  ],
  getDocumentId: (event) => event.data.orderId,
  evolve: evolveOrder,
});

export const customerOrders = (pongo: PongoClient) => {
  const collection = pongo
    .db()
    .collection<CustomerOrderDocument>(customerOrdersCollection);

  return {
    of: async (customerId: string): Promise<CustomerOrder[]> =>
      (await collection.find({ customerId }, { sort: { placedAt: -1 } })).map(
        ({ _id, _version: _ignored, ...order }) => ({
          orderId: _id,
          ...order,
        }),
      ),
  };
};

export type CustomerOrders = ReturnType<typeof customerOrders>;
