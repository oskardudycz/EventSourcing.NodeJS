import {
  externalMessageId,
  getForwarderId,
  type ForwardedMessage,
  type ForwardingHandler,
  type ForwardTo,
  type HandlerRetryOptions,
} from '@e-commerce/core';
import type {
  RecordedMessage,
  WorkflowProcessorContext,
} from '@event-driven-io/emmett';
import { initialPayment, PaymentId, type PaymentEvent } from '../payment';
import { evolvePaymentWorkflow } from '../paymentWorkflow';
import {
  paymentsResponseRoutes,
  paymentsResponsesChannel,
} from '../paymentsConfig';
import type { PaymentExternalEvent } from './paymentExternalEvent';

export const paymentsExternalForwarderId = getForwarderId({
  name: 'payments-external',
});

export const paymentForwarderTypes = [
  'payments.PaymentAuthorized',
  'payments.PaymentCaptured',
  'payments.PaymentCaptureFailed',
  'payments.PaymentTimedOut',
  'payments.PaymentAuthorizationExpired',
] as const;

const toExternalEvents = async (
  event: RecordedMessage<PaymentEvent>,
  context: WorkflowProcessorContext,
): Promise<ForwardedMessage<PaymentExternalEvent>[]> => {
  if (!paymentForwarderTypes.some((forwarded) => forwarded === event.type))
    return [];

  const { paymentId } = event.data;
  const {
    state: { referenceId },
  } = await context.session.messageStore.aggregateStream(
    PaymentId.workflowStreamNameOf(paymentId),
    { evolve: evolvePaymentWorkflow, initialState: initialPayment },
  );
  const metadataOf = (type: PaymentExternalEvent['type']) => ({
    messageId: externalMessageId(event.metadata.messageId, type),
    correlationId: event.metadata.correlationId,
    causationId: event.metadata.messageId,
  });
  const failedAt = (at: string): ForwardedMessage<PaymentExternalEvent> => ({
    type: 'payments.external.PaymentFailed',
    data: { referenceId, paymentId, failedAt: at },
    metadata: metadataOf('payments.external.PaymentFailed'),
  });

  switch (event.type) {
    case 'payments.PaymentAuthorized':
      return [
        {
          type: 'payments.external.PaymentAuthorized',
          data: {
            referenceId,
            paymentId,
            authorizedAt: event.data.authorizedAt,
          },
          metadata: metadataOf('payments.external.PaymentAuthorized'),
        },
      ];
    case 'payments.PaymentCaptured':
      return [
        {
          type: 'payments.external.PaymentCaptured',
          data: { referenceId, paymentId, capturedAt: event.data.capturedAt },
          metadata: metadataOf('payments.external.PaymentCaptured'),
        },
      ];
    case 'payments.PaymentCaptureFailed':
      return [failedAt(event.data.failedAt)];
    case 'payments.PaymentTimedOut':
      return [failedAt(event.data.timedOutAt)];
    case 'payments.PaymentAuthorizationExpired':
      return [failedAt(event.data.expiredAt)];
    default:
      return [];
  }
};

export const paymentExternalEventForwarder = ({
  forward,
  ...retry
}: HandlerRetryOptions & {
  forward: ForwardTo;
}): ForwardingHandler<PaymentEvent> =>
  forward<PaymentEvent, PaymentExternalEvent>({
    channels: [paymentsResponsesChannel],
    routes: [paymentsResponseRoutes],
    map: toExternalEvents,
    ...retry,
  });
