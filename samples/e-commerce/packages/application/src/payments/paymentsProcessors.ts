import { isInAChannelStream, toWorkflowInbox } from '@e-commerce/core';
import type { Logger } from 'pino';
import type { ChannelReading } from '../messagingBus';
import type { ModuleConsumer } from '../moduleConsumer';
import { authorizationGatewayClient } from './authorization/authorizationGatewayClient';
import { captureGatewayClient } from './capture/captureGatewayClient';
import type { Payment } from './payment';
import {
  paymentRequestTypes,
  type ExpirePaymentAuthorization,
  type PaymentRequest,
  type TimeOutPayment,
} from './paymentCommand';
import type { PaymentGateway } from './paymentGateway';
import {
  paymentWorkflowInbox,
  paymentWorkflowOptions,
  type PaymentWorkflowInput,
  type PaymentWorkflowOutput,
} from './paymentWorkflow';
import { paymentsSubscriptions } from './paymentsConfig';

type PaymentsConsumer = ModuleConsumer;

type PaymentsProcessorsOptions = {
  now: () => Date;
  gateway: PaymentGateway;
  logger: Logger;
};

export const registerPaymentsProcessors = (
  payments: PaymentsConsumer,
  { gateway, logger, now }: PaymentsProcessorsOptions,
) => {
  const clientOptions = {
    gateway,
    logger,
  };
  const capture = captureGatewayClient(clientOptions);
  const authorization = authorizationGatewayClient(clientOptions);

  payments.workflowProcessor<
    PaymentWorkflowInput,
    Payment,
    PaymentWorkflowOutput
  >({
    ...paymentWorkflowOptions(now),
    separateInputInboxFromProcessing: true,
    processorId: 'payments-workflow',
    getWorkflowId: (message) =>
      isInAChannelStream(message) ? null : message.data.paymentId,
    outputHandler: {
      canHandle: [
        'payments.PaymentCaptureRequested',
        'payments.PaymentCanceled',
        'payments.PaymentTimedOut',
      ],
      eachBatch: async (messages): Promise<PaymentWorkflowInput[]> => {
        const answers: PaymentWorkflowInput[] = [];

        for (const message of messages)
          switch (message.type) {
            case 'payments.PaymentCaptureRequested':
              answers.push(...(await capture(message)));
              break;
            case 'payments.PaymentCanceled':
            case 'payments.PaymentTimedOut':
              await authorization(message);
              break;
          }

        return answers;
      },
    },
  });
};

export const registerPaymentsChannelReaders = (
  read: ChannelReading,
  { now }: { now: () => Date },
) => {
  read<PaymentRequest>({
    subscription: paymentsSubscriptions.requests,
    canHandle: [...paymentRequestTypes],
    handle: toWorkflowInbox(paymentWorkflowInbox(now)),
  });
};

export const registerPaymentsInternalReader = (
  read: ChannelReading,
  { now }: { now: () => Date },
) => {
  read<TimeOutPayment | ExpirePaymentAuthorization>({
    subscription: paymentsSubscriptions.internal,
    canHandle: [
      'payments.TimeOutPayment',
      'payments.ExpirePaymentAuthorization',
    ],
    handle: toWorkflowInbox(paymentWorkflowInbox(now)),
  });
};
