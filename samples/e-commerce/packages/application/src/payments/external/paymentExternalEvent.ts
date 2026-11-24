import type { Event } from '@event-driven-io/emmett';

export type PaymentAuthorized = Event<
  'payments.external.PaymentAuthorized',
  { referenceId: string; paymentId: string; authorizedAt: string }
>;

export type PaymentCaptured = Event<
  'payments.external.PaymentCaptured',
  { referenceId: string; paymentId: string; capturedAt: string }
>;

export type PaymentFailed = Event<
  'payments.external.PaymentFailed',
  { referenceId: string; paymentId: string; failedAt: string }
>;

export type PaymentExternalEvent =
  PaymentAuthorized | PaymentCaptured | PaymentFailed;

export const paymentExternalEventTypes = [
  'payments.external.PaymentAuthorized',
  'payments.external.PaymentCaptured',
  'payments.external.PaymentFailed',
] as const;
