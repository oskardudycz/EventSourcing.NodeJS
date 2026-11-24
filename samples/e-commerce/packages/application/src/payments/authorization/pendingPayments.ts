import type { ReadEvent } from '@event-driven-io/emmett';
import { singleStreamReadModel } from '../../readModelProjection';
import type { PongoClient } from '@event-driven-io/pongo';
import type { PaymentEvent } from '../payment';

export const pendingPaymentsCollection = 'pending_payments';

type PendingPayment = { timesOutAt: string };

export const pendingPaymentsReadModel = singleStreamReadModel<
  PendingPayment,
  PaymentEvent
>({
  collectionName: pendingPaymentsCollection,
  canHandle: [
    'payments.PaymentAuthorizationRequested',
    'payments.PaymentAuthorized',
    'payments.PaymentTimedOut',
  ],
  getDocumentId: (event) => event.data.paymentId,
  evolve: (
    current: PendingPayment | null,
    event: ReadEvent<PaymentEvent>,
  ): PendingPayment | null =>
    event.type === 'payments.PaymentAuthorizationRequested'
      ? { timesOutAt: event.data.timesOutAt }
      : null,
});

export const pendingPayments = (pongo: PongoClient) => {
  const collection = pongo
    .db()
    .collection<PendingPayment>(pendingPaymentsCollection);

  return {
    timedOutAt: async (now: Date): Promise<string[]> =>
      (await collection.find({ timesOutAt: { $lte: now.toISOString() } })).map(
        ({ _id }) => _id,
      ),
  };
};

export type PendingPayments = ReturnType<typeof pendingPayments>;
