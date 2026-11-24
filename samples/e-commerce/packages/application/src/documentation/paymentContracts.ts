import { z } from 'zod';
import type { PaymentExternalEvent } from '../payments/external/paymentExternalEvent';
import type {
  CheckoutSessionCreated,
  PaymentAuthorizationExpired,
  PaymentAuthorizationRequested,
  PaymentAuthorized,
  PaymentCanceled,
  PaymentCaptureFailed,
  PaymentCaptureRequested,
  PaymentCaptured,
  PaymentTimedOut,
} from '../payments/payment';
import type {
  AuthorizePayment,
  CancelPayment,
  CapturePayment,
  ConfirmPaymentAuthorization,
  ConfirmPaymentCapture,
  ExpirePaymentAuthorization,
  FailPaymentCapture,
  RecordCheckoutSession,
  TimeOutPayment,
} from '../payments/paymentCommand';
import { at, later, orderId, paymentId } from './fixtures';
import { contractsOf } from './messageContract';

const { event, command } = contractsOf('payments');
const { event: externalEvent } = contractsOf('payments.external');

const id = z.string();
const time = z.string();
const idOnly = z.object({ paymentId: id });

export const paymentAuthorizationRequested = event<
  PaymentAuthorizationRequested['data']
>(
  'PaymentAuthorizationRequested',
  'Authorization of a payment was requested.',
  z.object({
    paymentId: id,
    referenceId: id,
    amount: z.number(),
    requestedAt: time,
    timesOutAt: time,
  }),
  {
    paymentId,
    referenceId: orderId,
    amount: 39.98,
    requestedAt: at,
    timesOutAt: later,
  },
);

export const checkoutSessionCreated = event<CheckoutSessionCreated['data']>(
  'CheckoutSessionCreated',
  'The payment provider created a checkout session.',
  z.object({ paymentId: id, url: id, expiresAt: time }),
  { paymentId, url: 'https://sandbox.example/checkout/1', expiresAt: later },
);

export const paymentAuthorized = event<PaymentAuthorized['data']>(
  'PaymentAuthorized',
  'The payment was authorized.',
  z.object({ paymentId: id, authorizedAt: time, captureBefore: time }),
  { paymentId, authorizedAt: at, captureBefore: later },
);

export const paymentCaptureRequested = event<PaymentCaptureRequested['data']>(
  'PaymentCaptureRequested',
  'Capture of the payment was requested.',
  z.object({ paymentId: id, amount: z.number(), requestedAt: time }),
  { paymentId, amount: 39.98, requestedAt: at },
);

export const paymentCaptured = event<PaymentCaptured['data']>(
  'PaymentCaptured',
  'The payment was captured.',
  z.object({ paymentId: id, amount: z.number(), capturedAt: time }),
  { paymentId, amount: 39.98, capturedAt: at },
);

export const paymentCaptureFailed = event<PaymentCaptureFailed['data']>(
  'PaymentCaptureFailed',
  'Capture of the payment failed.',
  z.object({
    paymentId: id,
    reason: z.literal('UnexpectedError'),
    failedAt: time,
  }),
  { paymentId, reason: 'UnexpectedError', failedAt: at },
);

export const paymentCanceled = event<PaymentCanceled['data']>(
  'PaymentCanceled',
  'The payment was canceled.',
  z.object({ paymentId: id, canceledAt: time }),
  { paymentId, canceledAt: at },
);

export const paymentTimedOut = event<PaymentTimedOut['data']>(
  'PaymentTimedOut',
  'The payment was not authorized in time.',
  z.object({ paymentId: id, timedOutAt: time }),
  { paymentId, timedOutAt: at },
);

export const paymentAuthorizationExpired = event<
  PaymentAuthorizationExpired['data']
>(
  'PaymentAuthorizationExpired',
  'The authorization expired before the capture.',
  z.object({ paymentId: id, expiredAt: time }),
  { paymentId, expiredAt: at },
);

export const authorizePayment = command<AuthorizePayment['data']>(
  'AuthorizePayment',
  'Ask payments to authorize a payment for a reference, such as an order.',
  z.object({ paymentId: id, referenceId: id, amount: z.number() }),
  { paymentId, referenceId: orderId, amount: 39.98 },
);

export const capturePayment = command<CapturePayment['data']>(
  'CapturePayment',
  'Ask payments to capture an authorized payment.',
  idOnly,
  { paymentId },
);

export const cancelPayment = command<CancelPayment['data']>(
  'CancelPayment',
  'Ask payments to cancel a payment.',
  idOnly,
  { paymentId },
);

export const confirmPaymentAuthorization = command<
  ConfirmPaymentAuthorization['data']
>(
  'ConfirmPaymentAuthorization',
  'The payment provider authorized the payment.',
  z.object({ paymentId: id, captureBefore: time }),
  { paymentId, captureBefore: later },
);

export const confirmPaymentCapture = command<ConfirmPaymentCapture['data']>(
  'ConfirmPaymentCapture',
  'The payment provider captured the payment.',
  idOnly,
  { paymentId },
);

export const failPaymentCapture = command<FailPaymentCapture['data']>(
  'FailPaymentCapture',
  'The payment provider could not capture the payment.',
  z.object({ paymentId: id, reason: z.literal('UnexpectedError') }),
  { paymentId, reason: 'UnexpectedError' },
);

export const timeOutPayment = command<TimeOutPayment['data']>(
  'TimeOutPayment',
  'Time out a payment that stayed pending.',
  idOnly,
  { paymentId },
);

export const expirePaymentAuthorization = command<
  ExpirePaymentAuthorization['data']
>(
  'ExpirePaymentAuthorization',
  'Expire an authorization that was not captured in time.',
  idOnly,
  { paymentId },
);

export const recordCheckoutSession = command<RecordCheckoutSession['data']>(
  'RecordCheckoutSession',
  'Record the checkout session of the payment provider.',
  z.object({
    paymentId: id,
    session: z.object({ url: id, expiresAt: time }),
  }),
  {
    paymentId,
    session: { url: 'https://sandbox.example/checkout/1', expiresAt: later },
  },
);

export const paymentAuthorizedExternal = externalEvent<
  Extract<
    PaymentExternalEvent,
    { type: 'payments.external.PaymentAuthorized' }
  >['data']
>(
  'PaymentAuthorized',
  'The payment of a reference was authorized.',
  z.object({ referenceId: id, paymentId: id, authorizedAt: time }),
  { referenceId: orderId, paymentId, authorizedAt: at },
);

export const paymentCapturedExternal = externalEvent<
  Extract<
    PaymentExternalEvent,
    { type: 'payments.external.PaymentCaptured' }
  >['data']
>(
  'PaymentCaptured',
  'The payment of a reference was captured.',
  z.object({ referenceId: id, paymentId: id, capturedAt: time }),
  { referenceId: orderId, paymentId, capturedAt: at },
);

export const paymentFailedExternal = externalEvent<
  Extract<
    PaymentExternalEvent,
    { type: 'payments.external.PaymentFailed' }
  >['data']
>(
  'PaymentFailed',
  'The payment of a reference failed.',
  z.object({ referenceId: id, paymentId: id, failedAt: time }),
  { referenceId: orderId, paymentId, failedAt: at },
);

export const paymentStoredContracts = [
  paymentAuthorizationRequested,
  checkoutSessionCreated,
  paymentAuthorized,
  paymentCaptureRequested,
  paymentCaptured,
  paymentCaptureFailed,
  paymentCanceled,
  paymentTimedOut,
  paymentAuthorizationExpired,
  confirmPaymentAuthorization,
  confirmPaymentCapture,
  failPaymentCapture,
  timeOutPayment,
  expirePaymentAuthorization,
  recordCheckoutSession,
];

export const paymentRequestContracts = [
  authorizePayment,
  capturePayment,
  cancelPayment,
];

export const paymentResponseContracts = [
  paymentAuthorizedExternal,
  paymentCapturedExternal,
  paymentFailedExternal,
];
