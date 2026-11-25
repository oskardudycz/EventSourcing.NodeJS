import type { Worker } from '@e-commerce/core';
import type { TimeOutPayment } from '../paymentCommand';
import type { PendingPayments } from './pendingPayments';

export const paymentTimeoutWorker = ({
  pendingPayments,
  storeAsInput,
}: {
  pendingPayments: PendingPayments;
  storeAsInput: (command: TimeOutPayment) => Promise<unknown>;
}): Worker => ({
  handle: async (now) => {
    for (const paymentId of await pendingPayments.timedOutAt(now))
      await storeAsInput({
        type: 'payments.TimeOutPayment',
        data: { paymentId, timedOutAt: now.toISOString() },
      });
  },
});
