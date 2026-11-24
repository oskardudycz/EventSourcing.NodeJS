import { WorkflowSpecification } from '@event-driven-io/emmett';
import { describe, it } from 'vitest';
import { OrderId } from '../orders/order';
import { ShoppingCartId } from '../shoppingCarts/shoppingCart';
import { PaymentId, type PaymentEvent } from './payment';
import { paymentWorkflow } from './paymentWorkflow';

const orderId = OrderId.derivedFrom(ShoppingCartId.of('customer-1', 1));
const paymentId = PaymentId.derivedFrom(orderId);
const amount = 62.5;

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 0, 1, 10, minutes)).toISOString();
const now = at(0);
const timesOutAt = new Date(Date.UTC(2026, 0, 2, 10)).toISOString();
const captureBefore = new Date(Date.UTC(2026, 0, 8, 10)).toISOString();
const session = { url: 'https://checkout.example/c/pay/1', expiresAt: at(30) };

const clock = { current: new Date(now) };
const atTime = (time: string) => {
  clock.current = new Date(time);
};
const given = WorkflowSpecification.for(
  paymentWorkflow({ now: () => clock.current }),
);

const requested: PaymentEvent = {
  type: 'payments.PaymentAuthorizationRequested',
  data: {
    paymentId,
    referenceId: orderId,
    amount,
    requestedAt: now,
    timesOutAt,
  },
};
const sessionCreated: PaymentEvent = {
  type: 'payments.CheckoutSessionCreated',
  data: { paymentId, ...session },
};
const authorized: PaymentEvent = {
  type: 'payments.PaymentAuthorized',
  data: { paymentId, authorizedAt: now, captureBefore },
};
const captureRequested: PaymentEvent = {
  type: 'payments.PaymentCaptureRequested',
  data: { paymentId, amount, requestedAt: now },
};
const captured: PaymentEvent = {
  type: 'payments.PaymentCaptured',
  data: { paymentId, amount, capturedAt: now },
};
const canceled: PaymentEvent = {
  type: 'payments.PaymentCanceled',
  data: { paymentId, canceledAt: now },
};

describe('payment workflow', () => {
  it('authorizingRecordsTheRequestWithTheTimeOut24HoursLater', () => {
    atTime(now);

    return given([])
      .when({
        type: 'payments.AuthorizePayment',
        data: { paymentId, referenceId: orderId, amount },
      })
      .then([requested]);
  });

  it('authorizingAnExistingPaymentDecidesNothing', () =>
    given([requested])
      .when({
        type: 'payments.AuthorizePayment',
        data: { paymentId, referenceId: orderId, amount },
      })
      .thenNothingHappened());

  it('aSessionIsRecordedForAPendingPayment', () => {
    atTime(now);

    return given([requested])
      .when({
        type: 'payments.RecordCheckoutSession',
        data: { paymentId, session },
      })
      .then([sessionCreated]);
  });

  it('aSecondSessionIsNotRecordedWhileOneIsOpen', () => {
    atTime(at(29));

    return given([requested, sessionCreated])
      .when({
        type: 'payments.RecordCheckoutSession',
        data: { paymentId, session },
      })
      .thenNothingHappened();
  });

  it('aNewSessionIsRecordedOnceTheOpenOneExpired', () => {
    atTime(at(30));

    return given([requested, sessionCreated])
      .when({
        type: 'payments.RecordCheckoutSession',
        data: { paymentId, session },
      })
      .then([sessionCreated]);
  });

  it('aSessionIsNotRecordedForAnAuthorizedPayment', () => {
    atTime(now);

    return given([requested, authorized])
      .when({
        type: 'payments.RecordCheckoutSession',
        data: { paymentId, session },
      })
      .thenNothingHappened();
  });

  it('confirmingTheAuthorizationRecordsTheDeadlineToCapture', () => {
    atTime(now);

    return given([requested])
      .when({
        type: 'payments.ConfirmPaymentAuthorization',
        data: { paymentId, captureBefore },
      })
      .then([authorized]);
  });

  it('confirmingTheAuthorizationAgainDecidesNothing', () =>
    given([requested, authorized])
      .when({
        type: 'payments.ConfirmPaymentAuthorization',
        data: { paymentId, captureBefore },
      })
      .thenNothingHappened());

  it('capturingAnAuthorizedPaymentRequestsTheCapture', () => {
    atTime(now);

    return given([requested, authorized])
      .when({ type: 'payments.CapturePayment', data: { paymentId } })
      .then([captureRequested]);
  });

  it('capturingAPaymentThatIsNotAuthorizedDecidesNothing', () =>
    given([requested])
      .when({ type: 'payments.CapturePayment', data: { paymentId } })
      .thenNothingHappened());

  it('confirmingTheCaptureRecordsTheCapture', () => {
    atTime(now);

    return given([requested, authorized, captureRequested])
      .when({ type: 'payments.ConfirmPaymentCapture', data: { paymentId } })
      .then([captured]);
  });

  it('confirmingACaptureThatWasNotRequestedDecidesNothing', () =>
    given([requested, authorized])
      .when({ type: 'payments.ConfirmPaymentCapture', data: { paymentId } })
      .thenNothingHappened());

  it('aFailedCaptureRecordsTheReason', () => {
    atTime(now);

    return given([requested, authorized, captureRequested])
      .when({
        type: 'payments.FailPaymentCapture',
        data: { paymentId, reason: 'UnexpectedError' },
      })
      .then([
        {
          type: 'payments.PaymentCaptureFailed',
          data: { paymentId, reason: 'UnexpectedError', failedAt: now },
        },
      ]);
  });

  it('aFailedCaptureAfterTheCaptureDecidesNothing', () =>
    given([requested, authorized, captureRequested, captured])
      .when({
        type: 'payments.FailPaymentCapture',
        data: { paymentId, reason: 'UnexpectedError' },
      })
      .thenNothingHappened());

  it('cancelingAnAuthorizedPaymentRecordsTheCancellation', () => {
    atTime(now);

    return given([requested, authorized])
      .when({ type: 'payments.CancelPayment', data: { paymentId } })
      .then([canceled]);
  });

  it('cancelingACapturedPaymentDecidesNothing', () =>
    given([requested, authorized, captureRequested, captured])
      .when({ type: 'payments.CancelPayment', data: { paymentId } })
      .thenNothingHappened());

  it('aPendingPaymentTimesOutAtItsDeadline', () => {
    atTime(timesOutAt);

    return given([requested])
      .when({ type: 'payments.TimeOutPayment', data: { paymentId } })
      .then([
        {
          type: 'payments.PaymentTimedOut',
          data: { paymentId, timedOutAt: timesOutAt },
        },
      ]);
  });

  it('aPendingPaymentDoesNotTimeOutBeforeItsDeadline', () => {
    atTime(at(1));

    return given([requested])
      .when({ type: 'payments.TimeOutPayment', data: { paymentId } })
      .thenNothingHappened();
  });

  it('anAuthorizedPaymentNeverTimesOut', () => {
    atTime(timesOutAt);

    return given([requested, authorized])
      .when({ type: 'payments.TimeOutPayment', data: { paymentId } })
      .thenNothingHappened();
  });

  it('anAuthorizationExpiresAtItsDeadline', () => {
    atTime(captureBefore);

    return given([requested, authorized])
      .when({
        type: 'payments.ExpirePaymentAuthorization',
        data: { paymentId },
      })
      .then([
        {
          type: 'payments.PaymentAuthorizationExpired',
          data: { paymentId, expiredAt: captureBefore },
        },
      ]);
  });

  it('anAuthorizationDoesNotExpireBeforeItsDeadline', () => {
    atTime(at(1));

    return given([requested, authorized])
      .when({
        type: 'payments.ExpirePaymentAuthorization',
        data: { paymentId },
      })
      .thenNothingHappened();
  });

  it('aCanceledPaymentNeverExpires', () => {
    atTime(captureBefore);

    return given([requested, authorized, canceled])
      .when({
        type: 'payments.ExpirePaymentAuthorization',
        data: { paymentId },
      })
      .thenNothingHappened();
  });
});
