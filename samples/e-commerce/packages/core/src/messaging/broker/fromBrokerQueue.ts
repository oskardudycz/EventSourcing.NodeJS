import type {
  Message,
  SingleMessageHandlerResult,
  WorkflowProcessorContext,
} from '@event-driven-io/emmett';
import { defaultChannelReaderRetry } from '../channels';
import { messagingMetrics } from '../messagingMetrics';
import { retryInHandler, type HandlerRetryOptions } from '../retryInHandler';
import { brokerHeaders, type ReceivedMessage } from './brokerMessage';
import type { DeadLetters } from './deadLetters';

export type BrokerQueueReader = HandlerRetryOptions & {
  deadLetters: DeadLetters;
  queue?: string;
};

export const fromBrokerQueue = <
  MessageType extends Message = Message,
  HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
>(
  { deadLetters, queue, retry, signal }: BrokerQueueReader,
  handle: (
    message: ReceivedMessage<MessageType>,
    context: HandlerContext,
  ) => void | Promise<void>,
) => {
  const metrics = messagingMetrics();

  return async (
    message: ReceivedMessage<MessageType>,
    context: HandlerContext,
  ): Promise<SingleMessageHandlerResult> => {
    const destination = queue ?? message.metadata.streamName;

    try {
      await retryInHandler(async () => handle(message, context), {
        retry: { ...defaultChannelReaderRetry, ...retry },
        signal,
      });
      metrics.handled(
        destination,
        message.type,
        message.metadata.headers[brokerHeaders.forwardedAt],
      );
    } catch (error) {
      if (signal?.aborted) throw error;

      metrics.failed(destination, message.type);
      await retryInHandler(() => deadLetters.failed(message), { signal });
    }
  };
};
