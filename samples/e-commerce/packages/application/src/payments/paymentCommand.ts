import type { Command } from '@event-driven-io/emmett';
import type { CaptureFailureReason, CheckoutSession } from './payment';

export type AuthorizePayment = Command<
  'payments.AuthorizePayment',
  {
    paymentId: string;
    referenceId: string;
    amount: number;
  }
>;

export type CapturePayment = Command<
  'payments.CapturePayment',
  { paymentId: string }
>;

export type CancelPayment = Command<
  'payments.CancelPayment',
  { paymentId: string }
>;

export type ConfirmPaymentAuthorization = Command<
  'payments.ConfirmPaymentAuthorization',
  { paymentId: string; captureBefore: string }
>;

export type ConfirmPaymentCapture = Command<
  'payments.ConfirmPaymentCapture',
  { paymentId: string }
>;

export type FailPaymentCapture = Command<
  'payments.FailPaymentCapture',
  { paymentId: string; reason: CaptureFailureReason }
>;

export type TimeOutPayment = Command<
  'payments.TimeOutPayment',
  { paymentId: string }
>;

export type ExpirePaymentAuthorization = Command<
  'payments.ExpirePaymentAuthorization',
  { paymentId: string }
>;

export type RecordCheckoutSession = Command<
  'payments.RecordCheckoutSession',
  { paymentId: string; session: CheckoutSession }
>;

export type PaymentRequest = AuthorizePayment | CapturePayment | CancelPayment;

export type PaymentAnswer =
  | ConfirmPaymentAuthorization
  | ConfirmPaymentCapture
  | FailPaymentCapture
  | TimeOutPayment
  | ExpirePaymentAuthorization;

export type PaymentCommand =
  PaymentRequest | PaymentAnswer | RecordCheckoutSession;

export const paymentRequestTypes = [
  'payments.AuthorizePayment',
  'payments.CapturePayment',
  'payments.CancelPayment',
] as const;

export const paymentAnswerTypes = [
  'payments.ConfirmPaymentAuthorization',
  'payments.ConfirmPaymentCapture',
  'payments.FailPaymentCapture',
  'payments.TimeOutPayment',
  'payments.ExpirePaymentAuthorization',
] as const;

export const paymentCommandTypes = [
  ...paymentRequestTypes,
  ...paymentAnswerTypes,
  'payments.RecordCheckoutSession',
] as const;
