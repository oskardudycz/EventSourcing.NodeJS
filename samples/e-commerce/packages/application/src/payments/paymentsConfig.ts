import {
  messageRoutes,
  routeChannel,
  routeKey,
  Urns,
  type ForwardedMessage,
} from '@e-commerce/core';
import {
  paymentExternalEventTypes,
  type PaymentExternalEvent,
} from './external/paymentExternalEvent';
import {
  paymentRequestTypes,
  type ExpirePaymentAuthorization,
  type PaymentRequest,
  type TimeOutPayment,
} from './paymentCommand';

export const paymentsRequestsChannel = 'payments-requests';
export const paymentsResponsesChannel = 'payments-responses';

export const paymentsChannels = [
  paymentsRequestsChannel,
  paymentsResponsesChannel,
];

export const paymentsRequestsQueue = 'payments-requests';
export const paymentsInternalChannel = 'payments-internal';
export const paymentsInternalQueue = 'payments-internal';

const isPaymentInternal = (message: { type: string }) =>
  message.type === 'payments.TimeOutPayment' ||
  message.type === 'payments.ExpirePaymentAuthorization';

export const paymentsInternalRoutes = messageRoutes<
  ForwardedMessage<TimeOutPayment | ExpirePaymentAuthorization>
>(
  routeChannel<ForwardedMessage<TimeOutPayment | ExpirePaymentAuthorization>>(
    isPaymentInternal,
    paymentsInternalChannel,
  ),
  routeKey<ForwardedMessage<TimeOutPayment | ExpirePaymentAuthorization>>(
    isPaymentInternal,
    (message) => Urns.routingKeyOf(message.data.paymentId),
  ),
);

export const paymentsSubscriptions = {
  internal: {
    channel: paymentsInternalChannel,
    queue: paymentsInternalQueue,
  },
  requests: {
    channel: paymentsRequestsChannel,
    queue: paymentsRequestsQueue,
  },
};

const isPaymentRequest = (message: { type: string }) =>
  paymentRequestTypes.some((type) => type === message.type);

const isPaymentResponse = (message: { type: string }) =>
  paymentExternalEventTypes.some((type) => type === message.type);

export const paymentsRequestRoutes = messageRoutes<
  ForwardedMessage<PaymentRequest>
>(
  routeChannel<ForwardedMessage<PaymentRequest>>(
    isPaymentRequest,
    paymentsRequestsChannel,
  ),
  routeKey<ForwardedMessage<PaymentRequest>>(isPaymentRequest, (message) =>
    Urns.routingKeyOf(message.data.paymentId),
  ),
);

export const paymentsResponseRoutes = messageRoutes<
  ForwardedMessage<PaymentExternalEvent>
>(
  routeChannel<ForwardedMessage<PaymentExternalEvent>>(
    isPaymentResponse,
    paymentsResponsesChannel,
  ),
  routeKey<ForwardedMessage<PaymentExternalEvent>>(
    isPaymentResponse,
    (message) => Urns.routingKeyOf(message.data.referenceId),
  ),
);
