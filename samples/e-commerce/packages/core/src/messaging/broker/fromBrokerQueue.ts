import type {
  Message,
  SingleMessageHandlerResult,
  WorkflowProcessorContext,
} from '@event-driven-io/emmett';
import { defaultChannelReaderRetry } from '../channels';
import { retryInHandler, type HandlerRetryOptions } from '../retryInHandler';
import type { ReceivedMessage } from './brokerMessage';
import type { DeadLetters } from './deadLetters';

export type BrokerQueueReader = HandlerRetryOptions & {
  deadLetters: DeadLetters;
};

export const fromBrokerQueue =
  <
    MessageType extends Message = Message,
    HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
  >(
    { deadLetters, retry, signal }: BrokerQueueReader,
    handle: (
      message: ReceivedMessage<MessageType>,
      context: HandlerContext,
    ) => void | Promise<void>,
  ) =>
  async (
    message: ReceivedMessage<MessageType>,
    context: HandlerContext,
  ): Promise<SingleMessageHandlerResult> => {
    try {
      await retryInHandler(async () => handle(message, context), {
        retry: { ...defaultChannelReaderRetry, ...retry },
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;

      await retryInHandler(() => deadLetters.failed(message), { signal });
    }
  };
