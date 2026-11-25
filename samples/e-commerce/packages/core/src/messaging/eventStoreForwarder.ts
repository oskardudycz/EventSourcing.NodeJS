import { messagingMetrics, stampedAsForwarded } from './messagingMetrics';
import type {
  AnyRecordedMessageMetadata,
  EventStore,
  Message,
  RecordedMessage,
  WorkflowProcessorContext,
} from '@event-driven-io/emmett';
import {
  appendMessagesToChannelStream,
  channelStreamName,
  isInAChannelStream,
  type ForwardedMessage,
} from './channels';
import { messageRouter, type MessageRoutes } from './messageRoutes';
import { retryInHandler, type HandlerRetryOptions } from './retryInHandler';

type ForwardingBaseOptions = HandlerRetryOptions & {
  channels: readonly string[];
  storeOf?: (channel: string) => EventStore | undefined;
};

export type ForwardingOptions<
  Input extends Message,
  Outgoing extends Message,
  MetadataType extends AnyRecordedMessageMetadata = AnyRecordedMessageMetadata,
  HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
> = ForwardingBaseOptions & {
  routes: readonly MessageRoutes<ForwardedMessage<Outgoing>>[];
  map: (
    message: RecordedMessage<Input, MetadataType>,
    context: HandlerContext,
  ) => ForwardedMessage<Outgoing>[] | Promise<ForwardedMessage<Outgoing>[]>;
};

export type ForwardingAsItIsOptions<Input extends Message> =
  ForwardingBaseOptions & {
    routes: readonly MessageRoutes<ForwardedMessage<Input>>[];
    map?: never;
  };

export type ForwardingHandler<
  Input extends Message,
  MetadataType extends AnyRecordedMessageMetadata = AnyRecordedMessageMetadata,
  HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
> = (
  messages: RecordedMessage<Input, MetadataType>[],
  context: HandlerContext,
) => Promise<void>;

export type RoutedMessage = {
  source: RecordedMessage<Message, AnyRecordedMessageMetadata>;
  forwarded: ForwardedMessage;
  channel: string;
  key: string | undefined;
};

export const routedBatchOf = async <
  Input extends Message,
  MetadataType extends AnyRecordedMessageMetadata,
  HandlerContext extends WorkflowProcessorContext,
>(
  messages: RecordedMessage<Input, MetadataType>[],
  context: HandlerContext,
  map: (
    message: RecordedMessage<Input, MetadataType>,
    context: HandlerContext,
  ) => ForwardedMessage[] | Promise<ForwardedMessage[]>,
  router: {
    declaredRouteFor: (message: ForwardedMessage) => {
      channel: string;
      key: string | undefined;
    };
  },
): Promise<RoutedMessage[]> => {
  const routed: RoutedMessage[] = [];

  for (const message of messages) {
    if (isInAChannelStream(message)) continue;

    for (const forwarded of await map(message, context)) {
      const { channel, key } = router.declaredRouteFor(forwarded);

      routed.push({
        source: message,
        forwarded: stampedAsForwarded(forwarded),
        channel,
        key,
      });
    }
  }

  return routed;
};

const byChannel = (routed: RoutedMessage[]) => {
  const groups = new Map<string, RoutedMessage[]>();

  for (const message of routed)
    groups.set(message.channel, [
      ...(groups.get(message.channel) ?? []),
      message,
    ]);

  return groups;
};

export const getForwarderId = (options: { name: string }): string =>
  `emt:processor:forwarder:${options.name}`;

export function forwardToChannels<Input extends Message>(
  options: ForwardingAsItIsOptions<Input>,
): ForwardingHandler<Input>;
export function forwardToChannels<
  Input extends Message,
  Outgoing extends Message,
  MetadataType extends AnyRecordedMessageMetadata = AnyRecordedMessageMetadata,
  HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
>(
  options: ForwardingOptions<Input, Outgoing, MetadataType, HandlerContext>,
): ForwardingHandler<Input, MetadataType, HandlerContext>;
export function forwardToChannels({
  channels,
  routes,
  storeOf = () => undefined,
  map = (message) => [message],
  retry,
  signal,
}:
  | ForwardingOptions<Message, Message>
  | ForwardingAsItIsOptions<Message>): ForwardingHandler<Message> {
  const router = messageRouter(routes, channels);
  const metrics = messagingMetrics();

  return (messages, context) =>
    retryInHandler(
      async () => {
        const routed = await routedBatchOf(messages, context, map, router);

        for (const [channel, inChannel] of byChannel(routed)) {
          await appendMessagesToChannelStream(
            storeOf(channel) ?? context.session.messageStore,
            channelStreamName(channel),
            inChannel.map(({ forwarded, key }) => ({
              message: forwarded,
              key,
            })),
          );
          for (const { forwarded } of inChannel)
            metrics.published(channel, forwarded.type);
        }
      },
      { retry, signal },
    );
}

export type ForwardTo = {
  <Input extends Message>(
    options: ForwardingAsItIsOptions<Input>,
  ): ForwardingHandler<Input>;
  <
    Input extends Message,
    Outgoing extends Message,
    MetadataType extends AnyRecordedMessageMetadata =
      AnyRecordedMessageMetadata,
    HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
  >(
    options: ForwardingOptions<Input, Outgoing, MetadataType, HandlerContext>,
  ): ForwardingHandler<Input, MetadataType, HandlerContext>;
};

export const forwardingToChannels = (
  storeOf: (channel: string) => EventStore | undefined,
): ForwardTo => {
  function forward<Input extends Message>(
    options: ForwardingAsItIsOptions<Input>,
  ): ForwardingHandler<Input>;
  function forward<
    Input extends Message,
    Outgoing extends Message,
    MetadataType extends AnyRecordedMessageMetadata =
      AnyRecordedMessageMetadata,
    HandlerContext extends WorkflowProcessorContext = WorkflowProcessorContext,
  >(
    options: ForwardingOptions<Input, Outgoing, MetadataType, HandlerContext>,
  ): ForwardingHandler<Input, MetadataType, HandlerContext>;
  function forward(
    options:
      ForwardingOptions<Message, Message> | ForwardingAsItIsOptions<Message>,
  ): ForwardingHandler<Message> {
    return options.map
      ? forwardToChannels<Message, Message>({ ...options, storeOf })
      : forwardToChannels<Message>({ ...options, storeOf });
  }

  return forward;
};
