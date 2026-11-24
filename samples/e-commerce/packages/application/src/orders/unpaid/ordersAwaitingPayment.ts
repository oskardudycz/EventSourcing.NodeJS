import type { ReadEvent } from '@event-driven-io/emmett';
import { singleStreamReadModel } from '../../readModelProjection';
import type { PongoClient } from '@event-driven-io/pongo';
import type { OrderEvent } from '../order';

export const ordersAwaitingPaymentCollection = 'orders_awaiting_payment';

type OrderAwaitingPayment = { dueAt: string };

export const ordersAwaitingPaymentReadModel = singleStreamReadModel<
  OrderAwaitingPayment,
  OrderEvent
>({
  collectionName: ordersAwaitingPaymentCollection,
  canHandle: [
    'orders.OrderPaymentFailed',
    'orders.OrderCompleted',
    'orders.OrderClosedUnpaid',
    'orders.OrderCanceled',
  ],
  getDocumentId: (event) => event.data.orderId,
  evolve: (
    current: OrderAwaitingPayment | null,
    event: ReadEvent<OrderEvent>,
  ): OrderAwaitingPayment | null =>
    event.type === 'orders.OrderPaymentFailed' && event.data.dueAt !== null
      ? { dueAt: event.data.dueAt }
      : event.type === 'orders.OrderPaymentFailed'
        ? current
        : null,
});

export const ordersAwaitingPayment = (pongo: PongoClient) => {
  const collection = pongo
    .db()
    .collection<OrderAwaitingPayment>(ordersAwaitingPaymentCollection);

  return {
    overdueAt: async (now: Date): Promise<string[]> =>
      (await collection.find({ dueAt: { $lte: now.toISOString() } })).map(
        ({ _id }) => _id,
      ),
  };
};

export type OrdersAwaitingPayment = ReturnType<typeof ordersAwaitingPayment>;
