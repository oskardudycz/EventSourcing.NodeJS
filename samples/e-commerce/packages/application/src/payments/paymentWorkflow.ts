import { WorkflowHandler, type Workflow } from '@event-driven-io/emmett';
import { isBefore } from '../time';
import {
  evolve,
  initialPayment,
  openCheckoutSession,
  PaymentId,
  type Payment,
  type PaymentEvent,
} from './payment';
import { paymentCommandTypes, type PaymentCommand } from './paymentCommand';

export const paymentWorkflowName = 'payments';

const paymentValidityInMs = 24 * 60 * 60 * 1000;

export type PaymentWorkflowInput = PaymentCommand;
export type PaymentWorkflowOutput = PaymentEvent;

export const paymentEventTypes: PaymentEvent['type'][] = [
  'payments.PaymentAuthorizationRequested',
  'payments.CheckoutSessionCreated',
  'payments.PaymentAuthorized',
  'payments.PaymentCaptureRequested',
  'payments.PaymentCaptured',
  'payments.PaymentCaptureFailed',
  'payments.PaymentCanceled',
  'payments.PaymentTimedOut',
  'payments.PaymentAuthorizationExpired',
];

export const isPaymentEvent = (message: {
  type: string;
}): message is PaymentEvent =>
  paymentEventTypes.some((type) => type === message.type);

const decidePayment = (
  input: PaymentWorkflowInput,
  payment: Payment,
  at: Date,
): PaymentEvent[] => {
  const now = at.toISOString();

  switch (input.type) {
    case 'payments.AuthorizePayment':
      return payment.status !== undefined
        ? []
        : [
            {
              type: 'payments.PaymentAuthorizationRequested',
              data: {
                ...input.data,
                requestedAt: now,
                timesOutAt: new Date(
                  at.getTime() + paymentValidityInMs,
                ).toISOString(),
              },
            },
          ];
    case 'payments.RecordCheckoutSession':
      return payment.status !== 'Pending' || openCheckoutSession(payment, now)
        ? []
        : [
            {
              type: 'payments.CheckoutSessionCreated',
              data: { paymentId: payment.id, ...input.data.session },
            },
          ];
    case 'payments.ConfirmPaymentAuthorization':
      return payment.status !== 'Pending'
        ? []
        : [
            {
              type: 'payments.PaymentAuthorized',
              data: {
                paymentId: payment.id,
                authorizedAt: now,
                captureBefore: input.data.captureBefore,
              },
            },
          ];
    case 'payments.CapturePayment':
      return payment.status !== 'Authorized'
        ? []
        : [
            {
              type: 'payments.PaymentCaptureRequested',
              data: {
                paymentId: payment.id,
                amount: payment.amount,
                requestedAt: now,
              },
            },
          ];
    case 'payments.ConfirmPaymentCapture':
      return payment.status !== 'CaptureRequested'
        ? []
        : [
            {
              type: 'payments.PaymentCaptured',
              data: {
                paymentId: payment.id,
                amount: payment.amount,
                capturedAt: now,
              },
            },
          ];
    case 'payments.FailPaymentCapture':
      return payment.status !== 'CaptureRequested'
        ? []
        : [
            {
              type: 'payments.PaymentCaptureFailed',
              data: {
                paymentId: payment.id,
                reason: input.data.reason,
                failedAt: now,
              },
            },
          ];
    case 'payments.CancelPayment':
      return payment.status !== 'Authorized'
        ? []
        : [
            {
              type: 'payments.PaymentCanceled',
              data: { paymentId: payment.id, canceledAt: now },
            },
          ];
    case 'payments.TimeOutPayment':
      return payment.status !== 'Pending' || isBefore(now, payment.timesOutAt)
        ? []
        : [
            {
              type: 'payments.PaymentTimedOut',
              data: { paymentId: payment.id, timedOutAt: now },
            },
          ];
    case 'payments.ExpirePaymentAuthorization':
      return payment.status !== 'Authorized' ||
        isBefore(now, payment.captureBefore)
        ? []
        : [
            {
              type: 'payments.PaymentAuthorizationExpired',
              data: { paymentId: payment.id, expiredAt: now },
            },
          ];
  }
};

export const paymentWorkflow = ({
  now,
}: {
  now: () => Date;
}): Workflow<PaymentWorkflowInput, Payment, PaymentWorkflowOutput> => ({
  name: paymentWorkflowName,
  decide: (input, payment) => decidePayment(input, payment, now()),
  evolve: (payment, output) =>
    isPaymentEvent(output) ? evolve(payment, output) : payment,
  initialState: initialPayment,
});

export const paymentWorkflowOptions = (now: () => Date) => ({
  workflow: paymentWorkflow({ now }),
  mapWorkflowId: PaymentId.workflowStreamNameOf,
  getWorkflowId: ({ data }: { data: { paymentId: string } }) => data.paymentId,
  inputs: { commands: [...paymentCommandTypes], events: [] },
  outputs: { commands: [], events: paymentEventTypes },
});

export const paymentWorkflowInbox = (now: () => Date) =>
  WorkflowHandler<PaymentWorkflowInput, Payment, PaymentWorkflowOutput>({
    ...paymentWorkflowOptions(now),
    separateInputInboxFromProcessing: true,
  });

export const paymentWorkflowHandler = (now: () => Date) =>
  WorkflowHandler<PaymentWorkflowInput, Payment, PaymentWorkflowOutput>({
    ...paymentWorkflowOptions(now),
    retry: { onVersionConflict: 2 },
  });
