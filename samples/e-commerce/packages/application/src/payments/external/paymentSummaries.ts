import type { ReadEvent } from '@event-driven-io/emmett';
import { singleStreamReadModel } from '../../readModelProjection';
import type { PongoClient } from '@event-driven-io/pongo';
import type { PaymentEvent } from '../payment';

export const paymentSummariesCollection = 'payment_summaries';

export type PaymentSummary = { referenceId: string };

export const paymentSummariesReadModel = singleStreamReadModel<
  PaymentSummary,
  PaymentEvent
>({
  collectionName: paymentSummariesCollection,
  canHandle: ['payments.PaymentAuthorizationRequested'],
  getDocumentId: (event) => event.data.paymentId,
  evolve: (
    current: PaymentSummary | null,
    event: ReadEvent<PaymentEvent>,
  ): PaymentSummary | null =>
    event.type === 'payments.PaymentAuthorizationRequested'
      ? { referenceId: event.data.referenceId }
      : current,
});

export const paymentSummaries = (pongo: PongoClient) => {
  const collection = pongo
    .db()
    .collection<PaymentSummary>(paymentSummariesCollection);

  return {
    get: (paymentId: string) => collection.findOne({ _id: paymentId }),
  };
};

export type PaymentSummaries = ReturnType<typeof paymentSummaries>;
