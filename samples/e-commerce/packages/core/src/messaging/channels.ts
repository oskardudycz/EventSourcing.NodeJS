import { messagingMetrics } from './messagingMetrics';
import {
  MessageProcessor,
  type AnyCommand,
  type AnyEvent,
  type AnyRecordedMessageMetadata,
  type AsyncRetryOptions,
  type CombineMetadata,
  type Event,
  type EventStore,
  type Message,
  type RecordedMessage,
  type SingleMessageHandlerResult,
  type WorkflowProcessorContext,
} from '@event-driven-io/emmett';
import { matchesBindingKey } from './bindingKeys';
import { retryInHandler, type HandlerRetryOptions } from './retryInHandler';

export const channelStreamPrefix = 'channel:';

export const channelStreamName = (channel: string) =>
  `${channelStreamPrefix}${channel}`;

export const isInternalChannel = (channel: string) =>
  channel.endsWith('-internal');

export const deadLetterStreamName = (queue: string) =>
  channelStreamName(`${queue}-dlq`);

export const isInAChannelStream = (message: object): boolean =>
  'metadata' in message &&
  typeof message.metadata === 'object' &&
  message.metadata !== null &&
  'streamName' in message.metadata &&
  typeof message.metadata.streamName === 'string' &&
  message.metadata.streamName.startsWith(channelStreamPrefix);

export type ChannelMessageMetadata = { key?: string };

export type ForwardedMessageMetadata = {
  messageId: string;
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  spanId?: string;
  forwardedAt?: string;
};

export type ForwardedMessage<MessageType extends Message = Message> =
  CombineMetadata<MessageType, ForwardedMessageMetadata>;

export const appendToChannelStream = <MessageType extends Message>(
  store: EventStore,
  streamName: string,
  message: ForwardedMessage<MessageType>,
  key: string | undefined,
) => appendMessagesToChannelStream(store, streamName, [{ message, key }]);

export const appendMessagesToChannelStream = <MessageType extends Message>(
  store: EventStore,
  streamName: string,
  messages: {
    message: ForwardedMessage<MessageType>;
    key: string | undefined;
  }[],
) =>
  store.appendToStream(
    streamName,
    messages.map(
      ({ message: { type, data, kind, metadata }, key }) =>
        ({
          type,
          data,
          kind,
          metadata: {
            messageId: metadata.messageId,
            correlationId: metadata.correlationId,
            causationId: metadata.causationId,
            forwardedAt: metadata.forwardedAt,
            key,
          },
          // Emmett's appendToStream takes only events, while a stream can carry commands too; Emmett casts the same way when it stores workflow outputs.
        }) as Event,
    ),
  );

export type ChannelSubscription = {
  channel: string;
  queue: string;
  bindingKey?: string;
};

export const defaultChannelReaderRetry: AsyncRetryOptions = {
  forever: false,
  retries: 2,
  factor: 2,
  minTimeout: 1000,
  maxTimeout: 30_000,
};

export const isDeliveredThrough = (
  {
    channel,
    bindingKey = '#',
  }: Pick<ChannelSubscription, 'channel' | 'bindingKey'>,
  message: RecordedMessage<
    Message,
    AnyRecordedMessageMetadata & ChannelMessageMetadata
  >,
): boolean =>
  message.metadata.streamName === channelStreamName(channel) &&
  matchesBindingKey(bindingKey, message.metadata.key ?? '');

const forwardedAtOf = (metadata: object): string | undefined =>
  'forwardedAt' in metadata && typeof metadata.forwardedAt === 'string'
    ? metadata.forwardedAt
    : undefined;

export const fromChannel =
  <
    MessageType extends Message,
    MetadataType extends AnyRecordedMessageMetadata =
      AnyRecordedMessageMetadata,
    HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
  >(
    {
      channel,
      queue,
      bindingKey,
      retry,
      signal,
    }: ChannelSubscription & HandlerRetryOptions,
    handle: (
      message: RecordedMessage<
        MessageType,
        MetadataType & ChannelMessageMetadata
      >,
      context: HandlerContext,
    ) => void | Promise<void>,
  ) =>
  async (
    message: RecordedMessage<
      MessageType,
      MetadataType & ChannelMessageMetadata
    >,
    context: HandlerContext,
  ): Promise<SingleMessageHandlerResult> => {
    if (!isDeliveredThrough({ channel, bindingKey }, message))
      return MessageProcessor.result.skip({
        reason: `Not delivered through channel '${channel}'`,
      });

    const metrics = messagingMetrics();

    try {
      await retryInHandler(async () => handle(message, context), {
        retry: { ...defaultChannelReaderRetry, ...retry },
        signal,
      });
      metrics.handled(queue, message.type, forwardedAtOf(message.metadata));
    } catch (error) {
      if (signal?.aborted) throw error;

      metrics.failed(queue, message.type);
      await appendToChannelStream(
        context.session.messageStore,
        deadLetterStreamName(queue),
        message,
        message.metadata.key,
      );
      metrics.deadLettered(queue, message.type);
    }
  };

export const toWorkflowInbox =
  <
    Input extends AnyEvent | AnyCommand,
    MetadataType extends AnyRecordedMessageMetadata =
      AnyRecordedMessageMetadata,
  >(
    storeInInbox: (
      store: EventStore,
      message: RecordedMessage<Input, MetadataType>,
    ) => Promise<unknown>,
  ) =>
  async (
    message: RecordedMessage<Input, MetadataType>,
    context: WorkflowProcessorContext,
  ): Promise<void> => {
    await storeInInbox(context.session.messageStore, message);
  };
