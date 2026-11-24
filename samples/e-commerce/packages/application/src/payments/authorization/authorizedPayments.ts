import type { ReadEvent } from '@event-driven-io/emmett';
import { singleStreamReadModel } from '../../readModelProjection';
import type { PongoClient } from '@event-driven-io/pongo';
import type { PaymentEvent } from '../payment';

export const authorizedPaymentsCollection = 'authorized_payments';

type AuthorizedPayment = { captureBefore: string };

export const authorizedPaymentsReadModel = singleStreamReadModel<
  AuthorizedPayment,
  PaymentEvent
>({
  collectionName: authorizedPaymentsCollection,
  canHandle: [
    'payments.PaymentAuthorized',
    'payments.PaymentCaptureRequested',
    'payments.PaymentCanceled',
    'payments.PaymentAuthorizationExpired',
  ],
  getDocumentId: (event) => event.data.paymentId,
  evolve: (
    current: AuthorizedPayment | null,
    event: ReadEvent<PaymentEvent>,
  ): AuthorizedPayment | null =>
    event.type === 'payments.PaymentAuthorized'
      ? { captureBefore: event.data.captureBefore }
      : null,
});

export const authorizedPayments = (pongo: PongoClient) => {
  const collection = pongo
    .db()
    .collection<AuthorizedPayment>(authorizedPaymentsCollection);

  return {
    expiredAt: async (now: Date): Promise<string[]> =>
      (
        await collection.find({ captureBefore: { $lte: now.toISOString() } })
      ).map(({ _id }) => _id),
  };
};

export type AuthorizedPayments = ReturnType<typeof authorizedPayments>;
