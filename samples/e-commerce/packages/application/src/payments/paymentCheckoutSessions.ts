import {
  EmmettError,
  IllegalStateError,
  NotFoundError,
  type EventStore,
} from '@event-driven-io/emmett';
import {
  openCheckoutSession,
  PaymentId,
  type CheckoutSession,
  type Payment,
} from './payment';
import type { PaymentGateway } from './paymentGateway';
import {
  paymentWorkflowHandler,
  paymentWorkflowOptions,
} from './paymentWorkflow';

const checkoutSessionLifetimeInMs = 30 * 60 * 1000;

export type CreateCheckoutSession = {
  paymentId: string;
  referenceId: string;
  successUrl: string;
  cancelUrl: string;
};

export const paymentCheckoutSessions = ({
  store,
  gateway,
  now,
}: {
  store: EventStore;
  gateway: PaymentGateway;
  now: () => Date;
}) => {
  const recordSession = paymentWorkflowHandler(now);

  const { workflow } = paymentWorkflowOptions(now);

  const paymentOf = async (paymentId: string): Promise<Payment> =>
    (
      await store.aggregateStream(PaymentId.workflowStreamNameOf(paymentId), {
        evolve: workflow.evolve,
        initialState: workflow.initialState,
      })
    ).state;

  return {
    createCheckoutSession: async ({
      paymentId,
      referenceId,
      successUrl,
      cancelUrl,
    }: CreateCheckoutSession): Promise<CheckoutSession> => {
      const createdAt = now();
      const payment = await paymentOf(paymentId);

      if (payment.status === undefined || payment.referenceId !== referenceId)
        throw new NotFoundError({ type: 'Payment', id: paymentId });

      if (payment.status !== 'Pending')
        throw new IllegalStateError(`Payment '${paymentId}' is not pending`);

      const open = openCheckoutSession(payment, createdAt.toISOString());

      if (open) return open;

      const session = await gateway
        .createCheckoutSession({
          paymentId,
          amount: payment.amount,
          successUrl,
          cancelUrl,
          expiresAt: new Date(
            createdAt.getTime() + checkoutSessionLifetimeInMs,
          ).toISOString(),
        })
        .catch((cause: unknown) => {
          throw new EmmettError({
            status: 502,
            message: `Opening a checkout session for payment '${paymentId}' failed`,
            cause,
          });
        });

      await recordSession(store, {
        type: 'payments.RecordCheckoutSession',
        data: { paymentId, session },
      });

      return session;
    },
  };
};

export type PaymentCheckoutSessions = ReturnType<
  typeof paymentCheckoutSessions
>;
