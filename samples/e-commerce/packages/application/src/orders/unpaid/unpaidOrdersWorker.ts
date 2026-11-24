import type { Worker } from '@e-commerce/core';
import type { CloseUnpaidOrder } from '../order';
import type { OrdersAwaitingPayment } from './ordersAwaitingPayment';

export const unpaidOrdersWorker = ({
  ordersAwaitingPayment,
  storeAsInput,
}: {
  ordersAwaitingPayment: OrdersAwaitingPayment;
  storeAsInput: (command: CloseUnpaidOrder) => Promise<unknown>;
}): Worker => ({
  handle: async (now) => {
    for (const orderId of await ordersAwaitingPayment.overdueAt(now))
      await storeAsInput({
        type: 'orders.CloseUnpaidOrder',
        data: { orderId },
      });
  },
});
