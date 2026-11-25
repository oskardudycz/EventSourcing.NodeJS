import { getInMemoryEventStore } from '@event-driven-io/emmett';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { OrderId } from '../orders/order';
import { PaymentId } from './payment';
import { paymentCheckoutSessions } from './paymentCheckoutSessions';
import { paymentProvider } from './paymentProvider';
import { paymentWorkflowHandler } from './paymentWorkflow';

const now = () => new Date('2026-01-01T10:00:00.000Z');

describe('payment checkout sessions', () => {
  it('aCheckoutSessionWaitsForAPaymentThatIsStillOnItsWay', async () => {
    const store = getInMemoryEventStore();
    const orderId = OrderId.of(`${randomUUID()}-1`);
    const paymentId = PaymentId.derivedFrom(orderId);
    const sessions = paymentCheckoutSessions({
      store,
      gateway: paymentProvider(),
      now,
    });
    const paymentArrivesLater = new Promise((resolve) =>
      setTimeout(resolve, 200),
    ).then(() =>
      paymentWorkflowHandler(now)(store, {
        type: 'payments.AuthorizePayment',
        data: { paymentId, referenceId: orderId, amount: 100 },
      }),
    );

    const session = await sessions.createCheckoutSession({
      paymentId,
      referenceId: orderId,
      successUrl: 'http://shop/orders/1',
      cancelUrl: 'http://shop/orders/1',
    });
    await paymentArrivesLater;

    expect(session.url).toBeTruthy();
  });
});
