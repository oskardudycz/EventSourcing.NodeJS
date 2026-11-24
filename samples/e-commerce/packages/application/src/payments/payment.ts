import { Urns } from '@e-commerce/core';
import type { Event } from '@event-driven-io/emmett';

const paymentType = 'payment';

export const PaymentId = {
  require: (id: string): string => Urns.requireType(id, paymentType),
  of: (tail: string): string => Urns.of('ecommerce', paymentType, tail),
  tailOf: Urns.tailOf,
  derivedFrom: (sourceUrn: string, attempt = 1): string =>
    attempt === 1
      ? Urns.derive(sourceUrn, paymentType)
      : Urns.of(
          Urns.namespaceOf(sourceUrn),
          paymentType,
          `${Urns.tailOf(sourceUrn)}-${attempt}`,
        ),
  workflowStreamNameOf: (id: string): string => `payments_workflow-${id}`,
};

export type PaymentStatus =
  | 'Pending'
  | 'Authorized'
  | 'CaptureRequested'
  | 'Captured'
  | 'Canceled'
  | 'Failed';

export type CheckoutSession = { url: string; expiresAt: string };

export type CaptureFailureReason = 'UnexpectedError';

export type PaymentAuthorizationRequested = Event<
  'payments.PaymentAuthorizationRequested',
  {
    paymentId: string;
    referenceId: string;
    amount: number;
    requestedAt: string;
    timesOutAt: string;
  }
>;

export type CheckoutSessionCreated = Event<
  'payments.CheckoutSessionCreated',
  { paymentId: string; url: string; expiresAt: string }
>;

export type PaymentAuthorized = Event<
  'payments.PaymentAuthorized',
  { paymentId: string; authorizedAt: string; captureBefore: string }
>;

export type PaymentCaptureRequested = Event<
  'payments.PaymentCaptureRequested',
  { paymentId: string; amount: number; requestedAt: string }
>;

export type PaymentCaptured = Event<
  'payments.PaymentCaptured',
  { paymentId: string; amount: number; capturedAt: string }
>;

export type PaymentCaptureFailed = Event<
  'payments.PaymentCaptureFailed',
  { paymentId: string; reason: CaptureFailureReason; failedAt: string }
>;

export type PaymentCanceled = Event<
  'payments.PaymentCanceled',
  { paymentId: string; canceledAt: string }
>;

export type PaymentTimedOut = Event<
  'payments.PaymentTimedOut',
  { paymentId: string; timedOutAt: string }
>;

export type PaymentAuthorizationExpired = Event<
  'payments.PaymentAuthorizationExpired',
  { paymentId: string; expiredAt: string }
>;

export type PaymentEvent =
  | PaymentAuthorizationRequested
  | CheckoutSessionCreated
  | PaymentAuthorized
  | PaymentCaptureRequested
  | PaymentCaptured
  | PaymentCaptureFailed
  | PaymentCanceled
  | PaymentTimedOut
  | PaymentAuthorizationExpired;

export type Payment = {
  id: string;
  referenceId: string;
  amount: number;
  status?: PaymentStatus;
  timesOutAt: string;
  captureBefore?: string;
  checkoutSession?: CheckoutSession;
};

export const initialPayment = (): Payment => ({
  id: '',
  referenceId: '',
  amount: 0,
  timesOutAt: '',
});

export const exists = (payment: Payment) => payment.status !== undefined;

export const openCheckoutSession = (
  payment: Payment,
  now: string,
): CheckoutSession | undefined =>
  payment.checkoutSession &&
  Date.parse(now) < Date.parse(payment.checkoutSession.expiresAt)
    ? payment.checkoutSession
    : undefined;

export const evolve = (payment: Payment, event: PaymentEvent): Payment => {
  switch (event.type) {
    case 'payments.PaymentAuthorizationRequested':
      return {
        ...payment,
        id: event.data.paymentId,
        referenceId: event.data.referenceId,
        amount: event.data.amount,
        status: 'Pending',
        timesOutAt: event.data.timesOutAt,
      };
    case 'payments.CheckoutSessionCreated':
      return {
        ...payment,
        checkoutSession: {
          url: event.data.url,
          expiresAt: event.data.expiresAt,
        },
      };
    case 'payments.PaymentAuthorized':
      return {
        ...payment,
        status: 'Authorized',
        captureBefore: event.data.captureBefore,
      };
    case 'payments.PaymentCaptureRequested':
      return { ...payment, status: 'CaptureRequested' };
    case 'payments.PaymentCaptured':
      return { ...payment, status: 'Captured' };
    case 'payments.PaymentCaptureFailed':
      return { ...payment, status: 'Failed' };
    case 'payments.PaymentCanceled':
      return { ...payment, status: 'Canceled' };
    case 'payments.PaymentTimedOut':
      return { ...payment, status: 'Failed' };
    case 'payments.PaymentAuthorizationExpired':
      return { ...payment, status: 'Failed' };
  }
};
