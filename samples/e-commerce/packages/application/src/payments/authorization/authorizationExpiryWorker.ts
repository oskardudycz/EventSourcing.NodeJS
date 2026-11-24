import type { Worker } from '@e-commerce/core';
import type { ExpirePaymentAuthorization } from '../paymentCommand';
import type { AuthorizedPayments } from './authorizedPayments';

export const authorizationExpiryWorker = ({
  authorizedPayments,
  storeAsInput,
}: {
  authorizedPayments: AuthorizedPayments;
  storeAsInput: (command: ExpirePaymentAuthorization) => Promise<unknown>;
}): Worker => ({
  handle: async (now) => {
    for (const paymentId of await authorizedPayments.expiredAt(now))
      await storeAsInput({
        type: 'payments.ExpirePaymentAuthorization',
        data: { paymentId },
      });
  },
});
