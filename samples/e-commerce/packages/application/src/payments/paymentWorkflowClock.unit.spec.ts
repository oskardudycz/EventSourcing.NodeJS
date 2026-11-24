import { WorkflowSpecification } from '@event-driven-io/emmett';
import { describe, it } from 'vitest';
import { OrderId } from '../orders/order';
import { ShoppingCartId } from '../shoppingCarts/shoppingCart';
import { PaymentId, type PaymentEvent } from './payment';
import { paymentWorkflow } from './paymentWorkflow';

const orderId = OrderId.derivedFrom(ShoppingCartId.of('customer-1', 1));
const paymentId = PaymentId.derivedFrom(orderId);
const at = (hours: number) =>
  new Date(Date.UTC(2026, 0, 1, hours)).toISOString();
const timesOutAt = at(34);

const requested: PaymentEvent = {
  type: 'payments.PaymentAuthorizationRequested',
  data: {
    paymentId,
    referenceId: orderId,
    amount: 62.5,
    requestedAt: at(10),
    timesOutAt,
  },
};

const timeOutSentAt = (senderTime: string) => ({
  type: 'payments.TimeOutPayment' as const,
  data: { paymentId },
  metadata: { now: new Date(senderTime) },
});

const given = (workflowTime: string) =>
  WorkflowSpecification.for(
    paymentWorkflow({ now: () => new Date(workflowTime) }),
  );

describe('payment workflow clock', () => {
  it('aWorkflowStampsItsDecisionsWithItsClockNotTheSendersClock', () =>
    given(timesOutAt)([requested])
      .when(timeOutSentAt(at(10)))
      .then([
        {
          type: 'payments.PaymentTimedOut',
          data: { paymentId, timedOutAt: timesOutAt },
        },
      ]));

  it('aWorkflowDecidesWithItsClockNotTheSendersClock', () =>
    given(at(11))([requested])
      .when(timeOutSentAt(at(40)))
      .thenNothingHappened());
});
